"use client";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import KpiSummaryGrid, {
  type KpiSummaryItem,
} from "@/components/dashboard/kpi-summary-grid";
import SmartAdsPlaybook from "@/components/dashboard/smart-ads-playbook";
import {
  formatCostMicros,
  formatQualityBucketLabel,
  hasQualityIssue,
  summarizeQualityFlags,
} from "@/lib/ads/quality-score";
import type { AdsSnapshot } from "@/lib/types/client";
function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
function AdsMetricTile({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-bip-card/40 px-3 py-2.5">
      
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
        {value}
      </p>
      {meta ? (
        <p className="mt-0.5 text-[10px] text-white/50">{meta}</p>
      ) : null}
    </div>
  );
}
type AdsChannelPanelProps = {
  adsSnapshot: AdsSnapshot | null;
  adsLoading: boolean;
  adsError: string | null;
  adsClientId: number | null;
  playbookTaskCount: number;
  kpiItems: KpiSummaryItem[];
  clientName?: string;
  onSyncAds?: () => void;
};
export default function AdsChannelPanel({
  adsSnapshot,
  adsLoading,
  adsError,
  adsClientId,
  playbookTaskCount,
  kpiItems,
  clientName,
  onSyncAds,
}: AdsChannelPanelProps) {
  const keywordQuality = Array.isArray(adsSnapshot?.keyword_quality)
    ? adsSnapshot.keyword_quality
    : [];
  const qualitySummary = summarizeQualityFlags(keywordQuality);
  return (
    <div className="space-y-6">
      
      {kpiItems.length > 0 ? (
        <KpiSummaryGrid items={kpiItems} theme="dark" />
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        <aside className="space-y-4 lg:col-span-4">
          
          <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
            
            <div className="flex items-start justify-between gap-3">
              
              <div className="min-w-0">
                
                <div className="flex items-center gap-2">
                  
                  <BarChart3
                    className="shrink-0 text-bip-accent"
                    size={16}
                  />
                  <h3 className="text-sm font-semibold text-white">
                    Google Ads reporting
                  </h3>
                  {playbookTaskCount > 0 ? (
                    <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      
                      {playbookTaskCount}
                    </span>
                  ) : null}
                </div>
                {adsSnapshot ? (
                  <p className="mt-2 text-xs text-white/50">
                    
                    Last sync {formatDateTime(
                      adsSnapshot.updated_at,
                    )} <br /> Range {adsSnapshot.start_date} to
                    {adsSnapshot.end_date}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-white/50">
                    No snapshot synced yet.
                  </p>
                )}
                {playbookTaskCount > 0 ? (
                  <p className="mt-1 text-xs text-white/50">
                    
                    {playbookTaskCount} playbook intervention
                    {playbookTaskCount === 1 ? "" : "s"} ready
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                
                {adsClientId ? (
                  <a
                    href={`/ads-audit/${adsClientId}`}
                    className="rounded-lg border border-white/[0.08] px-3 py-2 text-center text-xs font-medium text-white/75 transition hover:bg-bip-card/60"
                  >
                    
                    Performance audit
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={onSyncAds}
                  disabled={adsLoading || !onSyncAds}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-bip-accent disabled:opacity-60"
                >
                  
                  {adsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sync ads
                </button>
              </div>
            </div>
          </div>
          {keywordQuality.length > 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
              
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                
                Quality Score flags
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                
                <div>
                  
                  <dt className="text-white/50">Keywords tracked</dt>
                  <dd className="font-medium text-white/75">
                    {qualitySummary.totalKeywords}
                  </dd>
                </div>
                <div>
                  
                  <dt className="text-white/50">Flagged</dt>
                  <dd className="font-medium text-white/75">
                    {qualitySummary.flaggedKeywords}
                  </dd>
                </div>
                <div>
                  
                  <dt className="text-white/50">LP below avg</dt>
                  <dd className="font-medium text-white/75">
                    
                    {qualitySummary.landingPageBelowAverage}
                  </dd>
                </div>
                <div>
                  
                  <dt className="text-white/50">Ad relevance</dt>
                  <dd className="font-medium text-white/75">
                    
                    {qualitySummary.adRelevanceBelowAverage}
                  </dd>
                </div>
                <div>
                  
                  <dt className="text-white/50">Expected CTR</dt>
                  <dd className="font-medium text-white/75">
                    
                    {qualitySummary.expectedCtrBelowAverage}
                  </dd>
                </div>
                <div>
                  
                  <dt className="text-white/50">QS ≤ 5</dt>
                  <dd className="font-medium text-white/75">
                    {qualitySummary.qualityScoreLow}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </aside>
        <div className="space-y-4 lg:col-span-8">
          
          {adsLoading ? (
            <p className="text-sm text-white/50">Syncing Google Ads...</p>
          ) : null}
          {adsError ? <p className="text-sm text-red-400">{adsError}</p> : null}
          {!adsLoading && adsSnapshot ? (
            <>
              
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                
                <AdsMetricTile
                  label="Impressions"
                  value={String(
                    Math.round(adsSnapshot.totals.impressions ?? 0),
                  )}
                  meta={`Updated ${formatDateTime(adsSnapshot.updated_at)}`}
                />
                <AdsMetricTile
                  label="Clicks"
                  value={String(Math.round(adsSnapshot.totals.clicks ?? 0))}
                />
                <AdsMetricTile
                  label="Conversions"
                  value={String(
                    Math.round(adsSnapshot.totals.conversions ?? 0),
                  )}
                />
                <AdsMetricTile
                  label="CTR"
                  value={`${((adsSnapshot.totals.ctr ?? 0) * 100).toFixed(2)}%`}
                />
                <AdsMetricTile
                  label="Search IS"
                  value={
                    typeof adsSnapshot.totals.search_impression_share ===
                    "number"
                      ? `${(adsSnapshot.totals.search_impression_share * 100).toFixed(2)}%`
                      : "Not synced"
                  }
                />
                <AdsMetricTile
                  label="Lost IS (Budget)"
                  value={
                    typeof adsSnapshot.totals
                      .search_budget_lost_impression_share === "number"
                      ? `${(adsSnapshot.totals.search_budget_lost_impression_share * 100).toFixed(2)}%`
                      : "Not synced"
                  }
                />
              </div>
              {adsSnapshot.campaigns.length > 0 ? (
                <div className="overflow-auto rounded-xl border border-white/[0.08] bg-bip-card/40">
                  
                  <div className="border-b border-white/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                    
                    Campaign performance
                  </div>
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs"><thead><tr className="border-b border-white/[0.08] text-white/50"><th className="px-3 py-2 font-medium">Campaign</th><th className="px-3 py-2 font-medium">Impressions</th><th className="px-3 py-2 font-medium">Clicks</th><th className="px-3 py-2 font-medium">Conversions</th><th className="px-3 py-2 font-medium">CTR</th><th className="px-3 py-2 font-medium">Search IS</th><th className="px-3 py-2 font-medium">
                          Lost IS (Rank)
                        </th><th className="px-3 py-2 font-medium">
                          Lost IS (Budget)
                        </th></tr></thead><tbody>{adsSnapshot.campaigns.slice(0, 10).map((campaign) => (
                        <tr
                          key={campaign.campaign_id}
                          className="border-b border-white/[0.08]/50 text-white/75 last:border-0"
                        ><td className="px-3 py-2 text-white/75">
                            {campaign.campaign_name}
                          </td><td className="px-3 py-2">
                            {Math.round(campaign.impressions ?? 0)}
                          </td><td className="px-3 py-2">
                            {Math.round(campaign.clicks ?? 0)}
                          </td><td className="px-3 py-2">
                            {Math.round(campaign.conversions ?? 0)}
                          </td><td className="px-3 py-2">
                            {((campaign.ctr ?? 0) * 100).toFixed(2)}%
                          </td><td className="px-3 py-2">
                            
                            {typeof campaign.search_impression_share ===
                            "number"
                              ? `${(campaign.search_impression_share * 100).toFixed(2)}%`
                              : "—"}
                          </td><td className="px-3 py-2">
                            
                            {typeof campaign.search_rank_lost_impression_share ===
                            "number"
                              ? `${(campaign.search_rank_lost_impression_share * 100).toFixed(2)}%`
                              : "—"}
                          </td><td className="px-3 py-2">
                            
                            {typeof campaign.search_budget_lost_impression_share ===
                            "number"
                              ? `${(campaign.search_budget_lost_impression_share * 100).toFixed(2)}%`
                              : "—"}
                          </td></tr>
                      ))}
                    </tbody></table>
                </div>
              ) : null}
              {Array.isArray(adsSnapshot.auction_insights) &&
              adsSnapshot.auction_insights.length > 0 ? (
                <div className="overflow-auto rounded-xl border border-white/[0.08] bg-bip-card/40">
                  
                  <div className="border-b border-white/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                    
                    Auction insights
                  </div>
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead><tr className="border-b border-white/[0.08] text-white/50"><th className="px-3 py-2 font-medium">Campaign</th><th className="px-3 py-2 font-medium">Domain</th><th className="px-3 py-2 font-medium">Impr. Share</th><th className="px-3 py-2 font-medium">Overlap</th></tr></thead><tbody>{adsSnapshot.auction_insights
                        .slice(0, 15)
                        .map((row, index) => (
                          <tr
                            key={`${row.campaign_id}-${row.domain}-${index}`}
                            className="border-b border-white/[0.08]/50 text-white/75 last:border-0"
                          ><td className="px-3 py-2 text-white/75">
                              {row.campaign_name}
                            </td><td className="px-3 py-2">{row.domain}</td><td className="px-3 py-2">
                              
                              {typeof row.impression_share === "number"
                                ? `${(row.impression_share * 100).toFixed(2)}%`
                                : "—"}
                            </td><td className="px-3 py-2">
                              
                              {typeof row.overlap_rate === "number"
                                ? `${(row.overlap_rate * 100).toFixed(2)}%`
                                : "—"}
                            </td></tr>
                        ))}
                    </tbody></table>
                </div>
              ) : null}
              {keywordQuality.length === 0 ? (
                <p className="rounded-xl border border-white/[0.08] bg-bip-card/40 px-3 py-3 text-xs text-white/50">
                  
                  No Search keyword Quality Score data in this sync. PMax-heavy
                  accounts may not return keyword-level QS metrics.
                </p>
              ) : (
                <div className="overflow-auto rounded-xl border border-white/[0.08] bg-bip-card/40">
                  
                  <div className="border-b border-white/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                    
                    Keyword Quality Score
                  </div>
                  <table className="w-full min-w-[980px] border-collapse text-left text-xs"><thead><tr className="border-b border-white/[0.08] text-white/50"><th className="px-3 py-2 font-medium">Campaign</th><th className="px-3 py-2 font-medium">Ad group</th><th className="px-3 py-2 font-medium">Keyword</th><th className="px-3 py-2 font-medium">QS</th><th className="px-3 py-2 font-medium">Ad relevance</th><th className="px-3 py-2 font-medium">Landing page</th><th className="px-3 py-2 font-medium">Expected CTR</th><th className="px-3 py-2 font-medium">
                          Cost (30d)
                        </th></tr></thead><tbody>{keywordQuality.slice(0, 25).map((row) => {
                        const flagged = hasQualityIssue(row);
                        return (
                          <tr
                            key={`${row.campaign_id}-${row.ad_group_id}-${row.criterion_id}`}
                            className={`border-b border-white/[0.08]/50 last:border-0 ${flagged ? "bg-amber-950/20 text-white/75" : "text-white/75"}`}
                          ><td className="px-3 py-2">
                              {row.campaign_name}
                            </td><td className="px-3 py-2">{row.ad_group_name}</td><td className="px-3 py-2 font-medium text-white/75">
                              {row.keyword}
                            </td><td className="px-3 py-2">
                              {row.quality_score ?? "—"}
                            </td><td className="px-3 py-2">
                              
                              {formatQualityBucketLabel(row.ad_relevance)}
                            </td><td className="px-3 py-2">
                              
                              {formatQualityBucketLabel(
                                row.landing_page_experience,
                              )}
                            </td><td className="px-3 py-2">
                              
                              {formatQualityBucketLabel(row.expected_ctr)}
                            </td><td className="px-3 py-2">
                              {formatCostMicros(row.cost_micros)}
                            </td></tr>
                        );
                      })}
                    </tbody></table>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
      {adsSnapshot ? (
        <SmartAdsPlaybook adsSnapshot={adsSnapshot} clientName={clientName} />
      ) : null}
    </div>
  );
}
