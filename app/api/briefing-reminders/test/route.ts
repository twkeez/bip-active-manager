import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { loadPlanInputs } from "@/lib/briefing-reminders/load-plan";
import { planRun, upcomingRuns } from "@/lib/briefing-reminders/plan";
import { buildReminder } from "@/lib/briefing-reminders/send";
import { sendGmailAs } from "@/lib/email/gmail-send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * "Send me a test": one client's reminder exactly as its strategist would get
 * it at the next run, built from today's data, emailed only to the person
 * asking. Nothing is recorded and nobody else receives it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let clientId: number;
  try {
    clientId = Number(((await request.json()) as { clientId?: unknown }).clientId);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { clients, staff } = await loadPlanInputs(admin);
  // The next run that includes this client: Low Contact clients skip third Mondays.
  const reminderRun = upcomingRuns(new Date(), 2)
    .map((run) => ({ run, reminder: planRun(clients, staff, run.slot).reminders.find((r) => r.clientId === clientId) }))
    .find((entry) => entry.reminder);
  if (!reminderRun?.reminder) {
    return NextResponse.json({ error: "This client is not in the next reminder runs." }, { status: 404 });
  }

  try {
    const email = await buildReminder(admin, reminderRun.reminder, reminderRun.run);
    const realTo = reminderRun.reminder.to.map((t) => `${t.name} <${t.email}>`).join(", ");
    await sendGmailAs(admin, user.id, {
      to: user.email,
      subject: `[Test] ${email.subject}`,
      body: `TEST ONLY. In the real run on ${reminderRun.run.date} this goes to: ${realTo}\n\n${email.body}`,
    });
    return NextResponse.json({ ok: true, sentTo: user.email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the test." },
      { status: 502 },
    );
  }
}
