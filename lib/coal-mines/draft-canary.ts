import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";

/**
 * Turning "tell me when X" into a canary.
 *
 * The hard part is not the SQL, it is the conventions that make the result
 * readable on the board: a query that returns the problem rows and nothing
 * else, a column that names each row, and two headlines — one for the quiet
 * case and one for the loud one. A canary that answers correctly but reports
 * "12 rows" has not actually told anybody anything.
 *
 * "understanding" and "caveats" exist so the person who typed the instruction
 * can check the check. They are not decoration: the failure mode here is a
 * query that runs cleanly and answers a subtly different question, and the only
 * defence against that is saying plainly what it decided to look for.
 */

export const DRAFT_MODEL = "claude-opus-5";

/**
 * Generous, because adaptive thinking spends from the same budget as the
 * answer. The first version allowed 4000, which was ample in a test against a
 * three-table catalogue and nowhere near enough against the real one — a
 * hundred tables is a lot to think about, and the JSON was cut off mid-string
 * around 3000 characters. The symptom was an unterminated-JSON parse error,
 * which says nothing about the actual cause.
 */
const MAX_TOKENS = 24_000;

/** The draft ran out of room. Recoverable by asking for something narrower. */
export class DraftTruncatedError extends Error {}

export type CanaryDraft = {
  name: string;
  watches: string;
  sql: string;
  headlineNone: string;
  headlineSome: string;
  itemLabelColumn: string;
  itemMetaColumns: string[];
  hrefTemplate: string | null;
  severity: "attention" | "overdue";
  understanding: string;
  caveats: string[];
};

const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    watches: { type: "string" },
    sql: { type: "string" },
    headlineNone: { type: "string" },
    headlineSome: { type: "string" },
    itemLabelColumn: { type: "string" },
    itemMetaColumns: { type: "array", items: { type: "string" } },
    hrefTemplate: { type: ["string", "null"] },
    severity: { type: "string", enum: ["attention", "overdue"] },
    understanding: { type: "string" },
    caveats: { type: "array", items: { type: "string" } },
  },
  required: [
    "name",
    "watches",
    "sql",
    "headlineNone",
    "headlineSome",
    "itemLabelColumn",
    "itemMetaColumns",
    "hrefTemplate",
    "severity",
    "understanding",
    "caveats",
  ],
  additionalProperties: false,
} as const;

export const canaryDraftOutputFormat = jsonSchemaOutputFormat(schema);

export function buildDraftPrompt(instruction: string, catalogue: string): string {
  return `You are writing a monitoring check ("canary") for the internal ops app of Beyond Indigo Pets, a marketing agency whose clients are veterinary practices. Somebody has described in plain language something they want watched. Turn it into a read-only SQL query and the copy needed to report it.

THE INSTRUCTION
${instruction}

DATABASE (PostgreSQL, schema "public")
${catalogue}

HOW THIS DOMAIN WORKS — get these wrong and the query is confidently incorrect:
- A client's services are the text columns seo, ppc, smm, orm and blog on "clients". They hold the tier or amount bought, NOT a boolean: 'Foundation', 'Premium', 'Premium Plus', or for blog a number of posts a month.
- A service is NOT bought when the value is null, empty, or one of: 'N', 'No', 'None', '0', 'false', 'NA', 'N/A', '#N/A' (compare case-insensitively). Anything else means they buy it. Never test for = 'Y'.
- clients.onboarding_status = 'active' means mid-onboarding, not "is a live client".
- clients.is_low_contact marks deliberately quiet accounts and clients.is_website_only marks website-build-only accounts — 154 of 248 clients. Exclude website-only clients from anything about marketing delivery unless the instruction says otherwise.
- Ads data: client_ads_snapshots, one row per sync attempt, run_status 'completed' | 'failed' | 'running' — 'completed', never 'success'. Use the newest completed row per client. Money is in cost_micros inside the totals jsonb (divide by 1000000).
- Basecamp messages are in basecamp_communication_events, one row per thread event, with client_id nullable because projects are monitored whether or not a client record exists.

RULES FOR THE QUERY
- One statement. It must begin with SELECT or WITH. No semicolons, no comments, no CTE that writes.
- Return ONLY the rows that are a problem. Zero rows means all clear — that is how the canary reports good news, so never return a status column saying "ok".
- Return at most a few hundred rows. If the instruction would match most of the roster, tighten it and say so in caveats.
- Include a column that names each row for a human: usually clients.account_name. Include clients.id as client_id when the rows are clients, so the board can link to them.
- Include the numbers that justify the finding — days overdue, spend, a date — as extra columns, and round or format them so they read well.
- Use now() and intervals for dates. Prefer explicit column lists over select *.
- Order the worst offenders first.

RULES FOR THE COPY
- "name": two to four words, what it watches. Not a sentence.
- "watches": one sentence, plain language, describing what would have to be true for this to fire. Written for someone who did not write the instruction.
- "headlineNone": the all-clear line, stated as a positive fact. Use {count} for the number of rows checked only if your query cannot tell you that — usually just state the good news.
- "headlineSome": the alarm line. Use {count} where the number of findings goes.
- "itemLabelColumn": the result column that names each row.
- "itemMetaColumns": the other columns worth showing under the name, in order. Keep it to three at most.
- "hrefTemplate": where to go and fix it, with {column} substituted per row — normally "/dashboard/clients/{client_id}" when the rows are clients, otherwise null.
- "severity": "overdue" when a finding means a promise to a client is already being broken; "attention" when it is a question worth asking.
- "understanding": one short paragraph saying in plain English exactly what the query looks for, including every threshold and exclusion you chose. The person reading it will not read the SQL, and this is how they catch you answering the wrong question.
- "caveats": the assumptions you had to make, and anything the instruction asked for that the data cannot actually answer. Be honest and specific. An empty list is fine only when there genuinely were none.

If the instruction cannot be answered from these tables at all, still return your best attempt, and say plainly in the first caveat what is missing.`;
}

/** Drafts a canary. Throws if Claude declines or returns nothing usable. */
export async function draftCanary(
  instruction: string,
  catalogue: string,
): Promise<CanaryDraft> {
  const client = new Anthropic();
  // Streamed rather than awaited whole: at this budget a single response can
  // run long enough to bump the request timeout, and the stream keeps hold of
  // the partial message so a failure can say why it failed.
  const stream = client.messages.stream({
    model: DRAFT_MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: stripLoneSurrogates(buildDraftPrompt(instruction, catalogue)),
      },
    ],
    output_config: { format: canaryDraftOutputFormat },
  });

  let message;
  try {
    message = await stream.finalMessage();
  } catch (error) {
    // Truncated JSON fails to parse inside the helper, so the only way to tell
    // "ran out of room" from "genuinely malformed" is the partial message.
    if (stream.currentMessage?.stop_reason === "max_tokens") {
      throw new DraftTruncatedError(
        "The check ran past the length limit while being written. Try a narrower instruction — one condition rather than several.",
      );
    }
    throw error;
  }

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to write this check.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new DraftTruncatedError(
      "The check ran past the length limit while being written. Try a narrower instruction — one condition rather than several.",
    );
  }

  const parsed = message.parsed_output as CanaryDraft | null;
  if (!parsed?.sql?.trim()) {
    throw new Error("Claude returned no query for this instruction.");
  }
  return parsed;
}
