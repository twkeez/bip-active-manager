import { bipStatusLabel, type PoobahBipStatus } from "@/lib/poobah/types";

// How a watched client's live BIP Control lifecycle shows. Colors come from
// the app's theme tokens (--warning, .bip-badge-warning), which are defined
// for both light and dark mode.

export type BipFilter = "all" | "onboarding" | "active";

/** Onboarding includes "Pending launch" (onboarding, waiting on the website). */
export function matchesBipFilter(status: PoobahBipStatus, filter: BipFilter): boolean {
  if (filter === "all") return true;
  if (filter === "onboarding") return status === "onboarding" || status === "launch";
  return status === "active";
}

export const isOnboarding = (status: PoobahBipStatus) => status === "onboarding" || status === "launch";

/** The amber left edge for onboarding clients; nothing for the rest. */
export function onboardingAccent(status: PoobahBipStatus): string {
  return isOnboarding(status) ? "border-l-4 border-l-[var(--warning)]" : "border-l-4 border-l-transparent";
}

/** Onboarding: amber badge. Not a BIP client: neutral badge. Active: no badge (default). */
export function BipStatusBadge({ status }: { status: PoobahBipStatus }) {
  if (status === "active") return null;
  return <span className={`bip-badge ${isOnboarding(status) ? "bip-badge-warning" : ""}`}>{bipStatusLabel(status)}</span>;
}

export function BipStatusLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bip-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded-sm bg-[var(--warning)]" aria-hidden="true" />
        <span className="bip-badge bip-badge-warning">Onboarding</span> incl. pending launch
      </span>
      <span>Active: no marker</span>
      <span className="flex items-center gap-1.5">
        <span className="bip-badge">Not a BIP client</span> prospect
      </span>
      <span>Read live from each client&apos;s record.</span>
    </p>
  );
}
