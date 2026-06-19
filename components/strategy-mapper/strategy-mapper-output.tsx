"use client";

import { useState } from "react";
import { ClipboardCopy, Printer } from "lucide-react";
import { copyStrategyMapperToClipboard } from "@/lib/strategy-mapper/copy-rich-html";
import { SERVICE_LABELS } from "@/lib/strategy-mapper/form-options";
import { SERVICE_ICONS } from "@/lib/strategy-mapper/report-brand-tokens";
import {
  ReportDocumentShell,
  ReportObservationCallout,
  ReportPageHeader,
  ReportSection,
  ReportSectionTitle,
  ReportSubheading,
} from "@/components/vet-onboarding/report/report-chrome";
import "@/components/vet-onboarding/report/report-theme.css";
import type {
  StrategyMapperFormData,
  StrategyMapperGenerateResult,
  StrategyMapperReport,
  StrategyMapperService,
} from "@/types/strategy-mapper";

interface StrategyMapperOutputProps {
  form: StrategyMapperFormData;
  result: StrategyMapperGenerateResult;
  onStartOver: () => void;
}

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
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`w-full rounded-lg border border-[var(--report-border)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--report-text)] focus:border-[var(--report-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--report-teal)] ${className}`}
    />
  );
}

function formatSpecializations(form: StrategyMapperFormData): string {
  const items = [...form.specializations];
  if (form.customSpecialization.trim()) {
    items.push(form.customSpecialization.trim());
  }
  return items.length > 0 ? items.join(", ") : "General practice";
}

