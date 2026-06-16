import {
  DATAFORSEO_ENDPOINTS,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  cleanDomain,
  extractTaskResult,
  extractTaskResultItems,
  postDataForSeoLive,
} from "@/lib/dataforseo/client";
import { formatKeywordGapItems } from "@/lib/dataforseo/keyword-gap";
import type {
  BlogIdeaRow,
  CompetitorRow,
  DataForSeoRequestBody,
  KeywordGapRow,
  LocalRankRow,
} from "@/lib/dataforseo/types";

type Credentials = { login: string; password: string };

type ActionResult =
  | { ok: true; action: string; keywords?: KeywordGapRow[]; ideas?: BlogIdeaRow[]; results?: LocalRankRow[]; competitors?: CompetitorRow[]; matchedRank?: number | null }
  | { ok: false; status: number; error: string };

import {
  businessMatchesTitle,
  formatLocationName,
} from "@/lib/dataforseo/domain-discovery";

export async function runBlogIdeasAction(
  creds: Credentials,
  body: DataForSeoRequestBody,
): Promise<ActionResult> {
  const seedKeyword = body.seedKeyword?.trim();
  if (!seedKeyword) {
    return { ok: false, status: 400, error: "A seed keyword is required." };
  }

  const [ideasResponse, paaResponse] = await Promise.all([
    postDataForSeoLive(DATAFORSEO_ENDPOINTS.keywordIdeas, creds.login, creds.password, [
      {
        keywords: [seedKeyword],
        location_code: DEFAULT_LOCATION_CODE,
        language_code: DEFAULT_LANGUAGE_CODE,
        include_serp_info: true,
        limit: 50,
      },
    ]),
    postDataForSeoLive(DATAFORSEO_ENDPOINTS.serpOrganicAdvanced, creds.login, creds.password, [
      {
        keyword: seedKeyword,
        location_code: DEFAULT_LOCATION_CODE,
        language_code: DEFAULT_LANGUAGE_CODE,
        people_also_ask_click_depth: 2,
        depth: 20,
      },
    ]),
  ]);

  if (!ideasResponse.ok) {
    return { ok: false, status: ideasResponse.status, error: ideasResponse.error ?? "Failed to load keyword ideas." };
  }

  const ideaItems = extractTaskResultItems(ideasResponse.data);
  const ideas: BlogIdeaRow[] = ideaItems.map((raw, idx) => {
    const item = raw as {
      keyword?: string;
      keyword_data?: {
        keyword?: string;
        keyword_info?: { search_volume?: number | null };
        serp_info?: { keyword_difficulty?: number | null };
      };
    };
    const keyword = item.keyword ?? item.keyword_data?.keyword ?? "";
    const difficulty = item.keyword_data?.serp_info?.keyword_difficulty;
    return {
      id: idx,
      question: keyword,
      source: "keyword_idea" as const,
      volume: item.keyword_data?.keyword_info?.search_volume ?? null,
      difficulty: difficulty != null ? `${difficulty}%` : null,
    };
  });

  if (paaResponse.ok) {
    const paaResult = extractTaskResult(paaResponse.data) as { items?: unknown[] } | null;
    const paaItems = paaResult?.items ?? [];
    let paaId = ideas.length;

    for (const raw of paaItems) {
      const element = raw as {
        type?: string;
        items?: Array<{ title?: string; expanded_element?: Array<{ title?: string }> }>;
      };
      if (element.type !== "people_also_ask") continue;

      for (const question of element.items ?? []) {
        const text = question.title?.trim();
        if (!text) continue;
        ideas.push({
          id: paaId,
          question: text,
          source: "people_also_ask",
          volume: null,
          difficulty: null,
        });
        paaId += 1;
      }
    }
  }

  return { ok: true, action: "blog_ideas", ideas };
}

