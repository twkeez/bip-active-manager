// Strategist follow-ups: a note Tom sends a strategist about a client from the
// response report, and the rules that decide when it has been acted on.
// Pure functions here; the database and email work is in process.ts.

export type FollowupRow = {
  id: number;
  basecamp_project_id: string;
  project_name: string;
  client_id: number | null;
  recipient_name: string | null;
  recipient_email: string;
  subject: string;
  note: string;
  thread_title: string | null;
  thread_url: string | null;
  sent_by_user_id: string;
  sent_by_email: string | null;
  sent_at: string;
  renudged_at: string | null;
  state: "open" | "done";
  resolution: "we_posted" | "marked_done" | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

/** Open this long and it is overdue: re-sent once, in the morning email, highlighted. */
export const FOLLOWUP_OVERDUE_HOURS = 48;

const HOUR = 3_600_000;

export function isOverdue(followup: Pick<FollowupRow, "state" | "sent_at">, now: Date): boolean {
  return (
    followup.state === "open" &&
    now.getTime() - new Date(followup.sent_at).getTime() >= FOLLOWUP_OVERDUE_HOURS * HOUR
  );
}

export function openForLabel(sentAt: string, now: Date): string {
  const hours = (now.getTime() - new Date(sentAt).getTime()) / HOUR;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

/** The note pre-filled in the Notify box, from where the conversation stands. */
export function defaultNote(input: {
  accountName: string;
  recipientName: string | null;
  status: "awaiting_us" | "awaiting_client" | "no_contact";
  waitingDays: number | null;
  threadTitle: string | null;
}): { subject: string; note: string } {
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const days =
    input.waitingDays == null ? "" : input.waitingDays === 1 ? " for 1 day" : ` for ${input.waitingDays} days`;
  const thread = input.threadTitle ? ` on "${input.threadTitle}"` : "";
  let ask: string;
  if (input.status === "awaiting_us") {
    ask = `${input.accountName} has been waiting on a reply from us${days}${thread}. Could you get back to them?`;
  } else if (input.status === "awaiting_client") {
    ask = `We haven't heard from ${input.accountName}${days}${thread}. Could you check in with them?`;
  } else {
    ask = `There's been no Basecamp conversation with ${input.accountName} lately. Could you reach out to them?`;
  }
  return { subject: `Follow-up needed: ${input.accountName}`, note: `${greeting}\n\n${ask}\n\nThanks!` };
}

/** The email as sent: Tom's note, then the links. */
export function followupEmailBody(
  followup: Pick<FollowupRow, "note" | "thread_url" | "basecamp_project_id">,
  options: { reminder?: boolean } = {},
): string {
  return [
    ...(options.reminder
      ? ["Reminder: this is still open. Nothing has been posted in the Basecamp project since.", ""]
      : []),
    followup.note.trim(),
    "",
    ...(followup.thread_url ? [`Thread: ${followup.thread_url}`] : []),
    `Basecamp project: https://basecamp.com/2175055/projects/${followup.basecamp_project_id}`,
    "",
    followup.thread_url
      ? "(Sent from the BIP Response Report. This closes on its own once you reply in that thread.)"
      : "(Sent from the BIP Response Report. This closes on its own once you post in the project.)",
  ].join("\n");
}

/**
 * A thread as the Basecamp sync stores it: one row per thread, carrying when
 * it last changed and who posted last (classic Basecamp's "last updater").
 */
export type ThreadActivity = {
  basecamp_project_id: string;
  basecamp_recording_id: number;
  occurred_at: string;
  author_email: string | null;
};

/** The Basecamp message id at the end of a thread URL (…/messages/113355480). */
export function threadIdFromUrl(url: string | null): number | null {
  const match = (url ?? "").match(/\/messages\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Open follow-ups the person asked has acted on (Tom's rule, 2026-09-26: only
 * the person asked, and only in that thread):
 * - a note about a thread closes when that thread's latest post is by the
 *   person asked, after the note went out;
 * - a note with no thread (nobody has spoken lately) closes when the person
 *   asked posts anywhere in the project, since reaching out is the ask.
 *
 * The sync keeps only each thread's last poster, so if the client answers
 * before the next sync, the strategist's reply is not seen and the follow-up
 * stays open for a manual "Mark done". It can stay open wrongly; it cannot
 * close wrongly.
 */
export function followupsAnswered(
  followups: FollowupRow[],
  threads: ThreadActivity[],
): Array<{ followup: FollowupRow; post: ThreadActivity }> {
  const answered: Array<{ followup: FollowupRow; post: ThreadActivity }> = [];
  for (const followup of followups) {
    if (followup.state !== "open") continue;
    const sent = new Date(followup.sent_at).getTime();
    const recipient = followup.recipient_email.trim().toLowerCase();
    const threadId = threadIdFromUrl(followup.thread_url);
    const match = threads.find(
      (thread) =>
        thread.basecamp_project_id === followup.basecamp_project_id &&
        (threadId == null || thread.basecamp_recording_id === threadId) &&
        (thread.author_email ?? "").trim().toLowerCase() === recipient &&
        new Date(thread.occurred_at).getTime() > sent,
    );
    if (match) answered.push({ followup, post: match });
  }
  return answered;
}

/** Overdue and not yet re-sent: each gets exactly one reminder. */
export function followupsToRenudge(followups: FollowupRow[], now: Date): FollowupRow[] {
  return followups.filter((followup) => isOverdue(followup, now) && !followup.renudged_at);
}
