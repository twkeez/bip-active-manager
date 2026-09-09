"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  RefreshCw,
  Undo2,
} from "lucide-react";
import type {
  ProjectActivity,
  ProjectDisposition,
} from "@/lib/clients/basecamp-project-triage";
import type { MasterSheetMatch } from "@/lib/clients/master-sheet";

/**
 * The screen for connecting client records to Basecamp projects.
 *
 * Ordered by consequence, not by size: the clients being silently skipped come
 * first because they are actively invisible to every other tool, then the links
 * that are safe to make in bulk, then the judgement calls.
 */

type Duplicate = {
  projectId: string;
  projectName: string | null;
  clients: Array<{ id: number; name: string }>;
};

type ReadyRow = {
  clientId: number;
  accountName: string;
  projectId: string;
  projectName: string;
};

type AmbiguousRow = {
  clientId: number;
  accountName: string;
  currentProjectId: string | null;
  projectId: string | null;
  projectName: string | null;
};

type ConflictRow = AmbiguousRow & { currentProjectName: string | null };

type UnmatchedRow = {
  projectId: string;
  projectName: string;
  disposition: ProjectDisposition;
  reason: string;
  activity: ProjectActivity;
  /** Null when no master sheet has been uploaded. */
  sheet: MasterSheetMatch | null;
};

type IgnoredRow = { projectId: string; projectName: string; reason: string | null };

type Props = {
  loadError: string | null;
  projectCount: number;
  clientCount: number;
  trackedCount: number;
  linkableClients: Array<{ id: number; name: string }>;
  linkedCount: number;
  skippedCount: number;
  duplicates: Duplicate[];
  readyToLink: ReadyRow[];
  ambiguous: AmbiguousRow[];
  nameConflicts: ConflictRow[];
  unmatched: UnmatchedRow[];
  ignored: IgnoredRow[];
  strategists: string[];
  accountId: string | null;
  sheetSize: number;
  sheetImportedAt: string | null;
};


