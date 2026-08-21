import { describe, expect, it } from "vitest";
import { isAllowedInTeamMode, isNavItemVisible } from "@/lib/auth/app-mode";

describe("team mode route gate", () => {
  it("serves the clients section and its sub-routes", () => {
    expect(isAllowedInTeamMode("/dashboard/clients")).toBe(true);
    expect(isAllowedInTeamMode("/dashboard/clients/248")).toBe(true);
    expect(isAllowedInTeamMode("/dashboard/clients/new")).toBe(true);
  });

  it("serves the tools the team was given", () => {
    for (const path of [
      "/reports",
      "/reports/doc-to-pdf",
      "/reputation",
      "/social-planner",
      "/site-audit",
      "/sitemaps",
      "/local-rank",
      "/ads-health",
      "/ads-audit",
      "/ads-diagnostic",
      "/ads-planner",
      "/conversion-integrity",
      "/ppc-defense",
      "/global-ads-optimization",
      "/reports-print/248",
      "/onboarding-report-print/248",
      "/services",
      "/client-expectations-print/248",
    ]) {
      expect(isAllowedInTeamMode(path), path).toBe(true);
    }
  });

  it("blocks the experimental app", () => {
    for (const path of [
      "/inbox",
      "/ai-planner",
      "/sales-lab",
      "/illuminare",
      "/control-center",
      "/dashboard",
      "/dashboard/cockpit",
      "/team",
      "/backlinks",
      "/vet-onboarding",
      "/bulk-discover",
      "/llms-txt",
      "/wins",
      "/onboarding-strategy-mapper",
      "/onboarding-settings",
    ]) {
      expect(isAllowedInTeamMode(path), path).toBe(false);
    }
  });

  it("blocks tools the team has not been given yet", () => {
    for (const path of [
      "/seo-audits",
      "/seo-ops",
      "/onboarding",
      "/onboarding-sops",
      "/my-tasks",
      "/playbook",
      "/best-practices",
      "/client-expectations",
    ]) {
      expect(isAllowedInTeamMode(path), path).toBe(false);
    }
  });

  it("serves /services itself but not its children", () => {
    expect(isAllowedInTeamMode("/services")).toBe(true);
    // The Reference Library is a file store; Partnership is admin-authored.
    expect(isAllowedInTeamMode("/services/library")).toBe(false);
    expect(isAllowedInTeamMode("/services/partnership")).toBe(false);
  });

  it("serves the expectations document but not the editor", () => {
    expect(isAllowedInTeamMode("/client-expectations-print/248")).toBe(true);
    expect(isAllowedInTeamMode("/client-expectations")).toBe(false);
  });

  it("always allows sign-in and the root redirect", () => {
    expect(isAllowedInTeamMode("/")).toBe(true);
    expect(isAllowedInTeamMode("/login")).toBe(true);
    expect(isAllowedInTeamMode("/login/forgot-password")).toBe(true);
    expect(isAllowedInTeamMode("/signup")).toBe(true);
    expect(isAllowedInTeamMode("/auth/callback")).toBe(true);
  });

  it("serves the APIs the clients section calls", () => {
    for (const path of [
      "/api/clients/syncable",
      "/api/reporting/keywords",
      "/api/reports/doc-import",
      "/api/social/posts",
      "/api/ads/sync",
      "/api/reputation/248",
      "/api/seo/ops/queue",
      "/api/tasks",
      "/api/basecamp/sync",
      "/api/google/connect-status",
    ]) {
      expect(isAllowedInTeamMode(path), path).toBe(true);
    }
  });

  it("blocks the experimental APIs", () => {
    for (const path of [
      "/api/gmail/messages",
      "/api/illuminare/clients",
      "/api/sales-lab/drafts",
      "/api/strategy-mapper/run",
      "/api/vet-onboarding/steps",
      "/api/backlinks/scan",
      "/api/discovery/run",
      "/api/wins/list",
    ]) {
      expect(isAllowedInTeamMode(path), path).toBe(false);
    }
  });

  it("matches on whole path segments, not bare prefixes", () => {
    expect(isAllowedInTeamMode("/reportsomething")).toBe(false);
    expect(isAllowedInTeamMode("/dashboard/clientsomething")).toBe(false);
    expect(isAllowedInTeamMode("/api/adsomething/x")).toBe(false);
  });
});

describe("nav visibility", () => {
  it("hides links team mode would bounce", () => {
    expect(isNavItemVisible("/inbox", "team")).toBe(false);
    expect(isNavItemVisible("/reputation", "team")).toBe(true);
  });

  it("shows everything in full mode", () => {
    expect(isNavItemVisible("/inbox", "full")).toBe(true);
    expect(isNavItemVisible("/sales-lab", "full")).toBe(true);
  });
});
