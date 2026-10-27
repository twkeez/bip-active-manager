import { DATAFORSEO_ENDPOINTS, postDataForSeoLive } from "@/lib/dataforseo/client";
import { getDataForSeoConfig } from "@/lib/env";
import { US_STATES } from "@/lib/onboarding/research-location";
import { bareDomain } from "@/lib/website-audit/crawl";
import { AI_PLATFORMS, PLATFORM_LABEL } from "@/lib/website-audit/platforms";
import platformConfig from "@/lib/website-audit/config/platforms.json";
import promptConfig from "@/lib/website-audit/config/prompts.json";
import type {
  AiPlatform,
  AiPrompt,
  AiVisibilityResults,
  MentionsDatabase,
  PlatformSummary,
  PromptRun,
  TechnicalCrawl,
} from "@/lib/website-audit/types";

// Section 1: how AI search sees the practice. Two different measurements,
// kept apart in the results and the report:
//  - the LLM Mentions database: answers DataForSEO has observed citing or
//    naming the practice (Google AI Overview and ChatGPT, US), and
//  - our fixed prompt set, asked today of six platforms in the practice's area.
// The step can be run again: it only asks prompts that have no answer yet.

const FEATURE = "Website audit: AI visibility";
const BASE = "https://api.dataforseo.com/v3";
const ENDPOINTS = {
  aiMode: `${BASE}/serp/google/ai_mode/live/advanced`,
  scraper: (platform: "chat_gpt" | "gemini") => `${BASE}/ai_optimization/${platform}/llm_scraper/live/advanced`,
  responses: (platform: string) => `${BASE}/ai_optimization/${platform}/llm_responses/live`,
  mentionsTarget: `${BASE}/ai_optimization/llm_mentions/target_metrics/live`,
  mentionsSearch: `${BASE}/ai_optimization/llm_mentions/search_mentions/live`,
};
const API_PLATFORM: Record<"chatgpt" | "gemini" | "claude" | "perplexity", string> = {
  chatgpt: "chat_gpt",
  gemini: "gemini",
  claude: "claude",
  perplexity: "perplexity",
};
/** Calls in flight at once, across all platforms (DataForSEO allows 30 per platform). */
const CONCURRENCY = 16;
const EXCERPT = 700;

export type AiProfile = "consumer" | "economy";

type Practice = { domain: string; practiceName: string; city: string | null; state: string | null };

function stateName(state: string | null): string {
  const code = (state ?? "").trim().toUpperCase();
  return US_STATES[code] ?? (state ?? "").trim();
}

/** Service names from the site's own service pages: "Skin & Allergy Care" from its title, else the address. */
export function servicesFromCrawl(crawl: TechnicalCrawl | undefined): string[] {
  if (!crawl) return [];
  const seen = new Map<string, string>();
  for (const page of crawl.pages) {
    if (page.finalStatus !== 200 || page.softError) continue;
    const path = new URL(page.finalUrl).pathname;
    const match = /\/services?\/([^/]+?)(?:\.html?)?\/?$/i.exec(path);
    if (!match) continue;
    const fromTitle = page.title?.split(/\s[|–—-]\s/)[0]?.trim();
    const fromSlug = match[1].replace(/[-_]+/g, " ").trim();
    // "Pet Wellness in Power Springs, GA" → "pet wellness": the prompts add the town themselves.
    const cleanTitle = fromTitle?.replace(/\s+(in|near|at|for)\s+[^,]+(,\s*[a-z]{2})?$/i, "").trim();
    const name = (cleanTitle && cleanTitle.length <= 40 ? cleanTitle : fromSlug).toLowerCase();
    const key = match[1].toLowerCase();
    if (!seen.has(key) && name) seen.set(key, name);
  }
  return [...seen.values()];
}

