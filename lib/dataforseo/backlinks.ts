import {
  DATAFORSEO_ENDPOINTS,
  cleanDomain,
  extractTaskResult,
  extractTaskResultItems,
  postDataForSeoLive,
} from "@/lib/dataforseo/client";
import type { BacklinkRow, BacklinkSummary } from "@/lib/dataforseo/types";

// DataForSEO stamps come back as "2020-10-31 16:38:31 +00:00", which Date()
// parses inconsistently across runtimes. Normalize to ISO before handing to
// the client, and keep nulls as nulls rather than inventing an epoch date.
function toIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const iso = raw.trim().replace(" ", "T").replace(" +00:00", "Z").replace("+00:00", "Z");
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumber(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

type SummaryPayload = {
  target?: string;
  rank?: number;
  backlinks?: number;
  backlinks_spam_score?: number;
  broken_backlinks?: number;
  referring_domains?: number;
  referring_domains_nofollow?: number;
  referring_main_domains?: number;
  first_seen?: string;
  info?: { cms?: string | null };
};

type BacklinkPayload = {
  domain_from?: string;
  url_from?: string;
  url_to?: string;
  page_from_title?: string | null;
  anchor?: string | null;
  dofollow?: boolean;
  backlink_spam_score?: number;
  domain_from_rank?: number;
  links_count?: number;
  is_lost?: boolean;
  is_new?: boolean;
  is_broken?: boolean;
  first_seen?: string;
  last_seen?: string;
};

// Profile-level totals for a domain: how many links, how many distinct
// domains, and DataForSEO's own spam score for the profile as a whole.
export async function fetchBacklinkSummary(
  config: { login: string; password: string },
  target: string,
): Promise<{ ok: true; summary: BacklinkSummary } | { ok: false; error: string }> {
  const domain = cleanDomain(target);
  if (!domain) return { ok: false, error: "Enter a domain to look up." };

  const res = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.backlinksSummary,
    config.login,
    config.password,
    [{ target: domain, internal_list_limit: 1, backlinks_status_type: "live" }],
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Backlink summary failed." };

  const result = extractTaskResult(res.data) as SummaryPayload | null;
  if (!result) return { ok: false, error: "DataForSEO returned no summary for this domain." };

  return {
    ok: true,
    summary: {
      target: result.target ?? domain,
      rank: toNumber(result.rank),
      backlinks: toNumber(result.backlinks),
      referringDomains: toNumber(result.referring_domains),
      referringMainDomains: toNumber(result.referring_main_domains),
      referringDomainsNofollow: toNumber(result.referring_domains_nofollow),
      brokenBacklinks: toNumber(result.broken_backlinks),
      spamScore: toNumber(result.backlinks_spam_score),
      firstSeen: toIso(result.first_seen),
      cms: result.info?.cms ?? null,
    },
  };
}

// One row per linking domain — the "who links to us" view. Raw mode would
// repeat the same site once per linking page, which reads as noise when the
// question is which organizations link at all.
export async function fetchBacklinks(
  config: { login: string; password: string },
  target: string,
  limit = 100,
): Promise<{ ok: true; rows: BacklinkRow[] } | { ok: false; error: string }> {
  const domain = cleanDomain(target);
  if (!domain) return { ok: false, error: "Enter a domain to look up." };

  const res = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.backlinksList,
    config.login,
    config.password,
    [
      {
        target: domain,
        limit: Math.min(Math.max(limit, 1), 1000),
        mode: "one_per_domain",
        backlinks_status_type: "live",
        order_by: ["domain_from_rank,desc"],
      },
    ],
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Backlink lookup failed." };

  const items = extractTaskResultItems(res.data) as BacklinkPayload[];
  const rows = items.map((item, index) => ({
    id: index,
    domainFrom: item.domain_from ?? "—",
    urlFrom: item.url_from ?? "",
    urlTo: item.url_to ?? "",
    pageTitle: item.page_from_title ?? null,
    anchor: item.anchor ?? null,
    dofollow: item.dofollow === true,
    spamScore: toNumber(item.backlink_spam_score),
    domainRank: toNumber(item.domain_from_rank),
    linksFromDomain: toNumber(item.links_count) ?? 1,
    isLost: item.is_lost === true,
    isNew: item.is_new === true,
    isBroken: item.is_broken === true,
    firstSeen: toIso(item.first_seen),
    lastSeen: toIso(item.last_seen),
  }));

  return { ok: true, rows };
}
