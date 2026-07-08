import type { SocialDailySnapshot } from "@/lib/types/client";

export type SocialPlatform = "facebook" | "instagram";

export type PlatformSocial = {
  platform: SocialPlatform;
  // reach: null means "not available" (Facebook page reach is deprecated by Meta).
  reach: number | null;
  impressions: number | null;
  engagement: number;
  linkClicks: number;
  newFollowers: number;
};

const PLATFORM_ORDER: SocialPlatform[] = ["facebook", "instagram"];

// Builds correct per-platform social metrics from the daily snapshots. The two
// platforms store different things in the same fields, so each metric is
// computed per platform rather than summed across them:
//   - New followers: Facebook `follows` is a cumulative total → last − first;
//     Instagram `follows` is daily-new → sum.
//   - Reach: Instagram uses the stored de-duplicated period reach; Facebook is
//     unavailable from Meta's API → null ("not available").
//   - Engagement / link clicks / impressions: summed daily, per platform.
export function buildSocialByPlatform(
  rows: SocialDailySnapshot[],
  periodReach: Array<{ platform: string; reach: number }>,
  windowDays = 30,
): PlatformSocial[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const windowed = rows.filter((r) => new Date(r.snapshot_date).getTime() >= cutoff);

  const result: PlatformSocial[] = [];
  for (const platform of PLATFORM_ORDER) {
    const prows = windowed
      .filter((r) => r.platform === platform)
      .sort((a, b) => (a.snapshot_date < b.snapshot_date ? -1 : 1));
    if (prows.length === 0) continue;

    const engagement = prows.reduce((s, r) => s + (r.engagement ?? 0), 0);
    const linkClicks = prows.reduce((s, r) => s + (r.link_clicks ?? 0), 0);

    const imprRows = prows.filter((r) => r.impressions != null);
    const impressions = imprRows.length > 0 ? imprRows.reduce((s, r) => s + (r.impressions ?? 0), 0) : null;

    const followRows = prows.filter((r) => r.follows != null);
    let newFollowers = 0;
    if (followRows.length > 0) {
      newFollowers =
        platform === "facebook"
          ? (followRows[followRows.length - 1].follows ?? 0) - (followRows[0].follows ?? 0)
          : followRows.reduce((s, r) => s + (r.follows ?? 0), 0);
    }

    let reach: number | null = null;
    if (platform === "instagram") {
      const stored = periodReach.find((p) => p.platform === "instagram")?.reach;
      // Prefer the de-duplicated period reach; fall back to the daily sum until a
      // re-sync populates it (still better than nothing for Instagram).
      const dailyReachRows = prows.filter((r) => r.reach != null);
      reach = stored ?? (dailyReachRows.length > 0 ? dailyReachRows.reduce((s, r) => s + (r.reach ?? 0), 0) : null);
    }

    const hasData =
      reach != null || impressions != null || engagement > 0 || linkClicks > 0 || newFollowers !== 0;
    if (!hasData) continue;

    result.push({ platform, reach, impressions, engagement, linkClicks, newFollowers });
  }
  return result;
}
