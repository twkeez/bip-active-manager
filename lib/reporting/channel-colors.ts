// Stable colors for GA4 default-channel-grouping buckets so the traffic-mix
// visual reads consistently across every surface (client report, PDF, Word
// export, internal canvas). Unknown channels fall back to a rotating palette.
// Plain constants + a pure function so both server (Word export) and client
// (report preview, canvas) modules can import it.
export const CHANNEL_COLORS: Record<string, string> = {
  "Direct": "#3D52C4",
  "Organic Search": "#0EA5E9",
  "Paid Search": "#059669",
  "Organic Social": "#7B35B0",
  "Paid Social": "#E4177F",
  "Referral": "#F59E0B",
  "Email": "#14B8A6",
  "Display": "#8B5CF6",
  "Organic Video": "#EF4444",
  "Paid Video": "#DB2777",
  "Paid Shopping": "#0D9488",
  "Organic Shopping": "#65A30D",
  "Affiliates": "#D97706",
  "Audio": "#4F46E5",
  "SMS": "#0891B2",
  "Cross-network": "#6366F1",
  "Unassigned": "#9CA3AF",
};

export const CHANNEL_FALLBACK_PALETTE = [
  "#3D52C4", "#059669", "#7B35B0", "#E4177F", "#F59E0B", "#0EA5E9", "#14B8A6", "#EF4444",
];

export function channelColor(channel: string, index: number): string {
  return CHANNEL_COLORS[channel] ?? CHANNEL_FALLBACK_PALETTE[index % CHANNEL_FALLBACK_PALETTE.length];
}