/** The fixed prompt set, from config/prompts.json. */
export function buildPrompts(practice: Practice, services: string[]): AiPrompt[] {
  const city = practice.city?.trim() || "";
  const fill = (template: string, service = "") =>
    template
      .replace(/\{city\}/g, city)
      .replace(/\{state\}/g, stateName(practice.state))
      .replace(/\{st\}/g, (practice.state ?? "").trim().toUpperCase())
      .replace(/\{practice\}/g, practice.practiceName)
      .replace(/\{service\}/g, service)
      .replace(/\s+/g, " ")
      .trim();
  const prompts: AiPrompt[] = [];
  const add = (kind: AiPrompt["kind"], text: string) => {
    if (text && !prompts.some((p) => p.text === text)) prompts.push({ id: `p${prompts.length + 1}`, kind, text });
  };
  for (const t of promptConfig.local) add("local", fill(t));
  for (const service of services.slice(0, promptConfig.maxServices)) for (const t of promptConfig.service) add("service", fill(t, service));
  for (const t of promptConfig.informational) add("informational", fill(t));
  return prompts;
}

/** Ways the practice could be named in an answer: the full name, and its distinctive part ("Dallas Highway"). */
export function nameVariants(practiceName: string): string[] {
  const full = practiceName.trim().toLowerCase();
  const core = full
    .replace(/\b(the|animal|hospital|veterinary|vet|clinic|center|centre|pet|pets|care|of|and|&)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([full, core.length >= 6 ? core : ""].filter(Boolean))];
}

export function isMentioned(text: string, practiceName: string): boolean {
  const haystack = text.toLowerCase();
  return nameVariants(practiceName).some((name) => haystack.includes(name));
}

/** Every cited URL in an answer: references, sources and annotations (not the raw search results). */
export function citedUrls(value: unknown, out: string[] = [], key = ""): string[] {
  if (["search_results", "check_url", "images", "fan_out_queries"].includes(key)) return out;
  if (Array.isArray(value)) {
    for (const item of value) citedUrls(item, out, key);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string" && /^(references|sources|annotations|links)$/.test(key)) out.push(record.url);
    for (const [k, v] of Object.entries(record)) citedUrls(v, out, k);
  }
  return out;
}

/** The answer's text: markdown where given, else the text sections. */
function answerText(result: Record<string, unknown> | null | undefined): string {
  if (!result) return "";
  if (typeof result.markdown === "string") return result.markdown;
  const parts: string[] = [];
  const walk = (value: unknown, key = "") => {
    if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
    else if (typeof value === "string" && (key === "text" || key === "markdown")) parts.push(value);
  };
  walk(result.items);
  return parts.join("\n");
}

type CallResult = { answered: boolean; text: string; urls: string[]; model: string | null; error: string | null; cost: number };

async function call(url: string, body: Record<string, unknown>): Promise<{ result: Record<string, unknown> | null; error: string | null; cost: number }> {
  const config = getDataForSeoConfig();
  if (!config) return { result: null, error: "DataForSEO isn't configured.", cost: 0 };
  const res = await postDataForSeoLive(url, config.login, config.password, [body], FEATURE);
  const data = res.data as { tasks?: { result?: Record<string, unknown>[] | null }[] } | null;
  return { result: data?.tasks?.[0]?.result?.[0] ?? null, error: res.ok ? null : res.error, cost: res.cost };
}

