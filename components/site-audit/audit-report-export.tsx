"use client";

import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import {
  ReportDocumentShell,
  ReportFooter,
  ReportPageHeader,
  ReportSection,
  ReportObservationCallout,
  ReportCard,
} from "@/components/vet-onboarding/report/report-chrome";
import "@/components/vet-onboarding/report/report-theme.css";
import type {
  EditableIssue,
  SiteAuditDocumentBlock,
  SiteAuditDocumentBlockEntry,
  SiteAuditDocumentDraft,
} from "@/lib/site-audit/document-draft";
import { updateBlockEntry } from "@/lib/site-audit/document-draft";
import type { InspectorPriority } from "@/lib/site-audit/inspector-issues";

const EDITABLE_FIELD_CLASS =
  "w-full rounded-lg border border-[var(--report-border)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--report-text)] focus:border-[var(--report-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--report-teal)] print:border-0 print:bg-transparent print:px-0 print:py-0 print:shadow-none print:ring-0";

const PRIORITY_STYLES: Record<
  InspectorPriority,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  high: {
    label: "High Priority",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  medium: {
    label: "Minor Adjust",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function EditableTextarea({
  value,
  onChange,
  rows = 3,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      className={`${EDITABLE_FIELD_CLASS} ${className}`}
    />
  );
}

function BlockChrome({
  entry,
  index,
  total,
  onToggleIncluded,
  onRemove,
  onMove,
}: {
  entry: SiteAuditDocumentBlockEntry;
  index: number;
  total: number;
  onToggleIncluded: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="vet-output-no-print mb-2 flex flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        onClick={onToggleIncluded}
        className="inline-flex items-center gap-1 rounded border border-[var(--report-border)] px-2 py-0.5 text-[10px] text-[var(--report-muted)] hover:bg-[var(--report-row-alt)]"
      >
        {entry.included ? <EyeOff size={12} /> : <Eye size={12} />}
        {entry.included ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="rounded border border-[var(--report-border)] p-1 text-[var(--report-muted)] hover:bg-[var(--report-row-alt)] disabled:opacity-40"
        aria-label="Move up"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        disabled={index >= total - 1}
        onClick={() => onMove(1)}
        className="rounded border border-[var(--report-border)] p-1 text-[var(--report-muted)] hover:bg-[var(--report-row-alt)] disabled:opacity-40"
        aria-label="Move down"
      >
        <ChevronDown size={12} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
      >
        <Trash2 size={12} />
        Remove
      </button>
    </div>
  );
}

function updateIssueInGroup(
  draft: SiteAuditDocumentDraft,
  entryId: string,
  issueId: string,
  patch: Partial<EditableIssue>,
): SiteAuditDocumentDraft {
  return updateBlockEntry(draft, entryId, (entry) => {
    if (entry.block.kind !== "issue-group") return entry;
    return {
      ...entry,
      block: {
        ...entry.block,
        issues: entry.block.issues.map((issue) =>
          issue.id === issueId ? { ...issue, ...patch } : issue,
        ),
      },
    };
  });
}

type Props = {
  draft: SiteAuditDocumentDraft;
  onDraftChange: (draft: SiteAuditDocumentDraft) => void;
  onRemoveBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
};

export default function AuditReportExport({
  draft,
  onDraftChange,
  onRemoveBlock,
  onMoveBlock,
}: Props) {
  function patchBlock(id: string, block: SiteAuditDocumentBlock) {
    onDraftChange(updateBlockEntry(draft, id, (entry) => ({ ...entry, block })));
  }

  function toggleIncluded(id: string) {
    onDraftChange(
      updateBlockEntry(draft, id, (entry) => ({ ...entry, included: !entry.included })),
    );
  }

  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < draft.blocks.length) {
    const entry = draft.blocks[index];
    const chrome = (
      <BlockChrome
        entry={entry}
        index={index}
        total={draft.blocks.length}
        onToggleIncluded={() => toggleIncluded(entry.id)}
        onRemove={() => onRemoveBlock(entry.id)}
        onMove={(direction) => onMoveBlock(entry.id, direction)}
      />
    );
    const wrapperClass = entry.included
      ? "mb-6 print:break-inside-avoid"
      : "audit-export-block-hidden vet-output-no-print mb-4 rounded-lg border border-dashed border-[var(--report-border)] bg-[var(--report-row-alt)]/60 p-3 opacity-60";

    if (entry.block.kind === "metric") {
      const metricEntries: SiteAuditDocumentBlockEntry[] = [];
      while (
        index < draft.blocks.length &&
        draft.blocks[index].block.kind === "metric"
      ) {
        metricEntries.push(draft.blocks[index]);
        index += 1;
      }
      nodes.push(
        <div key={`metrics-${metricEntries[0].id}`} className="mb-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricEntries.map((metricEntry, metricIndex) => {
              const block = metricEntry.block;
              if (block.kind !== "metric") return null;
              const globalIndex = draft.blocks.findIndex((item) => item.id === metricEntry.id);
              return (
                <div
                  key={metricEntry.id}
                  className={
                    metricEntry.included
                      ? "print:break-inside-avoid"
                      : "audit-export-block-hidden vet-output-no-print opacity-50"
                  }
                >
                  <BlockChrome
                    entry={metricEntry}
                    index={globalIndex}
                    total={draft.blocks.length}
                    onToggleIncluded={() => toggleIncluded(metricEntry.id)}
                    onRemove={() => onRemoveBlock(metricEntry.id)}
                    onMove={(direction) => onMoveBlock(metricEntry.id, direction)}
                  />
                  {metricEntry.included ? (
                    <ReportCard className="p-4">
                      <label className="vet-output-no-print mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--report-footer)]">
                        Metric label
                      </label>
                      <EditableTextarea
                        value={block.label}
                        onChange={(label) =>
                          patchBlock(metricEntry.id, { kind: "metric", label, value: block.value })
                        }
                        rows={1}
                        className="mb-2 text-xs font-semibold uppercase text-[var(--report-muted)]"
                      />
                      <EditableTextarea
                        value={block.value}
                        onChange={(value) =>
                          patchBlock(metricEntry.id, { kind: "metric", label: block.label, value })
                        }
                        rows={1}
                        className="text-3xl font-bold text-[var(--report-navy)]"
                      />
                    </ReportCard>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>,
      );
      continue;
    }

    const block = entry.block;
    nodes.push(
      <div key={entry.id} className={wrapperClass}>
        {chrome}
        {!entry.included ? (
          <p className="text-xs italic text-[var(--report-muted)]">
            Hidden from export — click Show to include again
          </p>
        ) : null}
        {entry.included && block.kind === "title" ? (
          <ReportSection>
            <EditableTextarea
              value={block.text}
              onChange={(text) => patchBlock(entry.id, { kind: "title", text })}
              rows={1}
              className="text-2xl font-bold uppercase tracking-wide text-[var(--report-purple)] sm:text-3xl"
            />
          </ReportSection>
        ) : null}
        {entry.included && block.kind === "heading" && block.level === 2 ? (
          <ReportSection>
            <EditableTextarea
              value={block.text}
              onChange={(text) => patchBlock(entry.id, { kind: "heading", level: 2, text })}
              rows={1}
              className="text-2xl font-bold uppercase tracking-wide text-[var(--report-purple)] sm:text-3xl"
            />
          </ReportSection>
        ) : null}
        {entry.included && block.kind === "heading" && block.level === 3 ? (
          <EditableTextarea
            value={block.text}
            onChange={(text) => patchBlock(entry.id, { kind: "heading", level: 3, text })}
            rows={1}
            className="mb-4 text-lg font-bold text-[var(--report-magenta)]"
          />
        ) : null}
        {entry.included && block.kind === "meta" ? (
          <p className="text-sm text-[var(--report-muted)]">
            <EditableTextarea
              value={block.label}
              onChange={(label) => patchBlock(entry.id, { kind: "meta", label, value: block.value })}
              rows={1}
              className="mb-1 inline-block max-w-[8rem] font-semibold text-[var(--report-navy)]"
            />
            <EditableTextarea
              value={block.value}
              onChange={(value) => patchBlock(entry.id, { kind: "meta", label: block.label, value })}
              rows={1}
              className="inline-block flex-1"
            />
          </p>
        ) : null}
        {entry.included && block.kind === "paragraph" ? (
          <ReportObservationCallout>
            <EditableTextarea
              value={block.text}
              onChange={(text) => patchBlock(entry.id, { kind: "paragraph", text })}
              rows={4}
            />
          </ReportObservationCallout>
        ) : null}
        {entry.included && block.kind === "bullets" ? (
          <ul className="space-y-2">
            {block.items.map((item, itemIndex) => (
              <li key={`${entry.id}-bullet-${itemIndex}`} className="flex gap-2 print:break-inside-avoid">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--report-accent)]" />
                <div className="min-w-0 flex-1">
                  <EditableTextarea
                    value={item}
                    onChange={(value) =>
                      patchBlock(entry.id, {
                        kind: "bullets",
                        items: block.items.map((existing, i) =>
                          i === itemIndex ? value : existing,
                        ),
                      })
                    }
                    rows={1}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patchBlock(entry.id, {
                        kind: "bullets",
                        items: block.items.filter((_, i) => i !== itemIndex),
                      })
                    }
                    className="vet-output-no-print mt-1 text-[10px] text-red-600 hover:underline"
                  >
                    Remove bullet
                  </button>
                </div>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() =>
                  patchBlock(entry.id, { kind: "bullets", items: [...block.items, ""] })
                }
                className="vet-output-no-print text-xs font-medium text-[var(--report-purple)] hover:underline"
              >
                + Add bullet
              </button>
            </li>
          </ul>
        ) : null}
        {entry.included && block.kind === "issue-group" ? (
          <div className="space-y-3">
            <EditableTextarea
              value={block.heading}
              onChange={(heading) =>
                patchBlock(entry.id, { kind: "issue-group", heading, issues: block.issues })
              }
              rows={1}
              className="text-lg font-bold text-[var(--report-magenta)]"
            />
            <ul className="space-y-3">
              {block.issues.map((issue) => {
                const badge = PRIORITY_STYLES[issue.priority];
                if (!issue.included) {
                  return (
                    <li
                      key={issue.id}
                      className="vet-output-no-print rounded-lg border border-dashed border-[var(--report-border)] p-3 opacity-70"
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={issue.included}
                          onChange={(event) =>
                            onDraftChange(
                              updateIssueInGroup(draft, entry.id, issue.id, {
                                included: event.target.checked,
                              }),
                            )
                          }
                        />
                        Excluded: {issue.title}
                      </label>
                    </li>
                  );
                }
                return (
                  <li
                    key={issue.id}
                    className="rounded-lg border border-[var(--report-border)] bg-white p-4 print:break-inside-avoid"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <EditableTextarea
                        value={issue.title}
                        onChange={(title) =>
                          onDraftChange(updateIssueInGroup(draft, entry.id, issue.id, { title }))
                        }
                        rows={1}
                        className="flex-1 font-semibold text-[var(--report-navy)]"
                      />
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <EditableTextarea
                      value={issue.description}
                      onChange={(description) =>
                        onDraftChange(
                          updateIssueInGroup(draft, entry.id, issue.id, { description }),
                        )
                      }
                      rows={2}
                      className="mt-2"
                    />
                    <label className="vet-output-no-print mt-2 flex items-center gap-2 text-xs text-[var(--report-muted)]">
                      <input
                        type="checkbox"
                        checked={issue.included}
                        onChange={(event) =>
                          onDraftChange(
                            updateIssueInGroup(draft, entry.id, issue.id, {
                              included: event.target.checked,
                            }),
                          )
                        }
                      />
                      Include in export
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {entry.included && block.kind === "vitals" ? (
          <div>
            <EditableTextarea
              value={block.heading}
              onChange={(heading) =>
                patchBlock(entry.id, { kind: "vitals", heading, items: block.items })
              }
              rows={1}
              className="mb-3 text-lg font-bold text-[var(--report-magenta)]"
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {block.items.map((item, itemIndex) => (
                <div key={`${entry.id}-vital-${itemIndex}`} className="rounded border border-[var(--report-border)] p-2">
                  <EditableTextarea
                    value={item.label}
                    onChange={(label) =>
                      patchBlock(entry.id, {
                        kind: "vitals",
                        heading: block.heading,
                        items: block.items.map((existing, i) =>
                          i === itemIndex ? { ...existing, label } : existing,
                        ),
                      })
                    }
                    rows={1}
                    className="mb-1 text-xs font-semibold uppercase"
                  />
                  <EditableTextarea
                    value={item.value}
                    onChange={(value) =>
                      patchBlock(entry.id, {
                        kind: "vitals",
                        heading: block.heading,
                        items: block.items.map((existing, i) =>
                          i === itemIndex ? { ...existing, value } : existing,
                        ),
                      })
                    }
                    rows={1}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patchBlock(entry.id, {
                        kind: "vitals",
                        heading: block.heading,
                        items: block.items.filter((_, i) => i !== itemIndex),
                      })
                    }
                    className="vet-output-no-print mt-1 text-[10px] text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                patchBlock(entry.id, {
                  kind: "vitals",
                  heading: block.heading,
                  items: [...block.items, { label: "Metric", value: "—" }],
                })
              }
              className="vet-output-no-print mt-2 text-xs text-[var(--report-purple)] hover:underline"
            >
              + Add vital
            </button>
          </div>
        ) : null}
        {entry.included && block.kind === "sitemap" ? (
          <ReportCard className="space-y-2 text-sm">
            <EditableTextarea
              value={block.heading}
              onChange={(heading) => patchBlock(entry.id, { ...block, heading })}
              rows={1}
              className="font-bold text-[var(--report-magenta)]"
            />
            <EditableTextarea
              value={block.url}
              onChange={(url) => patchBlock(entry.id, { ...block, url })}
              rows={1}
            />
            <p className="text-[var(--report-muted)]">
              Found: {block.found ? "Yes" : "No"} · URL count: {block.urlCount}
            </p>
          </ReportCard>
        ) : null}
        {entry.included && block.kind === "schema" ? (
          <ReportCard className="space-y-2 text-sm">
            <EditableTextarea
              value={block.heading}
              onChange={(heading) => patchBlock(entry.id, { ...block, heading })}
              rows={1}
              className="font-bold text-[var(--report-magenta)]"
            />
            <EditableTextarea
              value={block.summary}
              onChange={(summary) => patchBlock(entry.id, { ...block, summary })}
              rows={2}
            />
            <ul className="space-y-2">
              {block.recommendations.map((item, itemIndex) => (
                <li key={`${entry.id}-schema-${itemIndex}`}>
                  <EditableTextarea
                    value={item}
                    onChange={(value) =>
                      patchBlock(entry.id, {
                        ...block,
                        recommendations: block.recommendations.map((existing, i) =>
                          i === itemIndex ? value : existing,
                        ),
                      })
                    }
                    rows={1}
                  />
                </li>
              ))}
            </ul>
          </ReportCard>
        ) : null}
        {entry.included && block.kind === "query-table" && block.rows.length > 0 ? (
          <div>
            <EditableTextarea
              value={block.heading}
              onChange={(heading) => patchBlock(entry.id, { ...block, heading })}
              rows={1}
              className="mb-3 text-lg font-bold text-[var(--report-magenta)]"
            />
            <div className="overflow-hidden rounded-lg border border-[var(--report-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--report-navy)] text-left text-xs font-semibold uppercase text-bip-text">
                    <th className="px-4 py-3">Query</th>
                    <th className="px-4 py-3">Clicks</th>
                    <th className="px-4 py-3">Impressions</th>
                    <th className="px-4 py-3">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.query} className="border-t border-[var(--report-border)]">
                      <td className="px-4 py-3">{row.query}</td>
                      <td className="px-4 py-3">{row.clicks}</td>
                      <td className="px-4 py-3">{row.impressions}</td>
                      <td className="px-4 py-3">{row.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {entry.included && block.kind === "page-table" && block.rows.length > 0 ? (
          <div>
            <EditableTextarea
              value={block.heading}
              onChange={(heading) => patchBlock(entry.id, { ...block, heading })}
              rows={1}
              className="mb-3 text-lg font-bold text-[var(--report-magenta)]"
            />
            <div className="overflow-hidden rounded-lg border border-[var(--report-border)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[var(--report-navy)] text-xs font-semibold uppercase text-bip-text">
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Words</th>
                    <th className="px-3 py-2">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.url} className="border-t border-[var(--report-border)]">
                      <td className="max-w-xs truncate px-3 py-2">{row.url}</td>
                      <td className="px-3 py-2">{row.status || "—"}</td>
                      <td className="px-3 py-2">{row.wordCount}</td>
                      <td className="max-w-xs truncate px-3 py-2">{row.title ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>,
    );
    index += 1;
  }

  return (
    <ReportDocumentShell className="audit-export-edit">
      <ReportPageHeader />
      {nodes}
      <ReportFooter />
    </ReportDocumentShell>
  );
}
