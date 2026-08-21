import Link from "next/link";
import { Filter, X } from "lucide-react";
import type { FocusClient } from "@/lib/dashboard/focus-client";

/**
 * Sits above a portfolio-wide list that has been narrowed to one client, so it
 * is never ambiguous whose findings are on screen — and always one click back
 * to the full picture.
 */
export default function FocusClientBanner({
  focusClient,
  toolPath,
  shownCount,
  totalCount,
}: {
  focusClient: FocusClient;
  /** The tool's own path, used for the "view all" link. */
  toolPath: string;
  shownCount: number;
  totalCount: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-bip-accent/30 bg-bip-accent/5 px-4 py-2.5">
      <Filter className="h-4 w-4 shrink-0 text-bip-accent" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-bip-text">
        Showing <span className="font-semibold">{focusClient.name}</span> only —{" "}
        {shownCount} of {totalCount} findings across all clients.
      </p>
      <Link
        href={toolPath}
        className="inline-flex items-center gap-1.5 rounded-md border border-bip-border bg-bip-card px-2.5 py-1 text-xs font-medium text-bip-text transition hover:bg-bip-page"
      >
        <X className="h-3 w-3" aria-hidden />
        View all clients
      </Link>
    </div>
  );
}