function Section({
  title,
  blurb,
  tone = "quiet",
  count,
  children,
}: {
  title: string;
  blurb: string;
  tone?: "quiet" | "warn" | "bad";
  count?: number;
  children: React.ReactNode;
}) {
  const ring =
    tone === "bad"
      ? "border-red-500/40"
      : tone === "warn"
        ? "border-amber-500/40"
        : "border-bip-border";
  const heading =
    tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-bip-text";
  return (
    <section className={`rounded-xl border ${ring} bg-bip-card p-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-semibold ${heading}`}>{title}</h2>
        {count !== undefined && (
          <span className="shrink-0 text-[11px] text-bip-muted">{count}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-bip-muted">{blurb}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ProjectLink({
  id,
  name,
  accountId,
}: {
  id: string;
  name: string | null;
  accountId: string | null;
}) {
  // Without an account id there is no URL to build, so the name stands alone
  // rather than becoming a link that goes nowhere.
  if (!accountId) {
    return <span className="text-bip-text">{name ?? `Project ${id}`}</span>;
  }
  return (
    <a
      href={`https://basecamp.com/${accountId}/projects/${id}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-bip-text hover:underline"
    >
      {name ?? `Project ${id}`}
      <ExternalLink className="h-3 w-3 shrink-0 text-bip-muted" />
    </a>
  );
}

/**
 * How the unclaimed projects are grouped.
 *
 * Without the master sheet, all we have is the project's name and how long it
 * has been silent — a weak basis for 50-odd decisions. With the sheet, the
 * question becomes "do we serve this practice?", which is the one that actually
 * decides, so the grouping changes to match.
 */
type GroupKey = "ours" | "on-sheet" | "absent-active" | "absent-silent" | ProjectDisposition;

const GROUP_COPY: Record<GroupKey, { title: string; blurb: string }> = {
  ours: {
    title: "Ours",
    blurb: "Our own projects, by name. Ignoring one keeps it off this list — it stays reversible.",
  },
  "on-sheet": {
    title: "On the master sheet",
    blurb:
      "A practice we serve. Link it to its client record, or import it if we have none. Fuzzy name matches are shown so you can check them — the sheet and Basecamp rarely word a name the same way.",
  },
  "absent-active": {
    title: "Not on the sheet, but still active",
    blurb:
      "No match on the master sheet, yet someone posted recently. Worth opening before you decide — it may be a practice missing from the sheet.",
  },
  "absent-silent": {
    title: "Not on the sheet, and silent over a year",
    blurb:
      "Absent from the master sheet with no message in more than a year. This is the group that is safe to ignore in bulk.",
  },
  practice: {
    title: "Look like practices",
    blurb:
      "Named like a veterinary practice. Check the client list first — the name often differs slightly from ours. Import only if we have no record at all.",
  },
  unclear: {
    title: "Need a look",
    blurb: "The name doesn't settle it, or the project is marked old. Open it before deciding.",
  },
  internal: {
    title: "Look like ours",
    blurb: "Our own projects. Ignoring one keeps it out of this list for good — it stays reversible.",
  },
};

const WITH_SHEET: GroupKey[] = ["on-sheet", "absent-active", "absent-silent", "ours"];
const WITHOUT_SHEET: GroupKey[] = ["practice", "unclear", "internal"];

function groupFor(row: UnmatchedRow, hasSheet: boolean): GroupKey {
  if (!hasSheet) return row.disposition;
  // Name wins over the sheet here: we are a row on our own master sheet, so
  // "Beyond Indigo Blog Communication" matches it and would otherwise be
  // presented as a client practice.
  if (row.disposition === "internal") return "ours";
  if (row.sheet && row.sheet.confidence !== "none") return "on-sheet";
  return row.activity.dormant ? "absent-silent" : "absent-active";
}

export default function BasecampProjectMatcher(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(props.readyToLink.map((row) => row.clientId)),
  );
  const [strategist, setStrategist] = useState("");
  // Which existing client each unmatched project should attach to. Needed
  // because the auto-matcher only pairs on an exact name, and real pairs often
  // disagree — "Volunteer Vet" the project vs "Volunteer Veterinary Hospital"
  // the client. Importing those would create a second record for one practice.
  const [linkTo, setLinkTo] = useState<Record<string, string>>({});

  const hasSheet = props.sheetSize > 0;
  const byDisposition = useMemo(() => {
    const groups = new Map<GroupKey, UnmatchedRow[]>();
    for (const row of props.unmatched) {
      const key = groupFor(row, hasSheet);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return groups;
  }, [props.unmatched, hasSheet]);
  const groupOrder = hasSheet ? WITH_SHEET : WITHOUT_SHEET;

  async function send(key: string, url: string, method: string, body: unknown, done: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? `Request failed (${response.status})`);
      }
      // The skipped list is the interesting half of an apply — it is where a
      // refused change explains itself.
      const skipped: Array<{ clientId: number; reason: string }> = payload?.skipped ?? [];
      setNote(
        skipped.length
          ? `${done} ${skipped.length} skipped: ${skipped
              .map((s) => `client ${s.clientId} — ${s.reason}`)
              .join("; ")}`
          : done,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const applySelected = () => {
    const updates = props.readyToLink
      .filter((row) => selected.has(row.clientId))
      .map((row) => ({ clientId: row.clientId, basecampProjectId: row.projectId }));
    if (!updates.length) return;
    void send(
      "apply",
      "/api/basecamp/projects/apply",
      "POST",
      { updates },
      `Linked ${updates.length} client${updates.length === 1 ? "" : "s"}.`,
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-semibold text-bip-text">Basecamp project wiring</h1>
        <p className="mt-1 text-xs text-bip-muted">
          {props.linkedCount} clients are linked to one of {props.projectCount} active
          Basecamp projects. {props.trackedCount} of the {props.clientCount} client records
          are currently marketing-tracked — the rest are dormant and are not counted as gaps.
          Anything tracked but unlinked is invisible to the thread monitor: not quiet,
          unwatched.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link
            href="/coal-mines"
            className="text-[11px] text-bip-muted hover:text-bip-text hover:underline"
          >
            ← Coal Mines
          </Link>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void send(
                "sheet",
                "/api/master-sheet",
                "POST",
                {},
                "Master sheet refreshed from Drive.",
              )
            }
            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text hover:underline disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            {props.sheetSize > 0
              ? `Refresh master sheet (${props.sheetSize} practices${
                  props.sheetImportedAt
                    ? `, ${new Date(props.sheetImportedAt).toLocaleDateString()}`
                    : ""
                })`
              : "Pull the master sheet from Drive"}
          </button>
          {/* Kept for when Drive access breaks or the sheet moves — the button
              above is the normal path. */}
          <label className="cursor-pointer text-[11px] text-bip-muted hover:text-bip-text hover:underline">
            or upload a CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busy !== null}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const csv = await file.text();
                await send("sheet", "/api/master-sheet", "POST", { csv }, "Master sheet updated.");
              }}
            />
          </label>
          {busy === "sheet" && <Loader2 className="h-3 w-3 animate-spin text-bip-muted" />}
        </div>
      </header>

      {props.sheetSize === 0 && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-3 text-xs text-bip-muted">
          No master sheet loaded, so the projects below are grouped by name alone. Pulling it
          from Drive sorts them by whether we actually serve the practice, which is the question
          that decides whether to import or ignore.
        </div>
      )}

      {props.loadError && (
        <div className="rounded-xl border border-red-500/40 bg-bip-card p-4 text-xs text-red-300">
          Could not load Basecamp projects: {props.loadError}
          <p className="mt-1 text-bip-muted">
            Everything below is based on client records alone until this is fixed.
          </p>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-bip-card p-3 text-xs text-red-300">
          {error}
        </div>
      )}
      {note && (
        <div className="rounded-xl border border-emerald-500/40 bg-bip-card p-3 text-xs text-emerald-300">
          {note}
        </div>
      )}

      {props.duplicates.length > 0 && (
        <Section
          title="Clients sharing a project"
          blurb={`${props.skippedCount} client record${
            props.skippedCount === 1 ? "" : "s"
          } share a project with another. The threads are still monitored — the sync reads Basecamp directly — but only one record gets the activity, so the others read as quiet on the comms monitor. Unlink the ones that are wrong; where a project genuinely serves two practices, keep the record you want it filed under.`}
          tone="warn"
          count={props.duplicates.length}
        >
          <ul className="space-y-3">
            {props.duplicates.map((group) => (
              <li key={group.projectId} className="rounded-lg border border-bip-border p-3">
                <p className="text-xs font-medium">
                  <ProjectLink id={group.projectId} name={group.projectName} accountId={props.accountId} />
                </p>
                <ul className="mt-2 space-y-1.5">
                  {group.clients.map((client, index) => (
                    <li key={client.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 text-[11px] text-bip-muted">
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="text-bip-text hover:underline"
                        >
                          {client.name}
                        </Link>
                        <span className="ml-1.5">
                          {index === 0 ? "gets the activity" : "reads as quiet"}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void send(
                            `unlink-${client.id}`,
                            "/api/basecamp/projects/apply",
                            "POST",
                            { updates: [{ clientId: client.id, basecampProjectId: null }] },
                            `Unlinked ${client.name}.`,
                          )
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-40"
                      >
                        {busy === `unlink-${client.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Link2Off className="h-3 w-3" />
                        )}
                        Unlink
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {props.readyToLink.length > 0 && (
        <Section
          title="Ready to link"
          blurb="Each of these clients has exactly one Basecamp project with the same name, and nothing else claims it."
          count={props.readyToLink.length}
        >
          <div className="mb-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selected.size === props.readyToLink.length
                    ? new Set()
                    : new Set(props.readyToLink.map((row) => row.clientId)),
                )
              }
              className="text-[11px] text-bip-muted hover:text-bip-text hover:underline"
            >
              {selected.size === props.readyToLink.length ? "Clear all" : "Select all"}
            </button>
            <button
              type="button"
              disabled={busy !== null || selected.size === 0}
              onClick={applySelected}
              className="inline-flex items-center gap-1.5 rounded border border-bip-border px-2.5 py-1 text-[11px] font-medium text-bip-text hover:bg-bip-border/40 disabled:opacity-40"
            >
              {busy === "apply" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2 className="h-3 w-3" />
              )}
              Link {selected.size} selected
            </button>
          </div>
          <ul className="divide-y divide-bip-border">
            {props.readyToLink.map((row) => (
              <li key={row.clientId} className="flex items-center gap-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={selected.has(row.clientId)}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(row.clientId)) next.delete(row.clientId);
                      else next.add(row.clientId);
                      return next;
                    })
                  }
                  className="h-3.5 w-3.5 shrink-0 accent-emerald-500"
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-bip-text">
                  {row.accountName}
                </span>
                <span className="shrink-0 text-[11px] text-bip-muted">
                  <ProjectLink id={row.projectId} name={row.projectName} accountId={props.accountId} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(props.ambiguous.length > 0 || props.nameConflicts.length > 0) && (
        <Section
          title="Need a decision"
          blurb="Nothing here can be linked automatically without risking the wrong pairing."
          tone="warn"
          count={props.ambiguous.length + props.nameConflicts.length}
        >
          <ul className="space-y-2">
            {props.ambiguous.map((row) => (
              <li key={`amb-${row.clientId}`} className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                <p className="text-[11px] text-bip-muted">
                  <Link
                    href={`/dashboard/clients/${row.clientId}`}
                    className="text-bip-text hover:underline"
                  >
                    {row.accountName}
                  </Link>{" "}
                  — more than one client record or project shares this name. Merge the
                  duplicate records first, then the link becomes obvious.
                </p>
              </li>
            ))}
            {props.nameConflicts.map((row) => (
              <li key={`con-${row.clientId}`} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                <p className="text-[11px] text-bip-muted">
                  <Link
                    href={`/dashboard/clients/${row.clientId}`}
                    className="text-bip-text hover:underline"
                  >
                    {row.accountName}
                  </Link>{" "}
                  points at{" "}
                  {row.currentProjectId ? (
                    <ProjectLink id={row.currentProjectId} name={row.currentProjectName} accountId={props.accountId} />
                  ) : (
                    "nothing"
                  )}
                  , but a project named the same as the client exists:{" "}
                  {row.projectId && <ProjectLink id={row.projectId} name={row.projectName} accountId={props.accountId} />}.
                  Only change it if the current one is wrong.
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {props.unmatched.length > 0 && (
        <Section
          title="Basecamp projects with no client"
          blurb="Active projects nothing in the app points at. Nobody is watching these threads. Most recent message first — read from the threads themselves, not Basecamp's project timestamp, which a bulk account change moved for 30 projects at once."
          tone="warn"
          count={props.unmatched.length}
        >
          {props.strategists.length > 0 && (
            <label className="mb-3 flex items-center gap-2 text-[11px] text-bip-muted">
              Assign imports to
              <select
                value={strategist}
                onChange={(event) => setStrategist(event.target.value)}
                className="rounded border border-bip-border bg-bip-card px-2 py-1 text-[11px] text-bip-text"
              >
                <option value="">Nobody yet</option>
                {props.strategists.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="space-y-4">
            {groupOrder.filter((key) => byDisposition.get(key)?.length).map((key) => (
              <div key={key}>
                <p className="text-[11px] font-semibold text-bip-text">
                  {GROUP_COPY[key].title}{" "}
                  <span className="font-normal text-bip-muted">
                    ({byDisposition.get(key)!.length})
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-bip-muted">{GROUP_COPY[key].blurb}</p>
                {(() => {
                  const rows = byDisposition.get(key)!;
                  const dormant = rows.filter((r) => r.activity.dormant).length;
                  // Pointless under a heading that already says "silent over a
                  // year" — every row in that group qualifies by definition.
                  return dormant > 0 && key !== "absent-silent" ? (
                    <p className="mt-0.5 text-[11px] text-bip-muted">
                      {dormant} of these {dormant === 1 ? "has" : "have"} had no activity in
                      over a year.
                    </p>
                  ) : null;
                })()}
                <ul className="mt-1.5 divide-y divide-bip-border">
                  {byDisposition.get(key)!.map((row) => (
                    <li
                      key={row.projectId}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <span className="min-w-0 text-[11px]">
                        <ProjectLink id={row.projectId} name={row.projectName} accountId={props.accountId} />
                        <span
                          className={`ml-1.5 ${
                            row.activity.dormant ? "text-bip-muted" : "text-bip-text"
                          }`}
                          title={row.reason}
                        >
                          {row.activity.days === null
                            ? "no message recorded yet"
                            : `last message ${row.activity.label}`}
                          {row.activity.dormant && " · dormant"}
                        </span>
                        {row.sheet?.confidence === "likely" && row.sheet.row && (
                          // Named in full because the match is a guess. Seeing
                          // "Paws and Claws" against "Happy Paws & Claws" is
                          // how a wrong pair gets caught.
                          <span className="ml-1.5 text-bip-muted">
                            ≈ sheet: {row.sheet.row.practiceName}
                          </span>
                        )}
                        {row.sheet?.confidence === "none" && row.sheet.nearest && (
                          // Shown only where it matters — this is the group
                          // that gets ignored in bulk, so a near miss needs to
                          // be seen before it is buried.
                          <span className="ml-1.5 text-amber-300">
                            close to sheet entry &ldquo;{row.sheet.nearest.row.practiceName}
                            &rdquo; — check
                          </span>
                        )}
                        {row.sheet?.confidence === "exact" && row.sheet.row?.city && (
                          <span className="ml-1.5 text-bip-muted">
                            {row.sheet.row.city}
                            {row.sheet.row.state ? `, ${row.sheet.row.state}` : ""}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {key !== "internal" && key !== "ours" && (
                          <>
                            <select
                              value={linkTo[row.projectId] ?? ""}
                              onChange={(event) =>
                                setLinkTo((current) => ({
                                  ...current,
                                  [row.projectId]: event.target.value,
                                }))
                              }
                              className="max-w-[11rem] rounded border border-bip-border bg-bip-card px-1.5 py-1 text-[11px] text-bip-text"
                            >
                              <option value="">Link to an existing client…</option>
                              {props.linkableClients.map((client) => (
                                <option key={client.id} value={String(client.id)}>
                                  {client.name}
                                </option>
                              ))}
                            </select>
                            {linkTo[row.projectId] && (
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() =>
                                  void send(
                                    `link-${row.projectId}`,
                                    "/api/basecamp/projects/apply",
                                    "POST",
                                    {
                                      updates: [
                                        {
                                          clientId: Number(linkTo[row.projectId]),
                                          basecampProjectId: row.projectId,
                                        },
                                      ],
                                    },
                                    `Linked ${row.projectName}.`,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-40"
                              >
                                {busy === `link-${row.projectId}` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Link2 className="h-3 w-3" />
                                )}
                                Link
                              </button>
                            )}
                          </>
                        )}
                        {/* No Import on our own projects — creating a client
                            record for Beyond Indigo Newsstand is never right,
                            and the button being there invites the mistake. */}
                        {key !== "internal" && key !== "ours" && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void send(
                              `import-${row.projectId}`,
                              "/api/basecamp/projects/import",
                              "POST",
                              {
                                projectId: row.projectId,
                                projectName: row.projectName,
                                marketingStrategist: strategist || undefined,
                                // These are running practices, not new business.
                                // Starting onboarding would invent 18 tasks each.
                                startOnboarding: false,
                              },
                              `Created a client for ${row.projectName}.`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-40"
                        >
                          {busy === `import-${row.projectId}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Import
                        </button>
                        )}
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void send(
                              `ignore-${row.projectId}`,
                              "/api/basecamp/projects/ignore",
                              "POST",
                              {
                                projectId: row.projectId,
                                projectName: row.projectName,
                                reason: key === "internal" ? "internal" : "not_a_client",
                              },
                              `Ignoring ${row.projectName}.`,
                            )
                          }
                          className="rounded border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-40"
                        >
                          Ignore
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {props.ignored.length > 0 && (
        <Section
          title="Ignored"
          blurb="Kept out of the coverage list on purpose. Restore one if that was a mistake."
          count={props.ignored.length}
        >
          <ul className="divide-y divide-bip-border">
            {props.ignored.map((row) => (
              <li key={row.projectId} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 text-[11px]">
                  <ProjectLink id={row.projectId} name={row.projectName} accountId={props.accountId} />
                  {row.reason && <span className="ml-1.5 text-bip-muted">{row.reason}</span>}
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void send(
                      `restore-${row.projectId}`,
                      "/api/basecamp/projects/ignore",
                      "DELETE",
                      { projectId: row.projectId },
                      `Restored ${row.projectName}.`,
                    )
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-40"
                >
                  {busy === `restore-${row.projectId}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Undo2 className="h-3 w-3" />
                  )}
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
