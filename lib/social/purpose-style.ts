import type { SocialPurpose } from "./types";

// Purpose is the GOAL axis (campaign_type is the FORMAT). Shape is constant —
// translucent pill, rounded-full — only the hue varies.
export const PURPOSE_STYLE: Record<
  SocialPurpose,
  { label: string; pill: string; dot: string }
> = {
  services: {
    label: "Services",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    dot: "bg-emerald-500",
  },
  fun: {
    label: "Fun",
    pill: "bg-pink-50 text-pink-700 border-pink-200/60",
    dot: "bg-pink-500",
  },
  engagement: {
    label: "Engagement",
    pill: "bg-violet-50 text-violet-700 border-violet-200/60",
    dot: "bg-violet-500",
  },
  educational: {
    label: "Educational",
    pill: "bg-sky-50 text-sky-700 border-sky-200/60",
    dot: "bg-sky-500",
  },
  promotional: {
    label: "Promotional",
    pill: "bg-amber-50 text-amber-700 border-amber-200/60",
    dot: "bg-amber-500",
  },
  community: {
    label: "Community",
    pill: "bg-teal-50 text-teal-700 border-teal-200/60",
    dot: "bg-teal-500",
  },
};

/** Neutral fallback for rows with no purpose set (most existing rows). */
export const PURPOSE_FALLBACK = {
  pill: "bg-slate-50 text-slate-600 border-slate-200/60",
  dot: "bg-slate-300",
};

export function purposeStyle(purpose: SocialPurpose | null | undefined) {
  return purpose ? PURPOSE_STYLE[purpose] : { label: "", ...PURPOSE_FALLBACK };
}
