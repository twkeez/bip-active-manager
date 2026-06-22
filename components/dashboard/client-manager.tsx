"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isoDaysAgo } from "@/lib/time";
import { BadgeAlert, Building2, LayoutGrid, ListTodo, ArrowLeft, X, Pencil, Loader2, MessageSquareText, Trash2,
} from "lucide-react";
import { previewText } from "@/lib/basecamp/display";
import ClientProfileView from "@/components/dashboard/client-profile-view";
import AppHeaderActions, { ModuleHeaderLinks } from "@/components/layout/app-header-actions";
import ClientOnboardingView from "@/components/dashboard/client-onboarding-view";
import SeoOpsView from "@/components/dashboard/seo-ops-view";
import DetailTabButton from "@/components/dashboard/detail-tab-button";
import DrawerQuickActions from "@/components/dashboard/drawer-quick-actions";
import { computeDrawerTabAlerts, countCriticalFindings,
} from "@/lib/dashboard/drawer-tab-alerts";
import { resolveQuickAction } from "@/lib/dashboard/quick-action-resolver";
import { clientMatchesServiceFilter, clientMatchesStatusFilter, type ClientServiceFilterKey, type ClientStatusFilter,
} from "@/lib/clients/client-filters";
import { resolveClientStatus } from "@/components/clients/client-status-badge";
import { evaluateClientSetup } from "@/lib/clients/setup-status";
import { activeServiceLabels, getClientActiveServices } from "@/lib/clients/service-active";
import type { AdsSignal, AdsSnapshot, BasecampSyncState, BasecampThreadEvent, ClientRow, ClientKeywordTarget, ClientReportingMetricPreference, GscPageMetric, GscQueryMetric, GscSignal, GscSnapshot, Ga4Snapshot, GbpReviewRow, GbpSnapshot, LighthouseAuditItem, LighthouseAuditOccurrence, LighthouseOccurrenceOverride, LighthouseSnapshot, KeywordHealthRow, ReportingAlertItem, ReportingFreshnessItem, ReportingKpiCard, SocialConnection, SocialDailySnapshot, SocialIdea, SocialPostSnapshot, SocialSignal, StrategistSummaryResult, SitemapSnapshot, SitemapUrlRow, SeoCrawlIssue, SeoCrawlSnapshot,
} from "@/lib/types/client";
import type { ManagedKeyword, ReportingActionItem } from "@/lib/reporting/types";
import { applyReportingMetricPreferences, buildReportingMetricControls, type ReportingMetricControl, type ReportingMetricId,
} from "@/lib/reporting/metric-registry";
import { buildReportingActions, buildReportingAlerts, buildReportingFreshness, buildReportingKpis, computeClientUrgencyScore,
} from "@/lib/reporting/build-report";
import { buildOccurrenceKeyFallback, buildSeoMetricsWithLighthouse, buildSitemapMetrics, buildTechnicalSummary, formatDateOnly, formatDateTime, norm, websiteLabel, type ChannelMetric, type HelpdeskTicketSelection, type TechnicalChannel, type TechnicalFilter, type TechnicalFinding, type TechnicalSummary, type HelpdeskDraftFormat,
} from "@/components/dashboard/client-workspace/shared";
import { FindingCard } from "@/components/dashboard/client-workspace/channel-tab";
import ClientPlaybookView from "@/components/playbook/client-playbook-view";
type DetailTab = |"profile" |"onboarding" |"connections" |"comms" |"reporting" |"seo_ops" |"seo" |"ads" |"sitemaps" |"social" |"actions" |"playbook";
type FlyoutMode ="basecamp" |"technical";
async function safeParseJson<T>(response: Response): Promise<T | null> { const text = await response.text();
if (!text.trim()) return null;
try { return JSON.parse(text) as T; }
catch { return null; }
}
function uniqueSorted(values: (string | null | undefined)[]) {
  const set = new Set<string>(); for (const v of values) {
  const t = norm(v);
if (t) set.add(t); }
return [...set].sort((a, b) => a.localeCompare(b));
}
function toMatchTokens(value: string | null | undefined) {
  return norm(value) .toLowerCase() .replace(/[^a-z0-9]+/g,"") .split("") .filter((token) => token.length >= 3);
}
function isLikelyOwnedByCurrentUser( strategist: string | null | undefined, userEmail: string | undefined,
) {
  if (!userEmail) return false;
const strategistTokens = toMatchTokens(strategist);
if (strategistTokens.length === 0) return false;
const emailLocal = userEmail.split("@")[0] ??"";
const userTokens = toMatchTokens(emailLocal);
if (userTokens.length === 0) return false;
return userTokens.some((token) => strategistTokens.some((part) => part.includes(token)));
}

