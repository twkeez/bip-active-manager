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
    "(Sent from the BIP Response Report. This closes on its own once someone from our team posts in the project.)",
  ].join("\n");
}

export type InternalPost = {
  basecamp_project_id: string;
  occurred_at: string;
  author_email: string | null;
};

/**
 * Open follow-ups that have been acted on: someone on our side posted in the
 * project after the note went out. Returns each with the first such post.
 */
export function followupsAnswered(
  followups: FollowupRow[],
  posts: InternalPost[],
): Array<{ followup: FollowupRow; post: InternalPost }> {
  const answered: Array<{ followup: FollowupRow; post: InternalPost }> = [];
  for (const followup of followups) {
    if (followup.state !== "open") continue;
    const sent = new Date(followup.sent_at).getTime();
    const first = posts
      .filter(
        (post) =>
          post.basecamp_project_id === followup.basecamp_project_id &&
          new Date(post.occurred_at).getTime() > sent,
      )
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0];
    if (first) answered.push({ followup, post: first });
  }
  return answered;
}

/** Overdue and not yet re-sent: each gets exactly one reminder. */
export function followupsToRenudge(followups: FollowupRow[], now: Date): FollowupRow[] {
  return followups.filter((followup) => isOverdue(followup, now) && !followup.renudged_at);
}
