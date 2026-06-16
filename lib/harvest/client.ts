import type { HarvestConfig, HarvestUser, HarvestUserAssignment } from "@/lib/harvest/types";

const HARVEST_BASE = "https://api.harvestapp.com/v2";

export async function requestHarvestJson<T>(
  config: HarvestConfig,
  path: string,
  query?: Record<string, string | number | undefined>,
) {
  const url = new URL(path.startsWith("http") ? path : HARVEST_BASE + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  let attempt = 0;
  while (attempt < 3) {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: "Bearer " + config.accessToken,
        "Harvest-Account-Id": config.accountId,
        "User-Agent": config.userAgent,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        "Harvest request failed (" + String(response.status) + ") for " + path + ": " + body,
      );
    }

    return (await response.json()) as T;
  }

  throw new Error("Harvest request failed with retries for " + path);
}

export async function fetchAllHarvestPages<T>(
  config: HarvestConfig,
  path: string,
  query: Record<string, string | number | undefined>,
  collectionKey: string,
) {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const payload = await requestHarvestJson<Record<string, unknown>>(config, path, {
      ...query,
      page,
      per_page: 2000,
    });
    const chunk = payload[collectionKey];
    if (Array.isArray(chunk)) {
      rows.push(...(chunk as T[]));
    }
    totalPages = typeof payload.total_pages === "number" ? payload.total_pages : 1;
    page += 1;
  }

  return rows;
}

export async function fetchHarvestUsersFromAssignments(config: HarvestConfig) {
  const assignments = await fetchAllHarvestPages<HarvestUserAssignment>(
    config,
    "/user_assignments",
    { is_active: "true" },
    "user_assignments",
  );
  return parseHarvestUsersFromAssignments(assignments);
}

export function parseHarvestUsersFromAssignments(
  assignments: HarvestUserAssignment[],
): HarvestUser[] {
  const byId = new Map<number, HarvestUser>();
  for (const assignment of assignments) {
    const userId = assignment.user?.id;
    const userName = assignment.user?.name?.trim();
    if (userId == null || !userName || byId.has(userId)) continue;
    byId.set(userId, harvestUserFromDisplayName(userId, userName));
  }
  return [...byId.values()].sort((left, right) =>
    harvestUserDisplayName(left).localeCompare(harvestUserDisplayName(right)),
  );
}

export function harvestUserFromDisplayName(id: number, displayName: string): HarvestUser {
  const trimmed = displayName.trim();
  const parts = trimmed.split(/\s+/);
  return {
    id,
    display_name: trimmed,
    first_name: parts[0] ?? trimmed,
    last_name: parts.slice(1).join(" "),
    email: "",
    is_active: true,
  };
}

export function harvestUserDisplayName(user: HarvestUser) {
  if (user.display_name?.trim()) return user.display_name.trim();
  return (user.first_name + " " + user.last_name).trim();
}

export function mergeHarvestUsers(...groups: HarvestUser[][]) {
  const byId = new Map<number, HarvestUser>();
  for (const group of groups) {
    for (const user of group) {
      const existing = byId.get(user.id);
      if (!existing) {
        byId.set(user.id, user);
        continue;
      }
      byId.set(user.id, {
        ...existing,
        ...user,
        display_name: user.display_name || existing.display_name,
        email: user.email || existing.email,
      });
    }
  }
  return [...byId.values()].sort((left, right) =>
    harvestUserDisplayName(left).localeCompare(harvestUserDisplayName(right)),
  );
}