async function askPlatform(platform: AiPlatform, prompt: string, location: { serp: string; profile: AiProfile }): Promise<CallResult> {
  if (platform === "ai_overview" || platform === "ai_mode") {
    const { result, error, cost } =
      platform === "ai_overview"
        ? await call(DATAFORSEO_ENDPOINTS.serpOrganicAdvanced, {
            keyword: prompt,
            location_name: location.serp,
            language_code: "en",
            load_async_ai_overview: true,
          })
        : await call(ENDPOINTS.aiMode, { keyword: prompt, location_name: location.serp, language_code: "en" });
    const overview = ((result?.items as Record<string, unknown>[] | undefined) ?? []).find((i) => i.type === "ai_overview");
    return {
      answered: Boolean(overview),
      text: overview ? answerText(overview) : "",
      urls: overview ? citedUrls(overview) : [],
      model: null,
      error,
      cost,
    };
  }
  const choice = (platformConfig[location.profile] as Record<string, { method: string; model?: string }>)[platform];
  const apiName = API_PLATFORM[platform];
  const { result, error, cost } =
    choice.method === "scraper"
      ? await call(ENDPOINTS.scraper(apiName as "chat_gpt" | "gemini"), {
          keyword: prompt,
          location_code: 2840,
          language_code: "en",
          // Gemini's scraper rejects this option; Gemini searches on its own.
          ...(apiName === "chat_gpt" ? { force_web_search: true } : {}),
        })
      : await call(ENDPOINTS.responses(apiName), {
          user_prompt: prompt,
          model_name: choice.model,
          ...(platform === "perplexity" ? { web_search_country_iso_code: "US" } : { web_search: true }),
          max_output_tokens: 2048,
        });
  return {
    answered: Boolean(result),
    text: answerText(result),
    urls: citedUrls(result),
    model: (result?.model_name as string | undefined) ?? (result?.model as string | undefined) ?? choice.model ?? null,
    error,
    cost,
  };
}

/** What DataForSEO's LLM Mentions database has observed (past ~90 days, US, Google AI Overview + ChatGPT). */
async function mentionsDatabase(practice: Practice): Promise<{ db: MentionsDatabase; cost: number }> {
  const domain = bareDomain(practice.domain);
  let cost = 0;
  const totals = async (target: Record<string, unknown>) => {
    const r = await call(ENDPOINTS.mentionsTarget, { target: [target], location_code: 2840, language_code: "en" });
    cost += r.cost;
    const metrics = r.result?.aggregated_metrics as
      | { total?: { mentions?: number; ai_search_volume?: number }; platform?: { key?: string; mentions?: number }[] }
      | undefined;
    return {
      mentions: metrics?.total?.mentions ?? 0,
      aiSearchVolume: metrics?.total?.ai_search_volume ?? 0,
      byPlatform: Object.fromEntries((metrics?.platform ?? []).map((p) => [p.key ?? "?", p.mentions ?? 0])),
      error: r.error,
    };
  };
  const [asSource, byName] = await Promise.all([totals({ domain, search_scope: ["sources"] }), totals({ keyword: practice.practiceName })]);
  const search = await call(ENDPOINTS.mentionsSearch, {
    target: [{ domain, search_scope: ["sources"] }],
    location_code: 2840,
    language_code: "en",
    order_by: ["ai_search_volume,desc"],
    limit: 25,
  });
  cost += search.cost;
  const items = (search.result?.items as Record<string, unknown>[] | undefined) ?? [];
  return {
    cost,
    db: {
      window: "About the last 90 days, United States, English (DataForSEO LLM Mentions)",
      citedAsSource: asSource,
      namedInAnswers: byName,
      examples: items.map((item) => ({
        platform: String(item.platform ?? ""),
        question: String(item.question ?? ""),
        answerExcerpt: String(item.answer ?? "").slice(0, EXCERPT),
        citedUrl: (citedUrls(item).find((u) => bareDomain(new URL(u).host) === domain) ?? null) as string | null,
        aiSearchVolume: typeof item.ai_search_volume === "number" ? item.ai_search_volume : null,
      })),
      error: asSource.error ?? byName.error ?? search.error,
    },
  };
}

export function summarizePlatforms(runs: PromptRun[], promptCount: number, models: Partial<Record<AiPlatform, string>>): PlatformSummary[] {
  return AI_PLATFORMS.map((platform) => {
    const mine = runs.filter((r) => r.platform === platform && !r.error);
    return {
      platform,
      label: PLATFORM_LABEL[platform],
      model: models[platform] ?? null,
      promptsRun: mine.length,
      promptsPlanned: promptCount,
      promptsAnswered: mine.filter((r) => r.answered).length,
      promptsCited: mine.filter((r) => r.cited).length,
      promptsMentioned: mine.filter((r) => r.mentioned).length,
      citations: mine.reduce((sum, r) => sum + r.ownCitations, 0),
    };
  });
}