export async function runLocalRankAction(
  creds: Credentials,
  body: DataForSeoRequestBody,
): Promise<ActionResult> {
  const businessName = body.businessName?.trim();
  const city = body.city?.trim();
  if (!businessName || !city) {
    return { ok: false, status: 400, error: "Business name and city are required." };
  }

  const keyword = `${businessName} ${city}`;
  const locationName = formatLocationName(city);

  const response = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.localPackAdvanced,
    creds.login,
    creds.password,
    [
      {
        keyword,
        location_name: locationName,
        language_code: DEFAULT_LANGUAGE_CODE,
        depth: 20,
      },
    ],
  );

  if (!response.ok) {
    return { ok: false, status: response.status, error: response.error ?? "Failed to load local rankings." };
  }

  const result = extractTaskResult(response.data) as {
    items?: unknown[];
    target_rankings?: Array<{ rank_absolute?: number }>;
  } | null;

  const packItems = (result?.items ?? []).filter(
    (raw) => (raw as { type?: string }).type === "local_pack",
  );

  const results: LocalRankRow[] = packItems.map((raw, idx) => {
    const item = raw as {
      rank_absolute?: number;
      title?: string;
      domain?: string | null;
      phone?: string | null;
    };
    const title = item.title ?? "Unknown listing";
    return {
      id: idx,
      rank: item.rank_absolute ?? idx + 1,
      title,
      domain: item.domain ?? null,
      phone: item.phone ?? null,
      isMatch: businessMatchesTitle(businessName, title),
    };
  });

  const matched = results.find((row) => row.isMatch);

  return {
    ok: true,
    action: "local_rank",
    results,
    matchedRank: matched?.rank ?? result?.target_rankings?.[0]?.rank_absolute ?? null,
  };
}

export async function runCompetitorLookupAction(
  creds: Credentials,
  body: DataForSeoRequestBody,
): Promise<ActionResult> {
  const domainRaw = body.targetDomain ?? body.clientDomain;
  const targetDomain = cleanDomain(domainRaw ?? "");
  if (!targetDomain) {
    return { ok: false, status: 400, error: "A target domain is required." };
  }

  const response = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.competitorsDomain,
    creds.login,
    creds.password,
    [
      {
        target: targetDomain,
        location_code: DEFAULT_LOCATION_CODE,
        language_code: DEFAULT_LANGUAGE_CODE,
        exclude_top_domains: true,
        limit: 25,
      },
    ],
  );

  if (!response.ok) {
    return { ok: false, status: response.status, error: response.error ?? "Failed to load competitors." };
  }

  const items = extractTaskResultItems(response.data);
  const competitors: CompetitorRow[] = items
    .map((raw, idx) => {
      const item = raw as {
        domain?: string;
        avg_position?: number;
        intersections?: number;
        full_domain_metrics?: { organic?: { count?: number; etv?: number } };
      };
      return {
        id: idx,
        domain: item.domain ?? "",
        avgPosition: item.avg_position ?? 0,
        intersections: item.intersections ?? 0,
        organicKeywords: item.full_domain_metrics?.organic?.count ?? 0,
        estimatedTraffic: item.full_domain_metrics?.organic?.etv ?? 0,
      };
    })
    .filter((row) => row.domain && row.domain !== targetDomain);

  return { ok: true, action: "competitor_lookup", competitors };
}

export async function runKeywordGapAction(
  creds: Credentials,
  body: DataForSeoRequestBody,
): Promise<ActionResult> {
  const clientDomainRaw = body.clientDomain?.trim();
  const competitorDomainRaw = body.competitorDomain?.trim();
  if (!clientDomainRaw || !competitorDomainRaw) {
    return { ok: false, status: 400, error: "Both domains are required." };
  }

  const clientDomain = cleanDomain(clientDomainRaw);
  const competitorDomain = cleanDomain(competitorDomainRaw);
  if (!clientDomain || !competitorDomain) {
    return { ok: false, status: 400, error: "Enter valid domains." };
  }

  const response = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.domainIntersection,
    creds.login,
    creds.password,
    [
      {
        target1: clientDomain,
        target2: competitorDomain,
        location_code: DEFAULT_LOCATION_CODE,
        language_code: DEFAULT_LANGUAGE_CODE,
        limit: 100,
      },
    ],
  );

  if (!response.ok) {
    return { ok: false, status: response.status, error: response.error ?? "Failed to load keyword gap data." };
  }

  const rawItems = extractTaskResultItems(response.data);
  const keywords = formatKeywordGapItems(rawItems, clientDomain, competitorDomain);

  return { ok: true, action: "keyword_gap", keywords };
}

export async function runDataForSeoAction(
  creds: Credentials,
  body: DataForSeoRequestBody,
): Promise<ActionResult> {
  switch (body.action ?? "keyword_gap") {
    case "blog_ideas":
      return runBlogIdeasAction(creds, body);
    case "local_rank":
      return runLocalRankAction(creds, body);
    case "competitor_lookup":
      return runCompetitorLookupAction(creds, body);
    case "keyword_gap":
    default:
      return runKeywordGapAction(creds, body);
  }
}
