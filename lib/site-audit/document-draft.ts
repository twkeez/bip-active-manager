import { INSPECTOR_TAB_LABELS, type SiteAuditExportModel } from "@/lib/site-audit/export-model";
import type { InspectorPriority, InspectorTab } from "@/lib/site-audit/inspector-issues";

export const DOCUMENT_DRAFT_VERSION = 2;

export type EditableIssue = {
  id: string;
  tab: InspectorTab;
  priority: InspectorPriority;
  source: string;
  title: string;
  description: string;
  included: boolean;
};

export type SiteAuditDocumentBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "meta"; label: string; value: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "metric"; label: string; value: string }
  | { kind: "issue-group"; heading: string; issues: EditableIssue[] }
  | {
      kind: "vitals";
      heading: string;
      items: Array<{ label: string; value: string }>;
    }
  | {
      kind: "sitemap";
      heading: string;
      url: string;
      found: boolean;
      urlCount: number;
    }
  | {
      kind: "schema";
      heading: string;
      summary: string;
      recommendations: string[];
    }
  | {
      kind: "query-table";
      heading: string;
      rows: Array<{
        query: string;
        clicks: number;
        impressions: number;
        position: number;
      }>;
    }
  | {
      kind: "page-table";
      heading: string;
      rows: Array<{
        url: string;
        status: number;
        wordCount: number;
        title: string | null;
      }>;
    };

export type SiteAuditDocumentBlockEntry = {
  id: string;
  included: boolean;
  block: SiteAuditDocumentBlock;
};

export type SiteAuditDocumentDraft = {
  version: typeof DOCUMENT_DRAFT_VERSION;
  blocks: SiteAuditDocumentBlockEntry[];
};

/** @deprecated Use SiteAuditDocumentDraft */
export type SiteAuditEditableDraft = {
  executiveSummary: string;
  prioritizedFixes: string[];
  issues: EditableIssue[];
  schemaRecommendations: string[];
};

let blockCounter = 0;

export function newBlockId(prefix: string): string {
  blockCounter += 1;
  return `${prefix}-${blockCounter}`;
}

export function documentDraftStorageKey(runId: number): string {
  return `site-audit-document-draft:${runId}`;
}

export function legacyEditableDraftStorageKey(runId: number): string {
  return `site-audit-editable-export:${runId}`;
}

export function buildDocumentDraft(model: SiteAuditExportModel): SiteAuditDocumentDraft {
  blockCounter = 0;
  const blocks: SiteAuditDocumentBlockEntry[] = [];

  const push = (prefix: string, block: SiteAuditDocumentBlock) => {
    blocks.push({ id: newBlockId(prefix), included: true, block });
  };

  push("title", { kind: "title", text: "Website SEO Audit" });
  push("meta", { kind: "meta", label: "Site", value: model.siteUrl });
  if (model.normalizedUrl && model.normalizedUrl !== model.siteUrl) {
    push("meta", { kind: "meta", label: "Resolved URL", value: model.normalizedUrl });
  }
  push("meta", { kind: "meta", label: "Audit date", value: model.formattedDate });
  push("meta", { kind: "meta", label: "Status", value: model.status });

  const lighthouseMetrics = model.scoreCards.filter((card) =>
    ["Performance", "SEO", "Accessibility", "Best practices"].includes(card.label),
  );
  if (lighthouseMetrics.length > 0) {
    push("heading", { kind: "heading", level: 2, text: "Lighthouse Scores" });
    for (const card of lighthouseMetrics) {
      push("metric", { kind: "metric", label: card.label, value: card.value });
    }
  }

  const snapshotMetrics = model.scoreCards.filter(
    (card) => !["Performance", "SEO", "Accessibility", "Best practices"].includes(card.label),
  );
  if (snapshotMetrics.length > 0) {
    push("heading", { kind: "heading", level: 2, text: "Audit Snapshot" });
    for (const card of snapshotMetrics) {
      push("metric", { kind: "metric", label: card.label, value: card.value });
    }
  }

  push("heading", { kind: "heading", level: 2, text: "Executive Summary" });
  push("paragraph", {
    kind: "paragraph",
    text: model.summary?.markdown ?? "",
  });

  push("heading", { kind: "heading", level: 2, text: "Prioritized Fixes" });
  push("bullets", {
    kind: "bullets",
    items: [...(model.summary?.prioritizedFixes ?? [])],
  });

  push("heading", { kind: "heading", level: 2, text: "Issue Checklist" });
  push("paragraph", {
    kind: "paragraph",
    text: `Critical: ${model.issueSummary.critical} · High priority: ${model.issueSummary.high} · Minor: ${model.issueSummary.mediumLow} · Passed checks: ${model.issueSummary.passed}`,
  });

  for (const tab of ["seo", "performance", "code"] as InspectorTab[]) {
    const items = model.issuesByTab[tab].items;
    if (!items.length) continue;
    push("issue-group", {
      kind: "issue-group",
      heading: INSPECTOR_TAB_LABELS[tab],
      issues: items.map((issue) => ({
        id: issue.id,
        tab: issue.tab,
        priority: issue.priority,
        source: issue.source,
        title: issue.title,
        description: issue.description ?? "",
        included: true,
      })),
    });
    if (model.issuesByTab[tab].truncatedCount > 0) {
      push("paragraph", {
        kind: "paragraph",
        text: `+ ${model.issuesByTab[tab].truncatedCount} additional issues available in the app.`,
      });
    }
  }

  if (model.lighthouseMetrics) {
    push("vitals", {
      kind: "vitals",
      heading: "Core Web Vitals (mobile)",
      items: [
        { label: "FCP", value: model.lighthouseMetrics.fcp },
        { label: "LCP", value: model.lighthouseMetrics.lcp },
        { label: "CLS", value: model.lighthouseMetrics.cls },
        { label: "TBT", value: model.lighthouseMetrics.tbt },
        { label: "Speed Index", value: model.lighthouseMetrics.speedIndex },
      ],
    });
  }

  if (model.sitemap) {
    push("sitemap", {
      kind: "sitemap",
      heading: "Sitemap",
      url: model.sitemap.url,
      found: model.sitemap.found,
      urlCount: model.sitemap.urlCount,
    });
  }

  if (model.schema) {
    push("schema", {
      kind: "schema",
      heading: "Structured Data",
      summary: `Schema detected on ${model.schema.pagesWithSchema} pages${
        model.schema.types.length ? ` · Types: ${model.schema.types.join(", ")}` : ""
      }`,
      recommendations: [...model.schema.recommendations],
    });
  }

  if (model.topQueries.length > 0) {
    push("query-table", {
      kind: "query-table",
      heading: model.keywordsLabel ?? "Top search queries",
      rows: model.topQueries.map((row) => ({ ...row })),
    });
  }

  if (model.topPages.length > 0) {
    push("page-table", {
      kind: "page-table",
      heading: `Page Inventory (sample ${model.topPages.length} of ${model.totalPagesCrawled})`,
      rows: model.topPages.map((page) => ({ ...page })),
    });
  }

  return { version: DOCUMENT_DRAFT_VERSION, blocks };
}