/** Runs (or finishes) the AI visibility step within `budgetMs`. */
export async function checkAiVisibility(
  practice: Practice,
  crawl: TechnicalCrawl | undefined,
  previous: AiVisibilityResults | undefined,
  options: { profile?: AiProfile; budgetMs?: number } = {},
): Promise<AiVisibilityResults> {
  const started = Date.now();
  const profile = options.profile ?? previous?.profile ?? "consumer";
  const budgetMs = options.budgetMs ?? 230_000;
  const domain = bareDomain(practice.domain);
  const serpLocation = [practice.city?.trim(), stateName(practice.state), "United States"].filter(Boolean).join(",");

  const prompts = previous?.prompts ?? buildPrompts(practice, servicesFromCrawl(crawl));
  const runs: PromptRun[] = (previous?.runs ?? []).filter((r) => !r.error);
  let cost = previous?.costUsd ?? 0;

  let mentions = previous?.mentions;
  if (!mentions || mentions.error) {
    const m = await mentionsDatabase(practice);
    mentions = m.db;
    cost += m.cost;
  }

  const done = new Set(runs.map((r) => `${r.platform}|${r.promptId}`));
  const queue = AI_PLATFORMS.flatMap((platform) => prompts.map((prompt) => ({ platform, prompt }))).filter(
    (job) => !done.has(`${job.platform}|${job.prompt.id}`),
  );
  const models: Partial<Record<AiPlatform, string>> = { ...(previous?.models ?? {}) };
  let next = 0;
  async function worker() {
    while (next < queue.length && Date.now() - started < budgetMs) {
      const job = queue[next];
      next += 1;
      const answer = await askPlatform(job.platform, job.prompt.text, { serp: serpLocation, profile });
      cost += answer.cost;
      if (answer.model) models[job.platform] = answer.model;
      const domains = [...new Set(answer.urls.map((u) => { try { return bareDomain(new URL(u).host); } catch { return ""; } }).filter(Boolean))];
      const own = answer.urls.filter((u) => { try { return bareDomain(new URL(u).host) === domain; } catch { return false; } });
      runs.push({
        promptId: job.prompt.id,
        platform: job.platform,
        answered: answer.answered,
        cited: own.length > 0,
        ownCitations: own.length,
        ownUrls: [...new Set(own)],
        mentioned: isMentioned(answer.text, practice.practiceName),
        citedDomains: domains,
        answerExcerpt: answer.text.slice(0, EXCERPT),
        error: answer.error,
      });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const okRuns = runs.filter((r) => !r.error);
  const missing = AI_PLATFORMS.length * prompts.length - okRuns.length;
  const otherDomains = new Map<string, number>();
  for (const r of okRuns) for (const d of r.citedDomains) if (d !== domain) otherDomains.set(d, (otherDomains.get(d) ?? 0) + 1);

  for (const platform of ["ai_overview", "ai_mode"] as const) models[platform] = `Google results for ${serpLocation}`;
  return {
    ranAt: new Date().toISOString(),
    profile,
    location: serpLocation,
    prompts,
    runs,
    models,
    platforms: summarizePlatforms(okRuns, prompts.length, models),
    mentions,
    topCitedDomains: [...otherDomains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([d, n]) => ({ domain: d, answers: n })),
    complete: missing === 0,
    missing,
    errors: [...new Set(runs.filter((r) => r.error).map((r) => `${PLATFORM_LABEL[r.platform]}: ${r.error}`))].slice(0, 10),
    costUsd: Number(cost.toFixed(4)),
  };
}
