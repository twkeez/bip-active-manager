import type { PostStatus } from "./types";

// The seven values the PUT route validates against. Kept in one place so the
// detail panel and anything built later stay in step with the API.
export const POST_STATUSES: PostStatus[] = [
  "idea",
  "brief_sent",
  "asset_received",
  "drafted",
  "approved",
  "scheduled",
  "posted",
];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  idea: "Idea",
  brief_sent: "Brief sent",
  asset_received: "Asset received",
  drafted: "Drafted",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
};

/** Translucent pill styling, matching the palette used across the planner. */
export const POST_STATUS_STYLES: Record<PostStatus, string> = {
  idea: "bg-slate-100 text-slate-600 border-slate-200/60",
  brief_sent: "bg-sky-50 text-sky-700 border-sky-200/60",
  asset_received: "bg-amber-50 text-amber-700 border-amber-200/60",
  drafted: "bg-orange-50 text-orange-700 border-orange-200/60",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  scheduled: "bg-teal-50 text-teal-700 border-teal-200/60",
  posted: "bg-violet-50 text-violet-700 border-violet-200/60",
};
