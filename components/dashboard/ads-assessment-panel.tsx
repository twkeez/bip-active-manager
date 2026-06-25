"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, AlertTriangle, MapPin, Swords, Stethoscope } from "lucide-react";
import type {
  AdsAssessment,
  AdsAssessmentPriority,
  AdsAssessmentSnapshot,
} from "@/lib/types/client";

type Props = {
  clientId: number | null;
  clientName?: string;
};

function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const PRIORITY_STYLES: Record<AdsAssessmentPriority, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  medium: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  low: "border-bip-border bg-bip-card/60 text-bip-muted",
};

const REC_STYLES: Record<string, string> = {
  keep: "text-emerald-400",
  consider: "text-amber-400",
  remove: "text-red-400",
};

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-bip-accent">{icon}</span>
        <h4 className="text-sm font-semibold text-bip-text">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export default function AdsAssessmentPanel({ clientId, clientName }: Props) {
  const [assessment, setAssessment] = useState<AdsAssessment | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ads/assessment/${clientId}`, { cache: "no-store" });
      const payload = (await res.json()) as { error?: string; assessment?: AdsAssessmentSnapshot | null };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load assessment");
      if (payload.assessment && Object.keys(payload.assessment.assessment ?? {}).length > 0) {
        setAssessment(payload.assessment.assessment as AdsAssessment);
        setGeneratedAt(payload.assessment.created_at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assessment");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run() {
    if (!clientId || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/assessment/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json()) as { error?: string; assessment?: AdsAssessmentSnapshot };
      if (!res.ok) throw new Error(payload.error ?? "Failed to run assessment");
      if (payload.assessment) {
        setAssessment(payload.assessment.assessment as AdsAssessment);
        setGeneratedAt(payload.assessment.created_at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run assessment");
    } finally {
      setRunning(false);
    }
  }

  if (!clientId) return null;

  return (
    <div className="rounded-xl border border-bip-accent/30 bg-bip-accent/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-bip-accent" />
            <h3 className="text-sm font-semibold text-bip-text">AI Ads Assessment</h3>
          </div>
          <p className="mt-1 text-xs text-bip-muted">
            Prioritized, AI-generated findings for {clientName ?? "this client"}&apos;s Google Ads.
            {generatedAt && (
              <> Last run {new Date(generatedAt).toLocaleString()}.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-bip-text transition hover:opacity-90 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {running ? "Analyzing…" : assessment ? "Re-run assessment" : "Run assessment"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {loading && !assessment && (
        <p className="mt-4 text-xs text-bip-muted">Loading…</p>
      )}

      {!loading && !assessment && !error && (
        <p className="mt-4 text-xs text-bip-muted">
          No assessment yet. Click “Run assessment” to analyze this account’s campaigns, search
          terms, geography, and competitive position.
        </p>
      )}

      {assessment && (
        <div className="mt-4 space-y-4">
          {/* Headline + summary metrics */}
          <div className="rounded-xl border border-bip-border bg-bip-card/50 p-5">
            <p className="text-sm font-medium text-bip-text">{assessment.summary?.headline}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["30-day spend", money(assessment.summary?.total_spend)],
                ["Conversions", String(assessment.summary?.total_conversions ?? "—")],
                ["Cost / conv", money(assessment.summary?.avg_cost_per_conv)],
                ["Impr. share", assessment.summary?.impression_share ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-bip-border bg-bip-card/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-bip-muted">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-bip-text">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action items */}
          {assessment.action_items?.length > 0 && (
            <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Prioritized action items">
              <ul className="space-y-2">
                {assessment.action_items.map((item, i) => (
                  <li key={i} className="rounded-lg border border-bip-border bg-bip-card/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low}`}>
                        {item.priority}
                      </span>
                      <span className="text-sm font-medium text-bip-text">{item.title}</span>
                      <span className="ml-auto rounded-full border border-bip-border px-2 py-0.5 text-[10px] text-bip-muted">
                        {item.category}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-bip-muted">{item.explanation}</p>
                    {item.estimated_monthly_impact && (
                      <p className="mt-1 text-xs font-medium text-emerald-400">{item.estimated_monthly_impact}</p>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Geography */}
          {assessment.geographic?.areas?.length > 0 && (
            <SectionCard icon={<MapPin className="h-4 w-4" />} title="Geographic efficiency">
              <p className="mb-2 text-xs text-bip-muted">
                Best area: <span className="text-bip-text">{assessment.geographic.best_area}</span> at{" "}
                {money(assessment.geographic.best_area_cost_per_conv)}/conv. Est. monthly waste from poor
                areas: <span className="text-red-300">{money(assessment.geographic.estimated_monthly_waste_from_poor_areas)}</span>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-bip-muted">
                    <tr>
                      <th className="px-2 py-1 font-medium">Area</th>
                      <th className="px-2 py-1 font-medium">Spend</th>
                      <th className="px-2 py-1 font-medium">Conv</th>
                      <th className="px-2 py-1 font-medium">$/conv</th>
                      <th className="px-2 py-1 font-medium">vs best</th>
                      <th className="px-2 py-1 font-medium">Rec</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.geographic.areas.map((a, i) => (
                      <tr key={i} className="border-t border-bip-border">
                        <td className="px-2 py-1.5 text-bip-text">{a.name}</td>
                        <td className="px-2 py-1.5 tabular-nums">{money(a.spend)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{a.conversions}</td>
                        <td className="px-2 py-1.5 tabular-nums">{money(a.cost_per_conv)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{a.vs_best_area_multiplier != null ? `${a.vs_best_area_multiplier}×` : "—"}</td>
                        <td className={`px-2 py-1.5 font-medium ${REC_STYLES[a.recommendation] ?? "text-bip-muted"}`}>{a.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Search term waste */}
          {assessment.search_term_waste?.irrelevant_categories?.length > 0 && (
            <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Search-term waste">
              <p className="mb-2 text-xs text-bip-muted">
                Est. total waste: <span className="text-red-300">{money(assessment.search_term_waste.total_estimated_waste)}</span>
              </p>
              <ul className="space-y-1.5">
                {assessment.search_term_waste.irrelevant_categories.map((c, i) => (
                  <li key={i} className="rounded-lg border border-bip-border bg-bip-card/40 px-3 py-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-bip-text">{c.category}</span>
                      <span className="text-red-300">{money(c.estimated_spend)} · {c.term_count} terms</span>
                    </div>
                    {c.example_terms?.length > 0 && (
                      <p className="mt-0.5 text-bip-muted">{c.example_terms.slice(0, 6).join(", ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Keyword flags */}
          {assessment.keyword_flags?.length > 0 && (
            <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Keyword flags">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-bip-muted">
                    <tr>
                      <th className="px-2 py-1 font-medium">Keyword</th>
                      <th className="px-2 py-1 font-medium">Spend</th>
                      <th className="px-2 py-1 font-medium">$/conv</th>
                      <th className="px-2 py-1 font-medium">Issue</th>
                      <th className="px-2 py-1 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.keyword_flags.map((k, i) => (
                      <tr key={i} className="border-t border-bip-border">
                        <td className="px-2 py-1.5 text-bip-text">{k.keyword}</td>
                        <td className="px-2 py-1.5 tabular-nums">{money(k.spend)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{money(k.cost_per_conv)}</td>
                        <td className="px-2 py-1.5 text-bip-muted">{k.issue}</td>
                        <td className="px-2 py-1.5 font-medium text-bip-accent">{k.action.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Competitive position */}
          {assessment.competitive_position && (assessment.competitive_position.competitors?.length > 0 || assessment.competitive_position.summary) && (
            <SectionCard icon={<Swords className="h-4 w-4" />} title="Competitive position">
              {assessment.competitive_position.summary && (
                <p className="mb-2 text-xs text-bip-muted">{assessment.competitive_position.summary}</p>
              )}
              {assessment.competitive_position.competitors?.length > 0 && (
                <ul className="space-y-1">
                  {assessment.competitive_position.competitors.map((c, i) => (
                    <li key={i} className="flex justify-between gap-2 text-xs">
                      <span className="text-bip-text">{c.domain}</span>
                      <span className="text-bip-muted">IS {c.impression_share} · above {c.position_above_rate}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {/* Service gaps */}
          {assessment.service_gaps?.length > 0 && (
            <SectionCard icon={<Stethoscope className="h-4 w-4" />} title="Service gaps">
              <ul className="space-y-1.5">
                {assessment.service_gaps.map((s, i) => (
                  <li key={i} className="rounded-lg border border-bip-border bg-bip-card/40 px-3 py-2 text-xs">
                    <p className="font-medium text-bip-text">{s.service}</p>
                    <p className="mt-0.5 text-bip-muted">{s.issue}</p>
                    <p className="mt-0.5 text-bip-accent">{s.recommendation}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Ad schedule */}
          {assessment.ad_schedule?.daypart_recommendation && (
            <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Ad schedule">
              <p className="text-xs text-bip-muted">{assessment.ad_schedule.daypart_recommendation}</p>
              {(assessment.ad_schedule.best_days?.length > 0 || assessment.ad_schedule.worst_days?.length > 0) && (
                <p className="mt-2 text-xs text-bip-muted">
                  {assessment.ad_schedule.best_days?.length > 0 && (
                    <>Best days: <span className="text-emerald-400">{assessment.ad_schedule.best_days.join(", ")}</span>. </>
                  )}
                  {assessment.ad_schedule.worst_days?.length > 0 && (
                    <>Worst days: <span className="text-red-300">{assessment.ad_schedule.worst_days.join(", ")}</span>.</>
                  )}
                </p>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
