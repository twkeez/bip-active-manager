import { describe, expect, it } from "vitest";
import { buildPlanTimeline, formatPlainDate } from "./client-timeline";

const base = {
  kickoffMeetingAt: null,
  onboardingStartedAt: null,
  webStatus: null,
  websiteLaunchDate: null,
  servicePlan: null,
  activeServices: [] as Array<"seo" | "ppc" | "smm" | "blog" | "orm">,
};

describe("buildPlanTimeline", () => {
  it("prefers the kickoff meeting over the date onboarding started", () => {
    expect(
      buildPlanTimeline({ ...base, kickoffMeetingAt: "2026-09-16T19:00:00Z", onboardingStartedAt: "2026-09-01T12:00:00Z" })
        .kickoff,
    ).toEqual({ label: "Kickoff", date: "Sep 16, 2026" });
  });

  // The old document labelled the record's creation date "Kickoff".
  it("labels the fallback honestly as when onboarding started", () => {
    expect(buildPlanTimeline({ ...base, onboardingStartedAt: "2026-09-01T12:00:00Z" }).kickoff).toEqual({
      label: "Started",
      date: "Sep 1, 2026",
    });
  });

  it("shows a late-evening Eastern meeting on its Eastern date, not the next UTC day", () => {
    expect(buildPlanTimeline({ ...base, kickoffMeetingAt: "2026-09-17T01:30:00Z" }).kickoff?.date).toBe("Sep 16, 2026");
  });

  it("says nothing about timing when every service simply starts now", () => {
    expect(
      buildPlanTimeline({ ...base, activeServices: ["seo", "ppc"], servicePlan: { seo: { startTrigger: "start_now" } } })
        .starts,
    ).toBeNull();
  });

  // What the wizard's date picker actually stores.
  it("shows a date-only kickoff on the day that was picked", () => {
    expect(buildPlanTimeline({ ...base, kickoffMeetingAt: "2026-09-16T00:00:00+00:00" }).kickoff?.date).toBe("Sep 16, 2026");
  });

  it("names what starts now and what waits for the website", () => {
    const timeline = buildPlanTimeline({
      ...base,
      webStatus: "splash_then_full",
      websiteLaunchDate: "2026-12-01",
      activeServices: ["seo", "ppc", "smm"],
      servicePlan: { seo: { startTrigger: "at_launch" }, ppc: { startTrigger: "start_now" }, smm: { startTrigger: "at_launch" } },
    });
    expect(timeline.starts).toBe("Google Ads starts now. SEO and Social Media begin when your full website launches (Dec 1, 2026).");
    expect(timeline.website).toMatch(/splash page/);
    expect(timeline.launchDate).toBe("Dec 1, 2026");
  });

  // Tiburon: Ads go live with the splash page, SEO waits for the real site.
  it("tells the splash launch apart from the full website launch", () => {
    expect(
      buildPlanTimeline({
        ...base,
        webStatus: "splash_then_full",
        activeServices: ["seo", "ppc"],
        servicePlan: { seo: { startTrigger: "at_launch" }, ppc: { startTrigger: "at_splash" } },
      }).starts,
    ).toBe("Google Ads begins when your splash page goes live. SEO begins when your full website launches.");
  });

  it("does not say 'full' website when there is no splash page", () => {
    expect(
      buildPlanTimeline({
        ...base,
        webStatus: "wait_for_launch",
        activeServices: ["seo"],
        servicePlan: { seo: { startTrigger: "at_launch" } },
      }).starts,
    ).toBe("SEO begins when your website launches.");
  });

  it("includes a service starting on a set date", () => {
    expect(
      buildPlanTimeline({
        ...base,
        activeServices: ["seo", "blog"],
        servicePlan: { blog: { startTrigger: "on_date", startDate: "2026-10-01" } },
      }).starts,
    ).toBe("SEO starts now. Blog starts Oct 1, 2026.");
  });
});

describe("formatPlainDate", () => {
  it("does not shift a date-only value to the previous day", () => {
    expect(formatPlainDate("2026-12-01")).toBe("Dec 1, 2026");
    expect(formatPlainDate("not a date")).toBeNull();
  });
});
