import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/models";
import { anthropicClient, costOf } from "@/lib/ai/usage";
import { loadBasecampActivity, type BasecampThread } from "@/lib/poobah/basecamp";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";
import {
  CLIENT_WATCH_PROMPT_VERSION,
  QUIET_WINDOW_DAYS,
  READ_WINDOW_DAYS,
  type OweResponse,
  type WatchRead,
} from "./shape";

/**
 * One Client Watch read: Claude goes through a client's Basecamp threads and
 * writes down where things stand, in the status sheet's columns.
 *
 * The posts come from BIP Control's own Basecamp sync, with logins and
 * access threads already removed (lib/poobah/basecamp.ts). Nothing here goes
 * to the client: it's for the team.
 */

export const CLIENT_WATCH_MODEL = MODELS.clientWatch;

/**
 * The most post text sent in one read, about 75,000 words of input. Threads
 * are added newest first; any left out are named in the read's notes, never
 * dropped quietly.
 */
export const MAX_TRANSCRIPT_CHARS = 300_000;

export type ClientToRead = {
  clientId: number;
  name: string;
  strategist: string | null;
  packageValue: string | null;
  /** The Response Report's heading for the client right now, e.g. "Waiting on us". */
  basecampStatus: string;
};

type Answer = {
  owe_response: OweResponse;
  what_we_owe: string;
  where_things_stand: string;
  open_asks: string;
  our_commitments: string;
  other_threads: string;
  latest_report_month: string;
  next_action: string;
  flags: string[];
  unhappy: boolean;
  most_recent_thread: string;
  read_notes: string;
};

const schema = {
  type: "object",
  properties: {
    owe_response: { type: "string", enum: ["yes", "no", "thanks_only"] },
    what_we_owe: { type: "string" },
    where_things_stand: { type: "string" },
    open_asks: { type: "string" },
    our_commitments: { type: "string" },
    other_threads: { type: "string" },
    latest_report_month: { type: "string" },
    next_action: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
    unhappy: { type: "boolean" },
    most_recent_thread: { type: "string" },
    read_notes: { type: "string" },
  },
  required: [
    "owe_response",
    "what_we_owe",
    "where_things_stand",
    "open_asks",
    "our_commitments",
    "other_threads",
    "latest_report_month",
    "next_action",
    "flags",
    "unhappy",
    "most_recent_thread",
    "read_notes",
  ],
  additionalProperties: false,
} as const;

const outputFormat = jsonSchemaOutputFormat(schema);

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

function threadText(thread: BasecampThread): string {
  const lines = [`### Thread: ${thread.title}${thread.project ? ` (project: ${thread.project})` : ""}`];
  for (const post of thread.posts) {
    const who = `${post.author} (${post.side === "Beyond Indigo" ? "Beyond Indigo" : "client"})`;
    const words = post.text ?? "[no words stored for this post]";
    lines.push(`- ${day(post.at)}, ${who}: ${words}${post.note ? ` [${post.note}]` : ""}`);
  }
  return lines.join("\n");
}

/** Threads newest first, as many as fit. Returns the text and how many were left out. */
export function buildTranscript(threads: BasecampThread[], maxChars = MAX_TRANSCRIPT_CHARS): { text: string; included: number; leftOut: number } {
  const parts: string[] = [];
  let size = 0;
  for (const thread of threads) {
    const text = threadText(thread);
    if (parts.length > 0 && size + text.length > maxChars) break;
    parts.push(text);
    size += text.length;
  }
  return { text: parts.join("\n\n"), included: parts.length, leftOut: threads.length - parts.length };
}

export function buildReadPrompt(client: ClientToRead, transcript: string, windowDays: number, today: Date): string {
  return `You help the Marketing Services Director at Beyond Indigo Pets, a marketing agency for veterinary practices, see where each client stands so no ball gets dropped. This is for the team only; it is never shown to the client.

Client: ${client.name}
Strategist (from the Master Sheet): ${client.strategist?.trim() || "none listed"}
Package: ${client.packageValue?.trim() || "not listed"}
Basecamp status from our response report: ${client.basecampStatus}
Today: ${day(today.toISOString())}
Below: every post in this client's Basecamp project from the last ${windowDays} days, grouped by thread, newest thread first. "Beyond Indigo" posts are ours; "client" posts are the practice's.

Rules:
- Use only what the posts say. Never guess or fill gaps. If something isn't in the posts, leave it out or say it isn't shown.
- Write dates as "Nov 3", never "3 days ago": the page shows day counts itself.
- Name people as the posts do. Never copy a password, login, code or account number.
- Short, plain sentences for a busy manager. Use "" for any field with nothing to say.

Fields:
- owe_response: "yes" when the client asked for something or is waiting on something from us that no later Beyond Indigo post answers or delivers. "thanks_only" when the client spoke last but only to thank or acknowledge, with nothing to answer. Otherwise "no".
- what_we_owe: when owe_response is "yes", exactly what we owe, with the date, who asked and the thread name.
- where_things_stand: two or three sentences on the account right now.
- open_asks: each client request still open, with its date.
- our_commitments: things Beyond Indigo said it would do that no later post shows done, with who said it and the date.
- other_threads: website, billing, onboarding or other non-marketing matters worth knowing.
- latest_report_month: the month (YYYY-MM) that the most recent monthly report posted in these threads covers. "" when no report is seen.
- next_action: one concrete next step, naming who should take it when the posts or the strategist make that clear.
- flags: short phrases for anything a manager should notice, such as "unhappy client", "cancellation mentioned", "promised work not confirmed", "report behind", "possible upsell", "login posted in Basecamp". Empty when nothing stands out.
- unhappy: true only when the client expresses dissatisfaction or mentions leaving or cancelling.
- most_recent_thread: the title of the thread with the newest post.
- read_notes: anything that limits this read, such as posts with no words stored, or replies that may have happened by email or phone.

Posts:
${transcript || "(no posts in this window)"}`;
}

