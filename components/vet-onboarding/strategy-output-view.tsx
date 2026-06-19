"use client";

import { StrategyCoverPage } from "@/components/vet-onboarding/report/report-cover-page";
import {
  ReportCard,
  ReportConfidentialBadge,
  ReportFooter,
  ReportPageHeader,
  ReportSection,
  ReportSectionTitle,
  ReportSubheading,
} from "@/components/vet-onboarding/report/report-chrome";
import type {
  ClientFormData,
  DiscoveryFormData,
  DiscoveryReport,
  OnboardingPlan,
} from "@/types/onboarding";

interface SnapshotRow {
  label: string;
  value: string;
}

interface StrategyOutputViewProps {
  plan: OnboardingPlan;
  practiceName: string;
  formattedDate: string;
  discovery?: DiscoveryReport;
  clientFormData?: ClientFormData;
  discoveryFormData?: DiscoveryFormData;
  onSwitchView?: () => void;
}

function ReportDataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--report-border)] print:break-inside-avoid">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--report-navy)] text-left text-xs font-semibold uppercase tracking-wide text-bip-text">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3">
                {header}
              </th>
            ))}
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
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 ${
                    j === 0
                      ? "font-medium text-[var(--report-text)]"
                      : "text-[var(--report-muted)]"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotTable({ rows }: { rows: SnapshotRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--report-border)]">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={`border-t border-[var(--report-border)] ${
                i % 2 === 1 ? "bg-[#f4f8fc]" : "bg-white"
              }`}
            >
              <td className="w-2/5 px-4 py-2.5 font-medium text-[var(--report-muted)]">
                {row.label}
              </td>
              <td className="px-4 py-2.5 text-[var(--report-text)]">
                {row.value || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrategyCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ReportCard>
      <ReportSubheading>{title}</ReportSubheading>
      <div className="text-sm leading-relaxed text-[var(--report-muted)]">
        {children}
      </div>
    </ReportCard>
  );
}

function formatWeaknesses(weaknesses: string[]): string {
  return weaknesses.map((w) => `• ${w}`).join(" ");
}

function ChecklistTable({
  items,
}: {
  items: Array<{ task: string; category: string }>;
}) {
  return (
    <ReportDataTable
      headers={["Category", "Task"]}
      rows={items.map((item) => [item.category, item.task])}
    />
  );
}

function buildSnapshotRows(
  clientFormData?: ClientFormData,
  discoveryFormData?: DiscoveryFormData,
): SnapshotRow[] {
  const dash = (value?: string) => value?.trim() || "—";
  const formatUrls = (value?: string) => {
    if (!value?.trim()) return "—";
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", ");
  };
  const marketingManaged = clientFormData?.marketingManagedBy
    ? clientFormData.previousAgencyName
      ? `${clientFormData.marketingManagedBy} (${clientFormData.previousAgencyName})`
      : clientFormData.marketingManagedBy
    : "—";

  return [
    { label: "Practice type", value: dash(clientFormData?.practiceType) },
    { label: "Location", value: dash(clientFormData?.location) },
    {
      label: "Services",
      value: clientFormData?.services?.length
        ? clientFormData.services.join(", ")
        : "—",
    },
    { label: "Budget", value: dash(clientFormData?.budget) },
    { label: "Timeline", value: dash(clientFormData?.timeline) },
    { label: "Website", value: dash(clientFormData?.websiteUrl) },
    {
      label: "Google Business Profile",
      value: formatUrls(clientFormData?.googleBusinessProfileUrls),
    },
    { label: "Facebook", value: dash(clientFormData?.facebookUrl) },
    { label: "Instagram", value: dash(clientFormData?.instagramUrl) },
    { label: "Practice phone", value: dash(clientFormData?.practicePhone) },
    {
      label: "Online booking URL",
      value: dash(clientFormData?.onlineBookingUrl),
    },
    { label: "Service area", value: dash(clientFormData?.serviceAreaNotes) },
    { label: "Marketing managed by", value: marketingManaged },
    {
      label: "Booking availability",
      value: dash(discoveryFormData?.bookingAvailability),
    },
    {
      label: "Avg transaction value",
      value: dash(discoveryFormData?.avgTransactionValue),
    },
    {
      label: "Google rating",
      value: dash(discoveryFormData?.googleRating),
    },
    {
      label: "Review count",
      value: dash(discoveryFormData?.googleReviewCount),
    },
    {
      label: "Website status",
      value: discoveryFormData?.mobileFriendly
        ? `Mobile-friendly: ${discoveryFormData.mobileFriendly}`
        : dash(clientFormData?.presence),
    },
    {
      label: "Booking method",
      value: dash(discoveryFormData?.onlineBooking),
    },
    {
      label: "Practice setting",
      value: dash(discoveryFormData?.clinicSetting),
    },
    {
      label: "Competitor types",
      value: discoveryFormData?.competitorTypes?.length
        ? discoveryFormData.competitorTypes.join(", ")
        : "—",
    },
  ];
}

export default function StrategyOutputView({
  plan,
  practiceName,
  formattedDate,
  discovery,
  clientFormData,
  discoveryFormData,
  onSwitchView,
}: StrategyOutputViewProps) {
  const snapshotRows = buildSnapshotRows(clientFormData, discoveryFormData);

  return (
    <div className="vet-output-strategy">
      <StrategyCoverPage
        practiceName={practiceName}
        formattedDate={formattedDate}
      />

      <div className="vet-output-print-strategy-banner hidden border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-red-700 print:block">
        Confidential — Internal Use Only
      </div>

      <ReportPageHeader />

      <ReportSection>
        <ReportSectionTitle>Internal Strategy Brief</ReportSectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--report-muted)]">{formattedDate}</p>
          <ReportConfidentialBadge />
        </div>
        <p className="mt-2 text-lg font-bold text-[var(--report-navy)]">
          {practiceName}
        </p>
      </ReportSection>

      <ReportSection>
        <ReportSubheading>Practice Snapshot</ReportSubheading>
        <SnapshotTable rows={snapshotRows} />
      </ReportSection>

      {discovery ? (
        <>
          <ReportSection breakBefore>
            <StrategyCard title="Capacity & Focus Strategy">
              <p>{discovery.capacityStrategy}</p>
            </StrategyCard>
          </ReportSection>

          <ReportSection>
            <StrategyCard title="UVP Positioning">
              <p>{discovery.uvpPositioning}</p>
            </StrategyCard>
          </ReportSection>

          <ReportSection>
            <StrategyCard title="Reputation Plan">
              <p>{discovery.reputationPlan}</p>
            </StrategyCard>
          </ReportSection>

          <ReportSection>
            <StrategyCard title="Website Priorities">
              <p>{discovery.websitePriorities}</p>
            </StrategyCard>
          </ReportSection>

          <ReportSection breakBefore>
            <ReportSubheading>Current Online Presence Audit</ReportSubheading>
            <ReportDataTable
              headers={["Asset", "Current State", "Gap / Fix", "Priority"]}
              rows={discovery.onlinePresenceAudit.map((row) => [
                row.asset,
                row.currentState,
                row.requiredFix,
                row.priority,
              ])}
            />
          </ReportSection>

          <ReportSection>
            <ReportSubheading>Competitive Deficit Analysis</ReportSubheading>
            <ReportDataTable
              headers={[
                "Competitor",
                "Category",
                "Strength",
                "Digital Weaknesses",
                "Your Advantage",
              ]}
              rows={discovery.competitorDeficitAnalysis.map((row) => [
                row.competitorName,
                row.competitorCategory,
                row.theirStrength,
                formatWeaknesses(row.digitalWeaknesses),
                row.yourAdvantage,
              ])}
            />
          </ReportSection>

          <ReportSection breakBefore>
            <ReportSubheading>Pricing &amp; Value Comparison</ReportSubheading>
            <ReportDataTable
              headers={[
                "Competitor",
                "Service",
                "Their Price",
                "Your Price",
                "Value Angle",
              ]}
              rows={discovery.pricingComparison.map((row) => [
                row.competitorName,
                row.serviceOrProcedure,
                row.competitorPriceNote,
                row.yourPriceNote,
                row.valueAngle,
              ])}
            />
          </ReportSection>

          <ReportSection>
            <ReportSubheading>Keyword &amp; Geo-Targeting Matrix</ReportSubheading>
            <ReportDataTable
              headers={[
                "Campaign Tier",
                "Target Geography",
                "Primary Keywords",
                "Search Intent",
              ]}
              rows={discovery.keywordGeoMatrix.map((row) => [
                row.campaignTier,
                row.targetGeography,
                row.primaryKeywords.join(", "),
                row.searchIntent,
              ])}
            />
          </ReportSection>

          <ReportSection breakBefore>
            <ReportSubheading>Marketing Cadence</ReportSubheading>
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-[var(--report-navy)]">
                  Monthly Retention Checklist
                </h4>
                <ChecklistTable items={discovery.monthlyChecklist} />
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-[var(--report-navy)]">
                  Quarterly Strategy Checklist
                </h4>
                <ChecklistTable items={discovery.quarterlyChecklist} />
              </div>
            </div>
          </ReportSection>
        </>
      ) : (
        <>
          <ReportSection>
            <StrategyCard title="Service Strategy">
              <p>{plan.serviceStrategy}</p>
            </StrategyCard>
          </ReportSection>
          {plan.goalsPlan ? (
            <ReportSection>
              <StrategyCard title="Goals Plan">
                <p>{plan.goalsPlan}</p>
              </StrategyCard>
            </ReportSection>
          ) : null}
        </>
      )}

      <ReportSection breakBefore>
        <StrategyCard title="Market Intelligence">
          <p>{plan.marketSnapshot}</p>
          <p className="mt-3">{plan.searchLandscape}</p>
          {plan.competitors.length > 0 ? (
            <div className="mt-4">
              <ReportDataTable
                headers={["Competitor", "Overview"]}
                rows={plan.competitors.map((c) => [c.name, c.note])}
              />
            </div>
          ) : null}
        </StrategyCard>
      </ReportSection>

      <ReportSection>
        <ReportSubheading>Full 30 / 60 / 90 Roadmap</ReportSubheading>
        <div className="space-y-6">
          {plan.roadmap.map((item, i) => (
            <div key={i}>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[var(--report-teal)] px-3 py-1 text-xs font-semibold text-bip-text">
                  {item.phase}
                </span>
                <h3 className="font-bold text-[var(--report-navy)]">
                  {item.title}
                </h3>
              </div>
              <div className="report-gradient-rule mt-2" />
              <ul className="mt-3 space-y-2">
                {item.actions.map((action, j) => (
                  <li
                    key={j}
                    className="flex gap-2 text-sm text-[var(--report-muted)] before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[var(--report-teal)]"
                  >
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportFooter />

      {onSwitchView ? (
        <div className="vet-output-no-print mt-8 flex flex-col gap-3 border-t border-[var(--report-border)] pt-6 sm:flex-row">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[var(--report-teal)] px-6 py-2.5 text-sm font-medium text-bip-text transition hover:brightness-110"
          >
            Download Strategy PDF
          </button>
          <button
            type="button"
            onClick={onSwitchView}
            className="rounded-lg border border-[var(--report-border)] px-6 py-2.5 text-sm font-medium text-[var(--report-muted)] transition hover:bg-[#f4f8fc]"
          >
            Switch to Client View
          </button>
        </div>
      ) : null}
    </div>
  );
}
