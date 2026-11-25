import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { recordReportSent, sentRow } from "@/lib/reporting/record-sent";

type Answer = { data: unknown; error: { code?: string; message: string } | null };

/** A fake service-key client: one read answer, one write answer, and the row it was asked to save. */
function fakeAdmin(read: Answer, write: { error: { code?: string; message: string } | null }) {
  const saved: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => read }) }) }),
      upsert: async (row: Record<string, unknown>) => {
        saved.push(row);
        return write;
      },
    }),
  } as unknown as SupabaseClient;
  return { admin, saved };
}

describe("sentRow", () => {
  it("marks a new month sent by the snapshot email", () => {
    expect(sentRow(7, "2026-10", "snapshot", null, "u1", "2026-11-03T10:00:00Z")).toEqual({
      client_id: 7,
      month: "2026-10-01",
      status: "sent",
      sent_via: ["snapshot"],
      updated_at: "2026-11-03T10:00:00Z",
      updated_by: "u1",
      sent_at: "2026-11-03T10:00:00Z",
      sent_by: "u1",
    });
  });

  it("keeps earlier ways of sending and the first sent date when it was already sent", () => {
    const row = sentRow(
      7,
      "2026-10",
      "snapshot",
      { status: "sent", sent_via: ["pdf"], sent_at: "2026-11-02T09:00:00Z", sent_by: "u0" },
      "u1",
      "2026-11-03T10:00:00Z",
    );
    expect(row).toMatchObject({ sent_via: ["snapshot", "pdf"], sent_at: "2026-11-02T09:00:00Z", sent_by: "u0", updated_by: "u1" });
  });

  it("moves a draft or reviewed report to sent, dated now", () => {
    const row = sentRow(7, "2026-10", "snapshot", { status: "reviewed", sent_via: [], sent_at: null, sent_by: null }, "u1", "2026-11-03T10:00:00Z");
    expect(row).toMatchObject({ status: "sent", sent_via: ["snapshot"], sent_at: "2026-11-03T10:00:00Z", sent_by: "u1" });
  });
});

describe("recordReportSent", () => {
  it("saves the month as sent", async () => {
    const { admin, saved } = fakeAdmin({ data: null, error: null }, { error: null });
    expect(await recordReportSent(admin, 7, "2026-10", "snapshot", "u1")).toEqual({ month: "2026-10", recorded: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ client_id: 7, month: "2026-10-01", status: "sent", sent_via: ["snapshot"] });
  });

  it("says which step to run when the table isn't there, and saves nothing", async () => {
    const { admin, saved } = fakeAdmin({ data: null, error: { code: "42P01", message: "missing" } }, { error: null });
    const result = await recordReportSent(admin, 7, "2026-10", "snapshot", "u1");
    expect(result).toEqual({
      month: "2026-10",
      recorded: false,
      error:
        "October 2026's report couldn't be marked as sent on Monthly reports: run supabase/migrations/20261125200000_monthly_reports.sql in Supabase first.",
    });
    expect(saved).toHaveLength(0);
  });

  it("names a failed save instead of throwing", async () => {
    const { admin } = fakeAdmin({ data: null, error: null }, { error: { message: "timeout" } });
    expect(await recordReportSent(admin, 7, "2026-10", "snapshot", "u1")).toEqual({
      month: "2026-10",
      recorded: false,
      error: "October 2026's report couldn't be marked as sent on Monthly reports: timeout",
    });
  });
});