export function createEmptyBlock(
  kind: SiteAuditDocumentBlock["kind"],
): SiteAuditDocumentBlock {
  switch (kind) {
    case "title":
      return { kind: "title", text: "New Section Title" };
    case "heading":
      return { kind: "heading", level: 2, text: "New Heading" };
    case "meta":
      return { kind: "meta", label: "Label", value: "Value" };
    case "paragraph":
      return { kind: "paragraph", text: "" };
    case "bullets":
      return { kind: "bullets", items: [""] };
    case "metric":
      return { kind: "metric", label: "Metric", value: "0" };
    case "issue-group":
      return { kind: "issue-group", heading: "Issues", issues: [] };
    case "vitals":
      return { kind: "vitals", heading: "Core Web Vitals", items: [{ label: "LCP", value: "—" }] };
    case "sitemap":
      return { kind: "sitemap", heading: "Sitemap", url: "", found: false, urlCount: 0 };
    case "schema":
      return { kind: "schema", heading: "Structured Data", summary: "", recommendations: [] };
    case "query-table":
      return { kind: "query-table", heading: "Search Queries", rows: [] };
    case "page-table":
      return { kind: "page-table", heading: "Page Inventory", rows: [] };
  }
}

export function insertBlock(
  draft: SiteAuditDocumentDraft,
  index: number,
  block: SiteAuditDocumentBlock,
  prefix = "custom",
): SiteAuditDocumentDraft {
  const entry: SiteAuditDocumentBlockEntry = {
    id: newBlockId(prefix),
    included: true,
    block,
  };
  const blocks = [...draft.blocks];
  blocks.splice(index, 0, entry);
  return { ...draft, blocks };
}

export function appendBlock(
  draft: SiteAuditDocumentDraft,
  block: SiteAuditDocumentBlock,
  prefix = "custom",
): SiteAuditDocumentDraft {
  return insertBlock(draft, draft.blocks.length, block, prefix);
}

export function removeBlock(draft: SiteAuditDocumentDraft, id: string): SiteAuditDocumentDraft {
  return {
    ...draft,
    blocks: draft.blocks.filter((entry) => entry.id !== id),
  };
}

export function moveBlock(
  draft: SiteAuditDocumentDraft,
  id: string,
  direction: -1 | 1,
): SiteAuditDocumentDraft {
  const index = draft.blocks.findIndex((entry) => entry.id === id);
  if (index < 0) return draft;
  const target = index + direction;
  if (target < 0 || target >= draft.blocks.length) return draft;
  const blocks = [...draft.blocks];
  const [entry] = blocks.splice(index, 1);
  blocks.splice(target, 0, entry);
  return { ...draft, blocks };
}

export function updateBlockEntry(
  draft: SiteAuditDocumentDraft,
  id: string,
  updater: (entry: SiteAuditDocumentBlockEntry) => SiteAuditDocumentBlockEntry,
): SiteAuditDocumentDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((entry) => (entry.id === id ? updater(entry) : entry)),
  };
}

