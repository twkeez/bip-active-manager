import { getMetaGraphConfig } from "@/lib/env";

type MetaPage = {
  id: string;
  name?: string;
  link?: string;
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
};

type MetaDailyPoint = {
  end_time?: string;
  value?: number;
};

type MetaInsightsMetric = {
  name?: string;
  values?: MetaDailyPoint[];
};

type MetaPost = {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
  insights?: {
    data?: Array<{
      name?: string;
      values?: Array<{ value?: number }>;
    }>;
  };
};

type MetaIgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  comments_count?: number;
  like_count?: number;
};

function norm(value: string | null | undefined) {
  return (value ?? "").trim();
}

function toHost(value: string | null | undefined) {
  const raw = norm(value);
  if (!raw) return "";
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeNameForMatch(value: string | null | undefined) {
  return norm(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|pllc|ltd|co|company|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostTokens(host: string) {
  return host
    .split(".")
    .map((part) => part.trim().toLowerCase())
    .filter(
      (part) => part && !["www", "com", "org", "net", "io", "biz", "co", "us"].includes(part),
    );
}

async function graphGet(path: string, params: Record<string, string>, accessToken?: string) {
  const defaultToken = getMetaGraphConfig().accessToken;
  const resolvedToken = accessToken ?? defaultToken;
  if (!resolvedToken) {
    throw new Error(
      "Missing Meta access token. Set META_GRAPH_ACCESS_TOKEN or configure a stored integration token.",
    );
  }
  const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
  url.searchParams.set("access_token", resolvedToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) {
    const rawMessage =
      typeof json?.error?.message === "string"
        ? json.error.message
        : `Meta API failed (${response.status})`;
    const code = typeof json?.error?.code === "number" ? json.error.code : null;
    const normalized = rawMessage.toLowerCase();
    const isExpiredToken =
      code === 190 ||
      (normalized.includes("error validating access token") &&
        normalized.includes("session has expired"));
    if (isExpiredToken) {
      throw new Error(
        "Meta access token has expired. Generate a new long-lived token and update META_GRAPH_ACCESS_TOKEN in .env.local, then restart the dev server.",
      );
    }
    throw new Error(rawMessage);
  }
  return json as Record<string, unknown>;
}

function isUnsupportedMetricError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /valid insights metric|must be one of the following values|Unsupported get request|permissions error|not available/i.test(
    error.message,
  );
}

function requiresTotalValueMetricType(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /metric_type=total_value/i.test(error.message);
}

async function fetchInsightsMetrics(
  entityPath: string,
  metrics: string[],
  period: "day" | "lifetime",
  since: string,
  until: string,
  accessToken: string,
) {
  const collected: MetaInsightsMetric[] = [];
  for (const metric of metrics) {
    try {
      const json = await graphGet(
        `${entityPath}/insights`,
        { metric, period, since, until },
        accessToken,
      );
      const rows = (json.data as MetaInsightsMetric[] | undefined) ?? [];
      collected.push(...rows);
    } catch (error) {
      if (requiresTotalValueMetricType(error)) {
        try {
          const retryJson = await graphGet(
            `${entityPath}/insights`,
            {
              metric,
              period,
              since,
              until,
              metric_type: "total_value",
            },
            accessToken,
          );
          const retryRows = (retryJson.data as MetaInsightsMetric[] | undefined) ?? [];
          collected.push(...retryRows);
          continue;
        } catch (retryError) {
          if (isUnsupportedMetricError(retryError) || requiresTotalValueMetricType(retryError)) {
            continue;
          }
          throw retryError;
        }
      }
      if (isUnsupportedMetricError(error)) continue;
      throw error;
    }
  }
  return collected;
}

function chooseBestPageForClient(
  clientName: string,
  clientWebsite: string,
  pages: MetaPage[],
  preferredPageId?: string | null,
) {
  if (pages.length === 0) return null;
  if (preferredPageId) {
    const known = pages.find((page) => page.id === preferredPageId);
    if (known) return known;
  }
  const websiteHost = toHost(clientWebsite);
  const websiteTokens = hostTokens(websiteHost);
  const nameLower = normalizeNameForMatch(clientName);
  const nameTokens = nameLower.split(/\s+/).filter((token) => token.length >= 3);

  const scored = pages.map((page) => {
    let score = 0;
    const pageHost = toHost(page.link);
    const pageName = normalizeNameForMatch(page.name);
    const pageTokens = pageName.split(/\s+/).filter((token) => token.length >= 3);
    const pageHostTokens = hostTokens(pageHost);

    if (websiteHost && pageHost && (websiteHost === pageHost || pageHost.includes(websiteHost))) {
      score += 100;
    }
    for (const token of websiteTokens) {
      if (pageHostTokens.includes(token)) score += 30;
      if (pageName.includes(token)) score += 20;
    }
    if (pageName && nameLower && (pageName.includes(nameLower) || nameLower.includes(pageName))) {
      score += 60;
    }
    for (const token of nameTokens) {
      if (pageTokens.includes(token)) score += 15;
      else if (pageName.includes(token)) score += 8;
    }
    return { page, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if ((scored[0]?.score ?? 0) > 0) return scored[0]!.page;
  // Safe fallback for single-page tokens where matching signals are weak.
  if (pages.length === 1) return pages[0]!;
  return null;
}

function aggregateDailyMetrics(
  metrics: MetaInsightsMetric[],
  keyMap: Record<string, string>,
  fallbackDate: string,
) {
  const byDate = new Map<string, Record<string, number>>();
  for (const metric of metrics) {
    const metricName = keyMap[norm(metric.name)];
    if (!metricName) continue;
    for (const point of metric.values ?? []) {
      const date = norm(point.end_time).slice(0, 10) || fallbackDate;
      const value = typeof point.value === "number" ? point.value : 0;
      if (!byDate.has(date)) byDate.set(date, {});
      byDate.get(date)![metricName] = value;
    }
  }
  return [...byDate.entries()].map(([snapshot_date, values]) => ({ snapshot_date, values }));
}

export async function fetchMetaPageForClient(
  clientName: string,
  clientWebsite: string,
  preferredPageId?: string | null,
  accessToken?: string,
) {
  const json = await graphGet("me/accounts", {
    fields: "id,name,link,access_token,instagram_business_account{id,username}",
    limit: "200",
  }, accessToken);
  const pages = (json.data as MetaPage[] | undefined) ?? [];
  return chooseBestPageForClient(clientName, clientWebsite, pages, preferredPageId);
}

export async function listMetaPages(accessToken?: string) {
  const json = await graphGet("me/accounts", {
    fields: "id,name,link,instagram_business_account{id,username}",
    limit: "200",
  }, accessToken);
  const pages = (json.data as MetaPage[] | undefined) ?? [];
  return pages.map((page) => ({
    id: page.id,
    name: page.name ?? null,
    link: page.link ?? null,
    instagramId: page.instagram_business_account?.id ?? null,
    instagramUsername: page.instagram_business_account?.username ?? null,
  }));
}

export async function fetchFacebookDaily(pageId: string, pageToken: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const data = await fetchInsightsMetrics(
    pageId,
    [
      "page_impressions",
      "page_impressions_unique",
      "page_post_engagements",
      "page_actions_post_reactions_total",
      "page_follows",
    ],
    "day",
    since,
    until,
    pageToken,
  );
  return aggregateDailyMetrics(
    data,
    {
      page_impressions: "impressions",
      page_impressions_unique: "reach",
      page_post_engagements: "engagement",
      page_actions_post_reactions_total: "profile_visits",
      page_follows: "follows",
    },
    until,
  );
}

export async function fetchInstagramDaily(igUserId: string, pageToken: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const data = await fetchInsightsMetrics(
    igUserId,
    [
      "reach",
      "profile_views",
      "website_clicks",
      "follower_count",
      "accounts_engaged",
      "total_interactions",
      "views",
      "content_views",
    ],
    "day",
    since,
    until,
    pageToken,
  );
  return aggregateDailyMetrics(
    data,
    {
      reach: "reach",
      profile_views: "profile_visits",
      website_clicks: "link_clicks",
      follower_count: "follows",
      accounts_engaged: "engagement",
      total_interactions: "engagement",
      views: "impressions",
      content_views: "impressions",
    },
    until,
  );
}

// De-duplicated Instagram reach over a 30-day window (native period reach), so
// the report matches Instagram's own number instead of summing daily reach.
// Facebook has no equivalent — Meta deprecated page reach.
export async function fetchInstagramPeriodReach(
  igUserId: string,
  pageToken: string,
): Promise<number | null> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  try {
    const json = await graphGet(
      `${igUserId}/insights`,
      { metric: "reach", period: "day", metric_type: "total_value", since, until },
      pageToken,
    );
    const data =
      (json.data as Array<{ total_value?: { value?: number }; values?: Array<{ value?: number }> }> | undefined) ?? [];
    const first = data[0];
    if (typeof first?.total_value?.value === "number") return first.total_value.value;
    // Fallback: if only daily values came back, sum them (still Instagram-only).
    if (first?.values?.length) return first.values.reduce((s, v) => s + (v.value ?? 0), 0);
    return null;
  } catch (error) {
    if (isUnsupportedMetricError(error)) return null;
    throw error;
  }
}

function insightMetricValue(
  insights:
    | {
        data?: Array<{
          name?: string;
          values?: Array<{ value?: number }>;
        }>;
      }
    | undefined,
  name: string,
) {
  const metric = insights?.data?.find((item) => norm(item.name) === name);
  return metric?.values?.[0]?.value ?? null;
}

export async function fetchFacebookPosts(pageId: string, pageToken: string) {
  let json: Record<string, unknown>;
  try {
    json = await graphGet(
      `${pageId}/posts`,
      {
        fields:
          "id,message,permalink_url,created_time,insights.metric(post_impressions,post_engaged_users,post_clicks)",
        limit: "25",
      },
      pageToken,
    );
  } catch (error) {
    if (!isUnsupportedMetricError(error)) throw error;
    json = await graphGet(
      `${pageId}/posts`,
      {
        fields: "id,message,permalink_url,created_time",
        limit: "25",
      },
      pageToken,
    );
  }
  const rows = (json.data as MetaPost[] | undefined) ?? [];
  return rows.map((row) => ({
    post_id: row.id,
    media_type: "post",
    permalink: row.permalink_url ?? null,
    caption: row.message ?? null,
    published_at: row.created_time ?? null,
    impressions: insightMetricValue(row.insights, "post_impressions"),
    reach: null,
    engagement: insightMetricValue(row.insights, "post_engaged_users"),
    link_clicks: insightMetricValue(row.insights, "post_clicks"),
    comments: null,
    saves: null,
    shares: null,
  }));
}

export async function fetchInstagramMedia(igUserId: string, pageToken: string) {
  const json = await graphGet(
    `${igUserId}/media`,
    {
      fields: "id,caption,media_type,permalink,timestamp,comments_count,like_count",
      limit: "25",
    },
    pageToken,
  );
  const rows = (json.data as MetaIgMedia[] | undefined) ?? [];
  return rows.map((row) => ({
    post_id: row.id,
    media_type: row.media_type ?? null,
    permalink: row.permalink ?? null,
    caption: row.caption ?? null,
    published_at: row.timestamp ?? null,
    impressions: null,
    reach: null,
    engagement: (row.like_count ?? 0) + (row.comments_count ?? 0),
    link_clicks: null,
    comments: row.comments_count ?? null,
    saves: null,
    shares: null,
  }));
}
