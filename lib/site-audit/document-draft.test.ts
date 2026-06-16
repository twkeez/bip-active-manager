import { describe, expect, it } from "vitest";
import { buildDocumentBrandedHtml } from "@/lib/site-audit/document-brand-html";
import {
  appendBlock,
  buildDocumentDraft,
  createEmptyBlock,
  includedBlocks,
  removeBlock,
  updateBlockEntry,
} from "@/lib/site-audit/document-draft";
import { buildSiteAuditExportModel } from "@/lib/site-audit/export-model";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";

const run: WebsiteAuditRun = {
  id: 1,
  owner_user_id: "user",
  input_url: "https://example-vet.com",
  normalized_url: "https://www.example-vet.com/",
  status: "completed",
  current_stage: "summary",
  stage_status: {},
  report_json: {
    crawl: {
      baseUrl: "https://www.example-vet.com/",
      crawledUrls: 3,
      pages: [],
      issues: [
        {
          rule_id: "missing-meta",
          severity: "critical",
          category: "onpage",
          title: "Missing meta description",
          description: "Add a meta description.",
          suggestion: null,
          url: null,
        },
      ],
    },
    lighthouse: {
      scores: { performance: 62, seo: 91, accessibility: 88, bestPractices: 79 },
      metrics: { fcp: "1.8 s", lcp: "3.4 s", cls: "0.08", tbt: "180 ms", speedIndex: "4.1 s" },
      findings: [],
    },
    summary: {
      markdown: "Original summary",
      wins: [],
      concerns: [],
      prioritizedFixes: ["Fix meta description"],
    },
  },
  created_at: "2026-06-09T12:00:00.000Z",
  updated_at: "2026-06-09T12:00:00.000Z",
};

describe("buildDocumentDraft", () => {
  it("creates editable blocks from audit data", () => {
    const model = buildSiteAuditExportModel(run);
    const draft = buildDocumentDraft(model);
    expect(draft.blocks.some((entry) => entry.block.kind === "title")).toBe(true);
    expect(draft.blocks.some((entry) => entry.block.kind === "metric")).toBe(true);
    expect(draft.blocks.some((entry) => entry.block.kind === "issue-group")).toBe(true);
  });

  it("supports hiding metrics and adding headings", () => {
    const draft = buildDocumentDraft(buildSiteAuditExportModel(run));
    const metricId = draft.blocks.find((entry) => entry.block.kind === "metric")?.id;
    expect(metricId).toBeTruthy();

    let next = updateBlockEntry(draft, metricId!, (entry) => ({
      ...entry,
      included: false,
    }));
    next = appendBlock(next, createEmptyBlock("heading"));
    next = updateBlockEntry(next, next.blocks[next.blocks.length - 1].id, (entry) => ({
      ...entry,
      block: { kind: "heading", level: 2, text: "Custom Client Section" },
    }));

    const included = includedBlocks(next);
    expect(included.some((entry) => entry.id === metricId)).toBe(false);
    expect(
      included.some(
        (entry) => entry.block.kind === "heading" && entry.block.text === "Custom Client Section",
      ),
    ).toBe(true);

    const html = buildDocumentBrandedHtml(next);
    expect(html).toContain("Custom Client Section");
    expect(html).not.toContain("<strong>Performance</strong>");
  });

  it("can remove blocks entirely", () => {
    const draft = buildDocumentDraft(buildSiteAuditExportModel(run));
    const metricId = draft.blocks.find((entry) => entry.block.kind === "metric")?.id!;
    const trimmed = removeBlock(draft, metricId);
    expect(trimmed.blocks.some((entry) => entry.id === metricId)).toBe(false);
  });
});
