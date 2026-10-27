import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { loadMatchContext } from "@/lib/help-desk/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";
import { anthropicClient } from "@/lib/ai/usage";

/**
 * Sorts help desk tickets into request types ("photo change", "staff
 * update"...) and writes a few-word gist of each, so the report can say what a
 * client keeps asking for without anyone reading thousands of tickets.
 *
 * Only tickets that matched a *current* client and were opened in the last
 * two years are sorted. The help desk goes back to 2013 and most of it is
 * former clients and noise; sorting all 38,000 tickets took hours to answer a
 * question about what current clients ask for now.
 *
 * The list is a first cut, meant to be revised once the real mix is visible.
 * Changing it only affects tickets categorized afterwards; to re-sort old
 * ones, clear categorized_at on zendesk_tickets.
 */

/** How far back "what they ask for" looks. */
export const CATEGORIZE_YEARS = 2;

/** ISO timestamp: tickets opened on or after this are categorized. */
export function categorizeCutoff(now: Date = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - CATEGORIZE_YEARS);
  return cutoff.toISOString();
}

// Haiku since 2026-10-27 (was Opus 5.5, with an Opus 4.8 fallback): sorting
// into a fixed list of 16 labels is a small-model job, at ~1/40th the price.
export const CATEGORIZE_MODEL = "claude-haiku-5-5";

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

const BATCH_SIZE = 50;
/** Batches sent at once. Each takes tens of seconds; several overlap. */
const CONCURRENCY = 8;

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
  const message = await client.messages.parse({
    model: CATEGORIZE_MODEL,
    max_tokens: 16000,
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

export type CategorizeResult = { done: boolean; categorized: number; remaining: number; inScope: number };

/**
 * Categorizes the in-scope tickets (current clients, last two years) that are
 * not done yet, until `deadline`. Call again until `done`.
 */
export async function categorizeTickets(deadline: number): Promise<CategorizeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const admin = createAdminClient();
  const client = anthropicClient("Help Desk ticket sorting");

  const context = await loadMatchContext(admin);
  const cutoff = categorizeCutoff();
  const inScope = context.tickets.filter((t) => {
    const match = context.matches.get(t.id);
    return Boolean(match?.practice && !match.practice.former && t.createdAt && t.createdAt >= cutoff);
  });
  // Newest first, so a partial run covers the most recent requests.
  const pending = inScope
    .filter((t) => !t.categorized)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map((t) => t.id);

  let categorized = 0;
  // Ids a batch came back without, so one stubborn ticket cannot loop forever.
  const skipped = new Set<number>();
  let cursor = 0;

  // Leave room for a round of batches to finish inside the function's limit.
  while (cursor < pending.length && Date.now() < deadline - 90_000) {
    const ids = pending.slice(cursor, cursor + BATCH_SIZE * CONCURRENCY);
    cursor += ids.length;
    const { data, error } = await admin.from("zendesk_tickets").select("id, subject, description").in("id", ids);
    if (error) throw new Error(`zendesk_tickets: ${error.message}`);
    const round = (data ?? []) as TicketToCategorize[];

    const batches: TicketToCategorize[][] = [];
    for (let i = 0; i < round.length; i += BATCH_SIZE) batches.push(round.slice(i, i + BATCH_SIZE));
    const verdicts = (await Promise.all(batches.map((batch) => categorizeBatch(client, batch)))).flat();

    const answered = new Set(verdicts.map((v) => v.id));
    for (const id of ids) if (!answered.has(id)) skipped.add(id);

    // One write per round. Only these columns are sent, so the rest of each
    // ticket row is left as it is.
    const now = new Date().toISOString();
    if (verdicts.length) {
      const { error: saveError } = await admin.from("zendesk_tickets").upsert(
        verdicts.map((v) => ({ id: v.id, category: v.category, gist: v.gist.slice(0, 200), categorized_at: now })),
        { onConflict: "id" },
      );
      if (saveError) throw new Error(`zendesk_tickets: ${saveError.message}`);
    }
    categorized += verdicts.length;
  }

  const remaining = pending.length - categorized;
  return { done: remaining <= skipped.size, categorized, remaining, inScope: inScope.length };
}
