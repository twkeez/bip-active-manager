import { describe, expect, it } from "vitest";
import {
  buildStrategistNotifyMailto,
  getStrategistRoster,
  matchStrategistByName,
  parseStrategistContacts,
} from "@/lib/team/strategist-roster";

describe("parseStrategistContacts", () => {
  it("parses name:email pairs", () => {
    const map = parseStrategistContacts(
      "Alex:alex@beyondindigo.com, Stephanie:stephanie@beyondindigo.com",
    );
    expect(map.get("alex")).toBe("alex@beyondindigo.com");
    expect(map.get("stephanie")).toBe("stephanie@beyondindigo.com");
  });

  it("ignores malformed entries", () => {
    const map = parseStrategistContacts("Alex,BadEntry,Beth:not-an-email");
    expect(map.size).toBe(0);
  });
});

describe("getStrategistRoster", () => {
  it("merges fixed assignees with configured emails", () => {
    const roster = getStrategistRoster("Alex:alex@example.com,Melissa:melissa@example.com");
    const alex = roster.find((entry) => entry.name === "Alex");
    const stephanie = roster.find((entry) => entry.name === "Stephanie");
    expect(alex?.email).toBe("alex@example.com");
    expect(stephanie?.email).toBeNull();
  });

  it("includes extra contacts from env not in fixed roster", () => {
    const roster = getStrategistRoster("Daniel:daniel@example.com");
    expect(roster.some((entry) => entry.name === "Daniel" && entry.email === "daniel@example.com")).toBe(
      true,
    );
  });
});

describe("matchStrategistByName", () => {
  const roster = getStrategistRoster("Alex:alex@example.com,Stephanie:stephanie@example.com");

  it("matches strategist names by token overlap", () => {
    expect(matchStrategistByName("Stephanie", roster)?.name).toBe("Stephanie");
    expect(matchStrategistByName("Alex", roster)?.name).toBe("Alex");
  });

  it("returns null for non-person values like Low Contact", () => {
    expect(matchStrategistByName("Low Contact", roster)).toBeNull();
  });

  it("returns null when strategist is empty", () => {
    expect(matchStrategistByName(null, roster)).toBeNull();
  });
});

describe("buildStrategistNotifyMailto", () => {
  it("builds a mailto url with subject, body, and workspace link", () => {
    const url = buildStrategistNotifyMailto({
      to: "alex@example.com",
      client: {
        id: 68,
        account_name: "Central Coast",
        marketing_strategist: "Low Contact",
      },
      thread: {
        occurred_at: new Date().toISOString(),
        thread_title: "Hollis updates",
        thread_excerpt: "Everything is good to go on my end!",
        thread_body: null,
        thread_url: "https://3.basecampapi.com/123/buckets/1/messages/99.json",
      },
      appUrl: "https://app.example.com",
      senderEmail: "ops@example.com",
    });

    expect(url.startsWith("mailto:")).toBe(true);
    expect(url).toContain("alex%40example.com");
    expect(url).toContain("Client+reply+needed+-+Central+Coast");
    expect(url).toContain("dashboard%2Fclients%2F68");
    expect(url).toContain("Everything+is+good+to+go+on+my+end");
    expect(url).toContain("ops%40example.com");
  });
});