export type ReadResult = Omit<WatchRead, "id" | "read_at">;

/** Reads one client. Never throws: a failure comes back as a row with `error` set, so it is recorded and shown. */
export async function readClient(
  admin: SupabaseClient,
  client: ClientToRead,
  newestPostAt: string | null,
  now = new Date(),
): Promise<ReadResult> {
  const base = {
    client_id: client.clientId,
    prompt_version: CLIENT_WATCH_PROMPT_VERSION,
    model: CLIENT_WATCH_MODEL,
    newest_post_at: newestPostAt,
  };
  const empty = {
    owe_response: null,
    what_we_owe: null,
    where_things_stand: null,
    open_asks: null,
    our_commitments: null,
    other_threads: null,
    latest_report_month: null,
    next_action: null,
    flags: [],
    unhappy: false,
    most_recent_thread: null,
    read_notes: null,
  };
  let windowDays = READ_WINDOW_DAYS;
  let counts = { threads: 0, posts: 0, withoutWords: 0 };
  let cost: number | null = null;
  try {
    let activity = await loadBasecampActivity(admin, client.clientId, READ_WINDOW_DAYS);
    if (activity.counts.posts === 0) {
      windowDays = QUIET_WINDOW_DAYS;
      activity = await loadBasecampActivity(admin, client.clientId, QUIET_WINDOW_DAYS);
    }
    counts = { threads: activity.counts.threads, posts: activity.counts.posts, withoutWords: activity.counts.posts_without_words };
    const transcript = buildTranscript(activity.threads);

    const message = await anthropicClient("Client Watch").messages.parse({
      model: CLIENT_WATCH_MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: outputFormat },
      messages: [{ role: "user", content: stripLoneSurrogates(buildReadPrompt(client, transcript.text, windowDays, now)) }],
    });
    cost = costOf({
      model: CLIENT_WATCH_MODEL,
      input: message.usage.input_tokens ?? 0,
      output: message.usage.output_tokens ?? 0,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
      cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      webSearches: 0,
    });
    if (message.stop_reason === "refusal") throw new Error("Claude declined to read this client's threads.");
    if (message.stop_reason === "max_tokens" || !message.parsed_output) {
      throw new Error("Claude's answer was cut off or couldn't be read.");
    }
    const answer = message.parsed_output as Answer;
    const text = (value: string) => value.trim() || null;
    const ourNotes = [
      transcript.leftOut
        ? `${transcript.leftOut} older thread${transcript.leftOut === 1 ? " was" : "s were"} too long to include in this read; the ${transcript.included} newest were read.`
        : null,
      windowDays === QUIET_WINDOW_DAYS ? `No posts in ${READ_WINDOW_DAYS} days, so ${QUIET_WINDOW_DAYS} days were read.` : null,
    ].filter(Boolean);
    return {
      ...base,
      window_days: windowDays,
      threads_read: counts.threads,
      posts_read: counts.posts,
      posts_without_words: counts.withoutWords,
      cost_usd: cost,
      owe_response: answer.owe_response,
      what_we_owe: text(answer.what_we_owe),
      where_things_stand: text(answer.where_things_stand),
      open_asks: text(answer.open_asks),
      our_commitments: text(answer.our_commitments),
      other_threads: text(answer.other_threads),
      latest_report_month: /^\d{4}-(0[1-9]|1[0-2])$/.test(answer.latest_report_month.trim()) ? answer.latest_report_month.trim() : null,
      next_action: text(answer.next_action),
      flags: answer.flags.map((flag) => flag.trim()).filter(Boolean),
      unhappy: answer.unhappy,
      most_recent_thread: text(answer.most_recent_thread),
      read_notes: [...ourNotes, answer.read_notes.trim()].filter(Boolean).join(" ") || null,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      ...empty,
      window_days: windowDays,
      threads_read: counts.threads,
      posts_read: counts.posts,
      posts_without_words: counts.withoutWords,
      cost_usd: cost,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
    };
  }
}
