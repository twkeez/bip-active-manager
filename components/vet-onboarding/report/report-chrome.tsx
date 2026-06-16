"use client";

import "./report-theme.css";

export function ReportDocumentShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`vet-report-document rounded-xl border border-[var(--report-border)] bg-white px-6 py-8 shadow-lg sm:px-10 sm:py-10 print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

export function ReportPageHeader() {
  return (
    <header className="mb-8 border-b border-[var(--report-border)] pb-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold tracking-wide text-[var(--report-navy)] sm:text-base">
          BEYOND INDIGO PETS
        </p>
        <p className="text-xs text-[var(--report-muted)] sm:text-sm">
          beyondindigopets.com
        </p>
      </div>
    </header>
  );
}

export function ReportSectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mb-6 ${className}`}>
      <h2 className="text-2xl font-bold uppercase tracking-wide text-[var(--report-purple)] sm:text-3xl">
        {children}
      </h2>
      <span
        className="absolute -right-1 top-0 hidden text-[var(--report-accent)] sm:inline"
        aria-hidden
      >
        ↙
      </span>
    </div>
  );
}

export function ReportSubheading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-bold text-[var(--report-magenta)]">{children}</h3>
      <div className="report-gradient-rule mt-2" />
    </div>
  );
}

export function ReportGradientRule({ className = "" }: { className?: string }) {
  return <div className={`report-gradient-rule ${className}`} />;
}

export function ReportPullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-4 border-[var(--report-teal)] py-1 pl-5 text-lg font-semibold leading-snug text-[var(--report-teal)]">
      &ldquo;{children}&rdquo;
    </blockquote>
  );
}

export function ReportKpiStat({
  value,
  label,
  caption,
  icon,
}: {
  value: string;
  label: string;
  caption?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--report-border)] bg-white p-5 print:break-inside-avoid">
      {icon ? <div className="mb-2 text-[var(--report-teal)]">{icon}</div> : null}
      <p className="text-3xl font-bold text-[var(--report-teal)]">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--report-navy)]">
        {label}
      </p>
      <div className="report-gradient-rule mt-3" />
      {caption ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--report-muted)]">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export interface ReportActionRow {
  action: string;
  assignedTo: string;
  timeline: string;
}

export function ReportActionTable({ rows }: { rows: ReportActionRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--report-border)] print:break-inside-avoid">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--report-navy)] text-left text-xs font-semibold uppercase tracking-wide text-white">
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Assigned To</th>
            <th className="px-4 py-3">Timeline</th>
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
                {row.action}
              </td>
              <td className="px-4 py-3 text-[var(--report-muted)]">
                {row.assignedTo}
              </td>
              <td className="px-4 py-3 text-[var(--report-muted)]">
                {row.timeline}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportFooter() {
  return (
    <footer className="mt-10 border-t border-[var(--report-border)] pt-6 text-center text-xs text-[var(--report-muted)]">
      Prepared by Beyond Indigo Pets | beyondindigopets.com | (877) 244-9322
    </footer>
  );
}

export function ReportSection({
  children,
  breakBefore = false,
  className = "",
}: {
  children: React.ReactNode;
  breakBefore?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`mb-10 ${breakBefore ? "report-section-break" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function ReportCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--report-border)] bg-white p-6 print:break-inside-avoid ${className}`}
    >
      {children}
    </div>
  );
}

export function ReportObservationCallout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`report-observation-callout rounded-lg print:break-inside-avoid ${className}`}
    >
      {children}
    </div>
  );
}

export function ReportConfidentialBadge() {
  return (
    <span className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
      For Beyond Indigo Pets team use only
    </span>
  );
}
