import type { SupabaseClient } from "@supabase/supabase-js";
import { sendGmailAs } from "@/lib/email/gmail-send";
import {
  followupEmailBody,
  followupsAnswered,
  followupsToRenudge,
  isOverdue,
  type FollowupRow,
  type ThreadActivity,
} from "./followups";

export type FollowupSweep = {
  closed: number;
  renudged: number;
  /** Still open after two days, for the morning email. */
  overdue: FollowupRow[];
  errors: string[];
};

/**
 * The hourly follow-up sweep, run by the job watchdog: close follow-ups the
 * person asked has answered in Basecamp, and re-send each overdue one once, copying
 * whoever sent it. Errors are collected, not thrown, so one failed reminder
 * does not stop the rest (the watchdog reports them).
 */
export async function sweepFollowups(admin: SupabaseClient, now: Date = new Date()): Promise<FollowupSweep> {
  const errors: string[] = [];
  const { data, error } = await admin
    .from("strategist_followups")
    .select("*")
    .eq("state", "open")
    .order("sent_at", { ascending: true });
  if (error) {
    // Table not created yet: nothing to sweep.
    if (/could not find the table|does not exist/i.test(error.message)) {
      return { closed: 0, renudged: 0, overdue: [], errors };
    }
    throw new Error(`Could not read follow-ups: ${error.message}`);
  }
  let open = (data ?? []) as FollowupRow[];
  if (!open.length) return { closed: 0, renudged: 0, overdue: [], errors };

  // --- Close the ones somebody acted on -----------------------------------
  const since = open[0].sent_at;
  const { data: postRows, error: postError } = await admin
    .from("basecamp_communication_events")
    .select("basecamp_project_id,basecamp_recording_id,occurred_at,author_email")
    .in("basecamp_project_id", [...new Set(open.map((f) => f.basecamp_project_id))])
    .gt("occurred_at", since);
  if (postError) errors.push(`Could not read Basecamp posts: ${postError.message}`);

  const answered = followupsAnswered(open, (postRows ?? []) as ThreadActivity[]);
  const closedIds = new Set<number>();
  let closed = 0;
  for (const { followup, post } of answered) {
    const { error: updateError } = await admin
      .from("strategist_followups")
      .update({
        state: "done",
        resolution: "we_posted",
        resolved_at: post.occurred_at,
        resolved_by: post.author_email,
      })
      .eq("id", followup.id)
      .eq("state", "open");
    if (updateError) {
      errors.push(`Could not close follow-up ${followup.id}: ${updateError.message}`);
    } else {
      closed += 1;
      closedIds.add(followup.id);
    }
  }
  open = open.filter((f) => !closedIds.has(f.id));

  // --- Remind once when overdue --------------------------------------------
  let renudged = 0;
  for (const followup of followupsToRenudge(open, now)) {
    try {
      await sendGmailAs(admin, followup.sent_by_user_id, {
        to: followup.recipient_email,
        cc: followup.sent_by_email,
        subject: `Reminder: ${followup.subject}`,
        body: followupEmailBody(followup, { reminder: true }),
      });
      const nowIso = now.toISOString();
      await admin.from("strategist_followups").update({ renudged_at: nowIso }).eq("id", followup.id);
      followup.renudged_at = nowIso;
      renudged += 1;
    } catch (sendError) {
      errors.push(
        `Could not re-send the follow-up to ${followup.recipient_email} about ${followup.project_name}: ${
          sendError instanceof Error ? sendError.message : "unknown error"
        }`,
      );
    }
  }

  return { closed, renudged, overdue: open.filter((f) => isOverdue(f, now)), errors };
}
