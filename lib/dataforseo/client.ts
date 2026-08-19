export const DEFAULT_LOCATION_CODE = 2840;
export const DEFAULT_LANGUAGE_CODE = "en";

export const DATAFORSEO_ENDPOINTS = {
  domainIntersection:
    "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live",
  keywordIdeas:
    "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live",
  serpOrganicAdvanced:
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
  // Local-pack results are returned as `local_pack` elements inside the Google
  // organic SERP; there is no standalone local_pack endpoint (that path returns
  // "Invalid Path"). Callers filter the organic items for type === "local_pack".
  localPackAdvanced:
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
  competitorsDomain:
    "https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live",
  myBusinessInfo:
    "https://api.dataforseo.com/v3/business_data/google/my_business_info/live",
  domainRankOverview:
    "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live",
  backlinksSummary: "https://api.dataforseo.com/v3/backlinks/summary/live",
  backlinksList: "https://api.dataforseo.com/v3/backlinks/backlinks/live",
  // Reviews are task-based, not live: post a task, then poll task_get. The
  // standard queue sat >15min in testing; priority 2 returned in ~60s.
  reviewsTaskPost: "https://api.dataforseo.com/v3/business_data/google/reviews/task_post",
  reviewsTaskGet: "https://api.dataforseo.com/v3/business_data/google/reviews/task_get",
} as const;

// my_business_info resolves reliably by place id and returns "No Search
// Results" for a plain business name, so always address it this way.
export function placeIdKeyword(placeId: string): string {
  return `place_id:${placeId.trim()}`;
}

export function cleanDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");
  domain = domain.split("/")[0] ?? domain;
  return domain;
}

export function dataForSeoBasicAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export function extractTaskResultItems(apiData: unknown): unknown[] {
  const data = apiData as {
    tasks?: Array<{
      result?: Array<{ items?: unknown[] }>;
    }>;
  };

  return data?.tasks?.[0]?.result?.[0]?.items ?? [];
}

export function extractTaskResult(apiData: unknown): unknown {
  const data = apiData as {
    tasks?: Array<{
      result?: unknown[];
    }>;
  };

  return data?.tasks?.[0]?.result?.[0] ?? null;
}

export function dataForSeoTaskError(apiData: unknown): string | null {
  const data = apiData as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{ status_code?: number; status_message?: string }>;
  };

  if (data.status_code != null && data.status_code !== 20000) {
    return data.status_message ?? "DataForSEO request failed.";
  }

  const task = data.tasks?.[0];
  if (task?.status_code != null && task.status_code !== 20000) {
    return task.status_message ?? "DataForSEO task failed.";
  }

  return null;
}

export async function postDataForSeoLive(
  url: string,
  login: string,
  password: string,
  payload: unknown[],
): Promise<{ ok: boolean; status: number; data: unknown; error: string | null }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: dataForSeoBasicAuthHeader(login, password),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      error: "DataForSEO request failed.",
    };
  }

  const taskError = dataForSeoTaskError(data);
  if (taskError) {
    return { ok: false, status: 502, data, error: taskError };
  }

  return { ok: true, status: 200, data, error: null };
}
