import type { ClientDisplayStatus } from "@/components/clients/client-status-badge";
import type {
  ClientServiceFilterKey,
  ClientStatusFilter,
  OnboardingFilter,
} from "@/lib/clients/client-filters";

export type ClientListTechnicalFilter =
  | ""
  | "critical"
  | "ads_issues"
  | "seo"
  | "ads"
  | "sitemaps"
  | "social";

export type ClientListViewState = {
  search: string;
  statusFilter: ClientStatusFilter;
  onboardingFilter: OnboardingFilter;
  serviceFilters: ClientServiceFilterKey[];
  strategistFilter: string;
  tierFilter: string;
  showMineOnly: boolean;
  showStaleOnly: boolean;
  prioritizeUrgent: boolean;
  technicalFilter: ClientListTechnicalFilter;
};

export const CLIENT_LIST_PATH = "/dashboard/clients";
export const CLIENT_LIST_VIEW_STORAGE_KEY = "bip:client-list-view";

const STATUS_VALUES = new Set<ClientDisplayStatus>([
  "Active",
  "Awaiting",
  "Pending",
  "Paused",
]);

const ONBOARDING_VALUES = new Set<OnboardingFilter>([
  "",
  "active",
  "complete",
  "not_started",
]);

const SERVICE_VALUES = new Set<ClientServiceFilterKey>(["seo", "ads", "comms"]);

const TECHNICAL_VALUES = new Set<ClientListTechnicalFilter>([
  "",
  "critical",
  "ads_issues",
  "seo",
  "ads",
  "sitemaps",
  "social",
]);

export function defaultClientListViewState(): ClientListViewState {
  return {
    search: "",
    statusFilter: "",
    onboardingFilter: "",
    serviceFilters: [],
    strategistFilter: "",
    tierFilter: "",
    showMineOnly: false,
    showStaleOnly: false,
    prioritizeUrgent: true,
    technicalFilter: "",
  };
}

function parseStatusFilter(value: string | null): ClientStatusFilter {
  if (!value) return "";
  return STATUS_VALUES.has(value as ClientDisplayStatus)
    ? (value as ClientStatusFilter)
    : "";
}

function parseOnboardingFilter(value: string | null): OnboardingFilter {
  if (!value) return "";
  return ONBOARDING_VALUES.has(value as OnboardingFilter)
    ? (value as OnboardingFilter)
    : "";
}

function parseServiceFilters(value: string | null): ClientServiceFilterKey[] {
  if (!value) return [];
  const services = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is ClientServiceFilterKey =>
      SERVICE_VALUES.has(item as ClientServiceFilterKey),
    );
  return [...new Set(services)];
}

function parseTechnicalFilter(value: string | null): ClientListTechnicalFilter {
  if (!value) return "";
  return TECHNICAL_VALUES.has(value as ClientListTechnicalFilter)
    ? (value as ClientListTechnicalFilter)
    : "";
}

function parseFlag(value: string | null) {
  return value === "1" || value === "true";
}

export function parseClientListViewState(
  searchParams: Pick<URLSearchParams, "get">,
): ClientListViewState {
  const defaults = defaultClientListViewState();
  const urgentParam = searchParams.get("urgent");

  return {
    search: searchParams.get("q")?.trim() ?? defaults.search,
    statusFilter: parseStatusFilter(searchParams.get("status")),
    onboardingFilter: parseOnboardingFilter(searchParams.get("onboarding")),
    serviceFilters: parseServiceFilters(searchParams.get("services")),
    strategistFilter: searchParams.get("strategist")?.trim() ?? defaults.strategistFilter,
    tierFilter: searchParams.get("tier")?.trim() ?? defaults.tierFilter,
    showMineOnly: parseFlag(searchParams.get("mine")),
    showStaleOnly: parseFlag(searchParams.get("stale")),
    prioritizeUrgent: urgentParam == null ? defaults.prioritizeUrgent : urgentParam !== "0",
    technicalFilter: parseTechnicalFilter(searchParams.get("tech")),
  };
}

export function hasClientListViewParams(searchParams: Pick<URLSearchParams, "get">) {
  return (
    searchParams.get("q") != null ||
    searchParams.get("status") != null ||
    searchParams.get("onboarding") != null ||
    searchParams.get("services") != null ||
    searchParams.get("strategist") != null ||
    searchParams.get("tier") != null ||
    searchParams.get("mine") != null ||
    searchParams.get("stale") != null ||
    searchParams.get("urgent") != null ||
    searchParams.get("tech") != null
  );
}

export function buildClientListQuery(state: ClientListViewState) {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search) params.set("q", search);
  if (state.statusFilter) params.set("status", state.statusFilter);
  if (state.onboardingFilter) params.set("onboarding", state.onboardingFilter);
  if (state.serviceFilters.length > 0) {
    params.set("services", state.serviceFilters.join(","));
  }
  if (state.strategistFilter.trim()) {
    params.set("strategist", state.strategistFilter.trim());
  }
  if (state.tierFilter.trim()) params.set("tier", state.tierFilter.trim());
  if (state.showMineOnly) params.set("mine", "1");
  if (state.showStaleOnly) params.set("stale", "1");
  if (!state.prioritizeUrgent) params.set("urgent", "0");
  if (state.technicalFilter) params.set("tech", state.technicalFilter);
  return params;
}

export function buildClientListHref(state: ClientListViewState) {
  const query = buildClientListQuery(state).toString();
  return query ? `${CLIENT_LIST_PATH}?${query}` : CLIENT_LIST_PATH;
}

export function readStoredClientListHref() {
  if (typeof window === "undefined") return CLIENT_LIST_PATH;
  try {
    const stored = window.sessionStorage.getItem(CLIENT_LIST_VIEW_STORAGE_KEY);
    if (!stored) return CLIENT_LIST_PATH;
    if (!stored.startsWith(CLIENT_LIST_PATH)) return CLIENT_LIST_PATH;
    return stored;
  } catch {
    return CLIENT_LIST_PATH;
  }
}

export function writeStoredClientListHref(href: string) {
  if (typeof window === "undefined") return;
  try {
    if (!href.startsWith(CLIENT_LIST_PATH)) return;
    window.sessionStorage.setItem(CLIENT_LIST_VIEW_STORAGE_KEY, href);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function resolveInitialClientListViewState(
  searchParams: Pick<URLSearchParams, "get">,
) {
  if (hasClientListViewParams(searchParams)) {
    return parseClientListViewState(searchParams);
  }
  if (typeof window === "undefined") {
    return defaultClientListViewState();
  }
  try {
    const storedHref = window.sessionStorage.getItem(CLIENT_LIST_VIEW_STORAGE_KEY);
    if (!storedHref) return defaultClientListViewState();
    const queryIndex = storedHref.indexOf("?");
    if (queryIndex === -1) return defaultClientListViewState();
    const storedParams = new URLSearchParams(storedHref.slice(queryIndex + 1));
    if (!hasClientListViewParams(storedParams)) return defaultClientListViewState();
    return parseClientListViewState(storedParams);
  } catch {
    return defaultClientListViewState();
  }
}
