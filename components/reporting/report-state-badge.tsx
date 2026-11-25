import { STATE_LABELS, type ReportState } from "@/lib/reporting/monthly";

const BADGE: Record<ReportState, string> = {
  not_started: "bip-badge",
  draft: "bip-badge bip-badge-warning",
  reviewed: "bip-badge bip-badge-info",
  sent: "bip-badge bip-badge-success",
};

/** A report's state for its month, as a pill. Colors come from the shared tokens. */
export function ReportStateBadge({ state }: { state: ReportState }) {
  return <span className={`${BADGE[state]} whitespace-nowrap`}>{STATE_LABELS[state]}</span>;
}
