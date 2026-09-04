import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AWAITING_REPLY_DAYS,
  CHASE_THEM_DAYS,
  STALLED_DAYS,
  findThreadIssues,
  groupByClient,
  type ThreadFinding,
  type ThreadRow,
} from "./basecamp-threads";
import { assessSyncHealth, type SyncStateRow } from "./sync-health";
import {
  findProjectWiringProblems,
  type ClientProjectRow,
} from "./project-wiring";

/**
 * Coal Mines — the checks that stay quiet until something is wrong.
 *
 * A canary watches one thing and reports in a single line. It never fixes
 * anything and never writes: the point is to notice, early, the sort of drift
 * nobody is looking for. Harmony Animal Hospital was sold Ads Foundation in
 * February and still had no campaign in September because nothing was watching.
 *
 * What belongs here: cross-cutting checks with no natural home in a feature —
 * a service sold but never started, a sync that has stopped running, a client
 * paying for something we are not delivering. What does not belong here: work
 * that is part of a feature, which should live in that feature. The celebration
 * calendar review started here and moved to the Social Planner for that reason.
 *
 * Canaries run on page load today. Putting them on a schedule is the next step,
 * and nothing here assumes one — a canary is a pure "look and report" function.
 */

export type CanaryStatus = "ok" | "attention" | "overdue";

export type Canary = {
  key: string;
  name: string;
  /** What this canary watches, in plain language. */
  watches: string;
  status: CanaryStatus;
  /** One-line verdict. */
  headline: string;
  /** Specifics worth naming — rendered as a list under the headline. */
  detail: string[];
  /** Findings you can act on directly. Rendered as links where a url exists. */
  items?: CanaryItem[];
  /** Findings grouped under headings — preferred when there are many. */
  sections?: CanarySection[];
  /**
   * Where to go and fix it. A canary that names a problem but leaves you
   * hunting for the screen that fixes it is only half a canary.
   */
  action?: { label: string; href: string };
};

export type CanaryItem = {
  label: string;
  /** Secondary line — who it belongs to, how long it has been waiting. */
  meta: string;
  href?: string | null;
  flagged?: boolean;
};

export type CanaryGroupView = {
  title: string;
  /** "3 threads · longest 23 days" */
  meta: string;
  flagged?: boolean;
  items: CanaryItem[];
};

export type CanarySection = {
  heading: string;
  /** What this bucket means and what to do about it. */
  blurb: string;
  tone: CanaryStatus;
  groups: CanaryGroupView[];
};