export function includedBlocks(draft: SiteAuditDocumentDraft): SiteAuditDocumentBlockEntry[] {
  return draft.blocks.filter((entry) => entry.included);
}

export function documentDraftFilename(
  draft: SiteAuditDocumentDraft,
  fallback: SiteAuditExportModel,
): string {
  const siteBlock = draft.blocks.find(
    (entry) => entry.included && entry.block.kind === "meta" && entry.block.label === "Site",
  )?.block;
  const siteUrl =
    siteBlock && siteBlock.kind === "meta"
      ? siteBlock.value
      : fallback.normalizedUrl ?? fallback.siteUrl;
  const dateBlock = draft.blocks.find(
    (entry) => entry.included && entry.block.kind === "meta" && entry.block.label === "Audit date",
  )?.block;
  const date =
    dateBlock && dateBlock.kind === "meta"
      ? dateBlock.value.slice(0, 10)
      : fallback.generatedAt.slice(0, 10);
  const slug = siteUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `Beyond-Indigo-Site-Audit-${slug || "site"}-${date}.pdf`;
}

function migrateLegacyEditableDraft(
  legacy: SiteAuditEditableDraft,
  model: SiteAuditExportModel,
): SiteAuditDocumentDraft {
  const draft = buildDocumentDraft(model);

  const blocks = draft.blocks.map((entry, index) => {
    const prev = draft.blocks[index - 1]?.block;

    if (
      entry.block.kind === "paragraph" &&
      prev?.kind === "heading" &&
      prev.text === "Executive Summary"
    ) {
      return {
        ...entry,
        block: { kind: "paragraph" as const, text: legacy.executiveSummary },
      };
    }

    if (
      entry.block.kind === "bullets" &&
      prev?.kind === "heading" &&
      prev.text === "Prioritized Fixes"
    ) {
      return {
        ...entry,
        block: { kind: "bullets" as const, items: [...legacy.prioritizedFixes] },
      };
    }

    if (entry.block.kind === "issue-group") {
      return {
        ...entry,
        block: {
          ...entry.block,
          issues: entry.block.issues.map((issue) => {
            const edited = legacy.issues.find((item) => item.id === issue.id);
            return edited ?? issue;
          }),
        },
      };
    }

    if (entry.block.kind === "schema") {
      return {
        ...entry,
        block: {
          ...entry.block,
          recommendations: [...legacy.schemaRecommendations],
        },
      };
    }

    return entry;
  });

  return { ...draft, blocks };
}

function parseStoredDraft(raw: string, model: SiteAuditExportModel): SiteAuditDocumentDraft | null {
  try {
    const parsed = JSON.parse(raw) as SiteAuditDocumentDraft | SiteAuditEditableDraft;
    if ("version" in parsed && parsed.version === DOCUMENT_DRAFT_VERSION && parsed.blocks) {
      return parsed as SiteAuditDocumentDraft;
    }
    if ("executiveSummary" in parsed) {
      return migrateLegacyEditableDraft(parsed as SiteAuditEditableDraft, model);
    }
    return null;
  } catch {
    return null;
  }
}

export function loadDocumentDraft(
  runId: number,
  model: SiteAuditExportModel,
): SiteAuditDocumentDraft | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(documentDraftStorageKey(runId));
  if (current) return parseStoredDraft(current, model);
  const legacy = window.localStorage.getItem(legacyEditableDraftStorageKey(runId));
  if (legacy) return parseStoredDraft(legacy, model);
  return null;
}

export function saveDocumentDraft(runId: number, draft: SiteAuditDocumentDraft): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(documentDraftStorageKey(runId), JSON.stringify(draft));
}

/** @deprecated */
export function editableDraftStorageKey(runId: number): string {
  return legacyEditableDraftStorageKey(runId);
}

/** @deprecated */
export function buildEditableDraft(model: SiteAuditExportModel): SiteAuditEditableDraft {
  const draft = buildDocumentDraft(model);
  const executive =
    draft.blocks.find(
      (entry) =>
        entry.block.kind === "paragraph" &&
        draft.blocks[draft.blocks.indexOf(entry) - 1]?.block.kind === "heading" &&
        (draft.blocks[draft.blocks.indexOf(entry) - 1]?.block as { text?: string }).text ===
          "Executive Summary",
    )?.block ?? null;
  return {
    executiveSummary: executive && executive.kind === "paragraph" ? executive.text : "",
    prioritizedFixes: [],
    issues: [],
    schemaRecommendations: [],
  };
}

/** @deprecated */
export function applyEditableDraft(
  base: SiteAuditExportModel,
  _draft: SiteAuditEditableDraft,
): SiteAuditExportModel {
  return base;
}

/** @deprecated Use loadDocumentDraft */
export function loadEditableDraft(_runId: number): SiteAuditEditableDraft | null {
  return null;
}

/** @deprecated Use saveDocumentDraft */
export function saveEditableDraft(_runId: number, _draft: SiteAuditEditableDraft): void {
  // no-op
}
