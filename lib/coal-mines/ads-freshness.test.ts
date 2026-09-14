import { describe, expect, it } from "vitest";
import {
  ADS_OVERDUE_DAYS,
  assessAdsFreshness,
  type AdsAccountRow,
  type AdsSnapshotRow,
} from "./ads-freshness";

const NOW = new Date("2026-09-14T12:00:00Z");

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function snapshot(
  client_id: number,
  days: number,
  run_status = "completed",
  error_message: string | null = null,
): AdsSnapshotRow {
  return { client_id, run_status, created_at: daysAgo(days), error_message };
}

const accounts: AdsAccountRow[] = [
  { id: 1, account_name: "Adobe Animal Hospital" },
  { id: 2, account_name: "Coal Creek Animal Hospital" },
];

describe("assessAdsFreshness", () => {
  it("is quiet when every account refreshed last night", () => {
    const result = assessAdsFreshness(accounts, [snapshot(1, 0), snapshot(2, 0)], NOW);
    expect(result.status).toBe("ok");
    expect(result.stale).toEqual([]);
    expect(result.freshestDays).toBe(0);
    expect(result.oldestDays).toBe(0);
  });

  it("names the accounts that are behind while the job is still running", () => {
    const result = assessAdsFreshness(accounts, [snapshot(1, 0), snapshot(2, 9)], NOW);
    // One account behind is that account's problem, not the schedule's.
    expect(result.status).toBe("attention");
    expect(result.stale.map((a) => a.accountName)).toEqual(["Coal Creek Animal Hospital"]);
  });

  it("calls it overdue when even the freshest account is old — the schedule stopped", () => {
    const result = assessAdsFreshness(
      accounts,
      [snapshot(1, ADS_OVERDUE_DAYS), snapshot(2, 59)],
      NOW,
    );
    expect(result.status).toBe("overdue");
    expect(result.freshestDays).toBe(ADS_OVERDUE_DAYS);
  });

  it("treats an account that has never synced as never, not as zero days old", () => {
    const result = assessAdsFreshness(accounts, [snapshot(1, 0)], NOW);
    expect(result.never.map((a) => a.accountName)).toEqual(["Coal Creek Animal Hospital"]);
    expect(result.never[0].days).toBeNull();
    expect(result.oldestDays).toBeNull();
    expect(result.status).toBe("attention");
  });

  it("reports a failed newest attempt even when an older run succeeded", () => {
    const result = assessAdsFreshness(
      accounts,
      [
        snapshot(1, 0, "failed", "invalid_grant"),
        snapshot(1, 1),
        snapshot(2, 0),
      ],
      NOW,
    );
    expect(result.failing.map((a) => a.accountName)).toEqual(["Adobe Animal Hospital"]);
    expect(result.failing[0].lastError).toBe("invalid_grant");
    // Yesterday's success still counts: the numbers on the page are a day old.
    expect(result.failing[0].days).toBe(1);
    expect(result.stale).toEqual([]);
  });

  it("does not flag a sync that is running right now", () => {
    const result = assessAdsFreshness(accounts, [snapshot(1, 0, "running"), snapshot(1, 1), snapshot(2, 0)], NOW);
    expect(result.failing).toEqual([]);
    expect(result.status).toBe("ok");
  });

  it("flags a run that started a day ago and never came back", () => {
    const result = assessAdsFreshness(
      accounts,
      [snapshot(1, 1, "running"), snapshot(1, 3), snapshot(2, 0)],
      NOW,
    );
    expect(result.failing.map((a) => a.accountName)).toEqual(["Adobe Animal Hospital"]);
    expect(result.failing[0].lastError).toBe("Attempt did not finish");
  });

  it("is quiet when no client buys ads at all", () => {
    const result = assessAdsFreshness([], [], NOW);
    expect(result.status).toBe("ok");
    expect(result.considered).toBe(0);
  });
});
