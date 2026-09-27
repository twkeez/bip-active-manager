import { describe, expect, it } from "vitest";
import { reminderEmail } from "./email";

const base = {
  accountName: "Paws Veterinary Clinic",
  cadence: "twice_monthly" as const,
  runDate: "2026-10-05",
  recipientNames: ["Melissa", "Stephanie"],
  clientMessage: "Hi Dr. Riff, calls from ads were up 20% this month.",
  strategistNote: "Paws — SEO, Ads\nNothing needs you.",
  basecampProjectId: "123",
};

describe("reminderEmail", () => {
  it("includes the draft, the private note, the project and where to mark it complete", () => {
    const { subject, body } = reminderEmail(base);
    expect(subject).toBe("Client update due: Paws Veterinary Clinic");
    expect(body).toContain("Hi Melissa and Stephanie,");
    expect(body).toContain("twice-monthly client update (October 5)");
    expect(body).toContain("calls from ads were up 20%");
    expect(body).toContain("For you, not the client:");
    expect(body).toContain("https://basecamp.com/2175055/projects/123");
    expect(body).toContain("/follow-ups");
  });

  it("suggests a personal check-in when there is no draft, and labels Low Contact", () => {
    const { subject, body } = reminderEmail({ ...base, cadence: "monthly", clientMessage: null, basecampProjectId: null });
    expect(subject).toBe("Client update due: Paws Veterinary Clinic (Low Contact)");
    expect(body).toContain("personal check-in");
    expect(body).not.toContain("----------");
    expect(body).toContain("No Basecamp project is linked");
  });
});
