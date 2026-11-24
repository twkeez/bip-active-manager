import Link from "next/link";
import type { LoadedSheetRoster, RosterEntry } from "@/lib/basecamp/sheet-roster";

/**
 * The Master Sheet roster, stated plainly at the top of the Response Report:
 * how many clients the sheet says to cover, how many were matched, and every
 * one that was not. Nothing is left out without being named.
 */

function readAt(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });
}

function why(entry: RosterEntry): string {
  if (entry.state === "no_project") return `matched to ${entry.clientName}, which has no Basecamp project linked`;
  if (entry.state === "ambiguous") {
    return `${entry.candidates.length} clients have this name: ${entry.candidates.map((c) => `#${c.clientId}`).join(", ")}`;
  }
  return entry.candidates.length
    ? `no client has this exact name. Closest: ${entry.candidates.map((c) => `${c.clientName} (#${c.clientId})`).join(", ")}`
    : "no client has this name";
}

export default function RosterCheck({ roster }: { roster: LoadedSheetRoster }) {
  if (roster.error) {
    return (
      <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        <p className="font-medium">The Master Sheet roster could not be checked.</p>
        <p className="mt-1">{roster.error}</p>
      </div>
    );
  }

  const { counts } = roster;
  const unsettled = roster.entries.filter((entry) => entry.state !== "ready");
  const shared = roster.entries.filter((entry) => entry.sharesProjectWith.length > 0);
  const attention = unsettled.length > 0 || roster.warnings.length > 0;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        attention ? "border-amber-500/40 bg-amber-500/10" : "border-bip-border bg-bip-fill/40"
      }`}
    >
      <p className="text-bip-text">
        <span className="font-medium">Master Sheet roster:</span> {counts.inScope} clients have a Package.{" "}
        {counts.ready} of {counts.inScope} are matched to a client with a Basecamp project
        {unsettled.length > 0 ? `; ${unsettled.length} are not (listed below).` : "."}
      </p>
      <p className="mt-1 text-xs text-bip-muted">
        Sheet read {readAt(roster.sheetReadAt)} · {roster.sheetTotal} practices on the Master tab · re-read every
        morning. The report below has one row for each matched client.
      </p>

      {roster.warnings.map((warning) => (
        <p key={warning} className="mt-2 text-xs text-amber-200">
          {warning}
        </p>
      ))}

      {unsettled.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-bip-text">
          {unsettled.map((entry) => (
            <li key={entry.practiceName}>
              <span className="font-medium">{entry.practiceName}</span>
              <span className="text-bip-muted">
                {" "}
                ({entry.strategist ?? "no strategist"}): {why(entry)}
              </span>
            </li>
          ))}
          <li className="text-bip-muted">
            Fix these on{" "}
            <Link href="/basecamp-projects" className="text-bip-accent hover:underline">
              Project Wiring
            </Link>
            . Nothing is matched by guesswork.
          </li>
        </ul>
      )}

      {(shared.length > 0 || roster.needsStrategist.length > 0) && (
        <details className="mt-2 text-xs text-bip-muted">
          <summary className="cursor-pointer hover:text-bip-text">
            {[
              shared.length > 0 ? `${shared.length} share a Basecamp project` : null,
              roster.needsStrategist.length > 0 ? `${roster.needsStrategist.length} have no strategist on the sheet` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </summary>
          {shared.length > 0 && (
            <p className="mt-1">
              Sharing a project:{" "}
              {shared.map((entry) => `${entry.practiceName} (with ${entry.sharesProjectWith.join(", ")})`).join("; ")}.
            </p>
          )}
          {roster.needsStrategist.length > 0 && (
            <p className="mt-1">Strategist blank or &quot;NEED&quot; on the sheet: {roster.needsStrategist.join(", ")}.</p>
          )}
        </details>
      )}
    </div>
  );
}
