import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stamp clients.last_report_run_at when a report is actually produced.
 *
 * Called from the two surfaces that mean "a report went out": the Word export
 * route and the chrome-free print view (which is how PDFs are made). Both are
 * opened deliberately to produce output, so a render is a legitimate signal.
 *
 * Best effort by design — a failure here must never break the export the user
 * asked for, so errors are swallowed rather than thrown.
 */
export async function stampReportRun(clientId: number): Promise<void> {
  if (!Number.isInteger(clientId) || clientId <= 0) return;
  try {
    const admin = createAdminClient();
    await admin
      .from("clients")
      .update({ last_report_run_at: new Date().toISOString() })
      .eq("id", clientId);
  } catch {
    // Non-fatal: the report still renders without the stamp.
  }
}
