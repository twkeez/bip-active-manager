import type { TruncatedRead } from "@/lib/data-integrity/row-cap";

/** Why a client-facing export was refused, in plain words. */
export function exportBlockedMessage(what: string, truncated: TruncatedRead[]): string {
  const capped = truncated.filter((read) => (read.kind ?? "row_cap") === "row_cap");
  const failed = truncated.filter((read) => read.kind === "read_failed");
  const parts: string[] = [];
  if (capped.length) {
    const tables = [...new Set(capped.map((read) => read.table))].join(", ");
    parts.push(
      `some of the data behind it was cut short by the database (${tables}). This has been recorded on Data health and emailed to Tom`,
    );
  }
  if (failed.length) {
    parts.push(
      `${failed.length === 1 ? "one part" : `${failed.length} parts`} of its data could not be read in full (listed below). Reload to try again; if it persists, the sync for that source needs a look`,
    );
  }
  return `Can't export this ${what}: ${parts.join("; and ")}. Its numbers may be incomplete.`;
}

/**
 * Shown instead of a client-facing document (or above its preview) when a
 * read behind it hit the database's row limit. A questionable number must
 * never reach a client (Tom, 2026-09-28).
 */
export default function ExportBlocked({
  what,
  truncated,
  variant = "page",
}: {
  what: string;
  truncated: TruncatedRead[];
  /** "page" replaces a print view; "notice" sits above a preview. */
  variant?: "page" | "notice";
}) {
  const box = (
    <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-100">
      <p className="font-semibold">Export blocked: data may be incomplete</p>
      <p className="mt-1">{exportBlockedMessage(what, truncated)}</p>
      <ul className="mt-2 list-disc pl-5 text-xs text-red-200/80">
        {truncated.slice(0, 5).map((read) => (
          <li key={read.problemKey}>{read.detail}</li>
        ))}
      </ul>
    </div>
  );
  if (variant === "notice") return <div className="px-6 pt-6">{box}</div>;
  return <div className="mx-auto max-w-2xl p-10">{box}</div>;
}
