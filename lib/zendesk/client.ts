import { getZendeskConfig } from "@/lib/env";

/**
 * A thin Zendesk API client: auth, and waiting out rate limits.
 *
 * The incremental exports allow 10 requests a minute (tickets) or 20 (users),
 * so a 429 is routine during a backfill rather than an error. Each call is
 * given a deadline; if Zendesk asks us to wait past it, the call says so
 * instead of sleeping through the function's time limit, and the sync stops
 * cleanly with its cursor saved.
 */

export class ZendeskNotConfiguredError extends Error {
  constructor() {
    super(
      "Zendesk is not configured. Set ZENDESK_EMAIL and ZENDESK_API_TOKEN (a Zendesk admin's) or ZENDESK_OAUTH_TOKEN in the Vercel environment.",
    );
  }
}

/** Zendesk wants us to wait longer than the time this run has left. */
export class ZendeskRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Zendesk rate limit: asked to wait ${retryAfterSeconds}s.`);
  }
}

export function zendeskBaseUrl(subdomain: string) {
  return `https://${subdomain}.zendesk.com`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a Zendesk API path (or a full URL Zendesk handed back) as JSON.
 * `deadline` is a Date.now() value the call must not wait past.
 */
export async function zendeskGet<T>(pathOrUrl: string, deadline: number): Promise<T> {
  const config = getZendeskConfig();
  if (!config) throw new ZendeskNotConfiguredError();

  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${zendeskBaseUrl(config.subdomain)}${pathOrUrl}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: config.authorization, Accept: "application/json" },
      cache: "no-store",
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after")) || 60;
      if (Date.now() + retryAfter * 1000 > deadline) {
        throw new ZendeskRateLimitedError(retryAfter);
      }
      await sleep(retryAfter * 1000);
      continue;
    }

    if (response.status === 401) {
      throw new Error(
        "Zendesk rejected the credentials (401). Check ZENDESK_EMAIL / ZENDESK_API_TOKEN, and that API token access is turned on in Zendesk Admin Center.",
      );
    }
    if (response.status === 403) {
      throw new Error(
        "Zendesk refused access (403). The incremental exports are admin-only — the credentials must belong to a Zendesk admin.",
      );
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Zendesk ${response.status} for ${new URL(url).pathname}: ${body.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }
  throw new Error(`Zendesk kept rate-limiting ${new URL(url).pathname}; try again in a few minutes.`);
}
