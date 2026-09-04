import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";

/**
 * Decides whether the last message in a Basecamp thread actually leaves
 * something outstanding for us.
 *
 * "The client spoke last" is a poor proxy for "the client is waiting". On live
 * data it surfaced an announcement ("Closed for Labor Day") and a thank-you
 * ("Tom K - thanks much.") as work. This reads what was actually said.
 *
 * One call for every candidate rather than one per thread: there are only ever
 * a couple of dozen, and batching keeps it to a single request the scheduler
 * can make once a day for a few cents.
 */

export const CLASSIFIER_MODEL = "claude-opus-5";

export type ReplyNeed = "needs_reply" | "fyi" | "closed" | "unclear";

export type ThreadToClassify = {
  /** Basecamp recording id — the stable key we write the verdict back to. */
  recordingId: number;
  clientName: string;
  title: string;
  /** The most recent message in the thread. */
  excerpt: string;
  /** True when we spoke last, which changes what "outstanding" means. */
  weSpokeLast: boolean;
  daysSince: number;
};

export type ThreadVerdict = {
  recordingId: number;
  replyNeed: ReplyNeed;
  reason: string;
  escalated: boolean;
};

const schema = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recordingId: { type: "number" },
          replyNeed: {
            type: "string",
            enum: ["needs_reply", "fyi", "closed", "unclear"],
          },
          reason: { type: "string" },
          escalated: { type: "boolean" },
        },
        required: ["recordingId", "replyNeed", "reason", "escalated"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
} as const;

export const threadVerdictOutputFormat = jsonSchemaOutputFormat(schema);

export function buildClassifyPrompt(threads: ThreadToClassify[]): string {
  const items = threads
    .map((t) =>
      [
        `--- recordingId: ${t.recordingId}`,
        `client: ${t.clientName}`,
        `thread: ${t.title}`,
        `last message was from: ${t.weSpokeLast ? "us (the agency)" : "the client"}`,
        `days since: ${t.daysSince}`,
        `last message: ${t.excerpt}`,
      ].join("\n"),
    )
    .join("\n\n");

  return `You are triaging Basecamp threads for Beyond Indigo Pets, a veterinary marketing agency, on behalf of the account team.

For each thread below, decide whether the LAST message leaves something outstanding for the agency to do or reply to.

Categories:
- "needs_reply" — the last message asks a question, makes a request, reports a problem, chases something, or otherwise leaves the client expecting a response or an action from us.
- "fyi" — the client is telling us something we do not need to answer (holiday closures, staff changes, an FYI). Courtesy replies do not count as needed.
- "closed" — the exchange is finished: a thank-you, an acknowledgement, a "sounds good", a confirmation that something we sent is fine.
- "unclear" — you genuinely cannot tell from the text available.

Also set "escalated": true when the client is chasing us, complaining, reporting something broken or not delivered, or expressing frustration. Those matter regardless of how long they have waited. Example of an escalation: "Stephanie previously sent me monthly updates, but I have not received anything for the past few months."

Guidance:
- Judge the LAST message, not the thread topic. A thread called "Marketing Updates Q3" whose last message is "thanks much" is closed.
- When we spoke last, "needs_reply" means we asked the client something and are waiting on them — say so in the reason. It does not mean we owe a reply.
- A message that sends us something we asked for (photos, a bio, copy) is "needs_reply", because someone has to use it and confirm receipt.
- Be conservative with "closed". If in doubt between closed and needs_reply, choose needs_reply — missing a real request costs more than one extra row on a list.
- Keep "reason" to one short sentence, written for a busy account manager.

Return a verdict for every recordingId given, and no others.

${items}`;
}

/** Returns a verdict for each thread. Throws if Claude declines or returns nothing. */
export async function classifyThreads(
  threads: ThreadToClassify[],
): Promise<ThreadVerdict[]> {
  if (threads.length === 0) return [];

  const client = new Anthropic();
  const message = await client.messages.parse({
    model: CLASSIFIER_MODEL,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: stripLoneSurrogates(buildClassifyPrompt(threads)),
      },
    ],
    output_config: { format: threadVerdictOutputFormat },
  });

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to classify these threads.");
  }

  const parsed = message.parsed_output as { verdicts?: ThreadVerdict[] } | null;
  const verdicts = parsed?.verdicts ?? [];

  // Only keep verdicts for threads we actually asked about — a hallucinated id
  // would otherwise write a verdict onto an unrelated thread.
  const asked = new Set(threads.map((t) => t.recordingId));
  return verdicts.filter((v) => asked.has(v.recordingId));
}
