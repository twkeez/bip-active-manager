import { Buffer } from "node:buffer";
import { refreshBasecampToken } from "@/lib/basecamp/auth";
import { getBasecampClassicConfig, getBasecampOAuthConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type BasecampTokenRow = {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_id: string;
  token_type: string;
  scope: string | null;
};

export type BasecampApiProject = {
  id: number;
  name: string;
  status?: string;
};

export type BasecampProjectSummary = {
  id: string;
  name: string;
  status: string | null;
  normalizedName: string;
};

function parseNextLink(linkHeader: string | null) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
  return match?.[1] ?? null;
}

export async function requestBasecampJson<T>(
  accessToken: string,
  accountId: string,
  path: string,
) {
  const url = `https://3.basecampapi.com/${accountId}${path}`;
  let attempt = 0;
  while (attempt < 3) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "BIPClientManager (ops@beyondindigo.com)",
      },
      cache: "no-store",
    });

    if (response.status === 429 && attempt < 2) {
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Basecamp request failed (${response.status}) for ${path}: ${body}`);
    }

    const data = (await response.json()) as T;
    const next = parseNextLink(response.headers.get("link"));
    return { data, next };
  }
  throw new Error(`Basecamp request failed with retries for ${path}`);
}

export async function fetchPaginated<T>(
  accessToken: string,
  accountId: string,
  path: string,
) {
  let nextPath: string | null = path;
  const rows: T[] = [];
  while (nextPath) {
    const currentPath: string = nextPath;
    const cleanPath: string = currentPath.startsWith("http")
      ? currentPath.replace(`https://3.basecampapi.com/${accountId}`, "")
      : currentPath;
    const page = await requestBasecampJson<T[]>(accessToken, accountId, cleanPath);
    rows.push(...page.data);
    nextPath = page.next;
  }
  return rows;
}

export async function fetchPaginatedRecent<T>(
  accessToken: string,
  accountId: string,
  path: string,
  isRecent: (row: T) => boolean,
) {
  let nextPath: string | null = path;
  const rows: T[] = [];
  let hitOldRow = false;
  while (nextPath && !hitOldRow) {
    const currentPath: string = nextPath;
    const cleanPath: string = currentPath.startsWith("http")
      ? currentPath.replace(`https://3.basecampapi.com/${accountId}`, "")
      : currentPath;
    const page = await requestBasecampJson<T[]>(accessToken, accountId, cleanPath);
    for (const row of page.data) {
      if (!isRecent(row)) {
        hitOldRow = true;
        break;
      }
      rows.push(row);
    }
    nextPath = hitOldRow ? null : page.next;
  }
  return rows;
}

export async function getActiveBasecampToken(admin: AdminClient) {
  const { data, error } = await admin
    .from("basecamp_oauth_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle<BasecampTokenRow>();
  if (error) throw new Error(`Failed to load Basecamp token: ${error.message}`);
  if (!data) throw new Error("Basecamp is not connected yet.");

  const expiresAt = new Date(data.expires_at).getTime();
  const shouldRefresh = Number.isNaN(expiresAt) || expiresAt - Date.now() < 5 * 60 * 1000;
  if (!shouldRefresh) return data;

  const refreshed = await refreshBasecampToken(data.refresh_token);
  const { data: updated, error: upsertError } = await admin
    .from("basecamp_oauth_tokens")
    .upsert({
      id: 1,
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      expires_at: refreshed.expiresAt,
      token_type: refreshed.tokenType,
      scope: refreshed.scope,
      account_id: data.account_id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single<BasecampTokenRow>();
  if (upsertError) {
    throw new Error(`Failed to refresh Basecamp token: ${upsertError.message}`);
  }
  return updated;
}

function trimProjectId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

export async function fetchAllBasecampProjects(
  accessToken: string,
  accountId: string,
  normalizeName: (value: string) => string,
): Promise<BasecampProjectSummary[]> {
  const rows = await fetchPaginated<BasecampApiProject>(
    accessToken,
    accountId,
    "/projects.json",
  );
  const projects: BasecampProjectSummary[] = [];
  for (const row of rows) {
    const id = trimProjectId(row.id);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) continue;
    projects.push({
      id,
      name,
      status: typeof row.status === "string" ? row.status : null,
      normalizedName: normalizeName(name),
    });
  }
  return projects;
}

function buildClassicAuthHeaders() {
  const config = getBasecampClassicConfig();
  const authorization = config.token
    ? `Bearer ${config.token}`
    : `Basic ${Buffer.from(
        `${config.basicUser}:${config.basicPassword}`,
        "utf8",
      ).toString("base64")}`;
  return {
    accountId: config.accountId,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "User-Agent": "BIPClientManager (ops@beyondindigo.com)",
    },
  };
}

type ClassicApiProject = {
  id?: number | string;
  name?: string;
  status?: string;
  archived?: boolean;
};

const CLASSIC_PROJECTS_MAX_PAGES = 50;
const CLASSIC_FETCH_TIMEOUT_MS = 30_000;

export async function fetchAllClassicBasecampProjects(
  normalizeName: (value: string) => string,
): Promise<BasecampProjectSummary[]> {
  const { accountId, headers } = buildClassicAuthHeaders();
  const projects: BasecampProjectSummary[] = [];
  let page = 1;
  let hasMore = true;
  let previousPageFirstId: string | null = null;

  while (hasMore) {

    if (page > CLASSIC_PROJECTS_MAX_PAGES) {
      break;
    }

    const url = `https://basecamp.com/${accountId}/api/v1/projects.json?page=${page}`;
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(CLASSIC_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Basecamp classic projects failed (${response.status}): ${body}`,
      );
    }
    const rows = (await response.json()) as ClassicApiProject[];
    if (!Array.isArray(rows) || rows.length === 0) {
      hasMore = false;
      break;
    }

    const pageFirstId = trimProjectId(rows[0]?.id);
    if (pageFirstId && pageFirstId === previousPageFirstId) {
      break;
    }
    previousPageFirstId = pageFirstId;

    for (const row of rows) {
      const id = trimProjectId(row.id);
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name) continue;
      projects.push({
        id,
        name,
        status:
          typeof row.status === "string"
            ? row.status
            : row.archived
              ? "archived"
              : "active",
        normalizedName: normalizeName(name),
      });
    }

    page += 1;
    hasMore = rows.length >= 25;
  }

  return projects;
}

export type BasecampProjectLoadMode = "oauth" | "classic";

function isOAuthConfigured() {
  try {
    getBasecampOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

export async function loadBasecampProjectsForMatch(
  normalizeName: (value: string) => string,
) {
  const oauthConfigured = isOAuthConfigured();

  if (oauthConfigured) {
    const admin = createAdminClient();
    try {
      const token = await getActiveBasecampToken(admin);
      const projects = await fetchAllBasecampProjects(
        token.access_token,
        token.account_id,
        normalizeName,
      );
      return { mode: "oauth" as const, projects };
    } catch (oauthError) {
      const oauthMessage =
        oauthError instanceof Error ? oauthError.message : "oauth_failed";
    }
  }

  try {
    const projects = await fetchAllClassicBasecampProjects(normalizeName);
    return { mode: "classic" as const, projects };
  } catch (classicError) {
    const classicMessage =
      classicError instanceof Error ? classicError.message : "classic_failed";
    throw new Error(classicMessage);
  }
}
