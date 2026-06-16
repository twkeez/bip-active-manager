import { describe, expect, it } from "vitest";
import {
  assembleWebsiteSeoSection,
  buildWebsiteAuditSectionTitle,
  mergeWebsiteSeoAuditIntoReport,
} from "@/lib/strategy-mapper/website-seo-report";
import type {
  StrategyMapperFormData,
  StrategyMapperReport,
  WebsiteSeoAuditResult,
} from "@/types/strategy-mapper";

const form: StrategyMapperFormData = {
  practiceName: "Example Vet",
  practiceOwnerName: "",
  streetAddress: "123 Main St",
  locationNotes: "",
  specializations: [],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  siteContext: "existing_active",
  strategicContextNotes: "",
};

const audit: WebsiteSeoAuditResult = {
  url: "https://example.com",
  finalUrl: "https://example.com/",
  auditMode: "fix_now",
  homepage: {
    title: "Example Vet",
    metaDescription: null,
    h1Count: 0,
    canonical: null,
    issues: [
      {
        id: "missing-h1",
        severity: "critical",
        title: "Missing H1",
        description: "No H1",
      },
    ],
  },
  crawl: { pagesScanned: 2, issueCount: 1, topIssues: [] },
  keywordAlignment: {
    matrixRows: [],
    coverage: [],
    gaps: ["emergency vet"],
  },
  redFlagSummary: ["Homepage: Missing H1"],
};

const baseReport: StrategyMapperReport = {
  executiveSummary: {
    missionStatement: "Mission",
    narrative: "Narrative",
    painPointResolution: "Pain",
    coreFocusAreas: ["Focus one"],
  },
  seoKeywordMatrix: [],
  activeStrategies: {},
  competitiveAuditRows: [],
  growthOpportunities: [],
  launchRoadmap: [],
  internalStrategistChecklist: [],
};

describe("website seo report helpers", () => {
  it("titles fix_now vs pre_launch sections", () => {
    expect(buildWebsiteAuditSectionTitle("fix_now")).toContain("Red Flags");
    expect(buildWebsiteAuditSectionTitle("pre_launch_baseline")).toContain("Pre-Launch");
  });

  it("merges audit section and prepends red flags to core focus for existing sites", () => {
    const merged = mergeWebsiteSeoAuditIntoReport(baseReport, audit, form, ["seo"]);
    expect(merged.websiteSeoAudit?.sectionTitle).toContain("Red Flags");
    expect(merged.executiveSummary.coreFocusAreas[0]).toContain("Site audit:");
    expect(merged.websiteSeoAudit?.keywordGaps).toEqual(["emergency vet"]);
  });

  it("builds report section from audit payload", () => {
    const section = assembleWebsiteSeoSection(audit, form);
    expect(section.homepageTitle).toBe("Example Vet");
    expect(section.framingNote.length).toBeGreaterThan(20);
  });
});
