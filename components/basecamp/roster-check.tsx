import Link from "next/link";
import type { ReportIntegrity } from "@/lib/basecamp/roster-report";
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

export default function RosterCheck({
  roster,
  integrity,
}: {
  roster: LoadedSheetRoster;
  /** What was checked and what could not be. Null when the roster could not be applied. */
  integrity: ReportIntegrity | null;
}) {
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
  const shared = roster.sharedProjects.filter((project) => project.kind === "shared");
  const wiringProblems = roster.sharedProjects.filter((project) => project.kind === "problem");
  const failed = integrity?.failed ?? [];
  const problems = integrity?.problems ?? [];
  const attention =
    unsettled.length > 0 || roster.warnings.length > 0 || wiringProblems.length > 0 || failed.length > 0 || problems.length > 0;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        attention ? "border-amber-500/40 bg-amber-500/10" : "border-bip-border bg-bip-fill/40"
      }`}
    >
      {integrity ? (
        <p className="text-bip-text">
          <span className="font-medium">
            Checked {integrity.inScope} of {integrity.inScope} Master Sheet clients with a Package:
          </span>{" "}
          {integrity.reported} reported
          {integrity.failed.length > 0 && `, ${integrity.failed.length} could not be read`}
          {integrity.excluded > 0 && `, ${integrity.excluded} excluded as cancelling or former`}
          {integrity.notMatched.length > 0 && `, ${integrity.notMatched.length} not matched to a client`}.
          {integrity.complete ? " Nothing was skipped." : " The ones not reported are named below."}
        </p>
      ) : (
        <p className="text-bip-text">
          <span className="font-medium">Master Sheet roster:</span> {counts.inScope} clients have a Package.{" "}
          {counts.ready} of {counts.inScope} are matched to a client with a Basecamp project
          {unsettled.length > 0 ? `; ${unsettled.length} are not (listed below).` : "."}
        </p>
      )}
      <p className="mt-1 text-xs text-bip-muted">
        Sheet read {readAt(roster.sheetReadAt)} · {roster.sheetTotal} practices on the Master tab · re-read every
        morning. {integrity ? integrity.limits.join(" ") : "The report below has one row for each matched client."}
      </p>

      {problems.map((problem) => (
        <p key={problem} className="mt-2 text-xs font-medium text-red-200">
          {problem}
        </p>
      ))}

      {failed.length > 0 && (
        <div className="mt-2 text-xs text-bip-text">
          <p className="font-medium text-red-200">
            Could not be read ({failed.length}). {failed.length === 1 ? "This client is" : "These clients are"} on the
            report, but what it shows for {failed.length === 1 ? "it" : "them"} cannot be trusted:
          </p>
          <ul className="mt-1 space-y-1">
            {failed.map((item) => (
              <li key={item.name}>
                <span className="font-medium">{item.name}</span>
                <span className="text-bip-muted">: {item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {wiringProblems.length > 0 && (
        <div className="mt-2 text-xs text-bip-text">
          <p className="font-medium text-amber-200">
            Wiring to fix: {wiringProblems.length} Basecamp {wiringProblems.length === 1 ? "project has" : "projects have"}{" "}
            more than one client record pointing at {wiringProblems.length === 1 ? "it" : "them"}.
          </p>
          <ul className="mt-1 space-y-1">
            {wiringProblems.map((project) => (
              <li key={project.projectId}>
                <a
                  href={`https://basecamp.com/2175055/projects/${project.projectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bip-accent hover:underline"
                >
                  Project {project.projectId}
                </a>
                <span className="text-bip-muted">
                  :{" "}
                  {project.claimants
                    .map((c) => `${c.clientName} (#${c.clientId}${c.practiceName ? "" : ", not a Master Sheet client"})`)
                    .join(" and ")}
                </span>
              </li>
            ))}
            <li className="text-bip-muted">
              Usually one of these is a duplicate client record. Unlink it on{" "}
              <Link href="/basecamp-projects" className="text-bip-accent hover:underline">
                Project Wiring
              </Link>
              . The posts are still read once and shown on the report.
            </li>
          </ul>
        </div>
      )}

      {(shared.length > 0 || roster.needsStrategist.length > 0) && (
        <details className="mt-2 text-xs text-bip-muted">
          <summary className="cursor-pointer hover:text-bip-text">
            {[
              shared.length > 0
                ? `${shared.length} Basecamp ${shared.length === 1 ? "project is" : "projects are"} shared by two practices (fine)`
                : null,
              roster.needsStrategist.length > 0 ? `${roster.needsStrategist.length} have no strategist on the sheet` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </summary>
          {shared.length > 0 && (
            <p className="mt-1">
              Sharing a project, each with its own row:{" "}
              {shared.map((project) => project.claimants.map((c) => c.practiceName).join(" and ")).join("; ")}.
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