type Props = { initialClients: ClientRow[]; initialThreadEvents: BasecampThreadEvent[]; initialLighthouseSnapshots: LighthouseSnapshot[]; initialLighthouseOverrides: LighthouseOccurrenceOverride[]; initialSeoCrawlSnapshots: SeoCrawlSnapshot[]; initialSeoCrawlIssues: SeoCrawlIssue[]; initialGscSnapshots: GscSnapshot[]; initialGscSignals: GscSignal[]; initialGscPageMetrics: GscPageMetric[]; initialGscQueryMetrics: GscQueryMetric[]; initialSitemapSnapshots: SitemapSnapshot[]; initialSitemapUrls: SitemapUrlRow[]; initialSocialConnections: SocialConnection[]; initialSocialDailySnapshots: SocialDailySnapshot[]; initialSocialPostSnapshots: SocialPostSnapshot[]; initialSocialSignals: SocialSignal[]; initialAdsSnapshots: AdsSnapshot[]; initialAdsSignals: AdsSignal[]; initialGa4Snapshots?: Ga4Snapshot[]; initialGbpSnapshots: GbpSnapshot[]; initialGbpReviews: GbpReviewRow[]; duplicateProjectIdCounts: Record<string, number>; userEmail: string | undefined; syncState: BasecampSyncState | null; basecampStatus?: string; initialDetailTab?: DetailTab | null; mode:"workspace"; workspaceClientId?: number | null; ReportingTab: ComponentType<any>; ChannelTab: ComponentType<any>;
};
export default function ClientManager({ initialClients, initialThreadEvents, initialLighthouseSnapshots, initialLighthouseOverrides, initialSeoCrawlSnapshots, initialSeoCrawlIssues, initialGscSnapshots, initialGscSignals, initialGscPageMetrics, initialGscQueryMetrics, initialSitemapSnapshots, initialSitemapUrls, initialSocialConnections, initialSocialDailySnapshots, initialSocialPostSnapshots, initialSocialSignals, initialAdsSnapshots, initialAdsSignals, initialGa4Snapshots = [], initialGbpSnapshots, initialGbpReviews, duplicateProjectIdCounts, userEmail, syncState, basecampStatus, initialDetailTab = null, workspaceClientId = null, ReportingTab, ChannelTab,
}: Props) {
  const router = useRouter();
const supabase = createClient();
const [clients, setClients] = useState<ClientRow[]>(initialClients);
const workspaceClient = workspaceClientId != null ? initialClients.find((client) => client.id === workspaceClientId) ?? null : null;
const initialSelectedClient = workspaceClient;
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("");
const [serviceFilters, setServiceFilters] = useState<ClientServiceFilterKey[]>([]);
const [strategistFilter, setStrategistFilter] = useState("");
const [tierFilter, setTierFilter] = useState("");
const [selected, setSelected] = useState<ClientRow | null |"new">(initialSelectedClient);
const [editMode, setEditMode] = useState(false);
const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
const [deleting, setDeleting] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);
const [acknowledging, setAcknowledging] = useState(false);
const [ackError, setAckError] = useState<string | null>(null);
const [taskCreateLoadingByThread, setTaskCreateLoadingByThread] = useState< Record<string, boolean | undefined> >({});
const [taskCreateMessageByThread, setTaskCreateMessageByThread] = useState< Record<string, string | undefined> >({});
const [showMineOnly, setShowMineOnly] = useState(false);
const [showStaleOnly, setShowStaleOnly] = useState(false);
const [prioritizeUrgent, setPrioritizeUrgent] = useState(true);
const [shareCopyStatus, setShareCopyStatus] = useState<{ tone:"success" |"error"; message: string; } | null>(null);
const [technicalFilter, setTechnicalFilter] = useState<TechnicalFilter>("");
const [detailTab, setDetailTab] = useState<DetailTab>(initialDetailTab ??"profile");
const [flyoutMode, setFlyoutMode] = useState<FlyoutMode>("basecamp");
const [form, setForm] = useState<Partial<ClientRow> | null>( initialSelectedClient ? { ...initialSelectedClient } : null, );
const initialLighthouseByClient = useMemo(() => { return Object.fromEntries( initialLighthouseSnapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, LighthouseSnapshot>; }, [initialLighthouseSnapshots]);
const [lighthouseByClient, setLighthouseByClient] = useState< Record<number, LighthouseSnapshot | undefined> >(initialLighthouseByClient);
const [lighthouseLoadingByClient, setLighthouseLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [lighthouseErrorByClient, setLighthouseErrorByClient] = useState< Record<number, string | undefined> >({});
const [lighthouseNoFixNeeded, setLighthouseNoFixNeeded] = useState< Record<number, Set<string>> >({});
const initialCrawlSnapshotByClient = useMemo( () => Object.fromEntries( initialSeoCrawlSnapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, SeoCrawlSnapshot>, [initialSeoCrawlSnapshots], );
const initialCrawlIssuesByClient = useMemo(() => { const grouped: Record<number, SeoCrawlIssue[]> = {}; for (const issue of initialSeoCrawlIssues) {
  if (!grouped[issue.client_id]) grouped[issue.client_id] = []; grouped[issue.client_id]!.push(issue); }
return grouped; }, [initialSeoCrawlIssues]);
const initialGscSnapshotByClient = useMemo( () => Object.fromEntries( initialGscSnapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, GscSnapshot>, [initialGscSnapshots], );
const initialGscSignalsByClient = useMemo(() => { const grouped: Record<number, GscSignal[]> = {}; for (const signal of initialGscSignals) {
  if (!grouped[signal.client_id]) grouped[signal.client_id] = []; grouped[signal.client_id]!.push(signal); }
return grouped; }, [initialGscSignals]);
const initialGscPageMetricsByClient = useMemo(() => { const grouped: Record<number, GscPageMetric[]> = {}; for (const row of initialGscPageMetrics) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialGscPageMetrics]);
const initialGscQueryMetricsByClient = useMemo(() => { const grouped: Record<number, GscQueryMetric[]> = {}; for (const row of initialGscQueryMetrics) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialGscQueryMetrics]);
const initialSitemapSnapshotByClient = useMemo( () => Object.fromEntries( initialSitemapSnapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, SitemapSnapshot>, [initialSitemapSnapshots], );
const initialSitemapUrlsByClient = useMemo(() => { const grouped: Record<number, SitemapUrlRow[]> = {}; for (const row of initialSitemapUrls) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialSitemapUrls]);
const initialSocialConnectionsByClient = useMemo(() => { const grouped: Record<number, SocialConnection[]> = {}; for (const row of initialSocialConnections) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialSocialConnections]);
const initialSocialDailyByClient = useMemo(() => { const grouped: Record<number, SocialDailySnapshot[]> = {}; for (const row of initialSocialDailySnapshots) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialSocialDailySnapshots]);
const initialSocialPostsByClient = useMemo(() => { const grouped: Record<number, SocialPostSnapshot[]> = {}; for (const row of initialSocialPostSnapshots) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialSocialPostSnapshots]);
const initialSocialSignalsByClient = useMemo(() => { const grouped: Record<number, SocialSignal[]> = {}; for (const row of initialSocialSignals) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialSocialSignals]);
const initialAdsSnapshotByClient = useMemo( () => Object.fromEntries( initialAdsSnapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, AdsSnapshot>, [initialAdsSnapshots], );
const ga4SnapshotByClient = useMemo( () => Object.fromEntries( initialGa4Snapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, Ga4Snapshot>, [initialGa4Snapshots], );
const initialAdsSignalsByClient = useMemo(() => { const grouped: Record<number, AdsSignal[]> = {}; for (const row of initialAdsSignals) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialAdsSignals]);
const initialGbpSnapshotByClient = useMemo( () => Object.fromEntries( initialGbpSnapshots.map((snapshot) => [snapshot.client_id, snapshot]), ) as Record<number, GbpSnapshot>, [initialGbpSnapshots], );
const initialGbpReviewsByClient = useMemo(() => { const grouped: Record<number, GbpReviewRow[]> = {}; for (const row of initialGbpReviews) {
  if (!grouped[row.client_id]) grouped[row.client_id] = []; grouped[row.client_id]!.push(row); }
return grouped; }, [initialGbpReviews]);
const [crawlSnapshotByClient, setCrawlSnapshotByClient] = useState< Record<number, SeoCrawlSnapshot | undefined> >(initialCrawlSnapshotByClient);
const [crawlIssuesByClient, setCrawlIssuesByClient] = useState< Record<number, SeoCrawlIssue[] | undefined> >(initialCrawlIssuesByClient);
const [crawlLoadingByClient, setCrawlLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [crawlErrorByClient, setCrawlErrorByClient] = useState< Record<number, string | undefined> >({});
const [gscSnapshotByClient, setGscSnapshotByClient] = useState< Record<number, GscSnapshot | undefined> >(initialGscSnapshotByClient);
const [gscSignalsByClient, setGscSignalsByClient] = useState< Record<number, GscSignal[] | undefined> >(initialGscSignalsByClient);
const [gscPageMetricsByClient, setGscPageMetricsByClient] = useState< Record<number, GscPageMetric[] | undefined> >(initialGscPageMetricsByClient);
const [gscQueryMetricsByClient, setGscQueryMetricsByClient] = useState< Record<number, GscQueryMetric[] | undefined> >(initialGscQueryMetricsByClient);
const [gscLoadingByClient, setGscLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [gscErrorByClient, setGscErrorByClient] = useState< Record<number, string | undefined> >({});
const [sitemapSnapshotByClient, setSitemapSnapshotByClient] = useState< Record<number, SitemapSnapshot | undefined> >(initialSitemapSnapshotByClient);
const [sitemapUrlsByClient, setSitemapUrlsByClient] = useState< Record<number, SitemapUrlRow[] | undefined> >(initialSitemapUrlsByClient);
const [sitemapLoadingByClient, setSitemapLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [sitemapErrorByClient, setSitemapErrorByClient] = useState< Record<number, string | undefined> >({});
const [socialConnectionsByClient, setSocialConnectionsByClient] = useState< Record<number, SocialConnection[] | undefined> >(initialSocialConnectionsByClient);
const [socialDailyByClient, setSocialDailyByClient] = useState< Record<number, SocialDailySnapshot[] | undefined> >(initialSocialDailyByClient);
const [socialPostsByClient, setSocialPostsByClient] = useState< Record<number, SocialPostSnapshot[] | undefined> >(initialSocialPostsByClient);
const [socialSignalsByClient, setSocialSignalsByClient] = useState< Record<number, SocialSignal[] | undefined> >(initialSocialSignalsByClient);
const [socialIdeasByClient, setSocialIdeasByClient] = useState< Record<number, SocialIdea[] | undefined> >({});
const [socialLoadingByClient, setSocialLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [socialErrorByClient, setSocialErrorByClient] = useState< Record<number, string | undefined> >({});
const [socialIdeasLoadingByClient, setSocialIdeasLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [socialIdeasErrorByClient, setSocialIdeasErrorByClient] = useState< Record<number, string | undefined> >({});
const [socialTokenRefreshing, setSocialTokenRefreshing] = useState(false);
const [socialTokenMessage, setSocialTokenMessage] = useState<string | null>(null);
const [reportingSyncRunning, setReportingSyncRunning] = useState(false);
const [reportingSyncMessage, setReportingSyncMessage] = useState<string | null>(null);
const [keywordTargetsByClient, setKeywordTargetsByClient] = useState< Record<number, ClientKeywordTarget[] | undefined> >({});
const [keywordTargetsLoadingByClient, setKeywordTargetsLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [reportingMetricPrefsByClient, setReportingMetricPrefsByClient] = useState< Record<number, ClientReportingMetricPreference[] | undefined> >({});
const [reportingMetricPrefsLoadingByClient, setReportingMetricPrefsLoadingByClient] = useState<Record<number, boolean | undefined>>({});
const [keywordDraftInput, setKeywordDraftInput] = useState("");
const [keywordHealthByClient, setKeywordHealthByClient] = useState< Record<number, KeywordHealthRow[] | undefined> >({});
const [keywordHealthLoadingByClient, setKeywordHealthLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [keywordHealthErrorByClient, setKeywordHealthErrorByClient] = useState< Record<number, string | undefined> >({});
const [keywordHealthAutoAttemptedByClient, setKeywordHealthAutoAttemptedByClient] = useState< Record<number, boolean | undefined> >({});
const [keywordDropTheoryByClient, setKeywordDropTheoryByClient] = useState< Record<number, Record<string, { theory: string; actionSignals: string[] } | undefined>> >({});
const [keywordDropTheoryLoadingByClient, setKeywordDropTheoryLoadingByClient] = useState< Record<number, Record<string, boolean | undefined>> >({});
const [strategistSummaryByClient, setStrategistSummaryByClient] = useState< Record<number, StrategistSummaryResult | undefined> >({});
const [strategistSummaryGoalsByClient, setStrategistSummaryGoalsByClient] = useState< Record<number, string | undefined> >({});
const [strategistSummaryLoadingByClient, setStrategistSummaryLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [strategistSummaryErrorByClient, setStrategistSummaryErrorByClient] = useState< Record<number, string | undefined> >({});
const [adsSnapshotByClient, setAdsSnapshotByClient] = useState< Record<number, AdsSnapshot | undefined> >(initialAdsSnapshotByClient);
const [adsSignalsByClient, setAdsSignalsByClient] = useState< Record<number, AdsSignal[] | undefined> >(initialAdsSignalsByClient);
const [adsLoadingByClient, setAdsLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [adsErrorByClient, setAdsErrorByClient] = useState< Record<number, string | undefined> >({});
const [gbpSnapshotByClient, setGbpSnapshotByClient] = useState< Record<number, GbpSnapshot | undefined> >(initialGbpSnapshotByClient);
const [gbpReviewsByClient, setGbpReviewsByClient] = useState< Record<number, GbpReviewRow[] | undefined> >(initialGbpReviewsByClient);
const [gbpLoadingByClient, setGbpLoadingByClient] = useState< Record<number, boolean | undefined> >({});
const [gbpErrorByClient, setGbpErrorByClient] = useState< Record<number, string | undefined> >({});
const [gbpSyncDiagnosticsByClient, setGbpSyncDiagnosticsByClient] = useState< Record< number, | { fetchedReviewCount: number; storedReviewCount: number; latestReviewTimeUnix: number | null; topReviews: Array<{ authorName: string | null; reviewTimeUnix: number | null; relativeTimeDescription: string | null; rating: number | null; }>; sourceBreakdown: { placesReviewCount: number; legacyReviewCount: number; gbpApiReviewCount: number; matchedGbpLocationCount: number; gbpApiError: string | null; }; } | undefined > >({});
const [selectedHelpdeskItems, setSelectedHelpdeskItems] = useState< Record<number, Record<string, HelpdeskTicketSelection>> >({});
const [noFixSavingKey, setNoFixSavingKey] = useState<string | null>(null);
const [helpdeskDraftOpen, setHelpdeskDraftOpen] = useState(false);
const [helpdeskDraftText, setHelpdeskDraftText] = useState("");
const [helpdeskDraftCopied, setHelpdeskDraftCopied] = useState<string | null>(null);
const [helpdeskDraftFormat, setHelpdeskDraftFormat] = useState<HelpdeskDraftFormat>("detailed");
const [helpdeskDraftClientId, setHelpdeskDraftClientId] = useState<number | null>(null); useEffect(() => { setLighthouseByClient(initialLighthouseByClient); }, [initialLighthouseByClient]); useEffect(() => { setCrawlSnapshotByClient(initialCrawlSnapshotByClient);
setCrawlIssuesByClient(initialCrawlIssuesByClient); }, [initialCrawlSnapshotByClient, initialCrawlIssuesByClient]); useEffect(() => { setGscSnapshotByClient(initialGscSnapshotByClient);
setGscSignalsByClient(initialGscSignalsByClient);
setGscPageMetricsByClient(initialGscPageMetricsByClient);
setGscQueryMetricsByClient(initialGscQueryMetricsByClient); }, [ initialGscSnapshotByClient, initialGscSignalsByClient, initialGscPageMetricsByClient, initialGscQueryMetricsByClient, ]); useEffect(() => { if (!selected || selected ==="new") return;
if (keywordTargetsByClient[selected.id] !== undefined) return; void loadKeywordTargets(selected.id); }, [selected, keywordTargetsByClient]); useEffect(() => { if (!selected || selected ==="new") return;
if (reportingMetricPrefsByClient[selected.id] !== undefined) return; void loadReportingMetricPrefs(selected.id); }, [selected, reportingMetricPrefsByClient]); useEffect(() => { setSitemapSnapshotByClient(initialSitemapSnapshotByClient);
setSitemapUrlsByClient(initialSitemapUrlsByClient); }, [initialSitemapSnapshotByClient, initialSitemapUrlsByClient]); useEffect(() => { setSocialConnectionsByClient(initialSocialConnectionsByClient);
setSocialDailyByClient(initialSocialDailyByClient);
setSocialPostsByClient(initialSocialPostsByClient);
setSocialSignalsByClient(initialSocialSignalsByClient); }, [ initialSocialConnectionsByClient, initialSocialDailyByClient, initialSocialPostsByClient, initialSocialSignalsByClient, ]); useEffect(() => { setAdsSnapshotByClient(initialAdsSnapshotByClient);
setAdsSignalsByClient(initialAdsSignalsByClient); }, [initialAdsSnapshotByClient, initialAdsSignalsByClient]); useEffect(() => { setGbpSnapshotByClient(initialGbpSnapshotByClient);
setGbpReviewsByClient(initialGbpReviewsByClient); }, [initialGbpSnapshotByClient, initialGbpReviewsByClient]); useEffect(() => { const next: Record<number, Set<string>> = {}; for (const row of initialLighthouseOverrides) {
  if (!next[row.client_id]) next[row.client_id] = new Set<string>(); next[row.client_id]!.add(row.occurrence_key); } setLighthouseNoFixNeeded(next); }, [initialLighthouseOverrides]);
const threadsByProject = useMemo(() => { const grouped = new Map<string, BasecampThreadEvent[]>(); for (const event of initialThreadEvents) {
  const projectId = norm(event.basecamp_project_id);
if (!projectId) continue;
const current = grouped.get(projectId) ?? []; current.push(event); grouped.set(projectId, current); } for (const [projectId, events] of grouped) { grouped.set( projectId, [...events] .sort( (left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime(), ) .slice(0, 30), ); }
return grouped; }, [initialThreadEvents]);
const selectedClientId = selected && selected !=="new" ? selected.id : null;
const selectedProjectId = selected && selected !=="new" ? norm(selected.basecamp_project_id) :"";
const selectedThreads = selectedProjectId ? (threadsByProject.get(selectedProjectId) ?? []) : [];
const selectedProjectDuplicateCount = selectedProjectId ? (duplicateProjectIdCounts[selectedProjectId] ?? 0) : 0;
function toThreadTaskKey(event: BasecampThreadEvent) {
  const threadRecordingId = event.parent_recording_id ?? event.basecamp_recording_id;
return `${norm(event.basecamp_project_id)}:${threadRecordingId}`; } useEffect(() => { if (!selectedClientId) return;
const run = async () => { const cutoffIso = isoDaysAgo(30);
await supabase .from("basecamp_communication_events") .select("id", { count:"exact", head: true }) .eq("basecamp_project_id", selectedProjectId) .gte("occurred_at", cutoffIso); }; void run(); }, [selectedClientId, selectedProjectId, selectedThreads.length, supabase]);
async function handleRefreshLighthouse(client: ClientRow) {
  const website = norm(client.website);
if (!website) {
  setLighthouseErrorByClient((prev) => ({ ...prev, [client.id]:"Website is required before running Lighthouse.", }));
return; } setLighthouseLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setLighthouseErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/seo/lighthouse", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await response.json()) as { error?: string; snapshot?: LighthouseSnapshot; };
if (!response.ok || !payload.snapshot) { throw new Error(payload.error ??"Failed to refresh Lighthouse data"); } setLighthouseByClient((prev) => ({ ...prev, [client.id]: payload.snapshot, })); }
catch (error) {
  setLighthouseErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Lighthouse request failed", })); }
finally { setLighthouseLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleRunSeoCrawl(client: ClientRow) {
  setCrawlLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setCrawlErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/seo/crawl", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await response.json()) as { error?: string; snapshot?: SeoCrawlSnapshot; issues?: SeoCrawlIssue[]; };
if (!response.ok || !payload.snapshot) { throw new Error(payload.error ??"Failed to run SEO crawl"); } setCrawlSnapshotByClient((prev) => ({ ...prev, [client.id]: payload.snapshot }));
setCrawlIssuesByClient((prev) => ({ ...prev, [client.id]: payload.issues ?? [] })); }
catch (error) {
  setCrawlErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"SEO crawl failed", })); }
finally { setCrawlLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleSyncSearchConsole(client: ClientRow) {
  setGscLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setGscErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/seo/search-console/sync", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await response.json()) as { error?: string; snapshot?: GscSnapshot; signals?: GscSignal[]; pageMetrics?: GscPageMetric[]; queryMetrics?: GscQueryMetric[]; };
if (!response.ok || !payload.snapshot) { throw new Error(payload.error ??"Search Console sync failed"); } setGscSnapshotByClient((prev) => ({ ...prev, [client.id]: payload.snapshot }));
setGscSignalsByClient((prev) => ({ ...prev, [client.id]: payload.signals ?? [] }));
setGscPageMetricsByClient((prev) => ({ ...prev, [client.id]: payload.pageMetrics ?? [], }));
setGscQueryMetricsByClient((prev) => ({ ...prev, [client.id]: payload.queryMetrics ?? [], })); }
catch (error) {
  setGscErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Search Console sync failed", })); }
finally { setGscLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleSyncSitemaps(client: ClientRow) {
  setSitemapLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setSitemapErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/sitemaps/sync", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await response.json()) as { error?: string; snapshot?: SitemapSnapshot; urls?: SitemapUrlRow[]; };
if (!response.ok || !payload.snapshot) { throw new Error(payload.error ??"Sitemap sync failed"); } setSitemapSnapshotByClient((prev) => ({ ...prev, [client.id]: payload.snapshot }));
setSitemapUrlsByClient((prev) => ({ ...prev, [client.id]: payload.urls ?? [] })); }
catch (error) {
  setSitemapErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Sitemap sync failed", })); }
finally { setSitemapLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleSyncAds(client: ClientRow) {
  setAdsLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setAdsErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/ads/sync", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await safeParseJson<{ error?: string; snapshot?: AdsSnapshot; signals?: AdsSignal[]; }>(response)) ?? { error:"Ads sync returned an unreadable response." };
if (!response.ok || !payload.snapshot) { throw new Error(payload.error ??"Ads sync failed"); } setAdsSnapshotByClient((prev) => ({ ...prev, [client.id]: payload.snapshot }));
setAdsSignalsByClient((prev) => ({ ...prev, [client.id]: payload.signals ?? [] })); }
catch (error) {
  setAdsErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Ads sync failed", })); }
finally { setAdsLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleSyncSocial(client: ClientRow) {
  setSocialLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setSocialErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/social/sync", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await safeParseJson<{ error?: string; connection?: SocialConnection; dailySnapshots?: SocialDailySnapshot[]; postSnapshots?: SocialPostSnapshot[]; signals?: SocialSignal[]; }>(response)) ?? { error:"Social sync returned an unreadable response." };
if (!response.ok) { throw new Error(payload.error ??"Social sync failed"); }
const connection = payload.connection;
if (connection) {
  setSocialConnectionsByClient((prev) => ({ ...prev, [client.id]: [connection], })); } setSocialDailyByClient((prev) => ({ ...prev, [client.id]: payload.dailySnapshots ?? [], }));
setSocialPostsByClient((prev) => ({ ...prev, [client.id]: payload.postSnapshots ?? [], }));
setSocialSignalsByClient((prev) => ({ ...prev, [client.id]: payload.signals ?? [], })); }
catch (error) {
  setSocialErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Social sync failed", })); }
finally { setSocialLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleSyncGbp(client: ClientRow) {
  setGbpLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setGbpErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/gbp/sync", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await safeParseJson<{ error?: string; snapshot?: GbpSnapshot; reviews?: GbpReviewRow[]; diagnostics?: { fetchedReviewCount?: number; storedReviewCount?: number; latestReviewTimeUnix?: number | null; topReviews?: Array<{ authorName?: string | null; reviewTimeUnix?: number | null; relativeTimeDescription?: string | null; rating?: number | null; }>; sourceBreakdown?: { placesReviewCount?: number; legacyReviewCount?: number; gbpApiReviewCount?: number; matchedGbpLocationCount?: number; gbpApiError?: string | null; }; }; }>(response)) ?? { error:"GBP sync returned an unreadable response." };
if (!response.ok || !payload.snapshot) { throw new Error(payload.error ??"Google Business Profile sync failed"); } setGbpSnapshotByClient((prev) => ({ ...prev, [client.id]: payload.snapshot }));
setGbpReviewsByClient((prev) => ({ ...prev, [client.id]: payload.reviews ?? [] }));
setGbpSyncDiagnosticsByClient((prev) => ({ ...prev, [client.id]: payload.diagnostics ? { fetchedReviewCount: Number(payload.diagnostics.fetchedReviewCount ?? 0), storedReviewCount: Number(payload.diagnostics.storedReviewCount ?? 0), latestReviewTimeUnix: typeof payload.diagnostics.latestReviewTimeUnix ==="number" ? payload.diagnostics.latestReviewTimeUnix : null, topReviews: Array.isArray(payload.diagnostics.topReviews) ? payload.diagnostics.topReviews .slice(0, 3) .map((row) => ({ authorName: row.authorName ?? null, reviewTimeUnix: typeof row.reviewTimeUnix ==="number" ? row.reviewTimeUnix : null, relativeTimeDescription: row.relativeTimeDescription ?? null, rating: typeof row.rating ==="number" ? row.rating : null, })) : [], sourceBreakdown: { placesReviewCount: Number(payload.diagnostics.sourceBreakdown?.placesReviewCount ?? 0), legacyReviewCount: Number(payload.diagnostics.sourceBreakdown?.legacyReviewCount ?? 0), gbpApiReviewCount: Number(payload.diagnostics.sourceBreakdown?.gbpApiReviewCount ?? 0), matchedGbpLocationCount: Number( payload.diagnostics.sourceBreakdown?.matchedGbpLocationCount ?? 0, ), gbpApiError: payload.diagnostics.sourceBreakdown?.gbpApiError ?? null, }, } : undefined, })); }
catch (error) {
  setGbpErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Google Business Profile sync failed", })); }
finally { setGbpLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleRunAllReportingSync(client: ClientRow) {
  if (reportingSyncRunning) return;
setReportingSyncRunning(true);
setReportingSyncMessage(null);
try { await handleRefreshLighthouse(client);
await handleRunSeoCrawl(client);
if (norm(client.sc_url)) {
  await handleSyncSearchConsole(client); }
if (norm(client.website)) {
  await handleSyncSitemaps(client); }
if (norm(client.ads_customer_id)) {
  await handleSyncAds(client); } await handleSyncSocial(client);
if (norm(client.google_place_id)) {
  await handleSyncGbp(client); } setReportingSyncMessage("Refreshed available channels for this client."); }
catch { setReportingSyncMessage("Some channels could not be refreshed. Check tab-level errors."); }
finally { setReportingSyncRunning(false); } }
async function loadKeywordTargets(clientId: number) {
  setKeywordTargetsLoadingByClient((prev) => ({ ...prev, [clientId]: true }));
try { const response = await fetch(`/api/reporting/keywords?clientId=${clientId}`, { method:"GET", credentials:"include", });
const payload = (await safeParseJson<{ rows?: ClientKeywordTarget[]; error?: string }>(response)) ?? null;
if (!response.ok) throw new Error(payload?.error ??"Failed to load keywords");
setKeywordTargetsByClient((prev) => ({ ...prev, [clientId]: payload?.rows ?? [], })); }
catch { setKeywordTargetsByClient((prev) => ({ ...prev, [clientId]: [] })); }
finally { setKeywordTargetsLoadingByClient((prev) => ({ ...prev, [clientId]: false })); } }
async function addKeywordTarget(clientId: number, keyword: string) {
  const trimmed = keyword.trim();
if (!trimmed) return;
setKeywordTargetsLoadingByClient((prev) => ({ ...prev, [clientId]: true }));
try { const response = await fetch("/api/reporting/keywords", { method:"PUT", headers: {"Content-Type":"application/json" }, credentials:"include", body: JSON.stringify({ clientId, upserts: [{ keyword: trimmed, priority: 50, isActive: true }], }), });
const payload = (await safeParseJson<{ rows?: ClientKeywordTarget[]; error?: string }>(response)) ?? null;
if (!response.ok) throw new Error(payload?.error ??"Failed to add keyword");
setKeywordTargetsByClient((prev) => ({ ...prev, [clientId]: payload?.rows ?? [], }));
setKeywordDraftInput(""); }
catch {
  // no-op
}
finally { setKeywordTargetsLoadingByClient((prev) => ({ ...prev, [clientId]: false })); } }
async function loadReportingMetricPrefs(clientId: number) {
  setReportingMetricPrefsLoadingByClient((prev) => ({ ...prev, [clientId]: true }));
try { const response = await fetch( `/api/reporting/metric-preferences?clientId=${clientId}`, { method:"GET", credentials:"include", }, );
const payload = (await safeParseJson<{ rows?: ClientReportingMetricPreference[]; error?: string; }>(response)) ?? null;
if (!response.ok) { throw new Error(payload?.error ??"Failed to load reporting metric preferences"); } setReportingMetricPrefsByClient((prev) => ({ ...prev, [clientId]: payload?.rows ?? [], })); }
catch { setReportingMetricPrefsByClient((prev) => ({ ...prev, [clientId]: [] })); }
finally { setReportingMetricPrefsLoadingByClient((prev) => ({ ...prev, [clientId]: false, })); } }
async function saveReportingMetricPrefs( clientId: number, rows: Array<{ metricId: ReportingMetricId; isEnabled: boolean; displayOrder: number }>, ) {
  setReportingMetricPrefsLoadingByClient((prev) => ({ ...prev, [clientId]: true }));
try { const response = await fetch("/api/reporting/metric-preferences", { method:"PUT", headers: {"Content-Type":"application/json" }, credentials:"include", body: JSON.stringify({ clientId, rows: rows.map((row) => ({ metricId: row.metricId, isEnabled: row.isEnabled, displayOrder: row.displayOrder, })), }), });
const payload = (await safeParseJson<{ rows?: ClientReportingMetricPreference[]; error?: string; }>(response)) ?? null;
if (!response.ok) { throw new Error(payload?.error ??"Failed to save reporting metric preferences"); } setReportingMetricPrefsByClient((prev) => ({ ...prev, [clientId]: payload?.rows ?? [], })); }
catch {
  // no-op
}
finally { setReportingMetricPrefsLoadingByClient((prev) => ({ ...prev, [clientId]: false, })); } }
async function resetReportingMetricPrefs(clientId: number) {
  setReportingMetricPrefsLoadingByClient((prev) => ({ ...prev, [clientId]: true }));
try { const response = await fetch("/api/reporting/metric-preferences", { method:"DELETE", headers: {"Content-Type":"application/json" }, credentials:"include", body: JSON.stringify({ clientId }), });
const payload = (await safeParseJson<{ rows?: ClientReportingMetricPreference[]; error?: string; }>(response)) ?? null;
if (!response.ok) { throw new Error(payload?.error ??"Failed to reset reporting metric preferences"); } setReportingMetricPrefsByClient((prev) => ({ ...prev, [clientId]: payload?.rows ?? [], })); }
catch {
  // no-op
}
finally { setReportingMetricPrefsLoadingByClient((prev) => ({ ...prev, [clientId]: false, })); } }
async function removeKeywordTarget(clientId: number, id: number) {
  setKeywordTargetsLoadingByClient((prev) => ({ ...prev, [clientId]: true }));
try { const response = await fetch("/api/reporting/keywords", { method:"PUT", headers: {"Content-Type":"application/json" }, credentials:"include", body: JSON.stringify({ clientId, deleteIds: [id] }), });
const payload = (await safeParseJson<{ rows?: ClientKeywordTarget[]; error?: string }>(response)) ?? null;
if (!response.ok) throw new Error(payload?.error ??"Failed to remove keyword");
setKeywordTargetsByClient((prev) => ({ ...prev, [clientId]: payload?.rows ?? [], })); }
catch {
  // no-op
}
finally { setKeywordTargetsLoadingByClient((prev) => ({ ...prev, [clientId]: false })); } }
const handleLoadKeywordHealth = useCallback(async (client: ClientRow) => { setKeywordHealthLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setKeywordHealthErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/seo/keyword-health", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await safeParseJson<{ error?: string; rows?: KeywordHealthRow[]; }>(response)) ?? { error:"Keyword Health returned an unreadable response." };
if (!response.ok || !payload.rows) { throw new Error(payload.error ??"Failed to load keyword health data"); } setKeywordHealthByClient((prev) => ({ ...prev, [client.id]: payload.rows ?? [] })); return payload.rows ?? []; }
catch (error) {
  setKeywordHealthErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Failed to load keyword health data", })); return []; }
finally { setKeywordHealthLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }, []); useEffect(() => { if (detailTab !=="reporting") return;
if (!selected || selected ==="new") return;
if (keywordHealthByClient[selected.id] != null) return;
if (keywordHealthLoadingByClient[selected.id]) return;
if (keywordHealthAutoAttemptedByClient[selected.id]) return;
setKeywordHealthAutoAttemptedByClient((prev) => ({ ...prev, [selected.id]: true })); void handleLoadKeywordHealth(selected); }, [ detailTab, selected, keywordHealthByClient, keywordHealthLoadingByClient, keywordHealthAutoAttemptedByClient, handleLoadKeywordHealth, ]);
async function handleExplainKeywordDrop(client: ClientRow, row: KeywordHealthRow) {
  const rowKey = `${row.keyword}::${row.page_url ??""}`;
setKeywordDropTheoryLoadingByClient((prev) => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [rowKey]: true, }, }));
try { const response = await fetch("/api/ai/keyword-drop-theory", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id, keyword: row.keyword, pageUrl: row.page_url, previousPosition: row.previous_position, currentPosition: row.current_position, previousClicks: row.previous_clicks, currentClicks: row.current_clicks, previousImpressions: row.previous_impressions, currentImpressions: row.current_impressions, }), });
const payload = (await safeParseJson<{ error?: string; result?: { theory: string; actionSignals: string[] }; }>(response)) ?? { error:"Theory endpoint returned unreadable response." };
if (!response.ok || !payload.result) { throw new Error(payload.error ??"Failed to generate keyword theory"); } setKeywordDropTheoryByClient((prev) => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [rowKey]: payload.result, }, })); }
catch (error) {
  setKeywordHealthErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Failed to generate keyword theory", })); }
finally { setKeywordDropTheoryLoadingByClient((prev) => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [rowKey]: false, }, })); } }
async function handleGenerateStrategistSummary(client: ClientRow) {
  setStrategistSummaryLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setStrategistSummaryErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/ai/strategist-summary", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id, goals: strategistSummaryGoalsByClient[client.id] ??"", }), });
const payload = (await safeParseJson<{ error?: string; summary?: StrategistSummaryResult; }>(response)) ?? { error:"Strategist summary returned unreadable response." };
if (!response.ok || !payload.summary) { throw new Error(payload.error ??"Failed to generate strategist summary"); } setStrategistSummaryByClient((prev) => ({ ...prev, [client.id]: payload.summary })); }
catch (error) {
  setStrategistSummaryErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Failed to generate strategist summary", })); }
finally { setStrategistSummaryLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleGenerateSocialIdeas(client: ClientRow) {
  setSocialIdeasLoadingByClient((prev) => ({ ...prev, [client.id]: true }));
setSocialIdeasErrorByClient((prev) => ({ ...prev, [client.id]: undefined }));
try { const response = await fetch("/api/social/ideas", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: client.id }), });
const payload = (await safeParseJson<{ error?: string; ideas?: SocialIdea[]; }>(response)) ?? { error:"Ideas endpoint returned an unreadable response." };
if (!response.ok) { throw new Error(payload.error ??"Failed to generate social ideas"); } setSocialIdeasByClient((prev) => ({ ...prev, [client.id]: payload.ideas ?? [], })); }
catch (error) {
  setSocialIdeasErrorByClient((prev) => ({ ...prev, [client.id]: error instanceof Error ? error.message :"Failed to generate social ideas", })); }
finally { setSocialIdeasLoadingByClient((prev) => ({ ...prev, [client.id]: false })); } }
async function handleRefreshSocialToken() {
  setSocialTokenRefreshing(true);
setSocialTokenMessage(null);
try { const response = await fetch("/api/social/token/refresh", { method:"POST" });
const payload = (await safeParseJson<{ error?: string; expiresAt?: string | null }>( response, )) ?? { error:"Token refresh endpoint returned an unreadable response." };
if (!response.ok) { throw new Error(payload.error ??"Failed to refresh Meta token"); } setSocialTokenMessage( payload.expiresAt ? `Meta token refreshed. Expires ${new Date(payload.expiresAt).toLocaleString()}.` :"Meta token refreshed.", ); }
catch (error) {
  setSocialTokenMessage( error instanceof Error ? error.message :"Failed to refresh Meta token", ); }
finally { setSocialTokenRefreshing(false); } }
function handleToggleHelpdeskSelection( client: ClientRow, item: LighthouseAuditItem, occurrence: LighthouseAuditOccurrence, ) {
  const key = buildOccurrenceKeyFallback(item.id, occurrence);
setSelectedHelpdeskItems((prev) => { const forClient = { ...(prev[client.id] ?? {}) };
if (forClient[key]) { delete forClient[key]; }
else { forClient[key] = { itemId: item.id, source:"lighthouse", title: item.title, description: item.description, suggestion: null, location: occurrence.selector ?? occurrence.location ?? null, evidence: occurrence.offending_value ?? occurrence.snippet ?? item.display_value ?? null, severity: item.severity, }; }
return { ...prev, [client.id]: forClient }; }); }
function handleToggleGenericHelpdeskSelection( client: ClientRow, selection: HelpdeskTicketSelection, occurrenceKey: string, ) {
  setSelectedHelpdeskItems((prev) => { const forClient = { ...(prev[client.id] ?? {}) };
if (forClient[occurrenceKey]) { delete forClient[occurrenceKey]; }
else { forClient[occurrenceKey] = selection; }
return { ...prev, [client.id]: forClient }; }); }
function buildHelpdeskTicketText(client: ClientRow, format: HelpdeskDraftFormat) {
  const selectedEntries = Object.values(selectedHelpdeskItems[client.id] ?? {}).sort( (left, right) => { if (left.severity !== right.severity) {
  return left.severity ==="critical" ? -1 : 1; }
return left.title.localeCompare(right.title); }, );
if (selectedEntries.length === 0) return"";
const hasCritical = selectedEntries.some((entry) => entry.severity ==="critical");
const auditActionById: Record<string, string> = { canonical:"Confirm each page has one preferred canonical URL and that it points to the correct live page.","structured-data":"Validate schema markup and fix any invalid or missing required properties.","uses-long-cache-ttl":"Increase cache TTL for static assets (images, CSS, JS) with versioned filenames and long-lived cache headers.","uses-optimized-images":"Compress and properly size images, and convert large assets to modern formats where possible.","modern-image-formats":"Serve next-gen image formats (WebP/AVIF) to reduce transfer size.","uses-responsive-images":"Provide responsive image variants (`srcset`/`sizes`) so smaller viewports download smaller files.","render-blocking-resources":"Defer or inline non-critical CSS/JS to reduce render-blocking on initial load.","forced-reflow":"Reduce layout thrashing by batching DOM reads/writes and limiting synchronous layout-triggering operations.","unused-javascript":"Remove or defer unused JavaScript and split bundles so only needed code loads initially.","unminified-javascript":"Minify JavaScript assets in production builds.","unminified-css":"Minify CSS assets in production builds.","uses-text-compression":"Enable Brotli/Gzip compression for text-based responses.","server-response-time":"Reduce backend TTFB with caching, faster queries, and reduced server processing time.","largest-contentful-paint":"Improve load speed of above-the-fold content (image optimization, caching, render-blocking resources).","total-blocking-time":"Reduce main-thread JavaScript work (defer non-critical scripts, split bundles, remove heavy third-party scripts).","image-alt":"Add meaningful alt text to informative images; leave decorative images empty (alt='').","http-status-code":"Fix non-200 responses for key pages and ensure redirects resolve correctly.","is-crawlable":"Ensure key pages are crawlable (robots rules, no unintended noindex, healthy response codes).", };
const severityLabel = (severity:"critical" |"watch") => severity ==="critical" ?"High priority" :"Monitor / medium priority";
const isNarrativeValue = (value: string | null | undefined) => { const text = norm(value);
return ( text.includes("Learn more") || text.length > 140 || text.includes("http://") || text.includes("https://") ); };
const describeWhere = (entry: HelpdeskTicketSelection) => norm(entry.location) ||"Not provided";
const describeObserved = (entry: HelpdeskTicketSelection) => { const candidate = norm(entry.evidence);
if (!candidate || isNarrativeValue(candidate)) return"See lighthouse notes below";
return candidate; };
const describeWhy = (entry: HelpdeskTicketSelection) => { const description = norm(entry.description);
if (description) return description;
return"This item is flagged and should be reviewed to improve SEO and page quality."; };
if (format ==="checklist") {
  const checklistLines = ["Help Desk Ticket Draft (Short Checklist)","", `Client: ${client.account_name}`, `Website: ${norm(client.website) ||"N/A"}`, `Generated: ${new Date().toLocaleString()}`,"", `Priority: ${hasCritical ?"High (contains critical items)" :"Medium"}`,"","Checklist", ...selectedEntries.map((entry, index) => { const where = describeWhere(entry);
const action = entry.suggestion ?? auditActionById[entry.itemId] ??"Investigate the finding and apply a best-practice fix for this page.";
return `${index + 1}. [ ] ${entry.title} (${severityLabel(entry.severity)})\n - Source: ${entry.source}\n - Where: ${where}\n - Action: ${action}\n - Reference ID: ${entry.itemId}`; }), ];
return checklistLines.join("\n"); }
const lines = ["Help Desk Ticket Draft","", `Client: ${client.account_name}`, `Website: ${norm(client.website) ||"N/A"}`, `Generated: ${new Date().toLocaleString()}`,"", `Priority: ${hasCritical ?"High (contains critical items)" :"Medium"}`, `Items selected: ${selectedEntries.length}`,"","Requested work","Please review and remediate the SEO findings below. Mark each item done with a brief note on what was changed.", ...selectedEntries.map((entry, index) => { const where = describeWhere(entry);
const observed = describeObserved(entry);
const why = describeWhy(entry);
const action = entry.suggestion ?? auditActionById[entry.itemId] ??"Investigate the finding and apply a best-practice fix for this page.";
return ["", `${index + 1}) ${entry.title}`, `- Source: ${entry.source}`, `- Priority: ${severityLabel(entry.severity)}`, `- Why this matters: ${why}`, `- Where to check: ${where}`, `- Observed: ${observed}`, `- Suggested action: ${action}`, `- Technical reference: id \`${entry.itemId}\``, ].join("\n"); }),"","Notes","- If a location is not provided, use the reference id plus the source section to investigate.","- Some monitor-level items are advisory checks and may not require code changes if already compliant.", ];
return lines.join("\n"); }
function handleCopyHelpdeskTicket(client: ClientRow) {
  const draft = buildHelpdeskTicketText(client, helpdeskDraftFormat);
if (!draft) return;
setHelpdeskDraftClientId(client.id);
setHelpdeskDraftText(draft);
setHelpdeskDraftCopied(null);
setHelpdeskDraftOpen(true); }
function handleSetHelpdeskDraftFormat(format: HelpdeskDraftFormat) {
  setHelpdeskDraftFormat(format);
setHelpdeskDraftCopied(null);
if (helpdeskDraftClientId == null) return;
const client = clients.find((row) => row.id === helpdeskDraftClientId);
if (!client) return;
setHelpdeskDraftText(buildHelpdeskTicketText(client, format)); }
async function handleCopyHelpdeskDraft() {
  try { await navigator.clipboard.writeText(helpdeskDraftText);
setHelpdeskDraftCopied("Copied to clipboard."); }
catch { setHelpdeskDraftCopied("Clipboard copy failed. Copy manually from the box."); } }
async function handleMarkNoFixNeeded( client: ClientRow, item: LighthouseAuditItem, occurrence: LighthouseAuditOccurrence, ) {
  const occurrenceKey = buildOccurrenceKeyFallback(item.id, occurrence);
setNoFixSavingKey(occurrenceKey);
try { const { error } = await supabase .from("client_lighthouse_occurrence_overrides") .insert({ client_id: client.id, audit_id: item.id, occurrence_key: occurrenceKey, decision:"no_fix_needed", });
if (error && !/duplicate key|unique/i.test(error.message)) { throw error; } setLighthouseNoFixNeeded((prev) => { const nextSet = new Set(prev[client.id] ?? []); nextSet.add(occurrenceKey);
return { ...prev, [client.id]: nextSet }; });
setSelectedHelpdeskItems((prev) => { const nextClient = { ...(prev[client.id] ?? {}) }; delete nextClient[occurrenceKey];
return { ...prev, [client.id]: nextClient }; }); }
finally { setNoFixSavingKey(null); } }
const strategistOptions = useMemo( () => uniqueSorted(clients.map((c) => c.marketing_strategist)), [clients], );
const tierOptions = useMemo(() => uniqueSorted(clients.map((c) => c.tier)), [clients]);
const technicalByClient = useMemo(() => { const map = new Map<number, TechnicalSummary>(); for (const client of clients) { map.set(client.id, buildTechnicalSummary(client)); }
return map; }, [clients]);
const selectedTechnicalSummary = selected && selected !=="new" ? technicalByClient.get(selected.id) : null;
const selectedLighthouse = selected && selected !=="new" ? lighthouseByClient[selected.id] ?? null : null;
const selectedLighthouseLoading = selected && selected !=="new" ? Boolean(lighthouseLoadingByClient[selected.id]) : false;
const selectedLighthouseError = selected && selected !=="new" ? lighthouseErrorByClient[selected.id] ?? null : null;
const selectedCrawlSnapshot = selected && selected !=="new" ? crawlSnapshotByClient[selected.id] ?? null : null;
const selectedCrawlIssues = selected && selected !=="new" ? crawlIssuesByClient[selected.id] ?? [] : [];
const selectedCrawlLoading = selected && selected !=="new" ? Boolean(crawlLoadingByClient[selected.id]) : false;
const selectedCrawlError = selected && selected !=="new" ? crawlErrorByClient[selected.id] ?? null : null;
const selectedGscSnapshot = selected && selected !=="new" ? gscSnapshotByClient[selected.id] ?? null : null;
const selectedGscSignals = useMemo( () => (selected && selected !=="new" ? gscSignalsByClient[selected.id] ?? [] : []), [selected, gscSignalsByClient], );
const selectedGscPageMetrics = useMemo( () => (selected && selected !=="new" ? gscPageMetricsByClient[selected.id] ?? [] : []), [selected, gscPageMetricsByClient], );
const selectedGscQueryMetrics = useMemo( () => (selected && selected !=="new" ? gscQueryMetricsByClient[selected.id] ?? [] : []), [selected, gscQueryMetricsByClient], );
const selectedGscLoading = selected && selected !=="new" ? Boolean(gscLoadingByClient[selected.id]) : false;
const selectedGscError = selected && selected !=="new" ? gscErrorByClient[selected.id] ?? null : null;
const selectedSitemapSnapshot = selected && selected !=="new" ? sitemapSnapshotByClient[selected.id] ?? null : null;
const selectedSitemapUrls = selected && selected !=="new" ? sitemapUrlsByClient[selected.id] ?? [] : [];
const selectedSitemapLoading = selected && selected !=="new" ? Boolean(sitemapLoadingByClient[selected.id]) : false;
const selectedSitemapError = selected && selected !=="new" ? sitemapErrorByClient[selected.id] ?? null : null;
const selectedSocialConnections = selected && selected !=="new" ? socialConnectionsByClient[selected.id] ?? [] : [];
const selectedSetupEvaluation = useMemo(() => { if (!selected || selected ==="new") return null;
return evaluateClientSetup(selected, { socialConnectionCount: selectedSocialConnections.length, }); }, [selected, selectedSocialConnections.length]);
const selectedSocialDaily = useMemo( () => (selected && selected !=="new" ? socialDailyByClient[selected.id] ?? [] : []), [selected, socialDailyByClient], );
const selectedSocialPosts = selected && selected !=="new" ? socialPostsByClient[selected.id] ?? [] : [];
const selectedSocialSignals = useMemo( () => (selected && selected !=="new" ? socialSignalsByClient[selected.id] ?? [] : []), [selected, socialSignalsByClient], );
const selectedSocialIdeas = selected && selected !=="new" ? socialIdeasByClient[selected.id] ?? [] : [];
const selectedSocialLoading = selected && selected !=="new" ? Boolean(socialLoadingByClient[selected.id]) : false;
const selectedSocialError = selected && selected !=="new" ? socialErrorByClient[selected.id] ?? null : null;
const selectedSocialIdeasLoading = selected && selected !=="new" ? Boolean(socialIdeasLoadingByClient[selected.id]) : false;
const selectedSocialIdeasError = selected && selected !=="new" ? socialIdeasErrorByClient[selected.id] ?? null : null;
const selectedAdsSnapshot = selected && selected !=="new" ? adsSnapshotByClient[selected.id] ?? null : null;
const selectedGa4Snapshot = selected && selected !=="new" ? ga4SnapshotByClient[selected.id] ?? null : null;
const selectedAdsSignals = useMemo( () => (selected && selected !=="new" ? adsSignalsByClient[selected.id] ?? [] : []), [selected, adsSignalsByClient], );
const selectedGbpSnapshot = useMemo( () => (selected && selected !=="new" ? gbpSnapshotByClient[selected.id] ?? null : null), [selected, gbpSnapshotByClient], );
const selectedGbpReviews = useMemo( () => (selected && selected !=="new" ? gbpReviewsByClient[selected.id] ?? [] : []), [selected, gbpReviewsByClient], );
const selectedAdsLoading = selected && selected !=="new" ? Boolean(adsLoadingByClient[selected.id]) : false;
const selectedAdsError = selected && selected !=="new" ? adsErrorByClient[selected.id] ?? null : null;
const selectedKeywordHealth = selected && selected !=="new" ? keywordHealthByClient[selected.id] ?? [] : [];
const selectedKeywordHealthLoading = selected && selected !=="new" ? Boolean(keywordHealthLoadingByClient[selected.id]) : false;
const selectedKeywordHealthError = selected && selected !=="new" ? keywordHealthErrorByClient[selected.id] ?? null : null;
const selectedKeywordDropTheoryMap = selected && selected !=="new" ? keywordDropTheoryByClient[selected.id] ?? {} : {};
const selectedKeywordDropTheoryLoadingMap = selected && selected !=="new" ? keywordDropTheoryLoadingByClient[selected.id] ?? {} : {};
const selectedStrategistSummary = selected && selected !=="new" ? strategistSummaryByClient[selected.id] ?? null : null;
const selectedStrategistSummaryGoals = selected && selected !=="new" ? strategistSummaryGoalsByClient[selected.id] ??"" :"";
const selectedStrategistSummaryLoading = selected && selected !=="new" ? Boolean(strategistSummaryLoadingByClient[selected.id]) : false;
const selectedStrategistSummaryError = selected && selected !=="new" ? strategistSummaryErrorByClient[selected.id] ?? null : null;
const selectedKeywordTargetsLoading = selected && selected !=="new" ? Boolean(keywordTargetsLoadingByClient[selected.id]) : false;
const selectedNoFixNeededSet = selected && selected !=="new" ? (lighthouseNoFixNeeded[selected.id] ?? new Set<string>()) : new Set<string>();
const selectedLighthouseAgeDays = selectedLighthouse ? Math.floor( (Date.now() - new Date(selectedLighthouse.fetched_at).getTime()) / (1000 * 60 * 60 * 24), ) : null;
const selectedLighthouseStale = selectedLighthouseAgeDays != null && selectedLighthouseAgeDays >= 30;
const selectedHelpdeskSelectionCount = selected && selected !=="new" ? Object.keys(selectedHelpdeskItems[selected.id] ?? {}).length : 0;
const selectedHelpdeskSelectionKeys = useMemo( () => new Set( selected && selected !=="new" ? Object.keys(selectedHelpdeskItems[selected.id] ?? {}) : [], ), [selected, selectedHelpdeskItems], );
const selectedTechnicalFindings = useMemo( () => selectedTechnicalSummary?.findings ?? [], [selectedTechnicalSummary], );
const selectedFindingsByTab = useMemo(() => { if (!selectedTechnicalSummary) return [];
if (detailTab ==="seo") {
  return selectedTechnicalSummary.findings.filter((finding) => finding.channel ==="seo"); }
if (detailTab ==="ads") {
  const base = selectedTechnicalSummary.findings.filter( (finding) => finding.channel ==="ads", );
const selectedClientId = selected && selected !=="new" ? String(selected.id) :"ads";
const adsFindings = selectedAdsSignals.map((signal, index) => ({ id: `${selectedClientId}-ads-signal-${index}`, channel:"ads" as const, title: signal.title, severity: signal.severity, status:"open" as const, confidence: signal.severity ==="critical" ? ("high" as const) : ("medium" as const), impact: signal.severity ==="critical" ? ("high" as const) : ("medium" as const), detectedAt: signal.created_at, dueLabel: signal.severity ==="critical" ?"Today" :"This week", }));
return [...adsFindings, ...base]; }
if (detailTab ==="sitemaps") {
  return selectedTechnicalSummary.findings.filter( (finding) => finding.channel ==="sitemaps", ); }
if (detailTab ==="social") {
  const base = selectedTechnicalSummary.findings.filter( (finding) => finding.channel ==="social", );
const selectedClientId = selected && selected !=="new" ? String(selected.id) :"social";
const socialFindings = selectedSocialSignals.map((signal, index) => ({ id: `${selectedClientId}-signal-${index}`, channel:"social" as const, title: signal.title, severity: signal.severity, status:"open" as const, confidence: signal.severity ==="critical" ? ("high" as const) : ("medium" as const), impact: signal.severity ==="critical" ? ("high" as const) : ("medium" as const), detectedAt: signal.created_at, dueLabel: signal.severity ==="critical" ?"Today" :"This week", }));
return [...socialFindings, ...base]; }
return selectedTechnicalSummary.findings; }, [detailTab, selected, selectedTechnicalSummary, selectedSocialSignals, selectedAdsSignals]);
const selectedChannelMetrics = useMemo(() => { if (!selected || selected ==="new") return [];
if (detailTab ==="seo") {
  const metrics = buildSeoMetricsWithLighthouse( selected, selectedTechnicalFindings, selectedLighthouse, ); metrics.push( { label:"Crawl issues", value: String(selectedCrawlIssues.length), source:"crawl", definition:"Issues found by the in-app website crawl (max 50 URLs).", updatedAt: selectedCrawlSnapshot?.updated_at ?? null, }, { label:"GSC signals", value: String(selectedGscSignals.length), source:"gsc", definition:"Signals derived from Search Console performance data.", updatedAt: selectedGscSnapshot?.updated_at ?? null, }, );
return metrics; }
if (detailTab ==="sitemaps") {
  return buildSitemapMetrics( selected, selectedTechnicalFindings, selectedSitemapSnapshot, ); }
if (detailTab ==="ads") {
  const totals = selectedAdsSnapshot?.totals;
const adsMetrics: ChannelMetric[] = [ { label:"Customer ID", value: norm(selected.ads_customer_id) ||"Missing", source:"internal", definition:"Google Ads customer ID used to fetch account metrics.", }, { label:"Impressions (30d)", value: totals ? String(Math.round(totals.impressions)) :"Not synced", source:"internal", definition:"Account impressions over the last 30 days.", updatedAt: selectedAdsSnapshot?.updated_at ?? null, }, { label:"Clicks (30d)", value: totals ? String(Math.round(totals.clicks)) :"Not synced", source:"internal", definition:"Account clicks over the last 30 days.", updatedAt: selectedAdsSnapshot?.updated_at ?? null, }, { label:"Conversions (30d)", value: totals ? String(Math.round(totals.conversions)) :"Not synced", source:"internal", definition:"Tracked conversions over the last 30 days.", updatedAt: selectedAdsSnapshot?.updated_at ?? null, }, { label:"Search IS (30d)", value: totals && typeof totals.search_impression_share ==="number" ? `${(totals.search_impression_share * 100).toFixed(2)}%` :"Not synced", source:"internal", definition:"Estimated Search Impression Share over the last 30 days.", updatedAt: selectedAdsSnapshot?.updated_at ?? null, }, { label:"Lost IS (Rank)", value: totals && typeof totals.search_rank_lost_impression_share ==="number" ? `${(totals.search_rank_lost_impression_share * 100).toFixed(2)}%` :"Not synced", source:"internal", definition:"Estimated impression share lost due to ad rank.", updatedAt: selectedAdsSnapshot?.updated_at ?? null, }, { label:"Lost IS (Budget)", value: totals && typeof totals.search_budget_lost_impression_share ==="number" ? `${(totals.search_budget_lost_impression_share * 100).toFixed(2)}%` :"Not synced", source:"internal", definition:"Estimated impression share lost due to budget limits.", updatedAt: selectedAdsSnapshot?.updated_at ?? null, }, ];
return adsMetrics; }
if (detailTab ==="social") {
  const latestDay = selectedSocialDaily[0];
const socialMetrics: ChannelMetric[] = [ { label:"Platforms connected", value: String(selectedSocialConnections.length), source:"internal", definition:"Number of active social platform connections for this client.", }, { label:"Posts tracked", value: String(selectedSocialPosts.length), source:"crawl", definition:"Recent Facebook/Instagram posts synced from Meta Graph API.", }, { label:"Reach (latest day)", value: latestDay?.reach == null ?"N/A" : String(latestDay.reach), source:"internal", definition:"Latest daily reach from social platform insights.", updatedAt: latestDay?.created_at ?? null, }, { label:"Impressions (latest day)", value: latestDay?.impressions == null ?"N/A" : String(latestDay.impressions), source:"internal", definition:"Latest daily impressions from social platform insights.", updatedAt: latestDay?.created_at ?? null, }, ];
return socialMetrics; }
return []; }, [ detailTab, selected, selectedTechnicalFindings, selectedLighthouse, selectedSitemapSnapshot, selectedAdsSnapshot, selectedSocialConnections.length, selectedSocialPosts.length, selectedSocialDaily, selectedCrawlIssues.length, selectedGscSignals.length, selectedCrawlSnapshot?.updated_at, selectedGscSnapshot?.updated_at, ]);
const selectedReportingKpis = useMemo<ReportingKpiCard[]>(() => { if (!selected || selected ==="new") return [];
return buildReportingKpis({ adsSnapshot: selectedAdsSnapshot, ga4Snapshot: selectedGa4Snapshot, gscPageMetrics: selectedGscPageMetrics, gscSignals: selectedGscSignals, gscSnapshotUpdatedAt: selectedGscSnapshot?.updated_at ?? null, socialDailyRows: selectedSocialDaily, socialPostCount: selectedSocialPosts.length, socialConnected: selectedSocialConnections.length > 0, crawlIssueCount: selectedCrawlIssues.length, technicalFindingCount: selectedTechnicalFindings.length, technicalCriticalCount: selectedTechnicalFindings.filter((f) => f.severity ==="critical").length, sitemapSnapshot: selectedSitemapSnapshot, gbpSnapshot: selectedGbpSnapshot, gbpReviews: selectedGbpReviews, lighthouseFetchedAt: selectedLighthouse?.fetched_at ?? null, crawlUpdatedAt: selectedCrawlSnapshot?.updated_at ?? null, }); }, [ selected, selectedAdsSnapshot, selectedGa4Snapshot, selectedGscPageMetrics, selectedGscSnapshot, selectedSocialDaily, selectedSocialPosts.length, selectedSocialConnections.length, selectedCrawlIssues.length, selectedTechnicalFindings, selectedGscSignals, selectedSitemapSnapshot, selectedGbpSnapshot, selectedGbpReviews, selectedLighthouse?.fetched_at, selectedCrawlSnapshot?.updated_at, ]);
const selectedMetricPreferences = useMemo<ClientReportingMetricPreference[]>( () => selected && selected !=="new" ? reportingMetricPrefsByClient[selected.id] ?? [] : [], [selected, reportingMetricPrefsByClient], );
const selectedMetricControls = useMemo<ReportingMetricControl[]>( () => buildReportingMetricControls( selectedMetricPreferences.map((row) => ({ metric_id: row.metric_id, is_enabled: row.is_enabled, display_order: row.display_order, })), ), [selectedMetricPreferences], );
const selectedMetricPrefsLoading = useMemo( () => selected && selected !=="new" ? Boolean(reportingMetricPrefsLoadingByClient[selected.id]) : false, [selected, reportingMetricPrefsLoadingByClient], );
const selectedReportingKpisFiltered = useMemo( () => applyReportingMetricPreferences( selectedReportingKpis, selectedMetricPreferences.map((row) => ({ metric_id: row.metric_id, is_enabled: row.is_enabled, display_order: row.display_order, })), ), [selectedReportingKpis, selectedMetricPreferences], );
const selectedReportingFreshness = useMemo<ReportingFreshnessItem[]>(() => { if (!selected || selected ==="new") return [];
return buildReportingFreshness({ adsUpdatedAt: selectedAdsSnapshot?.updated_at ?? null, gscUpdatedAt: selectedGscSnapshot?.updated_at ?? null, socialUpdatedAt: selectedSocialDaily[0]?.created_at ?? null, lighthouseOrCrawlUpdatedAt: selectedLighthouse?.fetched_at ?? selectedCrawlSnapshot?.updated_at ?? null, sitemapUpdatedAt: selectedSitemapSnapshot?.updated_at ?? null, gbpUpdatedAt: selectedGbpSnapshot?.updated_at ?? null, hasGa4Property: Boolean(norm(selected.ga4_property_id)), }); }, [ selected, selectedAdsSnapshot?.updated_at, selectedGscSnapshot?.updated_at, selectedSocialDaily, selectedLighthouse?.fetched_at, selectedCrawlSnapshot?.updated_at, selectedSitemapSnapshot?.updated_at, selectedGbpSnapshot?.updated_at, ]);
const selectedReportingAlerts = useMemo<ReportingAlertItem[]>(() => { if (!selected || selected ==="new") return [];
return buildReportingAlerts({ technicalFindings: selectedTechnicalFindings, gscSignals: selectedGscSignals, adsSignals: selectedAdsSignals, socialSignals: selectedSocialSignals, }); }, [selected, selectedTechnicalFindings, selectedGscSignals, selectedAdsSignals, selectedSocialSignals]);
const urgencyByClient = useMemo(() => { const map = new Map<number, number>();
const staleAgeDays = (value: string | null | undefined) => { if (!value) return null;
const diff = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24);
return Number.isFinite(diff) ? diff : null; }; for (const client of clients) {
  const technical = technicalByClient.get(client.id);
const gscSignals = gscSignalsByClient[client.id] ?? [];
const adsSignals = adsSignalsByClient[client.id] ?? [];
const adsSnapshot = adsSnapshotByClient[client.id];
const gscSnapshot = gscSnapshotByClient[client.id];
const lighthouseSnapshot = lighthouseByClient[client.id];
const crawlSnapshot = crawlSnapshotByClient[client.id];
const sitemapSnapshot = sitemapSnapshotByClient[client.id];
const socialLatest = (socialDailyByClient[client.id] ?? [])[0];
const gbpSnapshot = gbpSnapshotByClient[client.id];
const staleSourceCount = [ staleAgeDays(adsSnapshot?.updated_at), staleAgeDays(gscSnapshot?.updated_at), staleAgeDays(lighthouseSnapshot?.fetched_at ?? crawlSnapshot?.updated_at), staleAgeDays(sitemapSnapshot?.updated_at), staleAgeDays(socialLatest?.created_at), staleAgeDays(gbpSnapshot?.updated_at), ].filter((days) => days != null && days > 14).length;
const score = computeClientUrgencyScore({ needsReply: client.needs_reply, staleDays: client.days_stale, hasCriticalTechnical: Boolean(technical?.hasCritical), hasCriticalAds: adsSignals.some((signal) => signal.severity ==="critical"), hasCriticalGsc: gscSignals.some((signal) => signal.severity ==="critical"), missingScUrl: !norm(client.sc_url), missingAdsCustomerId: !norm(client.ads_customer_id), staleSourceCount, }); map.set(client.id, score); }
return map; }, [ clients, technicalByClient, gscSignalsByClient, adsSignalsByClient, adsSnapshotByClient, gscSnapshotByClient, lighthouseByClient, crawlSnapshotByClient, sitemapSnapshotByClient, socialDailyByClient, gbpSnapshotByClient, ]);
const selectedReportingActions = useMemo<ReportingActionItem[]>(() => { if (!selected || selected ==="new") return [];
return buildReportingActions({ client: selected, freshness: selectedReportingFreshness, alerts: selectedReportingAlerts, }).map((item) => { if ( item.id.startsWith("sync-") && item.detail.startsWith("Last updated") ) {
  const raw = item.detail.replace(/^Last updated /,"").replace(/\.$/,"");
return { ...item, detail: `Last updated ${formatDateTime(raw)}.`, }; }
return item; }); }, [selected, selectedReportingFreshness, selectedReportingAlerts]);
const selectedKeywordTargetsMemo = useMemo<ClientKeywordTarget[]>( () => selected && selected !=="new" ? keywordTargetsByClient[selected.id] ?? [] : [], [selected, keywordTargetsByClient], );
const selectedManagedKeywords = useMemo<ManagedKeyword[]>( () => selectedKeywordTargetsMemo.map((row) => ({ id: row.id, keyword: row.keyword, tag: row.tag, priority: row.priority, isActive: row.is_active, })), [selectedKeywordTargetsMemo], ); useEffect(() => { if (!selected || selected ==="new") return;
if (keywordTargetsByClient[selected.id] !== undefined) return; void loadKeywordTargets(selected.id); }, [selected, keywordTargetsByClient]);
const selectedUrgency = selected && selected !=="new" ? urgencyByClient.get(selected.id) ?? 0 : 0;
const selectedStaleSources = useMemo( () => selectedReportingFreshness.filter( (item) => item.source !=="ga4" && (item.status ==="stale" || item.status ==="missing"), ), [selectedReportingFreshness], );
const selectedDrawerTabAlerts = useMemo(() => { if (!selected || selected ==="new") return null;
const reportingCriticalCount = selectedReportingAlerts.filter( (alert) => alert.severity ==="critical", ).length;
const gscCriticalCount = selectedGscSignals.filter( (signal) => signal.severity ==="critical", ).length;
const adsSignalCriticalCount = selectedAdsSignals.filter( (signal) => signal.severity ==="critical", ).length;
const socialSignalCriticalCount = selectedSocialSignals.filter( (signal) => signal.severity ==="critical", ).length;
const totalCriticalCount = selectedTechnicalFindings.filter((finding) => finding.severity ==="critical").length + gscCriticalCount + adsSignalCriticalCount + socialSignalCriticalCount;
return computeDrawerTabAlerts({ needsReply: Boolean(selected.needs_reply), reportingAlertCount: reportingCriticalCount, staleSourceCount: selectedStaleSources.length, seoCriticalCount: gscCriticalCount + countCriticalFindings(selectedTechnicalFindings,"seo"), adsCriticalCount: adsSignalCriticalCount + countCriticalFindings(selectedTechnicalFindings,"ads"), sitemapCriticalCount: countCriticalFindings(selectedTechnicalFindings,"sitemaps"), socialCriticalCount: socialSignalCriticalCount + countCriticalFindings(selectedTechnicalFindings,"social"), totalCriticalCount, }); }, [ selected, selectedReportingAlerts, selectedStaleSources.length, selectedGscSignals, selectedAdsSignals, selectedSocialSignals, selectedTechnicalFindings, ]);
const selectedUrgentQuickAction = selectedReportingActions[0] ?? null;
const selectedTechnicalActivity = useMemo( () => [...selectedTechnicalFindings] .filter( (finding) => finding.channel ==="seo" || finding.channel ==="sitemaps", ) .sort( (left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime(), ), [selectedTechnicalFindings], );
const filtered = useMemo(() => { const base = clients.filter((c) => { const technical = technicalByClient.get(c.id);
if ( search && !norm(c.account_name).toLowerCase().includes(search.toLowerCase()) ) {
  return false; }
if (!clientMatchesStatusFilter(c, statusFilter)) {
  return false; }
if ( serviceFilters.length > 0 && !serviceFilters.some((service) => clientMatchesServiceFilter(c, service)) ) {
  return false; }
if (strategistFilter && norm(c.marketing_strategist) !== strategistFilter) {
  return false; }
if (tierFilter && norm(c.tier) !== tierFilter) {
  return false; }
if (showMineOnly && !isLikelyOwnedByCurrentUser(c.marketing_strategist, userEmail)) {
  return false; }
if (showStaleOnly && (c.days_stale ?? 0) < 15) {
  return false; }
if (technicalFilter ==="critical" && !technical?.hasCritical) {
  return false; }
if (technicalFilter ==="ads_issues" && (adsSignalsByClient[c.id]?.length ?? 0) === 0) {
  return false; }
if ( technicalFilter && technicalFilter !=="critical" && technicalFilter !=="ads_issues" && !technical?.findings.some((finding) => finding.channel === technicalFilter) ) {
  return false; }
return true; });
if (!prioritizeUrgent) return base;
return [...base].sort((left, right) => { const leftUrgency = urgencyByClient.get(left.id) ?? 0;
const rightUrgency = urgencyByClient.get(right.id) ?? 0;
if (leftUrgency !== rightUrgency) return rightUrgency - leftUrgency;
return left.account_name.localeCompare(right.account_name); }); }, [ clients, search, statusFilter, serviceFilters, strategistFilter, tierFilter, showMineOnly, showStaleOnly, technicalFilter, technicalByClient, adsSignalsByClient, prioritizeUrgent, urgencyByClient, userEmail, ]);
const likelyOwnedCount = useMemo( () => clients.filter((client) => isLikelyOwnedByCurrentUser(client.marketing_strategist, userEmail)).length, [clients, userEmail], );
const shareViewSummaryText = useMemo(() => { const toSnippet = (value: string, max = 72) => { const cleaned = value.replace(/\s+/g,"").trim();
if (!cleaned) return"—";
return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned; };
const padCell = (value: string, width: number) => { const normalized = toSnippet(value, width);
return normalized.length >= width ? normalized : normalized.padEnd(width,""); };
const activeFilters: string[] = [];
if (search.trim()) activeFilters.push(`Search="${search.trim()}"`);
if (statusFilter) activeFilters.push(`Status=${statusFilter}`);
if (serviceFilters.length) activeFilters.push(`Services=${serviceFilters.join(",")}`);
if (strategistFilter) activeFilters.push(`Strategist=${strategistFilter}`);
if (tierFilter) activeFilters.push(`Tier=${tierFilter}`);
if (showMineOnly) activeFilters.push("My accounts");
if (showStaleOnly) activeFilters.push("15+ days quiet");
if (technicalFilter) activeFilters.push(`Technical=${technicalFilter}`);
if (prioritizeUrgent) activeFilters.push("Prioritize urgent");
const viewName = statusFilter ==="Awaiting" ?"Awaiting Reply" : showStaleOnly ?"No Message in 15+ Days" : activeFilters.length > 0 ?"Filtered View" :"All Accounts";
const rows = filtered.slice(0, 15).map((client) => { const awaiting = resolveClientStatus(client);
const lastComms = client.last_communication_at == null ?"Never" : `${formatDateOnly(client.last_communication_at)} (${client.days_stale ??"?"}d ago)`;
const projectId = norm(client.basecamp_project_id);
const latestThread = projectId ? (threadsByProject.get(projectId) ?? [])[0] : undefined;
const messageSnippet = latestThread ? previewText(latestThread) :"No synced message yet";
return { row: [ padCell(client.account_name, 34), padCell(norm(client.marketing_strategist) ||"—", 14), padCell(awaiting, 12), padCell(lastComms, 20), ].join(" |"), snippet: ` ↳ Last msg: ${toSnippet(messageSnippet, 110)}`, }; });
const overflowCount = Math.max(0, filtered.length - 15);
return [ `BIP Client Manager — ${viewName}`, `Generated: ${new Date().toLocaleString()}`, `Showing ${filtered.length} of ${clients.length} clients`, `Active filters: ${activeFilters.length > 0 ? activeFilters.join(",") :"None"}`,"","```", [ padCell("Client", 34), padCell("Strategist", 14), padCell("Awaiting", 12), padCell("Last comms", 20), ].join(" |"), `${"-".repeat(34)}-+-${"-".repeat(14)}-+-${"-".repeat(12)}-+-${"-".repeat(20)}`, ...rows.flatMap((entry) => [entry.row, entry.snippet,""]),"```", ...(overflowCount > 0 ? ["", `+${overflowCount} more clients in this filtered view.`] : []), ].join("\n"); }, [ search, statusFilter, serviceFilters, strategistFilter, tierFilter, showMineOnly, showStaleOnly, technicalFilter, prioritizeUrgent, filtered, clients.length, threadsByProject, ]);
const handleShareViewSummary = useCallback(async () => { if (filtered.length === 0) return;
try { await navigator.clipboard.writeText(shareViewSummaryText);
setShareCopyStatus({ tone:"success", message: `Copied view summary at ${new Date().toLocaleTimeString()}.`, }); }
catch { setShareCopyStatus({ tone:"error", message:"Could not copy summary. Please check clipboard permissions.", }); } }, [filtered.length, shareViewSummaryText]);
function openNew() {
  setSaveError(null);
setAckError(null);
setDetailTab("connections");
setSelected("new");
setEditMode(true);
setForm({ account_name:"", marketing_strategist:"", total_package_hours: null, hours_for_strategist: null, blog:"", smm:"", seo:"", ppc:"", orm:"", ads_customer_id:"", ga4_id:"", sc_url:"", website:"", ga4_property_id:"", google_place_id:"", basecamp_project_id:"", harvest_project_id:"", harvest_client_id:"", tier:"", needs_reply: false, reply_acknowledged_at: null, reply_acknowledged_for_occurred_at: null, days_stale: null, last_communication_at: null, last_event_is_internal: null, }); }
function openRow(c: ClientRow) {
  setSaveError(null);
setAckError(null); router.push(`/dashboard/clients/${c.id}`); }
function closePanel() { router.push("/dashboard/clients"); }
async function handleAcknowledgeNoReply() {
  if (!selected || selected ==="new") return;
setAckError(null);
setAcknowledging(true);
try { const response = await fetch("/api/basecamp/acknowledge", { method:"POST", headers: {"Content-Type":"application/json", }, body: JSON.stringify({ clientId: selected.id }), });
const payload = (await response.json()) as { error?: string; client?: ClientRow; };
if (!response.ok || !payload.client) { throw new Error(payload.error ??"Failed to acknowledge client"); }
const updatedClient = payload.client;
setClients((prev) => prev.map((client) => client.id === updatedClient.id ? updatedClient : client, ), );
setSelected(updatedClient);
setForm(updatedClient); }
catch (error) {
  setAckError( error instanceof Error ? error.message :"Failed to acknowledge client", ); }
finally { setAcknowledging(false); } }
async function handleAddThreadTask(event: BasecampThreadEvent) {
  if (!selected || selected ==="new") return;
const taskKey = toThreadTaskKey(event);
setTaskCreateMessageByThread((prev) => ({ ...prev, [taskKey]: undefined }));
setTaskCreateLoadingByThread((prev) => ({ ...prev, [taskKey]: true }));
try { const response = await fetch("/api/tasks/from-basecamp", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ clientId: selected.id, basecampProjectId: event.basecamp_project_id, basecampRecordingId: event.parent_recording_id ?? event.basecamp_recording_id, }), });
const payload = (await safeParseJson<{ error?: string; created?: boolean }>( response, )) ?? { error:"Unexpected response from server" };
if (!response.ok) { throw new Error(payload.error ??"Failed to add task"); } setTaskCreateMessageByThread((prev) => ({ ...prev, [taskKey]: payload.created ?"Added to My Tasks." :"Already in My Tasks.", })); }
catch (error) {
  setTaskCreateMessageByThread((prev) => ({ ...prev, [taskKey]: error instanceof Error ? error.message :"Failed to add thread task.", })); }
finally { setTaskCreateLoadingByThread((prev) => ({ ...prev, [taskKey]: false })); } }
function patchField(key: keyof ClientRow, value: string) {
  setForm((prev) => { if (!prev) return prev;
const next = { ...prev };
if (key ==="total_package_hours" || key ==="hours_for_strategist") {
  const n = value ==="" ? null : Number(value); next[key] = (Number.isFinite(n) ? n : null) as never; }
else if (key ==="created_at" || key ==="id") {
  return next; }
else { (next as Record<string, unknown>)[key] = value ==="" ? null : value; }
return next; }); }
async function saveClient() {
  if (!form || selected === null) return;
const payload = { account_name: norm(form.account_name), marketing_strategist: norm(form.marketing_strategist) || null, total_package_hours: form.total_package_hours ?? null, hours_for_strategist: form.hours_for_strategist ?? null, blog: norm(form.blog) || null, smm: norm(form.smm) || null, seo: norm(form.seo) || null, ppc: norm(form.ppc) || null, orm: norm(form.orm) || null, ads_customer_id: norm(form.ads_customer_id) || null, ga4_id: norm(form.ga4_id) || null, sc_url: norm(form.sc_url) || null, website: norm(form.website) || null, ga4_property_id: norm(form.ga4_property_id) || null, google_place_id: norm(form.google_place_id) || null, basecamp_project_id: norm(form.basecamp_project_id) || null, harvest_project_id: norm(form.harvest_project_id) || null, harvest_client_id: norm(form.harvest_client_id) || null, tier: norm(form.tier) || null, };
if (!payload.account_name) { return; } setSaveError(null);
setSaving(true);
try { if (selected ==="new") {
  const { data, error } = await supabase .from("clients") .insert(payload) .select() .single();
if (error) throw error;
if (data) {
  const created = data as ClientRow;
let onboarded = created;
try { const startResponse = await fetch(`/api/clients/${created.id}/onboarding/start`, { method:"POST", });
const startPayload = (await startResponse.json()) as { error?: string; evaluation?: { onboardingStartedAt?: string | null }; };
if (startResponse.ok) {
  onboarded = {
    ...created,
    onboarding_status: "active",
    onboarding_started_at:
      startPayload.evaluation?.onboardingStartedAt ??
      new Date().toISOString(),
  };
}
} catch {
  // Client was created; onboarding can be started manually.
}
setClients((prev) =>
  [...prev, onboarded].sort((a, b) =>
    a.account_name.localeCompare(b.account_name),
  ),
);
router.push(`/dashboard/clients/${onboarded.id}?tab=onboarding`);
}
}
else {
  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", selected.id)
    .select()
    .single();
  if (error) throw error;
  if (data) {
    setClients((prev) =>
      prev.map((c) => (c.id === selected.id ? (data as ClientRow) : c)),
    );
  }
  setSelected(data as ClientRow);
  setForm(data as ClientRow);
  setEditMode(false);
}
}
catch (e: unknown) {
  const msg = e && typeof e ==="object" &&"message" in e ? String((e as { message: unknown }).message) :"Save failed";
setSaveError(msg); }
finally { setSaving(false); } }
async function handleDeleteClient() {
  if (!selected || selected ==="new") return;
const accountName = selected.account_name;
const confirmed = window.confirm( `Permanently delete"${accountName}"? This removes snapshots, Basecamp events, keyword targets, and other related data. This cannot be undone.`, );
if (!confirmed) return;
setDeleteError(null);
setDeleting(true);
try { const response = await fetch(`/api/clients/${selected.id}`, { method:"DELETE" });
const payload = (await response.json()) as { error?: string };
if (!response.ok) { throw new Error(payload.error ??"Delete failed."); } setClients((prev) => prev.filter((client) => client.id !== selected.id)); closePanel(); }
catch (error) {
  setDeleteError(error instanceof Error ? error.message :"Delete failed."); }
finally { setDeleting(false); } }
const detailTitle = selected ==="new" ?"New client" : selected ? selected.account_name :"";
return ( <div className="flex min-h-0 flex-1 flex-col bg-bip-page"> <header className="flex shrink-0 items-center justify-between border-b border-bip-border bg-bip-card px-6 py-4"> <div className="flex items-center gap-3"> <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg border border-bip-border bg-bip-card text-bip-text transition hover:bg-bip-page" title="Control panel" > <LayoutGrid className="h-4 w-4" aria-hidden /> </Link> <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bip-accent text-bip-page"> <Building2 className="h-5 w-5" aria-hidden /> </div> <div> <h1 className="text-lg font-semibold tracking-tight text-bip-text"> {detailTitle ||"Client workspace"} </h1> <p className="text-xs text-bip-muted"> Client workspace · {userEmail ??"Signed in"} </p> </div> </div> <div className="flex items-center gap-2"> <ModuleHeaderLinks /> <AppHeaderActions /> </div> </header> <div className="flex min-h-0 flex-1 flex-col gap-0"> {workspaceClient && form && ( <> <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-6"> <aside className="flex min-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-xl border border-bip-border bg-bip-card shadow-none"> <div className="flex items-start justify-between gap-3 border-b border-bip-border px-5 py-4"> <div className="min-w-0"> <Link href="/dashboard/clients" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-bip-muted hover:text-bip-text" > <ArrowLeft className="h-3.5 w-3.5" /> Back to clients </Link> <h2 className="truncate text-base font-semibold text-bip-text"> {detailTitle} </h2> {selected && selected !=="new" && ( <p className="mt-0.5 text-xs text-bip-muted"> ID #{selected.id} </p> )} </div> <div className="flex shrink-0 items-center gap-2"> {selected && selected !=="new" && !editMode && ( <button type="button" onClick={() => setEditMode(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-2.5 py-1.5 text-xs font-medium text-bip-text hover:bg-bip-page" > <Pencil className="h-3.5 w-3.5" /> Edit </button> )} <button type="button" onClick={closePanel} className="rounded-lg p-2 text-bip-muted hover:bg-bip-fill hover:text-bip-text" > <X className="h-5 w-5" /> </button> </div> </div> {selected && selected !=="new" && !editMode && ( <div className="border-b border-bip-border px-3 py-2"> <div className="flex flex-wrap gap-1"> <DetailTabButton tabId="profile" label="Profile" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} /> <DetailTabButton tabId="onboarding" label="Onboarding" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} /> <DetailTabButton tabId="connections" label="Connections" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} /> <DetailTabButton tabId="comms" label="Comms" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.comms.hasAlert} notificationCount={selectedDrawerTabAlerts?.comms.notificationCount} /> <DetailTabButton tabId="reporting" label="Reporting" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.reporting.hasAlert} notificationCount={selectedDrawerTabAlerts?.reporting.notificationCount} /> {getClientActiveServices(selected).seo ? <DetailTabButton tabId="seo_ops" label="SEO Ops" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} /> : null} <DetailTabButton tabId="seo" label="SEO" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.seo.hasAlert} notificationCount={selectedDrawerTabAlerts?.seo.notificationCount} /> <DetailTabButton tabId="ads" label="Ads" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.ads.hasAlert} notificationCount={selectedDrawerTabAlerts?.ads.notificationCount} /> <DetailTabButton tabId="sitemaps" label="Sitemaps" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.sitemaps.hasAlert} notificationCount={selectedDrawerTabAlerts?.sitemaps.notificationCount} /> <DetailTabButton tabId="social" label="Social" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.social.hasAlert} notificationCount={selectedDrawerTabAlerts?.social.notificationCount} /> <DetailTabButton tabId="actions" label="Actions" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} hasAlert={selectedDrawerTabAlerts?.actions.hasAlert} notificationCount={selectedDrawerTabAlerts?.actions.notificationCount} /> <DetailTabButton tabId="playbook" label="Playbook" activeTab={detailTab} onClick={(tab) => setDetailTab(tab as DetailTab)} /> </div> </div> )} {selected && selected !=="new" && !editMode && selectedSetupEvaluation && ( <div className={`border-b px-5 py-3 ${ selectedSetupEvaluation.isComplete ?"border-emerald-200 bg-emerald-50" :"border-amber-200 bg-amber-50" }`} > <div className="flex flex-wrap items-start justify-between gap-2"> <div> <p className="text-xs font-semibold uppercase tracking-wide text-bip-text"> Setup status </p> {selectedSetupEvaluation.isComplete ? ( <p className="mt-1 text-sm text-emerald-800"> All required connections configured. </p> ) : ( <ul className="mt-1 space-y-0.5"> {selectedSetupEvaluation.missingRequired.map((item) => ( <li key={item.id} className="text-sm text-red-800"> {item.label}: {item.reason} </li> ))} </ul> )} {selectedSetupEvaluation.missingRecommended.length > 0 && ( <ul className="mt-2 space-y-0.5"> {selectedSetupEvaluation.missingRecommended.map((item) => ( <li key={item.id} className="text-xs text-amber-800" > Recommended — {item.label} </li> ))} </ul> )} </div> <div className="flex flex-wrap gap-1"> {activeServiceLabels(selectedSetupEvaluation.services).map((label) => ( <span key={label} className="rounded-full bg-bip-card/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-bip-text" > {label} </span> ))} </div> </div> </div> )} {selected && selected !=="new" && !editMode && selectedUrgentQuickAction && selected && ( <DrawerQuickActions action={selectedUrgentQuickAction} {...resolveQuickAction(selectedUrgentQuickAction, { onAcknowledgeReply: () => void handleAcknowledgeNoReply(), onOpenTab: setDetailTab, onEditClient: () => setEditMode(true), onSyncAds: () => void handleSyncAds(selected), onSyncSearchConsole: () => void handleSyncSearchConsole(selected), onSyncSitemaps: () => void handleSyncSitemaps(selected), onSyncSocial: () => void handleSyncSocial(selected), onSyncGbp: () => void handleSyncGbp(selected), onRefreshLighthouse: () => void handleRefreshLighthouse(selected), onRunSeoCrawl: () => void handleRunSeoCrawl(selected), onRunAllReportingSync: () => void handleRunAllReportingSync(selected), })} resolving={ acknowledging && selectedUrgentQuickAction.id ==="reply-client" } /> )} <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"> {selected && selected !=="new" && selectedProjectDuplicateCount > 1 && ( <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"> This Basecamp project ID is shared by {selectedProjectDuplicateCount} clients. Thread ownership may be ambiguous until IDs are de-duplicated. </p> )} {ackError && selectedUrgentQuickAction?.id ==="reply-client" && ( <p className="mb-4 text-xs text-red-600">{ackError}</p> )} {editMode ? ( <div className="flex flex-col gap-4"> <Field label="Account name" required value={String(form.account_name ??"")} onChange={(v) => patchField("account_name", v)} /> <Field label="Marketing strategist" value={String(form.marketing_strategist ??"")} onChange={(v) => patchField("marketing_strategist", v)} /> <div className="grid grid-cols-2 gap-3"> <Field label="Total package hours" type="number" value={ form.total_package_hours == null ?"" : String(form.total_package_hours) } onChange={(v) => patchField("total_package_hours", v)} /> <Field label="Hours for strategist" type="number" value={ form.hours_for_strategist == null ?"" : String(form.hours_for_strategist) } onChange={(v) => patchField("hours_for_strategist", v) } /> </div> <div className="grid grid-cols-2 gap-3"> <Field label="Blog" value={String(form.blog ??"")} onChange={(v) => patchField("blog", v)} /> <Field label="SMM" value={String(form.smm ??"")} onChange={(v) => patchField("smm", v)} /> <Field label="SEO" value={String(form.seo ??"")} onChange={(v) => patchField("seo", v)} /> <Field label="PPC" value={String(form.ppc ??"")} onChange={(v) => patchField("ppc", v)} /> <Field label="ORM" value={String(form.orm ??"")} onChange={(v) => patchField("orm", v)} /> </div> <Field label="Tier" value={String(form.tier ??"")} onChange={(v) => patchField("tier", v)} /> <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-bip-muted"> Technical </h3> <Field label="Ads customer ID" value={String(form.ads_customer_id ??"")} onChange={(v) => patchField("ads_customer_id", v)} /> <Field label="GA4 ID" value={String(form.ga4_id ??"")} onChange={(v) => patchField("ga4_id", v)} /> <Field label="GA4 property ID" value={String(form.ga4_property_id ??"")} onChange={(v) => patchField("ga4_property_id", v)} /> <Field label="Search Console URL" value={String(form.sc_url ??"")} onChange={(v) => patchField("sc_url", v)} /> <Field label="Website" value={String(form.website ??"")} onChange={(v) => patchField("website", v)} /> <Field label="Google Place ID (GBP)" value={String(form.google_place_id ??"")} onChange={(v) => patchField("google_place_id", v)} /> <Field label="Basecamp project ID" value={String(form.basecamp_project_id ??"")} onChange={(v) => patchField("basecamp_project_id", v)} /> <Field label="Harvest project ID" value={String(form.harvest_project_id ??"")} onChange={(v) => patchField("harvest_project_id", v)} /> <Field label="Harvest client ID" value={String(form.harvest_client_id ??"")} onChange={(v) => patchField("harvest_client_id", v)} /> {selected && selected !=="new" && ( <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4"> <h3 className="text-xs font-semibold uppercase tracking-wide text-red-800"> Danger zone </h3> <p className="mt-1 text-xs text-red-700"> Permanently delete this client and all related snapshots, events, and keyword data. Tasks linked to this client will keep their client reference cleared. </p> {deleteError && ( <p className="mt-2 text-xs text-red-700"> {deleteError} </p> )} <button type="button" onClick={() => void handleDeleteClient()} disabled={deleting} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-bip-card px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60" > {deleting ? ( <Loader2 className="h-3.5 w-3.5 animate-spin" /> ) : ( <Trash2 className="h-3.5 w-3.5" /> )} Delete client permanently </button> </div> )} </div> ) : detailTab ==="profile" ? ( <ClientProfileView form={form} recentThreads={selectedThreads} /> ) : detailTab ==="onboarding" && selected && selected !=="new" ? ( <ClientOnboardingView clientId={selected.id} recentThreads={selectedThreads} onOpenTab={(tab) => { if (tab ==="edit") {
  setEditMode(true);
return; } setDetailTab(tab); }} onEditClient={() => setEditMode(true)} onGraduated={() => { setClients((prev) => prev.map((client) => client.id === selected.id ? { ...client, onboarding_status:"complete", onboarding_completed_at: new Date().toISOString(), } : client, ), );
setSelected((prev) => prev && prev !=="new" && prev.id === selected.id ? { ...prev, onboarding_status:"complete", onboarding_completed_at: new Date().toISOString(), } : prev, ); }} /> ) : detailTab ==="connections" ? ( <ConnectionsReadOnly form={form} /> ) : detailTab ==="comms" ? ( <CommsOverview form={form} /> ) : detailTab ==="reporting" ? ( <ReportingTab selectedClient={selected && selected !=="new" ? selected : null} allKpis={selectedReportingKpis} kpis={selectedReportingKpisFiltered} alerts={selectedReportingAlerts} freshness={selectedReportingFreshness} actions={selectedReportingActions} urgencyScore={selectedUrgency} staleSources={selectedStaleSources} keywordHealthRows={selectedKeywordHealth} selectedSocialDailyRows={selectedSocialDaily} selectedAdsSnapshot={selectedAdsSnapshot} selectedGa4Snapshot={selectedGa4Snapshot} selectedAdsSignals={selectedAdsSignals} keywordHealthLoading={selectedKeywordHealthLoading} keywordHealthError={selectedKeywordHealthError} keywordDropTheoryByRow={selectedKeywordDropTheoryMap} keywordDropTheoryLoadingByRow={selectedKeywordDropTheoryLoadingMap} strategistSummary={selectedStrategistSummary} strategistSummaryGoals={selectedStrategistSummaryGoals} strategistSummaryLoading={selectedStrategistSummaryLoading} strategistSummaryError={selectedStrategistSummaryError} runningSync={reportingSyncRunning} syncMessage={reportingSyncMessage} gbpSnapshot={selectedGbpSnapshot} gbpLoading={selected && selected !=="new" ? Boolean(gbpLoadingByClient[selected.id]) : false} gbpError={selected && selected !=="new" ? gbpErrorByClient[selected.id] ?? null : null} gbpSyncDiagnostics={ selected && selected !=="new" ? gbpSyncDiagnosticsByClient[selected.id] ?? null : null } onSyncGbp={ selected && selected !=="new" ? () => void handleSyncGbp(selected) : undefined } onLoadKeywordHealth={ selected && selected !=="new" ? () => void handleLoadKeywordHealth(selected) : undefined } onExplainKeywordDrop={ selected && selected !=="new" ? (row: KeywordHealthRow) => void handleExplainKeywordDrop(selected, row) : undefined } onGenerateStrategistSummary={ selected && selected !=="new" ? () => void handleGenerateStrategistSummary(selected) : undefined } onChangeStrategistGoals={ selected && selected !=="new" ? (nextGoals: string) => setStrategistSummaryGoalsByClient((prev) => ({ ...prev, [selected.id]: nextGoals, })) : undefined } onRunAllSync={ selected && selected !=="new" ? () => void handleRunAllReportingSync(selected) : undefined } onGenerateReport={ selected && selected !=="new" ? () => window.open( `/reports/${selected.id}?range=last30`,"_blank","noopener,noreferrer", ) : undefined } keywordTargets={selectedKeywordTargetsMemo} keywordTargetsLoading={selectedKeywordTargetsLoading} keywordDraftInput={keywordDraftInput} onKeywordDraftInputChange={setKeywordDraftInput} onAddKeyword={ selected && selected !=="new" ? (keyword: string) => void addKeywordTarget(selected.id, keyword) : undefined } onRemoveKeyword={ selected && selected !=="new" ? (id: number) => void removeKeywordTarget(selected.id, id) : undefined } managedKeywords={selectedManagedKeywords} metricControls={selectedMetricControls} metricPrefsLoading={selectedMetricPrefsLoading} onSaveMetricLayout={ selected && selected !=="new" ? (rows: Array<{ metricId: ReportingMetricId; isEnabled: boolean; displayOrder: number }>) => { void saveReportingMetricPrefs(selected.id, rows); } : undefined } onResetMetricPrefs={ selected && selected !=="new" ? () => void resetReportingMetricPrefs(selected.id) : undefined } /> ) : detailTab ==="seo_ops" && selected && selected !=="new" ? ( <SeoOpsView client={selected} gscQueryMetrics={selectedGscQueryMetrics} gscSnapshotUpdatedAt={selectedGscSnapshot?.updated_at ?? null} keywordTargets={selectedKeywordTargetsMemo} onOpenTab={(tab) => setDetailTab(tab)} onLoadKeywordHealth={() => handleLoadKeywordHealth(selected)} keywordHealthRows={selectedKeywordHealth} keywordHealthLoading={selectedKeywordHealthLoading} /> ) : detailTab ==="actions" ? ( <ActionsOverview findings={selectedTechnicalFindings} /> ) : detailTab ==="seo" || detailTab ==="ads" || detailTab ==="sitemaps" || detailTab ==="social" ? ( <ChannelTab channel={detailTab} findings={selectedFindingsByTab} metrics={selectedChannelMetrics} lighthouse={detailTab ==="seo" ? selectedLighthouse : null} lighthouseLoading={detailTab ==="seo" ? selectedLighthouseLoading : false} lighthouseError={detailTab ==="seo" ? selectedLighthouseError : null} lighthouseStale={detailTab ==="seo" ? selectedLighthouseStale : false} lighthouseAgeDays={detailTab ==="seo" ? selectedLighthouseAgeDays : null} crawlSnapshot={detailTab ==="seo" ? selectedCrawlSnapshot : null} crawlIssues={detailTab ==="seo" ? selectedCrawlIssues : []} crawlLoading={detailTab ==="seo" ? selectedCrawlLoading : false} crawlError={detailTab ==="seo" ? selectedCrawlError : null} gscSnapshot={detailTab ==="seo" ? selectedGscSnapshot : null} gscSignals={detailTab ==="seo" ? selectedGscSignals : []} gscPageMetrics={detailTab ==="seo" ? selectedGscPageMetrics : []} gscQueryMetrics={detailTab ==="seo" ? selectedGscQueryMetrics : []} gscLoading={detailTab ==="seo" ? selectedGscLoading : false} gscError={detailTab ==="seo" ? selectedGscError : null} sitemapSnapshot={detailTab ==="sitemaps" ? selectedSitemapSnapshot : null} sitemapUrls={detailTab ==="sitemaps" ? selectedSitemapUrls : []} sitemapLoading={detailTab ==="sitemaps" ? selectedSitemapLoading : false} sitemapError={detailTab ==="sitemaps" ? selectedSitemapError : null} adsSnapshot={detailTab ==="ads" ? selectedAdsSnapshot : null} adsSignals={detailTab ==="ads" ? selectedAdsSignals : []} adsLoading={detailTab ==="ads" ? selectedAdsLoading : false} adsError={detailTab ==="ads" ? selectedAdsError : null} socialConnections={detailTab ==="social" ? selectedSocialConnections : []} socialDaily={detailTab ==="social" ? selectedSocialDaily : []} socialPosts={detailTab ==="social" ? selectedSocialPosts : []} socialSignals={detailTab ==="social" ? selectedSocialSignals : []} socialIdeas={detailTab ==="social" ? selectedSocialIdeas : []} socialLoading={detailTab ==="social" ? selectedSocialLoading : false} socialError={detailTab ==="social" ? selectedSocialError : null} socialIdeasLoading={ detailTab ==="social" ? selectedSocialIdeasLoading : false } socialIdeasError={detailTab ==="social" ? selectedSocialIdeasError : null} noFixNeededSet={detailTab ==="seo" ? selectedNoFixNeededSet : new Set()} selectedCount={detailTab ==="seo" ? selectedHelpdeskSelectionCount : 0} selectedClient={ (detailTab ==="seo" || detailTab ==="ads") && selected && selected !=="new" ? selected : null } noFixSavingKey={detailTab ==="seo" ? noFixSavingKey : null} selectedSelectionKeys={ detailTab ==="seo" ? selectedHelpdeskSelectionKeys : new Set<string>() } onRefreshLighthouse={ detailTab ==="seo" && selected && selected !=="new" ? () => void handleRefreshLighthouse(selected) : undefined } onRunSeoCrawl={ detailTab ==="seo" && selected && selected !=="new" ? () => void handleRunSeoCrawl(selected) : undefined } onSyncSearchConsole={ detailTab ==="seo" && selected && selected !=="new" ? () => void handleSyncSearchConsole(selected) : undefined } onSyncSitemaps={ detailTab ==="sitemaps" && selected && selected !=="new" ? () => void handleSyncSitemaps(selected) : undefined } onSyncAds={ detailTab ==="ads" && selected && selected !=="new" ? () => void handleSyncAds(selected) : undefined } adsClientId={ detailTab ==="ads" && selected && selected !=="new" ? selected.id : null } onSyncSocial={ detailTab ==="social" && selected && selected !=="new" ? () => void handleSyncSocial(selected) : undefined } onGenerateSocialIdeas={ detailTab ==="social" && selected && selected !=="new" ? () => void handleGenerateSocialIdeas(selected) : undefined } onRefreshSocialToken={ detailTab ==="social" ? () => void handleRefreshSocialToken() : undefined } socialTokenRefreshing={detailTab ==="social" ? socialTokenRefreshing : false} socialTokenMessage={detailTab ==="social" ? socialTokenMessage : null} onToggleGenericHelpdeskSelection={ detailTab ==="seo" && selected && selected !=="new" ? ( selection: HelpdeskTicketSelection, occurrenceKey: string, ) => handleToggleGenericHelpdeskSelection( selected, selection, occurrenceKey, ) : undefined } onToggleHelpdeskSelection={ detailTab ==="seo" && selected && selected !=="new" ? (item: LighthouseAuditItem, occurrence: LighthouseAuditOccurrence) => handleToggleHelpdeskSelection(selected, item, occurrence) : undefined } onCopyHelpdeskTicket={ detailTab ==="seo" && selected && selected !=="new" ? () => void handleCopyHelpdeskTicket(selected) : undefined } onMarkNoFixNeeded={ detailTab ==="seo" && selected && selected !=="new" ? (item: LighthouseAuditItem, occurrence: LighthouseAuditOccurrence) => void handleMarkNoFixNeeded(selected, item, occurrence) : undefined } /> ) : detailTab ==="playbook" && selected && selected !=="new" ? ( <ClientPlaybookView client={selected} /> ) : null} </div> {editMode && ( <div className="flex flex-col gap-3 border-t border-bip-border px-5 py-4"> {saveError && ( <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"> {saveError} </p> )} <div className="flex gap-3"> <button type="button" onClick={() => { if (selected ==="new") closePanel(); else if (selected) {
  setForm({ ...selected });
setEditMode(false); } }} className="flex-1 rounded-lg border border-bip-border py-2.5 text-sm font-medium text-bip-text hover:bg-bip-page" > Cancel </button> <button type="button" disabled={saving || !norm(form.account_name)} onClick={() => void saveClient()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-bip-card py-2.5 text-sm font-medium text-bip-text disabled:opacity-50" > {saving && <Loader2 className="h-4 w-4 animate-spin" />} {selected ==="new" ?"Create client" :"Save changes"} </button> </div> </div> )} </aside> </div> </> )} {helpdeskDraftOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"> <div className="w-full max-w-3xl rounded-xl border border-bip-border bg-bip-card p-4 shadow-xl"> <div className="mb-3 flex items-center justify-between gap-2"> <p className="text-sm font-semibold text-bip-text"> Help desk ticket draft </p> <button type="button" onClick={() => { setHelpdeskDraftOpen(false);
setHelpdeskDraftCopied(null);
setHelpdeskDraftClientId(null); }} className="rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill" > Close </button> </div> <div className="mb-3 inline-flex rounded-md border border-bip-border p-0.5"> <button type="button" onClick={() => handleSetHelpdeskDraftFormat("detailed")} className={`rounded px-2 py-1 text-xs font-medium ${ helpdeskDraftFormat ==="detailed" ?"bg-bip-accent text-bip-page" :"text-bip-text hover:bg-bip-fill" }`} > Detailed </button> <button type="button" onClick={() => handleSetHelpdeskDraftFormat("checklist")} className={`rounded px-2 py-1 text-xs font-medium ${ helpdeskDraftFormat ==="checklist" ?"bg-bip-accent text-bip-page" :"text-bip-text hover:bg-bip-fill" }`} > Short checklist </button> </div> <textarea value={helpdeskDraftText} onChange={(event) => { setHelpdeskDraftText(event.target.value);
if (helpdeskDraftCopied) setHelpdeskDraftCopied(null); }} rows={16} className="w-full bip-input shadow-none" /> <div className="mt-3 flex items-center justify-between gap-2"> <p className="text-xs text-bip-muted"> Edit as needed, then copy into your help desk system. </p> <button type="button" onClick={() => void handleCopyHelpdeskDraft()} disabled={!helpdeskDraftText.trim()} className="rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60" > Copy </button> </div> {helpdeskDraftCopied && ( <p className="mt-2 text-xs text-bip-text"> {helpdeskDraftCopied} </p> )} </div> </div> )} </div> </div> );
}
function Field({ label, value, onChange, type ="text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return ( <label className="block"> <span className="mb-1 block text-xs font-medium text-bip-text"> {label} {required && <span className="text-red-500"> *</span>} </span> <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bip-input shadow-none" /> </label> );
}
function Row({ label, value, mono,
}: { label: string; value: string; mono?: boolean;
}) {
  return ( <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 border-b border-zinc-100 py-2.5 text-sm last:border-0"> <dt className="text-bip-muted">{label}</dt> <dd className={`text-bip-text ${mono ?"font-mono text-xs break-all" :""}`} > {value ||"—"} </dd> </div> );
}
function CommsOverview({ form }: { form: Partial<ClientRow> }) {
  return ( <dl className="space-y-0"> <Row label="Awaiting response" value={form.needs_reply ?"Yes - client last message" :"No"} /> <Row label="Acknowledged as no-reply" value={formatDateTime(form.reply_acknowledged_at)} /> <Row label="Last communication" value={formatDateTime(form.last_communication_at)} /> <Row label="Days since communication" value={ form.days_stale == null ?"" : `${form.days_stale} day${form.days_stale === 1 ?"" :"s"}` } /> <Row label="Last message source" value={ form.last_event_is_internal == null ?"" : form.last_event_is_internal ?"Internal" :"Client" } /> </dl> );
}
function ActionsOverview({ findings }: { findings: TechnicalFinding[] }) {
  const prioritized = [...findings].sort((left, right) => { if (left.severity !== right.severity) {
  return left.severity ==="critical" ? -1 : 1; }
return new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime(); });
return ( <div className="space-y-4"> <div className="rounded-lg border border-bip-border bg-bip-page p-3"> <div className="flex items-center gap-2 text-sm font-medium text-bip-text"> <ListTodo className="h-4 w-4" /> Weekly action queue </div> <p className="mt-1 text-xs text-bip-text"> Prioritized issues from SEO, Ads, Sitemaps, and Social in one list. </p> </div> {prioritized.length === 0 ? ( <p className="rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text"> No open technical actions for this client. </p> ) : ( <ul className="space-y-2"> {prioritized.map((finding) => ( <li key={finding.id}> <FindingCard finding={finding} /> </li> ))} </ul> )} <div className="rounded-lg border border-bip-border bg-bip-page p-3"> <div className="flex items-center gap-2 text-sm font-medium text-bip-text"> <BadgeAlert className="h-4 w-4" /> Rollout phases </div> <ul className="mt-2 space-y-1 text-xs text-bip-text"> <li>Phase 1: Foundation UI in right panel and table.</li> <li>Phase 2: SEO and Sitemaps data sources.</li> <li>Phase 3: Ads and Social diagnostics.</li> <li>Phase 4: Assignment workflow maturity.</li> </ul> </div> </div> );
}
function ConnectionsReadOnly({ form }: { form: Partial<ClientRow> }) {
  return ( <dl className="space-y-0"> <Row label="Ads customer ID" value={norm(form.ads_customer_id)} mono /> <Row label="GA4 ID" value={norm(form.ga4_id)} mono /> <Row label="GA4 property ID" value={norm(form.ga4_property_id)} mono /> <Row label="Search Console URL" value={norm(form.sc_url)} /> <Row label="Website" value={norm(form.website)} /> <Row label="Google Place ID (GBP)" value={norm(form.google_place_id)} mono /> <Row label="Basecamp project ID" value={norm(form.basecamp_project_id)} mono /> <Row label="Harvest project ID" value={norm(form.harvest_project_id)} mono /> <Row label="Harvest client ID" value={norm(form.harvest_client_id)} mono /> </dl> );
}
