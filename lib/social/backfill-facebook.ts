import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFacebookPosts, listMetaPagesWithTokens } from "@/lib/social/meta";
import { getMetaAccessTokenForSync } from "@/lib/social/token-manager";

/**
 * Re-reading Facebook post history now that the metrics work.
 *
 * The regular sync only looks at the most recent 25 posts, so fixing the
 * fetcher fixes the future and leaves 3,147 rows of blank history behind.
 * Meta still serves reactions, comments, shares and clicks for old posts, so
 * the history is recoverable — it was never that the numbers did not exist,
 * only that we asked for them with two retired metric names attached.
 *
 * Existing rows are updated in place by (client_id, platform, post_id); nothing
 * is deleted and captions already stored are simply rewritten with the same
 * text.
 */

export type BackfillPageResult = {
  clientId: number;
  accountName: string;
  pagesWalked: number;
  postsSeen: number;
  postsWithEngagement: number;
  error?: string;
};

export type BackfillSummary = {
  connections: number;
  matchedPages: number;
  postsUpdated: number;
  results: BackfillPageResult[];
};

/** Meta pages the history request walks before stopping, at 100 posts each. */
export const MAX_HISTORY_PAGES = 12;
const CONCURRENCY = 3;

/**
 * Meta answers "Please reduce the amount of data you're asking for" on busy
 * pages rather than serving a smaller result, and it is about the size of the
 * response, not a rate limit. Twenty of 103 pages hit it at 100 posts a
 * request on the first run, so a refusal halves the page size and tries again
 * instead of abandoning that practice's history.
 */
function isTooMuchDataError(error: unknown) {
  return (
    error instanceof Error &&
    /reduce the amount of data|unknown error occurred/i.test(error.message)
  );
}

const MIN_PAGE_SIZE = 12;

export async function backfillFacebookPostMetrics(
  admin: SupabaseClient,
  { maxPages = MAX_HISTORY_PAGES }: { maxPages?: number } = {},
): Promise<BackfillSummary> {
  const { accessToken } = await getMetaAccessTokenForSync(admin);
  const pages = await listMetaPagesWithTokens(accessToken);
  const pageById = new Map(pages.map((page) => [page.id, page]));

  const { data: connections, error } = await admin
    .from("client_social_connections")
    .select("client_id, page_id, account_name, id")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const rows = (connections ?? []).filter((row) => row.page_id && pageById.has(row.page_id as string));

  const results: BackfillPageResult[] = [];
  let postsUpdated = 0;

  for (let index = 0; index < rows.length; index += CONCURRENCY) {
    const batch = rows.slice(index, index + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (row): Promise<BackfillPageResult> => {
        const clientId = row.client_id as number;
        const accountName = (row.account_name as string) ?? String(clientId);
        const page = pageById.get(row.page_id as string)!;
        const result: BackfillPageResult = {
          clientId,
          accountName,
          pagesWalked: 0,
          postsSeen: 0,
          postsWithEngagement: 0,
        };
        if (!page.accessToken) {
          result.error = "No page access token";
          return result;
        }

        let cursor: string | undefined;
        try {
          let pageSize = 100;
          for (let walked = 0; walked < maxPages; walked += 1) {
            let batchPosts;
            for (;;) {
              try {
                batchPosts = await fetchFacebookPosts(page.id, page.accessToken, {
                  limit: pageSize,
                  after: cursor,
                });
                break;
              } catch (fetchError) {
                if (!isTooMuchDataError(fetchError) || pageSize <= MIN_PAGE_SIZE) throw fetchError;
                pageSize = Math.max(MIN_PAGE_SIZE, Math.floor(pageSize / 2));
              }
            }
            result.pagesWalked += 1;
            if (batchPosts.posts.length === 0) break;

            const payload = batchPosts.posts.map((post) => ({
              client_id: clientId,
              connection_id: row.id as number,
              platform: "facebook" as const,
              post_id: post.post_id,
              media_type: post.media_type,
              permalink: post.permalink,
              caption: post.caption,
              published_at: post.published_at,
              reach: post.reach,
              impressions: post.impressions,
              engagement: post.engagement,
              comments: post.comments,
              saves: post.saves,
              shares: post.shares,
              link_clicks: post.link_clicks,
              updated_at: new Date().toISOString(),
            }));
            const { error: upsertError } = await admin
              .from("client_social_post_snapshots")
              .upsert(payload, { onConflict: "client_id,platform,post_id" });
            if (upsertError) throw new Error(upsertError.message);

            result.postsSeen += payload.length;
            result.postsWithEngagement += payload.filter((p) => p.engagement !== null).length;
            postsUpdated += payload.length;

            if (!batchPosts.nextCursor) break;
            cursor = batchPosts.nextCursor;
          }
        } catch (backfillError) {
          result.error =
            backfillError instanceof Error ? backfillError.message : "Backfill failed";
        }
        return result;
      }),
    );
    results.push(...batchResults);
  }

  return {
    connections: (connections ?? []).length,
    matchedPages: rows.length,
    postsUpdated,
    results,
  };
}
