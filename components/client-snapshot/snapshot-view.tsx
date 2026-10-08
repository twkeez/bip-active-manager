import type {
  ClientSnapshot,
  SnapshotMetric,
  SnapshotSection,
} from "@/lib/client-snapshot/load";

// What a client sees. Nothing internal belongs here: no links into BIP
// Control, no staff-only notes. The internal preview wraps this with its own
// banner; the client portal renders it alone.
//
// Styled to the Beyond Indigo Pets brand, like the branded PDF reports
// (lib/reporting/pdf-render.ts): the indigo → purple → magenta gradient band
// with the reversed logo, brand-colored section accents, numbers in indigo.
// Brand colors are fixed (not theme tokens) on purpose: this page is always
// shown light, and a client's page should look the same everywhere.

const BRAND = {
  indigo: "#3350a2",
  purple: "#603894",
  magenta: "#962583",
  pink: "#ce2084",
};
const GRADIENT = `linear-gradient(120deg, ${BRAND.indigo} 0%, ${BRAND.purple} 55%, ${BRAND.magenta} 100%)`;

/** Beyond Indigo's helpdesk, linked from every snapshot and email. */
export const HELPDESK_URL = "https://help.beyondindigo.com";

const SECTION_ACCENT: Record<SnapshotSection["key"], string> = {
  ads: BRAND.indigo,
  website: BRAND.purple,
  social: BRAND.magenta,
  listing: BRAND.pink,
};

function formatValue(metric: SnapshotMetric, value: number): string {
  switch (metric.format) {
    case "money":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value >= 100 ? 0 : 2,
      });
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "rating":
      return value.toFixed(1);
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