/** Every canary, run together. Order is display order. */
export async function runCanaries(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary[]> {
  // Sync health leads: when it is unhappy every canary under it is reporting on
  // stale data, and that context changes how you read the rest of the page.
  return Promise.all([
    checkSyncHealth(supabase, now),
    checkProjectWiring(supabase),
    checkBasecampThreads(supabase, now),
  ]);
}

/** Whether the data everything else depends on is actually being refreshed. */
export async function checkSyncHealth(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary> {
  const base = {
    key: "sync-health",
    name: "Basecamp sync",
    watches:
      "Whether the scheduled job is still running. Everything below is only as current as this.",
  } as const;

  const { data } = await supabase
    .from("basecamp_sync_state")
    .select("last_synced_at, last_error")
    .eq("id", 1)
    .maybeSingle<SyncStateRow>();

  const health = assessSyncHealth(data ?? null, now);

  return {
    ...base,
    status:
      health.status === "ok" ? "ok" : health.status === "stale" ? "attention" : "overdue",
    headline: health.headline,
    detail:
      health.errors.length > 0
        ? [`Last run reported ${health.errors.length} project error(s) — see Client wiring.`]
        : [],
  };
}

/**
 * Client records fighting over the same Basecamp project. The loser of each
 * fight is skipped by the sync and therefore invisible everywhere else.
 */
export async function checkProjectWiring(supabase: SupabaseClient): Promise<Canary> {
  const base = {
    key: "project-wiring",
    name: "Client wiring",
    watches: "Client records pointing at the same Basecamp project as another client.",
  } as const;

  const { data, error } = await supabase
    .from("clients")
    .select("id, account_name, basecamp_project_id")
    .not("basecamp_project_id", "is", null)
    .returns<ClientProjectRow[]>();

  if (error) {
    return { ...base, status: "attention", headline: "Could not read clients.", detail: [error.message] };
  }

  const { duplicates, skippedClients, linked } = findProjectWiringProblems(data ?? []);

  if (duplicates.length === 0) {
    return {
      ...base,
      status: "ok",
      headline: `All ${linked} linked clients point at their own Basecamp project.`,
      detail: [],
    };
  }

  return {
    ...base,
    status: "overdue",
    headline: `${skippedClients} client${skippedClients === 1 ? " is" : "s are"} skipped by every sync — they share a Basecamp project with another client.`,
    detail: [
      "The sync gives a project to one client per run, so the others are passed over entirely and can never appear in any finding.",
      "Fix by giving each client its own Basecamp project ID, or clearing it on the records that should not have one.",
    ],
    action: { label: "Open Project Wiring", href: "/basecamp-projects" },
    sections: [
      {
        heading: `Shared projects (${duplicates.length})`,
        blurb: "First listed keeps the project; the rest are skipped.",
        tone: "overdue",
        groups: duplicates.map((g) => ({
          title: `Basecamp project ${g.projectId}`,
          meta: `${g.clients.length} clients`,
          items: g.clients.map((c, i) => ({
            label: c.name,
            meta: i === 0 ? `client ${c.id} · keeps it` : `client ${c.id} · SKIPPED`,
            href: `/dashboard/clients/${c.id}?tab=profile`,
            flagged: i > 0,
          })),
        })),
      },
    ],
  };
}

/**
 * Basecamp threads that are waiting on us, or that have gone quiet.
 *
 * Thread-level, where the Comms Monitor is client-level — see
 * ./basecamp-threads for why that distinction matters.
 */
export async function checkBasecampThreads(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary> {
  const base = {
    key: "basecamp-threads",
    name: "Basecamp threads",
    watches:
      "Individual threads where a client is waiting on a reply, or that nobody has touched in a while.",
  } as const;

  const [{ data: rows, error }, { data: clients }] = await Promise.all([
    supabase
      .from("basecamp_communication_events")
      .select(
        "client_id, thread_title, thread_url, thread_excerpt, occurred_at, is_internal, reply_need, reply_need_reason, reply_need_escalated, classified_excerpt",
      )
      .order("occurred_at", { ascending: false })
      .returns<ThreadRow[]>(),
    supabase.from("clients").select("id, account_name"),
  ]);

  if (error) {
    return {
      ...base,
      status: "attention",
      headline: "Could not read Basecamp threads.",
      detail: [error.message],
    };
  }

  const names = new Map<number, string>(
    (clients ?? []).map((c) => [c.id as number, c.account_name as string]),
  );
  const { awaitingUs, awaitingThem, stalled, considered } = findThreadIssues(
    rows ?? [],
    names,
    now,
  );

  if (awaitingUs.length === 0 && awaitingThem.length === 0 && stalled.length === 0) {
    return {
      ...base,
      status: "ok",
      headline: `All ${considered} client-facing threads answered and active.`,
      detail: [],
    };
  }

  const detail: string[] = [];
  if (awaitingUs.length > 0) {
    detail.push(
      `${awaitingUs.length} waiting on a reply for ${AWAITING_REPLY_DAYS}+ days — longest ${awaitingUs[0].days} days.`,
    );
  }
  if (awaitingThem.length > 0) {
    detail.push(`${awaitingThem.length} where we are waiting on the client for ${CHASE_THEM_DAYS}+ days.`);
  }
  if (stalled.length > 0) {
    detail.push(`${stalled.length} with no activity for ${STALLED_DAYS}+ days.`);
  }

  const toSection = (
    heading: string,
    blurb: string,
    tone: CanaryStatus,
    findings: ThreadFinding[],
    verb: string,
  ): CanarySection | null => {
    if (findings.length === 0) return null;
    return {
      heading: `${heading} (${findings.length})`,
      blurb,
      tone,
      groups: groupByClient(findings).map((g) => ({
        title: g.clientName,
        meta:
          g.items.length === 1
            ? `${verb} ${g.worstDays} days`
            : `${g.items.length} threads · longest ${g.worstDays} days`,
        flagged: g.escalated,
        items: g.items.map((f) => ({
          label: f.title,
          meta: [`${f.days}d`, f.reason ? `— ${f.reason}` : "— not yet read"].join(" "),
          href: f.url,
          flagged: f.escalated,
        })),
      })),
    };
  };

  const sections = [
    toSection(
      "Waiting on us",
      "The client asked something and has not had an answer.",
      "overdue",
      awaitingUs,
      "waiting",
    ),
    toSection(
      "Waiting on them",
      "We asked for something and have not had it back. Worth a chase.",
      "attention",
      awaitingThem,
      "asked",
    ),
    toSection(
      "Gone quiet",
      `No activity either way for ${STALLED_DAYS}+ days.`,
      "attention",
      stalled,
      "quiet",
    ),
  ].filter((x): x is CanarySection => x !== null);

  return {
    ...base,
    // Someone waiting on us is a promise we are failing; the other two are
    // questions. Only the first is overdue.
    status: awaitingUs.length > 0 ? "overdue" : "attention",
    headline:
      awaitingUs.length > 0
        ? `${awaitingUs.length} of ${considered} threads are waiting on us.`
        : awaitingThem.length > 0
          ? `${awaitingThem.length} threads are waiting on the client.`
          : `${stalled.length} of ${considered} threads have gone quiet.`,
    detail,
    sections,
  };
}
