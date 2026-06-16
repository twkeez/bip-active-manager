"use client";

import { Zap } from "lucide-react";
import {
  firstSentences,
  formatNextStep,
  getCompetitiveEdgeQuote,
  getCompetitorGapBullets,
  splitQuickWin,
  truncateToSentences,
} from "@/components/vet-onboarding/output-helpers";
import ReportCoverPage from "@/components/vet-onboarding/report/report-cover-page";
import {
  ReportActionTable,
  ReportFooter,
  ReportKpiStat,
  ReportPageHeader,
  ReportPullQuote,
  ReportSection,
  ReportSectionTitle,
  ReportSubheading,
  type ReportActionRow,
} from "@/components/vet-onboarding/report/report-chrome";
import type { DiscoveryReport, OnboardingPlan } from "@/types/onboarding";

interface ClientOutputViewProps {
  plan: OnboardingPlan;
  practiceName: string;
  contactName?: string;
  location?: string;
  mainGoal?: string;
  priorityFocus?: string;
  formattedDate: string;
  discovery?: DiscoveryReport;
  onSwitchView?: () => void;
}

const TIMELINE_LABELS = ["Immediate", "Week 1", "Week 2"];

function extractYear(formattedDate: string): string {
  const match = formattedDate.match(/\b(20\d{2})\b/);
  return match?.[1] ?? new Date().getFullYear().toString();
}

