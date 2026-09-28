import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { DataWarning } from "@/lib/data-integrity/warnings";

/**
 * Shown at the top of every page while any data warning is active: some read
 * came back cut short, so numbers built from it may be missing data. Client
 * reports and briefings refuse to export in that state; this says why.
 */
export default function DataWarningBanner({
  warnings,
  showLink,
}: {
  warnings: DataWarning[];
  /** The Data health page exists on the full app only. */
  showLink: boolean;
}) {
  if (!warnings.length) return null;
  const tables = [...new Set(warnings.map((w) => w.table_name).filter(Boolean))].slice(0, 4).join(", ");
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p>
        <strong>Some data may be incomplete.</strong> {warnings.length}{" "}
        {warnings.length === 1 ? "read was" : "reads were"} cut short by the database ({tables}), so figures built
        from {warnings.length === 1 ? "it" : "them"} may be missing data. A client report or briefing built on
        cut-short data refuses to export.{" "}
        {showLink && (
          <Link href="/data-health" className="font-medium underline">
            See Data health
          </Link>
        )}
      </p>
    </div>
  );
}
