import type {
  ClientSnapshot,
  SnapshotMetric,
} from "@/lib/client-snapshot/load";

// What a client sees. Nothing internal belongs here: no links into BIP
// Control, no staff-only notes. The internal preview wraps this with its own
// banner; the client app will render it alone.

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
    return <p className="text-xs text-bip-muted">out of 5</p>;
  if (metric.previous == null) {
    // Said once under the section heading when no tile has a comparison.
    return sectionHasNoHistory ? null : (
      <p className="text-xs text-bip-muted">No earlier period yet</p>
    );
  }
  if (metric.previous === 0) {
    return <p className="text-xs text-bip-muted">Previously 0</p>;
  }
  const change = (metric.value - metric.previous) / metric.previous;
  const flat = Math.abs(change) < 0.005;
  const good = metric.lowerIsBetter ? change < 0 : change > 0;
  const tone = flat
    ? "text-bip-muted"
    : good
      ? "text-[var(--success-fg)]"
      : "text-[var(--warning-fg)]";
  return (
    <p className={`text-xs ${tone}`}>
      {flat
        ? "About the same"
        : `${change > 0 ? "▲" : "▼"} ${Math.abs(change * 100).toFixed(0)}%`}{" "}
      <span className="text-bip-muted">
        vs. the 30 days before ({formatValue(metric, metric.previous)})
      </span>
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
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-bip-muted">
          Beyond Indigo Pets · Monthly Snapshot
        </p>
        <h1 className="text-2xl font-semibold text-bip-text">
          {snapshot.clientName}
        </h1>
        <p className="text-sm text-bip-muted">
          Updated{" "}
          {new Date(snapshot.generatedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "America/New_York",
          })}
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-bip-border bg-bip-card p-5">
        <h2 className="text-base font-semibold text-bip-text">
          What we did for you this month
        </h2>
        {snapshot.work.length ? (
          <ul className="space-y-3">
            {snapshot.work.map((item, index) => (
              <li
                key={`${item.date}-${index}`}
                className="border-l-2 border-bip-accent pl-3"
              >
                <p className="text-xs text-bip-muted">
                  {fmtDate(item.date)} · {item.author} · {item.thread}
                </p>
                <p className="text-sm text-bip-text">{item.excerpt}</p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-bip-accent hover:underline"
                  >
                    Read the full update in Basecamp →
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-bip-muted">
            No updates posted in the last 30 days.
          </p>
        )}
      </section>

      {sections.map((section) => {
        const noHistory =
          section.metrics.every(
            (metric) => metric.previous == null || metric.format === "rating",
          ) && section.metrics.some((metric) => metric.format !== "rating");
        return (
          <section
            key={section.key}
            className="space-y-3 rounded-2xl border border-bip-border bg-bip-card p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-bip-text">
                {section.title}
              </h2>
              <p className="text-xs text-bip-muted">{section.period}</p>
            </div>
            {noHistory && (
              <p className="-mt-2 text-xs text-bip-muted">
                Comparisons with the month before start next month.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {section.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-bip-fill p-3">
                  <p className="text-xs text-bip-muted">{metric.label}</p>
                  <p className="text-2xl font-semibold tabular-nums text-bip-text">
                    {formatValue(metric, metric.value)}
                  </p>
                  <Change metric={metric} sectionHasNoHistory={noHistory} />
                </div>
              ))}
            </div>
            {section.details && (
              <ul className="space-y-1 text-sm">
                {section.details.map((detail) => (
                  <li
                    key={detail.label}
                    className="flex justify-between gap-3 border-t border-bip-border pt-1"
                  >
                    <span className="text-bip-muted">{detail.label}</span>
                    <span className="text-right text-bip-text">
                      {detail.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="text-center text-xs text-bip-muted">
        Questions about anything here? Reply in Basecamp or call your Beyond
        Indigo team.
      </p>
    </article>
  );
}
