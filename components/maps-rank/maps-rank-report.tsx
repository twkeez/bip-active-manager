import BeyondIndigoLogo from "@/components/onboarding/beyond-indigo-logo";
import { TIER } from "@/lib/maps-rank/map-image";
import type { MapsRankReport } from "@/lib/maps-rank/report";

const INDIGO = "#3350a2";
const GRADIENT = "linear-gradient(120deg, #3350a2 0%, #603894 55%, #962583 100%)";
const CHANGE_COLOR = { better: "#047857", worse: "#b91c1c", same: "#475569" } as const;

/** The branded Maps ranking report, to save as a PDF. `maps` holds one finished map picture (a data address) per search. */
export default function MapsRankReportView({ report, maps }: { report: MapsRankReport; maps: (string | null)[] }) {
  const legend = (
    [
      ["goal", "Within your goal"],
      ["near", "In the top 10"],
      ["far", "Below the top 10"],
      ["none", `Not in the top ${report.depth}`],
    ] as const
  ).map(([tier, text]) => (
    <span key={tier} className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: TIER[tier] }} />
      {text}
    </span>
  ));
  return (
    <article className="mx-auto max-w-3xl space-y-6 text-slate-700">
      <header className="overflow-hidden rounded-3xl px-8 py-7 text-white" style={{ background: GRADIENT, breakInside: "avoid" }}>
        <BeyondIndigoLogo className="h-8 w-auto" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Google Maps Ranking Report</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight" style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}>
          {report.practice}
        </h1>
        <p className="mt-2 text-sm text-white/80">
          {report.dateLabel} · Report {report.reportNumber}
          {report.goalDateLabel && ` · Goals due ${report.goalDateLabel}`}
        </p>
      </header>

      <section className="space-y-2" style={{ breakInside: "avoid" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-wide text-white" style={{ background: INDIGO }}>
              {["Search", "Goal", "Baseline", "Last report", "Today", "Since baseline", "From your address"].map((h) => (
                <th key={h} className="px-2 py-1.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.summary.map((row) => (
              <tr key={row.keyword} className="border-b border-slate-200">
                <td className="px-2 py-2 font-medium text-slate-900">{row.keyword}</td>
                <td className="px-2 py-2">Top {row.goal}</td>
                <td className="px-2 py-2">{row.baselineLabel}</td>
                <td className="px-2 py-2">{row.lastLabel}</td>
                <td className="px-2 py-2 text-base font-semibold" style={{ color: row.goalMet ? "#047857" : "#0f172a" }}>
                  {row.todayLabel}
                </td>
                <td className="px-2 py-2 font-medium" style={{ color: row.change ? CHANGE_COLOR[row.change] : "#475569" }}>
                  {row.changeLabel}
                </td>
                <td className="px-2 py-2">{row.addressLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[12px] text-slate-600">{`"Today", "Baseline" and "Last report" are searched from ${report.townLabel}.`}</p>
        {report.problems.length > 0 && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            <strong>Not everything could be read on this run:</strong> {report.problems.join(" ")}
          </p>
        )}
      </section>

      <section className="space-y-1.5 border-t border-slate-200 pt-4" style={{ breakInside: "avoid" }}>
        <h2 className="text-base font-semibold" style={{ color: INDIGO }}>
          How to read this report
        </h2>
        {report.notes.map((note) => (
          <p key={note} className="text-[12px] leading-relaxed text-slate-600">
            {note}
          </p>
        ))}
      </section>

      {report.sections.map((s) => (
        <section key={s.keyword} className="space-y-3" style={{ breakBefore: "page" }}>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: INDIGO, fontFamily: "var(--font-heading)" }}>
              {`${s.index + 1}. "${s.keyword}"`}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-900">{s.headline}</p>
            <p className="text-[13px] text-slate-600">{s.gridLine}</p>
          </div>
          {maps[s.index] ? (
            <div style={{ breakInside: "avoid" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={maps[s.index] as string} alt={`Map of your rank around ${report.practice}`} className="mx-auto block rounded-xl" style={{ width: 440, height: 440 }} />
              <p className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[12px] text-slate-600">{legend}</p>
            </div>
          ) : (
            <p className="text-[13px] text-red-700">The map for this search couldn&apos;t be drawn.</p>
          )}
          {s.townError ? (
            <p className="text-[13px] text-red-700">{`The list from ${report.townLabel} couldn't be read on this run: ${s.townError}`}</p>
          ) : (
            <div style={{ breakInside: "avoid" }}>
              <p className="mb-1 text-[12px] text-slate-600">What Google Maps shows from {report.townLabel}:</p>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-[12px] uppercase tracking-wide text-slate-600">
                    <th className="py-1 pr-2 font-semibold">Rank</th>
                    <th className="py-1 pr-2 font-semibold">Business</th>
                    <th className="py-1 pr-2 text-right font-semibold">Rating</th>
                    <th className="py-1 pr-2 text-right font-semibold">Reviews</th>
                    <th className="py-1 text-right font-semibold">Miles from you</th>
                  </tr>
                </thead>
                <tbody>
                  {s.listings.map((l) => (
                    <tr key={`${l.position}-${l.name}`} className="border-b border-slate-100" style={l.isYou ? { background: "#eef2ff", fontWeight: 600 } : undefined}>
                      <td className="py-1 pl-1 pr-2">{l.position}</td>
                      <td className="py-1 pr-2 text-slate-900">
                        {l.name}
                        {l.isYou && " (you)"}
                      </td>
                      <td className="py-1 pr-2 text-right">{l.rating != null ? `${l.rating.toFixed(1)}★` : "—"}</td>
                      <td className="py-1 pr-2 text-right">{l.reviewCount != null ? l.reviewCount.toLocaleString("en-US") : "—"}</td>
                      <td className="py-1 pr-1 text-right">{l.isYou ? "—" : l.miles != null ? `${l.miles} mi` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      <p className="border-t border-slate-200 pt-3 text-center text-[12px] text-slate-500">Prepared by Beyond Indigo Pets · beyondindigopets.com</p>
    </article>
  );
}
