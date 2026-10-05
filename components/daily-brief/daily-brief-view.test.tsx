import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DailyBriefView from "@/components/daily-brief/daily-brief-view";
import { countByTier } from "@/lib/daily-brief/prioritize";
import type { BriefClient, DailyBrief } from "@/lib/daily-brief/types";

const client = (overrides: Partial<BriefClient> & Pick<BriefClient, "clientId" | "name" | "tier">): BriefClient => ({
  lifecycle: "active",
  reasons: [],
  services: ["SEO"],
  strategists: ["Alex"],
  findings: [],
  blindSpots: [],
  escalatedThreads: [],
  awaitingReplyCount: 0,
  watch: null,
  ...overrides,
});

function brief(clients: BriefClient[], overrides: Partial<DailyBrief> = {}): DailyBrief {
  return {
    date: "2026-10-05",
    generatedAt: "2026-10-05T10:20:00.000Z",
    clients,
    unchecked: [],
    counts: countByTier(clients),
    excluded: { websiteOnly: 154, paused: 2, noServices: 3 },
    staleSources: [],
    freshnessError: null,
    watchError: null,
    ...overrides,
  };
}

describe("DailyBriefView", () => {
  it("lists tiers in order, with their headings, and says what was left out", () => {
    const html = renderToStaticMarkup(
      <DailyBriefView
        brief={brief([
          client({ clientId: 1, name: "Newbie Vets", tier: 1, lifecycle: "onboarding", reasons: ["Onboarding"] }),
          client({
            clientId: 2,
            name: "Loud Animal Hospital",
            tier: 2,
            escalatedThreads: [{ title: "Where is my site?", days: 4, reason: "Client is chasing", url: "https://3.basecamp.com/x" }],
          }),
          client({ clientId: 3, name: "Fine Pets", tier: 5 }),
        ])}
      />,
    );
    const order = ["Onboarding", "A client is chasing us", "Quiet"].map((heading) => html.indexOf(`>${heading} `));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("Where is my site?");
    expect(html).toContain("154 website-only accounts");
  });

  it("names a client that could not be checked instead of dropping it", () => {
    const html = renderToStaticMarkup(
      <DailyBriefView brief={brief([], { unchecked: [{ clientId: 9, name: "Ghost Vet", reason: "query failed" }] })} />,
    );
    expect(html).toContain("1 client could not be checked");
    expect(html).toContain("Ghost Vet (query failed)");
  });

  it("warns when nightly syncs were not in, and when the check itself failed", () => {
    const stale = renderToStaticMarkup(<DailyBriefView brief={brief([], { staleSources: ["Google Ads sync"] })} />);
    expect(stale).toContain("Google Ads sync");
    const failed = renderToStaticMarkup(<DailyBriefView brief={brief([], { freshnessError: "db down" })} />);
    expect(failed).toContain("Could not confirm");
  });
});
