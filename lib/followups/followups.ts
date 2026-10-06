// Strategist follow-ups: a note Tom sends a strategist about a client from the
// response report, and the rules that decide when it has been acted on.
// Pure functions here; the database and email work is in process.ts.

export type FollowupRow = {
  id: number;
  /** "note": sent by hand from the Response Report. "client_update": a scheduled briefing reminder. */
  kind: "note" | "client_update";
  /** The reminder run's Monday, for client updates. */
  reminder_run: string | null;
  basecamp_project_id: string | null;
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
/** A client update takes longer to write than a reply, so it gets five days. */
export const CLIENT_UPDATE_OVERDUE_HOURS = 120;

const HOUR = 3_600_000;

export function overdueHours(kind: FollowupRow["kind"] | undefined): number {
  return kind === "client_update" ? CLIENT_UPDATE_OVERDUE_HOURS : FOLLOWUP_OVERDUE_HOURS;
}

export function isOverdue(followup: Pick<FollowupRow, "state" | "sent_at"> & { kind?: FollowupRow["kind"] }, now: Date): boolean {
  return (
    followup.state === "open" &&
    now.getTime() - new Date(followup.sent_at).getTime() >= overdueHours(followup.kind) * HOUR
  );
}

export function openForLabel(sentAt: string, now: Date): string {
  const hours = (now.getTime() - new Date(sentAt).getTime()) / HOUR;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * The two messages the Notify box can pre-write.
 *
 * - waiting_on_us: the client spoke last and is waiting for a reply. Points at
 *   the client's thread, which is also what closes the follow-up (the person
 *   asked replying there).
 * - been_a_while: it has been a while since we sent anything. About the whole
 *   project rather than one thread, so it names no thread and closes when the
 *   person asked posts anywhere in the project (see followupsAnswered).
 */
export type NoteKind = "waiting_on_us" | "been_a_while";

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  waiting_on_us: "Waiting on us",
  been_a_while: "It's been a while",
};

/** Waiting on us is only true when the client spoke last; everything else is "a while". */
export function defaultNoteKind(status: "awaiting_us" | "awaiting_client" | "no_contact"): NoteKind {
  return status === "awaiting_us" ? "waiting_on_us" : "been_a_while";
}

const dayCount = (days: number) => (days === 1 ? "1 day" : `${days} days`);

/** The note pre-filled in the Notify box, from where the conversation stands. */
export function defaultNote(input: {
  accountName: string;
  recipientName: string | null;
  kind: NoteKind;
  /** Days the client has waited on us. Used by "waiting on us". */
  waitingDays: number | null;
  /** Days since anything went out from our side, or null when nothing is on record. */
  daysSinceOurMessage: number | null;
  /** The client's thread, for "waiting on us". */
  threadTitle: string | null;
}): { subject: string; note: string } {
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";

  if (input.kind === "waiting_on_us") {
    const days = input.waitingDays == null ? "" : ` for ${dayCount(input.waitingDays)}`;
    const thread = input.threadTitle ? ` on "${input.threadTitle}"` : "";
    const ask = `${input.accountName} has been waiting on a reply from us${days}${thread}. Could you get back to them?`;
    return { subject: `Follow-up needed: ${input.accountName}`, note: `${greeting}\n\n${ask}\n\nThanks!` };
  }

  const ask =
    input.daysSinceOurMessage == null
      ? `There's been no Basecamp conversation with ${input.accountName} lately. Could you reach out to them?`
      : `It's been a while since we sent anything to ${input.accountName} in Basecamp: ${dayCount(input.daysSinceOurMessage)} since our last message. Could you check in with them?`;
  return { subject: `Check-in needed: ${input.accountName}`, note: `${greeting}\n\n${ask}\n\nThanks!` };
}

/** The email as sent: Tom's note, then the links. */
export function followupEmailBody(
  followup: Pick<FollowupRow, "note" | "thread_url" | "basecamp_project_id"> & {
    kind?: FollowupRow["kind"];
    project_name?: string;
    reminder_run?: string | null;
  },
  options: { reminder?: boolean } = {},
): string {
  if (followup.kind === "client_update") {
    // Only the overdue reminder goes through here; the first email is the
    // briefing reminder itself (lib/briefing-reminders/email.ts).
    return [
      `Reminder: ${followup.project_name ?? "This client"}'s client update from ${followup.reminder_run ?? "the last reminder"} is still open.`,
      "",
      "If it has been posted, mark it complete so it comes off the list.",
      "",
      ...(followup.basecamp_project_id
        ? [`Basecamp project: https://basecamp.com/2175055/projects/${followup.basecamp_project_id}`]
        : []),
      "Follow-ups: https://bip-active-manager.vercel.app/follow-ups",
    ].join("\n");
  }
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
 * A Basecamp post as the sync stores it: a thread row (who posted last), or,
 * since 2026-09-27, a "comment" row for each post inside a thread, whose
 * parent_recording_id is the thread.
 */
export type ThreadActivity = {
  basecamp_project_id: string;
  basecamp_recording_id: number;
  parent_recording_id?: number | null;
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
 * Each post in a thread is its own row, so a strategist's reply counts even
 * when the client answered it before the next sync.
 */
export function followupsAnswered(
  followups: FollowupRow[],
  threads: ThreadActivity[],
): Array<{ followup: FollowupRow; post: ThreadActivity }> {
  const answered: Array<{ followup: FollowupRow; post: ThreadActivity }> = [];
  for (const followup of followups) {
    if (followup.state !== "open") continue;
    // Client updates are the strategist's own wording, so nothing can match
    // them: only "Mark complete" closes one (Tom, 2026-09-26).
    if (followup.kind === "client_update") continue;
    const sent = new Date(followup.sent_at).getTime();
    const recipient = followup.recipient_email.trim().toLowerCase();
    const threadId = threadIdFromUrl(followup.thread_url);
    const match = threads.find(
      (thread) =>
        thread.basecamp_project_id === followup.basecamp_project_id &&
        (threadId == null ||
          thread.basecamp_recording_id === threadId ||
          thread.parent_recording_id === threadId) &&
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
