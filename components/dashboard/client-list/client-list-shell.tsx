"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeAlert,
  Building2,
  LayoutGrid,
  Loader2,
  Megaphone,
  Plus,
  Share2,
} from "lucide-react";
import type { ClientListInitialData } from "@/lib/dashboard/load-client-list-data";
import {
  norm,
  buildListTechnicalSummary,
  computeListUrgencyScore,
  isLikelyOwnedByCurrentUser,
  uniqueSorted,
  formatDateOnly,
  previewThreadText,
} from "@/lib/dashboard/client-list-utils";
import ClientListFilterBar from "@/components/clients/client-list-filter-bar";
import {
  ClientRowStatusBadge,
  resolveClientStatus,
} from "@/components/clients/client-status-badge";
import {
  clientMatchesOnboardingFilter,
  clientMatchesServiceFilter,
  clientMatchesStatusFilter,
  type ClientServiceFilterKey,
  type ClientStatusFilter,
  type OnboardingFilter,
} from "@/lib/clients/client-filters";
import { acknowledgeNoReply } from "@/lib/clients/acknowledge-no-reply";
import {
  buildClientListHref,
  CLIENT_LIST_PATH,
  defaultClientListViewState,
  hasClientListViewParams,
  parseClientListViewState,
  resolveInitialClientListViewState,
  writeStoredClientListHref,
  type ClientListTechnicalFilter,
  type ClientListViewState,
} from "@/lib/clients/client-list-view-state";
import type { ClientRow } from "@/lib/types/client";
import NewClientDrawer from "./new-client-drawer";
import BasecampStatusBanners from "@/components/layout/basecamp-status-banners";
import AppHeaderActions, {
  ModuleHeaderLinks,
} from "@/components/layout/app-header-actions";
type ClientListShellProps = ClientListInitialData & {
  userEmail?: string;
  basecampStatus?: string;
};
function websiteLabel(url: string | null | undefined) {
  const t = norm(url);
  if (!t) return "—";
  try {
    const u = t.includes("://") ? new URL(t) : new URL(`https://${t}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return t.length > 32 ? `${t.slice(0, 29)}…` : t;
  }
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}
export default function ClientListShell({
  clients,
  syncState,
  duplicateProjectIdCounts,
  gscSignalSummariesByClient,
  adsSignalSummariesByClient,
  freshnessByClient,
  hasAdsSnapshotByClient,
  threadPreviews,
  loadError,
  userEmail,
  basecampStatus,
}: ClientListShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasHydratedViewRef = useRef(false);
  const [clientRows, setClientRows] = useState(clients);
  const [acknowledgingClientId, setAcknowledgingClientId] = useState<
    number | null
  >(null);
  const [ackErrorByClientId, setAckErrorByClientId] = useState<
    Record<number, string>
  >({});
  const [search, setSearch] = useState(defaultClientListViewState().search);
  const [statusFilter, setStatusFilter] = useState(
    defaultClientListViewState().statusFilter,
  );
  const [onboardingFilter, setOnboardingFilter] = useState(
    defaultClientListViewState().onboardingFilter,
  );
  const [serviceFilters, setServiceFilters] = useState(
    defaultClientListViewState().serviceFilters,
  );
  const [strategistFilter, setStrategistFilter] = useState(
    defaultClientListViewState().strategistFilter,
  );
  const [tierFilter, setTierFilter] = useState(
    defaultClientListViewState().tierFilter,
  );
  const [showMineOnly, setShowMineOnly] = useState(
    defaultClientListViewState().showMineOnly,
  );
  const [showStaleOnly, setShowStaleOnly] = useState(
    defaultClientListViewState().showStaleOnly,
  );
  const [prioritizeUrgent, setPrioritizeUrgent] = useState(
    defaultClientListViewState().prioritizeUrgent,
  );
  const [technicalFilter, setTechnicalFilter] =
    useState<ClientListTechnicalFilter>(
      defaultClientListViewState().technicalFilter,
    );
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [startingOnboardingClientId, setStartingOnboardingClientId] = useState<
    number | null
  >(null);
  const [onboardingErrorByClientId, setOnboardingErrorByClientId] = useState<
    Record<number, string>
  >({});
  const applyViewState = useCallback((state: ClientListViewState) => {
    setSearch(state.search);
    setStatusFilter(state.statusFilter);
    setOnboardingFilter(state.onboardingFilter);
    setServiceFilters(state.serviceFilters);
    setStrategistFilter(state.strategistFilter);
    setTierFilter(state.tierFilter);
    setShowMineOnly(state.showMineOnly);
    setShowStaleOnly(state.showStaleOnly);
    setPrioritizeUrgent(state.prioritizeUrgent);
    setTechnicalFilter(state.technicalFilter);
  }, []);
  const getViewState = useCallback(
    (): ClientListViewState => ({
      search,
      statusFilter,
      onboardingFilter,
      serviceFilters,
      strategistFilter,
      tierFilter,
      showMineOnly,
      showStaleOnly,
      prioritizeUrgent,
      technicalFilter,
    }),
    [
      search,
      statusFilter,
      onboardingFilter,
      serviceFilters,
      strategistFilter,
      tierFilter,
      showMineOnly,
      showStaleOnly,
      prioritizeUrgent,
      technicalFilter,
    ],
  );
  const syncViewToUrl = useCallback(
    (state: ClientListViewState) => {
      const href = buildClientListHref(state);
      writeStoredClientListHref(href);
      router.replace(href, { scroll: false });
    },
    [router],
  );
  const updateView = useCallback(
    (partial: Partial<ClientListViewState>) => {
      const next = { ...getViewState(), ...partial };
      applyViewState(next);
      syncViewToUrl(next);
    },
    [applyViewState, getViewState, syncViewToUrl],
  );
  useEffect(() => {
    if (hasHydratedViewRef.current) {
      applyViewState(parseClientListViewState(searchParams));
      return;
    }
    hasHydratedViewRef.current = true;
    const initial = resolveInitialClientListViewState(searchParams);
    applyViewState(initial);
    const href = buildClientListHref(initial);
    writeStoredClientListHref(href);
    if (!hasClientListViewParams(searchParams) && href !== CLIENT_LIST_PATH) {
      router.replace(href, { scroll: false });
    }
  }, [applyViewState, router, searchParams]);
  useEffect(() => {
    setClientRows(clients);
  }, [clients]);
  const strategistOptions = useMemo(
    () => uniqueSorted(clientRows.map((c) => c.marketing_strategist)),
    [clientRows],
  );
  const tierOptions = useMemo(
    () => uniqueSorted(clientRows.map((c) => c.tier)),
    [clientRows],
  );
  const technicalByClient = useMemo(() => {
    const map = new Map<number, ReturnType<typeof buildListTechnicalSummary>>();
    for (const client of clientRows) {
      map.set(client.id, buildListTechnicalSummary(client));
    }
    return map;
  }, [clientRows]);
  const urgencyByClient = useMemo(() => {
    const map = new Map<number, number>();
    for (const client of clientRows) {
      map.set(
        client.id,
        computeListUrgencyScore({
          client,
          technical: technicalByClient.get(client.id)!,
          gscSignals: gscSignalSummariesByClient[client.id],
          adsSignals: adsSignalSummariesByClient[client.id],
          freshness: freshnessByClient[client.id],
        }),
      );
    }
    return map;
  }, [
    clientRows,
    technicalByClient,
    gscSignalSummariesByClient,
    adsSignalSummariesByClient,
    freshnessByClient,
  ]);
  const threadsByProject = useMemo(() => {
    const grouped = new Map<string, typeof threadPreviews>();
    for (const preview of threadPreviews) {
      const projectId = norm(preview.basecamp_project_id);
      if (!projectId) continue;
      const current = grouped.get(projectId) ?? [];
      current.push(preview);
      grouped.set(projectId, current);
    }
    for (const [projectId, previews] of grouped) {
      grouped.set(
        projectId,
        [...previews].sort(
          (left, right) =>
            new Date(right.occurred_at).getTime() -
            new Date(left.occurred_at).getTime(),
        ),
      );
    }
    return grouped;
  }, [threadPreviews]);
  const filtered = useMemo(() => {
    const base = clientRows.filter((c) => {
      const technical = technicalByClient.get(c.id);
      if (
        search &&
        !norm(c.account_name).toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (!clientMatchesStatusFilter(c, statusFilter)) {
        return false;
      }
      if (!clientMatchesOnboardingFilter(c, onboardingFilter)) {
        return false;
      }
      if (
        serviceFilters.length > 0 &&
        !serviceFilters.some((service) =>
          clientMatchesServiceFilter(c, service),
        )
      ) {
        return false;
      }
      if (
        strategistFilter &&
        norm(c.marketing_strategist) !== strategistFilter
      ) {
        return false;
      }
      if (tierFilter && norm(c.tier) !== tierFilter) {
        return false;
      }
      if (
        showMineOnly &&
        !isLikelyOwnedByCurrentUser(c.marketing_strategist, userEmail)
      ) {
        return false;
      }
      if (showStaleOnly && (c.days_stale ?? 0) < 15) {
        return false;
      }
      if (technicalFilter === "critical" && !technical?.hasCritical) {
        return false;
      }
      if (
        technicalFilter === "ads_issues" &&
        (adsSignalSummariesByClient[c.id]?.total ?? 0) === 0
      ) {
        return false;
      }
      if (
        technicalFilter &&
        technicalFilter !== "critical" &&
        technicalFilter !== "ads_issues" &&
        !technical?.findings.some(
          (finding) => finding.channel === technicalFilter,
        )
      ) {
        return false;
      }
      return true;
    });
    if (!prioritizeUrgent) return base;
    return [...base].sort((left, right) => {
      const leftUrgency = urgencyByClient.get(left.id) ?? 0;
      const rightUrgency = urgencyByClient.get(right.id) ?? 0;
      if (leftUrgency !== rightUrgency) return rightUrgency - leftUrgency;
      return left.account_name.localeCompare(right.account_name);
    });
  }, [
    clientRows,
    search,
    statusFilter,
    onboardingFilter,
    serviceFilters,
    strategistFilter,
    tierFilter,
    showMineOnly,
    showStaleOnly,
    technicalFilter,
    technicalByClient,
    adsSignalSummariesByClient,
    prioritizeUrgent,
    urgencyByClient,
    userEmail,
  ]);
  const likelyOwnedCount = useMemo(
    () =>
      clientRows.filter((client) =>
        isLikelyOwnedByCurrentUser(client.marketing_strategist, userEmail),
      ).length,
    [clientRows, userEmail],
  );
  const shareViewSummaryText = useMemo(() => {
    const toSnippet = (value: string, max = 72) => {
      const cleaned = value.replace(/\s+/g, "").trim();
      if (!cleaned) return "—";
      return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
    };
    const padCell = (value: string, width: number) => {
      const normalized = toSnippet(value, width);
      return normalized.length >= width
        ? normalized
        : normalized.padEnd(width, "");
    };
    const activeFilters: string[] = [];
    if (search.trim()) activeFilters.push(`Search="${search.trim()}"`);
    if (statusFilter) activeFilters.push(`Status=${statusFilter}`);
    if (onboardingFilter) activeFilters.push(`Onboarding=${onboardingFilter}`);
    if (serviceFilters.length)
      activeFilters.push(`Services=${serviceFilters.join(",")}`);
    if (strategistFilter) activeFilters.push(`Strategist=${strategistFilter}`);
    if (tierFilter) activeFilters.push(`Tier=${tierFilter}`);
    if (showMineOnly) activeFilters.push("My accounts");
    if (showStaleOnly) activeFilters.push("15+ days quiet");
    if (technicalFilter) activeFilters.push(`Technical=${technicalFilter}`);
    if (prioritizeUrgent) activeFilters.push("Prioritize urgent");
    const viewName =
      statusFilter === "Awaiting"
        ? "Awaiting Reply"
        : showStaleOnly
          ? "No Message in 15+ Days"
          : activeFilters.length > 0
            ? "Filtered View"
            : "All Accounts";
    const rows = filtered.slice(0, 15).map((client) => {
      const awaiting = resolveClientStatus(client);
      const lastComms =
        client.last_communication_at == null
          ? "Never"
          : `${formatDateOnly(client.last_communication_at)} (${client.days_stale ?? "?"}d ago)`;
      const projectId = norm(client.basecamp_project_id);
      const latestThread = projectId
        ? (threadsByProject.get(projectId) ?? [])[0]
        : undefined;
      const messageSnippet = latestThread
        ? previewThreadText(latestThread)
        : "No synced message yet";
      return {
        row: [
          padCell(client.account_name, 34),
          padCell(norm(client.marketing_strategist) || "—", 14),
          padCell(awaiting, 12),
          padCell(lastComms, 20),
        ].join(" |"),
        snippet: ` ↳ Last msg: ${toSnippet(messageSnippet, 110)}`,
      };
    });
    const overflowCount = Math.max(0, filtered.length - 15);
    return [
      `BIP Client Manager — ${viewName}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Showing ${filtered.length} of ${clientRows.length} clients`,
      `Active filters: ${activeFilters.length > 0 ? activeFilters.join(",") : "None"}`,
      "",
      "```",
      [
        padCell("Client", 34),
        padCell("Strategist", 14),
        padCell("Awaiting", 12),
        padCell("Last comms", 20),
      ].join(" |"),
      `${"-".repeat(34)}-+-${"-".repeat(14)}-+-${"-".repeat(12)}-+-${"-".repeat(20)}`,
      ...rows.flatMap((entry) => [entry.row, entry.snippet, ""]),
      "```",
      ...(overflowCount > 0
        ? ["", `+${overflowCount} more clients in this filtered view.`]
        : []),
    ].join("\n");
  }, [
    search,
    statusFilter,
    onboardingFilter,
    serviceFilters,
    strategistFilter,
    tierFilter,
    showMineOnly,
    showStaleOnly,
    technicalFilter,
    prioritizeUrgent,
    filtered,
    clientRows.length,
    threadsByProject,
  ]);
  const handleShareViewSummary = useCallback(async () => {
    if (filtered.length === 0) return;
    try {
      await navigator.clipboard.writeText(shareViewSummaryText);
      setShareCopyStatus({
        tone: "success",
        message: `Copied view summary at ${new Date().toLocaleTimeString()}.`,
      });
    } catch {
      setShareCopyStatus({
        tone: "error",
        message: "Could not copy summary. Please check clipboard permissions.",
      });
    }
  }, [filtered.length, shareViewSummaryText]);
  function openRow(c: ClientRow) {
    writeStoredClientListHref(buildClientListHref(getViewState()));
    router.push(`/dashboard/clients/${c.id}`);
  }
  async function handleStartOnboarding(
    client: ClientRow,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();
    setStartingOnboardingClientId(client.id);
    setOnboardingErrorByClientId((current) => {
      const next = { ...current };
      delete next[client.id];
      return next;
    });
    try {
      const response = await fetch(
        `/api/clients/${client.id}/onboarding/start`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to start onboarding.");
      }
      setClientRows((current) =>
        current.map((row) =>
          row.id === client.id ? { ...row, onboarding_status: "active" } : row,
        ),
      );
      router.refresh();
    } catch (error) {
      setOnboardingErrorByClientId((current) => ({
        ...current,
        [client.id]:
          error instanceof Error ? error.message : "Failed to start onboarding",
      }));
    } finally {
      setStartingOnboardingClientId(null);
    }
  }
  async function handleListNoReplyNeeded(
    client: ClientRow,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();
    setAcknowledgingClientId(client.id);
    setAckErrorByClientId((current) => {
      const next = { ...current };
      delete next[client.id];
      return next;
    });
    try {
      const updated = await acknowledgeNoReply(client.id);
      setClientRows((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      router.refresh();
    } catch (error) {
      setAckErrorByClientId((current) => ({
        ...current,
        [client.id]:
          error instanceof Error
            ? error.message
            : "Failed to mark as no reply needed",
      }));
    } finally {
      setAcknowledgingClientId(null);
    }
  }
  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bip-page p-8">
        
        <p className="max-w-md text-center text-sm text-bip-danger">
          
          Could not load clients: {loadError}
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bip-page">
      
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-bip-card px-6 py-4">
        
        <div className="flex items-center gap-3">
          
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-bip-card text-white/75 transition hover:bg-bip-page"
            title="Control panel"
          >
            
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bip-accent text-bip-page">
            
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            
            <h1 className="text-lg font-semibold tracking-tight text-white">
              
              Clients
            </h1>
            <p className="text-xs text-white/50">
              {userEmail ?? "Signed in"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          
          <ModuleHeaderLinks />
          <AppHeaderActions
            showConnectBasecamp
            showSyncBasecamp
            showSignOut
            onSyncComplete={() => router.refresh()}
          />
        </div>
      </header>
      <main className="flex min-w-0 flex-1 flex-col p-6">
        
        <BasecampStatusBanners
          basecampStatus={basecampStatus}
          syncState={syncState}
        />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          
          <button
            type="button"
            onClick={() => void handleShareViewSummary()}
            disabled={filtered.length === 0}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-transparent px-4 py-2.5 text-sm font-medium text-white shadow-none transition hover:bg-bip-card/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            
            <Share2 className="h-4 w-4" /> Share view
          </button>
          <button
            type="button"
            onClick={() => setNewClientOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-bip-accent px-4 py-2.5 text-sm font-medium text-bip-page shadow-none transition hover:brightness-110"
          >
            
            <Plus className="h-4 w-4" /> Add client
          </button>
        </div>
        <ClientListFilterBar
          search={search}
          onSearchChange={(value) => updateView({ search: value })}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => updateView({ statusFilter: value })}
          onboardingFilter={onboardingFilter}
          onOnboardingFilterChange={(value) =>
            updateView({ onboardingFilter: value })
          }
          serviceFilters={serviceFilters}
          onServiceFiltersChange={(value) =>
            updateView({ serviceFilters: value })
          }
        />
        <details className="mb-4 rounded-xl border border-white/[0.08] bg-bip-card px-4 py-3 shadow-none">
          
          <summary className="cursor-pointer text-sm font-medium text-white/75">
            
            Advanced filters
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            
            <select
              value={strategistFilter}
              onChange={(e) => updateView({ strategistFilter: e.target.value })}
              className="bip-input shadow-none"
            >
              
              <option value="">All strategists</option>
              {strategistOptions.map((s) => (
                <option key={s} value={s}>
                  
                  {s}
                </option>
              ))}
            </select>
            <select
              value={tierFilter}
              onChange={(e) => updateView({ tierFilter: e.target.value })}
              className="bip-input shadow-none"
            >
              
              <option value="">All tiers</option>
              {tierOptions.map((t) => (
                <option key={t} value={t}>
                  
                  {t}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75">
              
              <input
                type="checkbox"
                checked={showMineOnly}
                onChange={(event) =>
                  updateView({ showMineOnly: event.target.checked })
                }
                className="h-4 w-4 rounded border-white/[0.12]"
              />
              My accounts
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75">
              
              <input
                type="checkbox"
                checked={prioritizeUrgent}
                onChange={(event) =>
                  updateView({ prioritizeUrgent: event.target.checked })
                }
                className="h-4 w-4 rounded border-white/[0.12]"
              />
              Prioritize urgent
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75">
              
              <input
                type="checkbox"
                checked={showStaleOnly}
                onChange={(event) =>
                  updateView({ showStaleOnly: event.target.checked })
                }
                className="h-4 w-4 rounded border-white/[0.12]"
              />
              15+ days quiet
            </label>
            <select
              value={technicalFilter}
              onChange={(event) =>
                updateView({
                  technicalFilter: event.target
                    .value as ClientListTechnicalFilter,
                })
              }
              className="bip-input shadow-none"
            >
              
              <option value="">All technical</option>
              <option value="critical">Critical issues</option>
              <option value="ads_issues">Ads issues</option>
              <option value="seo">SEO</option> <option value="ads">Ads</option>
              <option value="sitemaps">Sitemap</option>
              <option value="social">Social</option>
            </select>
          </div>
        </details>
        <p className="mb-3 text-sm text-white/50">
          
          Showing {filtered.length} of {clientRows.length} clients
        </p>
        {userEmail ? (
          <p className="mb-3 text-xs text-white/50">
            
            My account matches: {likelyOwnedCount}
          </p>
        ) : null}
        {shareCopyStatus ? (
          <p
            className={`mb-3 rounded-lg border px-3 py-2 text-xs ${shareCopyStatus.tone === "success" ? "border-bip-accent/30 bg-bip-accent/10 text-bip-accent" : "border-bip-danger/30 bg-bip-danger/10 text-bip-danger"}`}
          >
            
            {shareCopyStatus.message}
          </p>
        ) : null}
        <p className="mb-3 text-xs text-white/50">
          
          Last Basecamp sync: {formatDateTime(syncState?.last_synced_at)}
        </p>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/[0.08] bg-bip-card shadow-none">
          
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm"><thead><tr className="sticky top-0 z-10 border-b border-white/[0.08] bg-bip-page/95 backdrop-blur"><th className="px-4 py-3 font-semibold text-white/75">
                  Account
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  
                  Strategist
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  Tier
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  Website
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  
                  Technical
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  
                  Priority
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  Status
                </th><th className="px-4 py-3 font-semibold text-white/75">
                  
                  Last comms
                </th></tr></thead><tbody>{filtered.map((c) => {
                const technical = technicalByClient.get(c.id);
                const gscSummary = gscSignalSummariesByClient[c.id];
                const adsSummary = adsSignalSummariesByClient[c.id];
                const missingScUrl = !norm(c.sc_url);
                const missingAdsCustomerId = !norm(c.ads_customer_id);
                const hasAdsSnapshot = hasAdsSnapshotByClient[c.id] ?? false;
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-white/[0.08] transition hover:bg-white/[0.06]"
                    onClick={() => openRow(c)}
                  ><td className="px-4 py-3 font-medium text-white">
                      
                      <div className="flex items-center gap-2">
                        
                        <span>{c.account_name}</span>
                        {c.onboarding_status === "active" ? (
                          <span className="inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                            
                            Onboarding
                          </span>
                        ) : null}
                        {norm(c.basecamp_project_id) &&
                          (duplicateProjectIdCounts[
                            norm(c.basecamp_project_id)
                          ] ?? 0) > 1 && (
                            <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                              
                              Shared BC ID
                            </span>
                          )}
                        {missingScUrl ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
                            
                            <BadgeAlert className="h-3.5 w-3.5" /> SC URL
                            missing
                          </span>
                        ) : null}
                        {gscSummary && gscSummary.total > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${gscSummary.hasCritical ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}
                          >
                            
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {gscSummary.total} SC issue
                            {gscSummary.total === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {missingAdsCustomerId ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
                            
                            <BadgeAlert className="h-3.5 w-3.5" /> Ads ID
                            missing
                          </span>
                        ) : null}
                        {!missingAdsCustomerId && hasAdsSnapshot ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                            
                            <Megaphone className="h-3.5 w-3.5" /> Ads
                            synced
                          </span>
                        ) : null}
                        {adsSummary && adsSummary.total > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${adsSummary.hasCritical ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}
                          >
                            
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {adsSummary.total} Ads issue
                            {adsSummary.total === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {!c.onboarding_status ? (
                          <button
                            type="button"
                            onClick={(event) =>
                              void handleStartOnboarding(c, event)
                            }
                            disabled={startingOnboardingClientId === c.id}
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-60"
                          >
                            
                            {startingOnboardingClientId === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Start onboarding
                          </button>
                        ) : c.onboarding_status === "active" ? (
                          <Link
                            href={`/dashboard/clients/${c.id}?tab=onboarding`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-500/20"
                          >
                            
                            Open onboarding
                          </Link>
                        ) : null}
                        {onboardingErrorByClientId[c.id] ? (
                          <span className="max-w-[140px] text-[10px] leading-tight text-bip-danger">
                            
                            {onboardingErrorByClientId[c.id]}
                          </span>
                        ) : null}
                      </div>
                    </td><td className="px-4 py-3 text-white/75">
                      
                      {norm(c.marketing_strategist) || "—"}
                    </td><td className="px-4 py-3">
                      
                      <span className="inline-flex rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/75">
                        
                        {norm(c.tier) || "—"}
                      </span>
                    </td><td className="px-4 py-3">
                      
                      {norm(c.website) ? (
                        <a
                          href={
                            c.website!.includes("://")
                              ? c.website!
                              : `https://${c.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex max-w-[220px] truncate text-white/75 underline decoration-white/30 underline-offset-2 hover:text-white"
                        >
                          
                          {websiteLabel(c.website)}
                        </a>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td><td className="px-4 py-3">
                      
                      <div className="flex items-center gap-2">
                        
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${technical?.health === "Critical" ? "border-red-500/20 bg-red-500/10 text-red-400" : technical?.health === "Watch" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}
                        >
                          
                          {technical?.health ?? "Good"}
                        </span>
                        <span className="text-xs text-white/50">
                          
                          {technical?.openCount ?? 0} open
                        </span>
                      </div>
                    </td><td className="px-4 py-3">
                      
                      {(() => {
                        const urgency = urgencyByClient.get(c.id) ?? 0;
                        const tone =
                          urgency >= 60
                            ? "border-red-500/20 bg-red-500/10 text-red-400"
                            : urgency >= 35
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
                        const label =
                          urgency >= 60
                            ? "High"
                            : urgency >= 35
                              ? "Medium"
                              : "Low";
                        return (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
                          >
                            
                            {label} ({urgency})
                          </span>
                        );
                      })()}
                    </td><td className="px-4 py-3">
                      
                      <div className="flex flex-col items-start gap-1.5">
                        
                        <ClientRowStatusBadge client={c} />
                        {resolveClientStatus(c) === "Awaiting" ? (
                          <>
                            
                            <button
                              type="button"
                              onClick={(event) =>
                                void handleListNoReplyNeeded(c, event)
                              }
                              disabled={acknowledgingClientId === c.id}
                              className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] bg-bip-card px-2 py-1 text-[11px] font-medium text-white/75 transition hover:bg-bip-page disabled:opacity-60"
                            >
                              
                              {acknowledgingClientId === c.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : null}
                              No reply needed
                            </button>
                            {ackErrorByClientId[c.id] ? (
                              <span className="max-w-[140px] text-[10px] leading-tight text-bip-danger">
                                
                                {ackErrorByClientId[c.id]}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td><td className="px-4 py-3 text-white/75">
                      
                      {c.last_communication_at ? (
                        <div className="space-y-0.5">
                          
                          <p>
                            {new Date(
                              c.last_communication_at,
                            ).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-white/50">
                            
                            {c.days_stale == null
                              ? "Unknown"
                              : `${c.days_stale} day${c.days_stale === 1 ? "" : "s"} ago`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-white/40">Never</span>
                      )}
                    </td></tr>
                );
              })}</tbody></table>
          {filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-white/50">
              
              No clients match your filters.
            </p>
          ) : null}
        </div>
      </main>
      <NewClientDrawer
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
      />
    </div>
  );
}