export default function StrategyMapperOutput({
  form,
  result,
  onStartOver,
}: StrategyMapperOutputProps) {
  const [report, setReport] = useState<StrategyMapperReport>(result.report);
  const [copied, setCopied] = useState(false);
  const { radius, activeServices } = result;

  function updateMission(value: string) {
    setReport((prev) => ({
      ...prev,
      executiveSummary: { ...prev.executiveSummary, missionStatement: value },
    }));
  }

  function updateNarrative(value: string) {
    setReport((prev) => ({
      ...prev,
      executiveSummary: { ...prev.executiveSummary, narrative: value },
    }));
  }

  function updateAuditRow(index: number, field: string, value: string) {
    setReport((prev) => ({
      ...prev,
      competitiveAuditRows: prev.competitiveAuditRows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function updateActiveStrategy(
    service: StrategyMapperService,
    field: "objective" | "title",
    value: string,
  ) {
    setReport((prev) => ({
      ...prev,
      activeStrategies: {
        ...prev.activeStrategies,
        [service]: {
          ...prev.activeStrategies[service]!,
          [field]: value,
        },
      },
    }));
  }

  function updateActiveTactic(
    service: StrategyMapperService,
    index: number,
    value: string,
  ) {
    setReport((prev) => {
      const block = prev.activeStrategies[service];
      if (!block) return prev;
      const tactics = [...block.tactics];
      tactics[index] = value;
      return {
        ...prev,
        activeStrategies: {
          ...prev.activeStrategies,
          [service]: { ...block, tactics },
        },
      };
    });
  }

  function updateGrowthBlock(
    index: number,
    field: "marketObservation" | "whyItMatters" | "title",
    value: string,
  ) {
    setReport((prev) => ({
      ...prev,
      growthOpportunities: prev.growthOpportunities.map((block, i) =>
        i === index ? { ...block, [field]: value } : block,
      ),
    }));
  }

  function updatePainPointResolution(value: string) {
    setReport((prev) => ({
      ...prev,
      executiveSummary: { ...prev.executiveSummary, painPointResolution: value },
    }));
  }

  function updateCoreFocusArea(index: number, value: string) {
    setReport((prev) => ({
      ...prev,
      executiveSummary: {
        ...prev.executiveSummary,
        coreFocusAreas: prev.executiveSummary.coreFocusAreas.map((item, i) =>
          i === index ? value : item,
        ),
      },
    }));
  }

  function updateKeywordRow(
    index: number,
    field: "intentCategory" | "targetGeography",
    value: string,
  ) {
    setReport((prev) => ({
      ...prev,
      seoKeywordMatrix: prev.seoKeywordMatrix.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function updateKeywordVariation(rowIndex: number, varIndex: number, value: string) {
    setReport((prev) => ({
      ...prev,
      seoKeywordMatrix: prev.seoKeywordMatrix.map((row, i) => {
        if (i !== rowIndex) return row;
        const keywordVariations = [...row.keywordVariations];
        keywordVariations[varIndex] = value;
        return { ...row, keywordVariations };
      }),
    }));
  }

  function updateRoadmapStep(
    index: number,
    field: "title" | "description",
    value: string,
  ) {
    setReport((prev) => ({
      ...prev,
      launchRoadmap: prev.launchRoadmap.map((step, i) =>
        i === index ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function updateChecklistItem(index: number, value: string) {
    setReport((prev) => ({
      ...prev,
      internalStrategistChecklist: prev.internalStrategistChecklist.map((item, i) =>
        i === index ? value : item,
      ),
    }));
  }

  async function handleCopy() {
    await copyStrategyMapperToClipboard(form, report, radius, activeServices);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function CopyButton({ className = "" }: { className?: string }) {
    return (
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`inline-flex items-center gap-2 rounded-lg bg-[var(--report-accent)] px-5 py-2.5 text-sm font-medium text-bip-text transition hover:brightness-110 ${className}`}
      >
        <ClipboardCopy className="h-4 w-4" />
        {copied ? "Copied!" : "Copy for Google Docs"}
      </button>
    );
  }

  return (
    <div className="vet-output-shell mx-auto max-w-4xl font-sans">
      <div className="vet-output-no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <CopyButton />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm text-bip-text hover:bg-bip-fill"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm text-bip-text hover:bg-bip-fill"
          >
            Start Over
          </button>
        </div>
      </div>

      <ReportDocumentShell>
        <ReportPageHeader />

        <ReportSection>
          {form.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoDataUrl}
              alt={`${form.practiceName} logo`}
              className="mb-4 max-h-20 print:max-h-16"
            />
          ) : null}
          <ReportSectionTitle>
            Customized Digital Marketing Plan
          </ReportSectionTitle>
          <p className="text-sm text-[var(--report-muted)]">
            <strong className="text-[var(--report-navy)]">Prepared for:</strong>{" "}
            {form.practiceName}
          </p>
          {form.practiceOwnerName ? (
            <p className="mt-1 text-sm text-[var(--report-muted)]">
              <strong className="text-[var(--report-navy)]">Practice Owner/Lead:</strong>{" "}
              {form.practiceOwnerName}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--report-muted)]">
            <strong className="text-[var(--report-navy)]">Geographic Focus:</strong>{" "}
            {form.streetAddress} — {radius.geographicFocusLabel}
          </p>
          <p className="mt-1 text-sm text-[var(--report-muted)]">
            <strong className="text-[var(--report-navy)]">Practice Type:</strong>{" "}
            {formatSpecializations(form)}
          </p>
        </ReportSection>

        <ReportSection breakBefore>
          <ReportSectionTitle>
            Executive Summary &amp; Targeted Growth Milestones
          </ReportSectionTitle>
          <ReportSubheading>Our Shared Mission</ReportSubheading>
          <EditableTextarea
            value={report.executiveSummary.missionStatement}
            onChange={updateMission}
            rows={2}
            className="mb-4 font-semibold text-[var(--report-magenta)]"
          />
          <ReportSubheading>Direct Pain-Point Resolution</ReportSubheading>
          <EditableTextarea
            value={report.executiveSummary.painPointResolution}
            onChange={updatePainPointResolution}
            rows={3}
            className="mb-4"
          />
          <ReportSubheading>Core Focus Areas</ReportSubheading>
          <ul className="mb-4 space-y-2">
            {report.executiveSummary.coreFocusAreas.map((area, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--report-accent)]" />
                <EditableTextarea
                  value={area}
                  onChange={(value) => updateCoreFocusArea(i, value)}
                  rows={1}
                  className="flex-1"
                />
              </li>
            ))}
          </ul>
          <EditableTextarea
            value={report.executiveSummary.narrative}
            onChange={updateNarrative}
            rows={4}
          />
        </ReportSection>

        <ReportSection breakBefore>
          <ReportSectionTitle>Local Competitive Market Audit</ReportSectionTitle>
          <div className="overflow-hidden rounded-lg border border-[var(--report-border)] print:break-inside-avoid">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--report-navy)] text-left text-xs font-semibold uppercase tracking-wide text-bip-text">
                  <th className="px-3 py-3">Practice</th>
                  <th className="px-3 py-3">Distance</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3">Reviews</th>
                  <th className="px-3 py-3">Google Ads?</th>
                </tr>
              </thead>
              <tbody>
                {report.competitiveAuditRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-[var(--report-border)] ${
                      i % 2 === 1 ? "bg-[var(--report-row-alt)]" : "bg-white"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--report-text)]">
                      {row.isClient ? `${row.practiceName} (You)` : row.practiceName}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.distance}
                        onChange={(e) =>
                          updateAuditRow(i, "distance", e.target.value)
                        }
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-[var(--report-text)] focus:border-[var(--report-border)] focus:bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.googleRating}
                        onChange={(e) =>
                          updateAuditRow(i, "googleRating", e.target.value)
                        }
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-[var(--report-text)] focus:border-[var(--report-border)] focus:bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.reviewCount}
                        onChange={(e) =>
                          updateAuditRow(i, "reviewCount", e.target.value)
                        }
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-[var(--report-text)] focus:border-[var(--report-border)] focus:bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.runsGoogleAds}
                        onChange={(e) =>
                          updateAuditRow(i, "runsGoogleAds", e.target.value)
                        }
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-[var(--report-text)] focus:border-[var(--report-border)] focus:bg-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection breakBefore>
          <ReportSectionTitle>
            Phase 1 — Active Digital Marketing Strategy
          </ReportSectionTitle>
          <div className="space-y-6">
            {activeServices.map((service) => {
              const block = report.activeStrategies[service];
              if (!block) return null;
              return (
                <div
                  key={service}
                  className="rounded-lg border border-[var(--report-border)] bg-white p-5 print:break-inside-avoid"
                >
                  <div className="mb-3 flex items-start gap-2">
                    <span className="text-xl" aria-hidden>
                      {SERVICE_ICONS[service]}
                    </span>
                    <EditableTextarea
                      value={block.title}
                      onChange={(value) => updateActiveStrategy(service, "title", value)}
                      rows={1}
                      className="flex-1 font-bold text-[var(--report-purple)]"
                    />
                  </div>
                  <ReportSubheading>Objective</ReportSubheading>
                  <EditableTextarea
                    value={block.objective}
                    onChange={(value) =>
                      updateActiveStrategy(service, "objective", value)
                    }
                    rows={2}
                  />
                  <ReportSubheading>Tactics</ReportSubheading>
                  <ul className="space-y-2">
                    {block.tactics.map((tactic, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--report-accent)]" />
                        <EditableTextarea
                          value={tactic}
                          onChange={(value) => updateActiveTactic(service, i, value)}
                          rows={1}
                          className="flex-1"
                        />
                      </li>
                    ))}
                  </ul>
                  {service === "seo" && report.seoKeywordMatrix.length > 0 ? (
                    <div className="mt-6">
                      <ReportSubheading>Targeted Keyword Matrix</ReportSubheading>
                      <div className="overflow-hidden rounded-lg border border-[var(--report-border)]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[var(--report-navy)] text-left text-xs font-semibold uppercase tracking-wide text-bip-text">
                              <th className="px-3 py-2">Intent Category</th>
                              <th className="px-3 py-2">Target Geography</th>
                              <th className="px-3 py-2">Keyword Variations</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.seoKeywordMatrix.map((row, i) => (
                              <tr
                                key={i}
                                className={`border-t border-[var(--report-border)] ${
                                  i % 2 === 1 ? "bg-[var(--report-row-alt)]" : "bg-white"
                                }`}
                              >
                                <td className="px-3 py-2 align-top">
                                  <input
                                    value={row.intentCategory}
                                    onChange={(e) =>
                                      updateKeywordRow(i, "intentCategory", e.target.value)
                                    }
                                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-[var(--report-text)] focus:border-[var(--report-border)] focus:bg-white"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    value={row.targetGeography}
                                    onChange={(e) =>
                                      updateKeywordRow(i, "targetGeography", e.target.value)
                                    }
                                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-[var(--report-text)] focus:border-[var(--report-border)] focus:bg-white"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {row.keywordVariations.map((kw, j) => (
                                    <input
                                      key={j}
                                      value={kw}
                                      onChange={(e) =>
                                        updateKeywordVariation(i, j, e.target.value)
                                      }
                                      className="mb-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm focus:border-[var(--report-border)] focus:bg-white"
                                    />
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ReportSection>

        {report.growthOpportunities.length > 0 ? (
          <ReportSection breakBefore>
            <ReportSectionTitle>
              Phase 2 — Future Growth Opportunities &amp; Market Vulnerabilities
            </ReportSectionTitle>
            <div className="space-y-6">
              {report.growthOpportunities.map((block, i) => (
                <ReportObservationCallout key={i}>
                  <EditableTextarea
                    value={block.title}
                    onChange={(value) => updateGrowthBlock(i, "title", value)}
                    rows={1}
                    className="font-bold text-[var(--report-purple)]"
                  />
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--report-muted)]">
                    {SERVICE_LABELS[block.service]}
                  </p>
                  <ReportSubheading>Market Observation</ReportSubheading>
                  <EditableTextarea
                    value={block.marketObservation}
                    onChange={(value) =>
                      updateGrowthBlock(i, "marketObservation", value)
                    }
                    rows={3}
                  />
                  <ReportSubheading>Why It Matters</ReportSubheading>
                  <EditableTextarea
                    value={block.whyItMatters}
                    onChange={(value) => updateGrowthBlock(i, "whyItMatters", value)}
                    rows={3}
                  />
                </ReportObservationCallout>
              ))}
            </div>
          </ReportSection>
        ) : null}

        {report.launchRoadmap.length > 0 ? (
          <ReportSection breakBefore>
            <ReportSectionTitle>The Beyond Indigo Launch Roadmap</ReportSectionTitle>
            <div className="space-y-4">
              {report.launchRoadmap.map((step, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--report-border)] bg-white p-5 print:break-inside-avoid"
                >
                  <EditableTextarea
                    value={step.title}
                    onChange={(value) => updateRoadmapStep(i, "title", value)}
                    rows={1}
                    className="font-bold text-[var(--report-purple)]"
                  />
                  <EditableTextarea
                    value={step.description}
                    onChange={(value) => updateRoadmapStep(i, "description", value)}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
          </ReportSection>
        ) : null}

        {report.internalStrategistChecklist.length > 0 ? (
          <ReportSection breakBefore>
            <ReportSectionTitle>
              🛠️ Internal Strategist Implementation Checklist
            </ReportSectionTitle>
            <ul className="space-y-2">
              {report.internalStrategistChecklist.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-[var(--report-text)]">☐</span>
                  <EditableTextarea
                    value={item}
                    onChange={(value) => updateChecklistItem(i, value)}
                    rows={1}
                    className="flex-1"
                  />
                </li>
              ))}
            </ul>
          </ReportSection>
        ) : null}

        <div className="vet-output-no-print mt-8 border-t border-[var(--report-border)] pt-6">
          <CopyButton />
        </div>
      </ReportDocumentShell>
    </div>
  );
}