function Change({
  metric,
  sectionHasNoHistory,
}: {
  metric: SnapshotMetric;
  sectionHasNoHistory: boolean;
}) {
  if (metric.format === "rating")
    return <p className="text-xs text-slate-500">out of 5 ★</p>;
  if (metric.previous == null) {
    // Said once under the section heading when no tile has a comparison.
    return sectionHasNoHistory ? null : (
      <p className="text-xs text-slate-500">No earlier period yet</p>
    );
  }
  if (metric.previous === 0)
    return <p className="text-xs text-slate-500">Previously 0</p>;
  const change = (metric.value - metric.previous) / metric.previous;
  const flat = Math.abs(change) < 0.005;
  const good = metric.lowerIsBetter ? change < 0 : change > 0;
  return (
    <p className="text-xs text-slate-500">
      <span
        className={`font-semibold ${flat ? "" : good ? "text-emerald-700" : "text-amber-700"}`}
      >
        {flat
          ? "About the same"
          : `${change > 0 ? "▲" : "▼"} ${Math.abs(change * 100).toFixed(0)}%`}
      </span>{" "}
      vs. the 30 days before ({formatValue(metric, metric.previous)})
    </p>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function SectionHeading({
  title,
  accent,
  right,
}: {
  title: string;
  accent: string;
  right?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2
        className="flex items-center gap-2 text-lg font-semibold"
        style={{ fontFamily: "var(--font-heading)", color: "#0f172a" }}
      >
        <span
          className="inline-block h-5 w-1.5 rounded-full"
          style={{ background: accent }}
          aria-hidden="true"
        />
        {title}
      </h2>
      {right && <p className="text-xs font-medium text-slate-500">{right}</p>}
    </div>
  );
}

/** Ads first: calls and leads are the clearest "here is what you got". */
const SECTION_ORDER = ["ads", "website", "social", "listing"];

export default function SnapshotView({
  snapshot,
}: {
  snapshot: ClientSnapshot;
}) {
  const sections = [...snapshot.sections].sort(
    (a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key),
  );
  const updated = new Date(snapshot.generatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  return (
    <article className="mx-auto max-w-3xl space-y-5 text-slate-700">
      <header
        className="relative overflow-hidden rounded-3xl px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9"
        style={{ background: GRADIENT }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25"
          style={{
            background: `radial-gradient(circle, ${BRAND.pink} 0%, transparent 70%)`,
          }}
          aria-hidden="true"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- a static brand SVG; next/image adds nothing here */}
        <img
          src="/brand/beyond-indigo-logo-rev.svg"
          alt="Beyond Indigo Pets"
          className="h-7 w-auto sm:h-8"
        />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
          Your Monthly Marketing Snapshot
        </p>
        <h1
          className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}
        >
          {snapshot.clientName}
        </h1>
        <p className="mt-2 text-sm text-white/80">Updated {updated}</p>
      </header>

      {snapshot.work.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            title="What we did for you this month"
            accent={BRAND.pink}
          />
          <ul className="space-y-4">
            {snapshot.work.map((item, index) => (
              <li
                key={`${item.date}-${index}`}
                className="border-l-2 pl-4"
                style={{ borderColor: BRAND.pink }}
              >
                <p className="text-xs font-medium text-slate-500">
                  {fmtDate(item.date)} · {item.author} · {item.thread}
                </p>
                <p className="mt-0.5 text-sm text-slate-800 [overflow-wrap:anywhere]">
                  {item.excerpt}
                </p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-semibold hover:underline"
                    style={{ color: BRAND.indigo }}
                  >
                    Read the full update in Basecamp →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {snapshot.work.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            title="What we did for you this month"
            accent={BRAND.pink}
          />
          <p className="mt-3 text-sm text-slate-500">
            No updates posted in the last 30 days.
          </p>
        </section>
      )}

      {sections.map((section) => {
        const accent = SECTION_ACCENT[section.key];
        const noHistory =
          section.metrics.every(
            (metric) => metric.previous == null || metric.format === "rating",
          ) && section.metrics.some((metric) => metric.format !== "rating");
        return (
          <section
            key={section.key}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <SectionHeading
              title={section.title}
              accent={accent}
              right={section.period}
            />
            {noHistory && (
              <p className="-mt-2 text-xs text-slate-500">
                Comparisons with the month before start next month.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {section.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="overflow-hidden rounded-xl bg-slate-50"
                >
                  <div className="p-3.5">
                    <div
                      className="mb-2 h-1 w-8 rounded-full"
                      style={{ background: accent }}
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium text-slate-500">
                      {metric.label}
                    </p>
                    <p
                      className="mt-0.5 text-[1.7rem] font-semibold leading-tight tabular-nums"
                      style={{
                        color: BRAND.indigo,
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {formatValue(metric, metric.value)}
                    </p>
                    <Change metric={metric} sectionHasNoHistory={noHistory} />
                  </div>
                </div>
              ))}
            </div>
            {section.details && (
              <ul className="space-y-1.5 text-sm">
                {section.details.map((detail) => (
                  <li
                    key={detail.label}
                    className="flex justify-between gap-3 border-t border-slate-100 pt-1.5"
                  >
                    <span className="text-slate-500">{detail.label}</span>
                    <span className="text-right font-medium text-slate-800">
                      {detail.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <footer className="space-y-3 pt-2 text-center">
        <div
          className="mx-auto h-1 w-24 rounded-full"
          style={{ background: GRADIENT }}
          aria-hidden="true"
        />
        <p className="text-sm text-slate-600">
          Questions about anything here? Reply in Basecamp or call your Beyond
          Indigo team.
        </p>
        <a
          href={HELPDESK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          style={{ background: GRADIENT }}
        >
          Need help? Visit our Help Center →
        </a>
        <p className="text-xs text-slate-500">
          Answers, how-tos and support requests, any time.
        </p>
        <p
          className="text-xs font-semibold tracking-wide"
          style={{ color: BRAND.purple }}
        >
          Beyond Indigo Pets · Marketing for veterinary practices
        </p>
      </footer>
    </article>
  );
}
