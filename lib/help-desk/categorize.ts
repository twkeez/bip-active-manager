import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";

/**
 * Sorts help desk tickets into request types ("photo change", "staff
 * update"...) and writes a few-word gist of each, so the report can say what a
 * client keeps asking for without anyone reading thousands of tickets.
 *
 * The list is a first cut, meant to be revised once the real mix is visible.
 * Changing it only affects tickets categorized afterwards; to re-sort old
 * ones, clear categorized_at on zendesk_tickets.
 */

export const CATEGORIZE_MODEL = "claude-opus-5-5";
/** If the main model declines a batch, the API re-runs it on this one. */
const FALLBACK_MODEL = "claude-opus-4-8";

export const TICKET_CATEGORIES = [
  "Photo / image change",
  "Text / content update",
  "Staff or doctor update",
  "Hours, contact or location info",
  "Design / layout change",
  "Promotion or announcement",
  "New page or feature request",
  "Forms",
  "Site down or broken",
  "Domain, DNS or email",
  "Google, SEO or listings",
  "Access or login help",
  "Billing or account",
  "Question / how-to",
  "Not a request (spam, auto-reply, thank-you)",
  "Other",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

const BATCH_SIZE = 40;
/** Batches sent at once. Each takes tens of seconds; several overlap. */
const CONCURRENCY = 4;

const schema = {
  type: "object",
  properties: {
    tickets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          category: { type: "string", enum: [...TICKET_CATEGORIES] },
          gist: { type: "string" },
        },
        required: ["id", "category", "gist"],
        additionalProperties: false,
      },
    },
  },
  required: ["tickets"],
  additionalProperties: false,
} as const;

const outputFormat = jsonSchemaOutputFormat(schema);

type TicketToCategorize = { id: number; subject: string | null; description: string | null };
type Verdict = { id: number; category: TicketCategory; gist: string };

export function buildCategorizePrompt(tickets: TicketToCategorize[]): string {
  const items = tickets
    .map((t) =>
      [
        `--- id: ${t.id}`,
        `subject: ${t.subject ?? "(none)"}`,
        `message: ${(t.description ?? "(none)").slice(0, 800)}`,
      ].join("\n"),
    )
    .join("\n\n");

  return `These are help desk tickets sent to Beyond Indigo Pets, an agency that builds and maintains websites for veterinary practices. Each one is from a practice asking for something.

For each ticket, choose the category that best describes what the practice is asking for, and write a gist: what they want, in at most 10 words, written for an account manager scanning a list (e.g. "Swap homepage hero photo", "Add Dr. Patel to staff page", "Holiday hours banner for Thanksgiving").

Categories:
${TICKET_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Guidance:
- Choose by what they want done, not by the words they use. "Update our team page with this photo of Dr. Lee" is a staff update.
- When a ticket asks for several things, choose the main one and mention the rest in the gist if there is room.
- Never put passwords, login details, phone numbers or other personal details in the gist, even if the ticket contains them.

Return one entry for every id given, and no others.

${items}`;
}

async function categorizeBatch(client: Anthropic, tickets: TicketToCategorize[]): Promise<Verdict[]> {
  const message = await client.beta.messages.parse({
    model: CATEGORIZE_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
    // Sorting into a fixed list does not need deep thought.
    output_config: { effort: "low", format: outputFormat },
    messages: [{ role: "user", content: stripLoneSurrogates(buildCategorizePrompt(tickets)) }],
  });
  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to categorize a batch of tickets.");
  }
  const parsed = message.parsed_output as { tickets?: Verdict[] } | null;
  const asked = new Set(tickets.map((t) => t.id));
  // A made-up id would otherwise label an unrelated ticket.
  return (parsed?.tickets ?? []).filter((v) => asked.has(v.id));
}

export type CategorizeResult = { done: boolean; categorized: number; remaining: number };

/** Categorizes uncategorized tickets until `deadline`. Call again until `done`. */
export async function categorizeTickets(deadline: number): Promise<CategorizeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const admin = createAdminClient();
  const client = new Anthropic();
  let categorized = 0;
  // Ids a batch came back without, so one stubborn ticket cannot loop forever.
  const skipped = new Set<number>();

  // Leave room for a round of batches to finish inside the function's limit.
  while (Date.now() < deadline - 90_000) {
    let query = admin
      .from("zendesk_tickets")
      .select("id, subject, description")
      .is("categorized_at", null)
      .order("id", { ascending: false })
      .limit(BATCH_SIZE * CONCURRENCY);
    if (skipped.size) query = query.not("id", "in", `(${[...skipped].join(",")})`);
    const { data, error } = await query;
    if (error) throw new Error(`zendesk_tickets: ${error.message}`);
    const pending = (data ?? []) as TicketToCategorize[];
    if (pending.length === 0) break;

    const batches: TicketToCategorize[][] = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));
    const results = await Promise.all(batches.map((batch) => categorizeBatch(client, batch)));

    const now = new Date().toISOString();
    const verdicts = results.flat();
    const answered = new Set(verdicts.map((v) => v.id));
    for (const ticket of pending) if (!answered.has(ticket.id)) skipped.add(ticket.id);

    for (const verdict of verdicts) {
      const { error: updateError } = await admin
        .from("zendesk_tickets")
        .update({ category: verdict.category, gist: verdict.gist.slice(0, 200), categorized_at: now })
        .eq("id", verdict.id);
      if (updateError) throw new Error(`zendesk_tickets: ${updateError.message}`);
    }
    categorized += verdicts.length;
  }

  const { count, error } = await admin
    .from("zendesk_tickets")
    .select("id", { count: "exact", head: true })
    .is("categorized_at", null);
  if (error) throw new Error(`zendesk_tickets: ${error.message}`);
  const remaining = count ?? 0;
  return { done: remaining === 0 || remaining <= skipped.size, categorized, remaining };
}
