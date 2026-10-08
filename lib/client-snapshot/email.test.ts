import { describe, expect, it } from "vitest";
import { buildSnapshotEmail, parseRecipients } from "./email";
import type { ClientSnapshot } from "./load";

describe("snapshot email", () => {
  it("checks and tidies recipients", () => {
    expect(parseRecipients("A@clinic.com, b@clinic.com\na@clinic.com")).toEqual(["a@clinic.com", "b@clinic.com"]);
    expect(() => parseRecipients("not-an-email")).toThrow("Not an email address");
    expect(parseRecipients("")).toEqual([]);
  });

  it("writes a short email with the link and up to three highlights", () => {
    const snapshot = {
      clientId: 81,
      clientName: "Dallas Highway Animal Hospital",
      generatedAt: "2026-10-08T00:00:00Z",
      work: [],
      omitted: [],
      incomplete: false,
      sections: [
        { key: "ads", title: "Google Ads", period: "", metrics: [
          { label: "Calls from your ads", value: 77, previous: null, format: "count" },
          { label: "Leads (calls and forms)", value: 33, previous: null, format: "count" },
        ] },
        { key: "website", title: "Your website", period: "", metrics: [{ label: "Visitors", value: 1997, previous: 1507, format: "count" }] },
        { key: "listing", title: "Listing", period: "", metrics: [{ label: "Google reviews", value: 407, previous: 398, format: "count" }] },
      ],
    } as ClientSnapshot;
    const email = buildSnapshotEmail(snapshot, "https://example.test/s/abc", "October");
    expect(email.subject).toBe("Your October marketing snapshot from Beyond Indigo Pets");
    expect(email.body).toContain("https://example.test/s/abc");
    expect(email.body).toContain("• Calls from your ads: 77");
    expect(email.body).toContain("• Visitors: 1,997");
    expect(email.body).not.toContain("Google reviews");
    expect(email.body).toContain("https://help.beyondindigo.com");
  });
});