function ClientPricingTable({
  rows,
}: {
  rows: DiscoveryReport["pricingComparison"];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-[var(--report-border)] print:break-inside-avoid">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--report-navy)] text-left text-xs font-semibold uppercase tracking-wide text-white">
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Regional Benchmark</th>
            <th className="px-4 py-3">Your Practice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-[var(--report-border)] ${
                i % 2 === 1 ? "bg-[#f4f8fc]" : "bg-white"
              }`}
            >
              <td className="px-4 py-3 font-medium text-[var(--report-text)]">
                {row.serviceOrProcedure}
              </td>
              <td className="px-4 py-3 text-[var(--report-muted)]">
                {row.competitorPriceNote}
              </td>
              <td className="px-4 py-3 font-medium text-[var(--report-teal)]">
                {row.yourPriceNote}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-2 text-sm text-[var(--report-muted)] before:mt-0.5 before:shrink-0 before:text-[var(--report-teal)] before:content-['☐']"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function ClientOutputView({
  plan,
  practiceName,
  contactName,
  location,
  mainGoal,
  priorityFocus,
  formattedDate,
  discovery,
  onSwitchView,
}: ClientOutputViewProps) {
  const welcomeLead = firstSentences(plan.welcome, 2);
  const whyItMatters = truncateToSentences(plan.whyItMatters, 2);
  const focusText = truncateToSentences(
    priorityFocus || plan.serviceStrategy || plan.goalsPlan,
    3,
  );
  const topGoal = mainGoal || "Grow your practice with confidence";
  const quickWins = plan.quickWins.slice(0, 3);
  const nextSteps = plan.nextSteps.slice(0, 3);
  const year = extractYear(formattedDate);

  const competitiveQuote = discovery ? getCompetitiveEdgeQuote(discovery) : "";
  const competitorGaps = discovery ? getCompetitorGapBullets(discovery) : [];
  const pricingRows = discovery?.pricingComparison.slice(0, 3) ?? [];
  const monthlyTasks =
    discovery?.monthlyChecklist.slice(0, 4).map((item) => item.task) ?? [];
  const quarterlyTasks =
    discovery?.quarterlyChecklist.slice(0, 3).map((item) => item.task) ?? [];

  const actionRows: ReportActionRow[] = nextSteps.map((step, i) => ({
    action: formatNextStep(step, contactName),
    assignedTo: contactName?.trim() || "Beyond Indigo Pets",
    timeline: TIMELINE_LABELS[i] ?? `Week ${i + 1}`,
  }));

  return (
    <div className="vet-output-client">
      <ReportCoverPage year={year} />

      <ReportPageHeader />

      <ReportSection>
        <ReportSectionTitle>Executive Summary</ReportSectionTitle>
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[var(--report-navy)]">
            {practiceName}
          </h3>
          <p className="mt-1 text-sm text-[var(--report-muted)]">
            {[contactName, location].filter(Boolean).join(" · ") ||
              "Your veterinary marketing partner"}
          </p>
          <p className="mt-1 text-xs text-[var(--report-muted)]">
            {formattedDate}
          </p>
        </div>
        <ReportPullQuote>{welcomeLead}</ReportPullQuote>
      </ReportSection>

      <ReportSection breakBefore>
        <ReportSectionTitle>The Opportunity</ReportSectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plan.stats.map((stat, i) => (
            <ReportKpiStat
              key={i}
              value={stat.num}
              label={stat.label}
            />
          ))}
        </div>
        <p className="mt-6 text-sm leading-relaxed text-[var(--report-muted)]">
          {whyItMatters}
        </p>
      </ReportSection>

      <ReportSection>
        <ReportSubheading>Your Priority Focus</ReportSubheading>
        <p className="text-base font-bold text-[var(--report-navy)]">{topGoal}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--report-muted)]">
          {focusText}
        </p>
      </ReportSection>

      {discovery ? (
        <ReportSection breakBefore>
          <ReportSectionTitle>Your Competitive Edge</ReportSectionTitle>
          {competitiveQuote ? (
            <ReportPullQuote>{competitiveQuote}</ReportPullQuote>
          ) : null}
          {pricingRows.length > 0 ? (
            <>
              <ReportSubheading>Pricing Advantage</ReportSubheading>
              <ClientPricingTable rows={pricingRows} />
            </>
          ) : null}
          {competitorGaps.length > 0 ? (
            <div className="mt-6">
              <ReportSubheading>Competitor Gaps We Will Exploit</ReportSubheading>
              <ul className="mt-3 space-y-2">
                {competitorGaps.map((gap, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-[var(--report-muted)] before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[var(--report-teal)]"
                  >
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ReportSection>
      ) : null}

      <ReportSection breakBefore>
        <ReportSectionTitle>Your Roadmap</ReportSectionTitle>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plan.roadmap.map((item, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--report-border)] bg-white p-5 print:break-inside-avoid"
            >
              <span className="inline-block rounded-full bg-[var(--report-teal)] px-3 py-1 text-xs font-semibold text-white">
                {item.phase}
              </span>
              <h4 className="mt-3 font-bold text-[var(--report-navy)]">
                {item.title}
              </h4>
              <div className="report-gradient-rule mt-2" />
              <ul className="mt-4 space-y-2">
                {item.actions.slice(0, 3).map((action, j) => (
                  <li
                    key={j}
                    className="flex gap-2 text-sm text-[var(--report-muted)] before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[var(--report-teal)]"
                  >
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ReportSection>

      {discovery ? (
        <ReportSection>
          <ReportSectionTitle>Ongoing Marketing Plan</ReportSectionTitle>
          {discovery.keywordGeoMatrix.length > 0 ? (
            <div className="mb-6">
              <ReportSubheading>Keyword Focus</ReportSubheading>
              <div className="mt-3 space-y-3">
                {discovery.keywordGeoMatrix.map((tier, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--report-border)] bg-white p-4 print:break-inside-avoid"
                  >
                    <p className="text-sm font-semibold text-[var(--report-navy)]">
                      {tier.campaignTier}
                    </p>
                    <p className="mt-1 text-xs text-[var(--report-muted)]">
                      {tier.primaryKeywords.slice(0, 2).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {monthlyTasks.length > 0 ? (
            <div className="mb-6">
              <ReportSubheading>Monthly Priorities</ReportSubheading>
              <ChecklistList items={monthlyTasks} />
            </div>
          ) : null}
          {quarterlyTasks.length > 0 ? (
            <div>
              <ReportSubheading>Quarterly Priorities</ReportSubheading>
              <ChecklistList items={quarterlyTasks} />
            </div>
          ) : null}
        </ReportSection>
      ) : null}

      <ReportSection>
        <ReportSectionTitle>Quick Wins</ReportSectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickWins.map((win, i) => {
            const { title, explanation } = splitQuickWin(win);
            return (
              <ReportKpiStat
                key={i}
                value={`0${i + 1}`}
                label={title}
                caption={explanation || undefined}
                icon={<Zap className="h-5 w-5" />}
              />
            );
          })}
        </div>
      </ReportSection>

      <ReportSection breakBefore>
        <ReportSectionTitle>Next Action Plan</ReportSectionTitle>
        {focusText ? (
          <ReportPullQuote>{truncateToSentences(focusText, 1)}</ReportPullQuote>
        ) : null}
        <div className="mt-6">
          <ReportActionTable rows={actionRows} />
        </div>
      </ReportSection>

      <ReportFooter />

      {onSwitchView ? (
        <div className="vet-output-no-print mt-8 flex flex-col gap-3 border-t border-[var(--report-border)] pt-6 sm:flex-row">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[var(--report-teal)] px-6 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            Download Client PDF
          </button>
          <button
            type="button"
            onClick={onSwitchView}
            className="rounded-lg border border-[var(--report-border)] px-6 py-2.5 text-sm font-medium text-[var(--report-muted)] transition hover:bg-[#f4f8fc]"
          >
            Switch to Strategy View
          </button>
        </div>
      ) : null}
    </div>
  );
}
