import { describe, expect, it } from "vitest";
import {
  aggregateHoursByUserAndProject,
  buildHarvestMonthPeriods,
  buildHarvestTimeActivityReport,
  extractHarvestUsersFromTimeEntries,
  matchHarvestUser,
  matchHarvestUsers,
} from "@/lib/harvest/time-activity";
import { harvestUserFromDisplayName } from "@/lib/harvest/client";
import type { HarvestTimeEntry, HarvestUser } from "@/lib/harvest/types";
import type { ClientRow } from "@/lib/types/client";

function client(partial: Partial<ClientRow> & Pick<ClientRow, "id" | "account_name">): ClientRow {
  return {
    marketing_strategist: "Alex",
    total_package_hours: null,
    hours_for_strategist: null,
    blog: "N",
    smm: "N",
    seo: "Premium",
    ppc: "N",
    orm: "N",
    ads_customer_id: null,
    ga4_id: null,
    sc_url: null,
    website: null,
    ga4_property_id: null,
    google_place_id: null,
    basecamp_project_id: null,
    harvest_project_id: "1001",
    harvest_client_id: "2001",
    tier: "Enterprise",
    last_communication_at: null,
    last_event_is_internal: null,
    needs_reply: false,
    reply_acknowledged_at: null,
    reply_acknowledged_for_occurred_at: null,
    days_stale: null,
    onboarding_status: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
    onboarding_target_date: null,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("buildHarvestMonthPeriods", () => {
  it("builds previous and current month ranges", () => {
    const { previousMonth, currentMonth } = buildHarvestMonthPeriods(new Date("2026-06-15T12:00:00Z"));
    expect(previousMonth.from).toBe("2026-05-01");
    expect(previousMonth.to).toBe("2026-05-31");
    expect(currentMonth.from).toBe("2026-06-01");
    expect(currentMonth.to).toBe("2026-06-15");
  });
});

describe("matchHarvestUser", () => {
  const users: HarvestUser[] = [
    {
      id: 10,
      first_name: "Alex",
      last_name: "Smith",
      email: "alex@example.com",
      is_active: true,
    },
  ];

  it("matches by email first", () => {
    const matched = matchHarvestUser(
      { name: "Alex", email: "alex@example.com" },
      users,
    );
    expect(matched?.id).toBe(10);
  });
});

describe("extractHarvestUsersFromTimeEntries", () => {
  it("dedupes users from time entry payloads", () => {
    const users = extractHarvestUsersFromTimeEntries([
      {
        id: 1,
        hours: 1,
        spent_date: "2026-06-01",
        user: { id: 10, name: "Alex Smith" },
        project: { id: 100, name: "Alpha" },
      },
      {
        id: 2,
        hours: 2,
        spent_date: "2026-06-02",
        user: { id: 10, name: "Alex Smith" },
        project: { id: 101, name: "Beta" },
      },
    ]);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(10);
    expect(users[0]?.first_name).toBe("Alex");
  });
});

describe("matchHarvestUsers", () => {
  const users = [
    harvestUserFromDisplayName(1, "Stephanie Anderson"),
    harvestUserFromDisplayName(2, "Melissa Rodriguez"),
    harvestUserFromDisplayName(3, "Alex Michel"),
  ];

  it("matches compound roster names to multiple Harvest users", () => {
    const matched = matchHarvestUsers({ name: "Stephanie/Melissa", email: null }, users);
    expect(matched.map((user) => user.id).sort()).toEqual([1, 2]);
  });
});

describe("buildHarvestTimeActivityReport", () => {
  it("flags clients without project hours in each month", () => {
    const { previousMonth, currentMonth } = buildHarvestMonthPeriods(
      new Date("2026-06-15T12:00:00Z"),
    );

    const entries: HarvestTimeEntry[] = [
      {
        id: 1,
        hours: 2,
        spent_date: previousMonth.from,
        user: { id: 10, name: "Alex Smith" },
        project: { id: 1001, name: "Alpha" },
      },
    ];

    const report = buildHarvestTimeActivityReport({
      clients: [
        client({ id: 1, account_name: "Alpha", harvest_project_id: "1001" }),
        client({ id: 2, account_name: "Beta", harvest_project_id: "1002" }),
      ],
      users: [
        {
          id: 10,
          first_name: "Alex",
          last_name: "Smith",
          email: "alex@example.com",
          is_active: true,
        },
      ],
      entries,
      referenceDate: new Date("2026-06-15T12:00:00Z"),
      strategistRoster: [{ name: "Alex", email: "alex@example.com" }],
    });

    expect(report.clientsMissingPreviousMonth.map((row) => row.accountName)).toEqual(["Beta"]);
    expect(report.clientsMissingCurrentMonth.map((row) => row.accountName)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(report.strategists[0]?.previousMonthHours).toBe(2);
    expect(report.strategists[0]?.currentMonthHours).toBe(0);
  });
});

describe("aggregateHoursByUserAndProject", () => {
  it("sums hours separately by month", () => {
    const previousMonth = {
      key: "previous",
      label: "May 2026",
      from: "2026-05-01",
      to: "2026-05-31",
    };
    const currentMonth = {
      key: "current",
      label: "June 2026",
      from: "2026-06-01",
      to: "2026-06-15",
    };

    const totals = aggregateHoursByUserAndProject(
      [
        {
          id: 1,
          hours: 1.5,
          spent_date: "2026-05-10",
          user: { id: 10, name: "Alex" },
          project: { id: 1001, name: "Alpha" },
        },
        {
          id: 2,
          hours: 2,
          spent_date: "2026-06-05",
          user: { id: 10, name: "Alex" },
          project: { id: 1001, name: "Alpha" },
        },
      ],
      previousMonth,
      currentMonth,
    );

    expect(totals.hoursByUserPrevious.get(10)).toBe(1.5);
    expect(totals.hoursByUserCurrent.get(10)).toBe(2);
    expect(totals.hoursByProjectPrevious.get("1001")).toBe(1.5);
    expect(totals.hoursByProjectCurrent.get("1001")).toBe(2);
  });
});
