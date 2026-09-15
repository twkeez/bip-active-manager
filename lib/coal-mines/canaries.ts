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
  SNAPSHOT_STALE_DAYS,
  assessFreshness,
  type AccountFreshness,
  type FreshnessAccount,
  type SnapshotRow,
} from "./snapshot-freshness";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { listBasecampProjectIgnores } from "@/lib/clients/basecamp-project-ignores";
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

/**
 * Every canary, run together. Order is display order.
 *
 * The built-in checks come first and in a fixed order; canaries somebody wrote
 * follow, oldest first. The admin client is only needed for those — their
 * queries run through a function the service role alone may call — and it is
 * imported lazily so this module stays importable without any environment.
 */
export async function runCanaries(
  supabase: SupabaseClient,
  now: Date = new Date(),
  admin?: SupabaseClient,
): Promise<Canary[]> {
  // Sync health leads: when it is unhappy every canary under it is reporting on
  // stale data, and that context changes how you read the rest of the page.
  const [builtIn, custom] = await Promise.all([
    Promise.all([
      checkSyncHealth(supabase, now),
      checkAdsFreshness(supabase, now),
      checkProjectWiring(supabase),
      checkBasecampThreads(supabase, now),
    ]),
    runCustom(admin),
  ]);
  return [...builtIn, ...custom];
}

async function runCustom(admin?: SupabaseClient): Promise<Canary[]> {
  const { runCustomCanaries } = await import("./custom-canaries");
  const client = admin ?? (await import("@/lib/supabase/admin")).createAdminClient();
  try {
    return await runCustomCanaries(client);
  } catch {
    // One broken custom canary must not cost you the built-in board.
    return [];
  }
}

/**
 * Whether the numbers on the client pages are actually from this week.
 *
 * Sits next to the Basecamp sync canary for the same reason: stale ads figures
 * do not look stale, they look like facts. Two months of frozen spend and
 * impression share went unnoticed in 2026 because nothing asked this question.
 */
export async function checkAdsFreshness(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary> {
  const base = {
    key: "ads-freshness",
    name: "Ads reporting",
    watches:
      "When each ads account last completed a refresh. Stale spend and impression-share figures read as current on the client page.",
  } as const;

  const [{ data: clients, error: clientsError }, { data: snapshots, error: snapshotsError }] =
    await Promise.all([
      supabase.from("clients").select("id, account_name, ads_customer_id"),
      supabase
        .from("client_ads_snapshots")
        .select("client_id, run_status, created_at, error_message")
        .order("created_at", { ascending: false })
        .returns<SnapshotRow[]>(),
    ]);

  const error = clientsError ?? snapshotsError;
  if (error) {
    return { ...base, status: "attention", headline: "Could not read ads snapshots.", detail: [error.message] };
  }

  // Only accounts we can actually sync. A client with no customer ID is not
  // stale, it is not connected — a different problem, and not this canary's.
  const accounts: FreshnessAccount[] = (clients ?? [])
    .filter((client) => isSyncableAdsCustomerId(client.ads_customer_id as string | null))
    .map((client) => ({ id: client.id as number, account_name: client.account_name as string }));

  const freshness = assessFreshness(accounts, snapshots ?? [], now);

  if (freshness.status === "ok") {
    return {
      ...base,
      status: "ok",
      headline:
        accounts.length === 0
          ? "No client has a Google Ads account connected."
          : `All ${freshness.considered} ads accounts refreshed within ${SNAPSHOT_STALE_DAYS} days.`,
      detail: [],
    };
  }

  const toItems = (entries: AccountFreshness[]): CanaryItem[] =>
    entries.map((entry) => ({
      label: entry.accountName,
      meta: [
        entry.days === null ? "never refreshed" : `last refreshed ${entry.days}d ago`,
        entry.lastError ? `— ${entry.lastError}` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/dashboard/clients/${entry.clientId}?tab=ads`,
      flagged: entry.days === null || Boolean(entry.lastError),
    }));

  const section = (
    heading: string,
    blurb: string,
    tone: CanaryStatus,
    entries: AccountFreshness[],
  ): CanarySection | null =>
    entries.length === 0
      ? null
      : {
          heading: `${heading} (${entries.length})`,
          blurb,
          tone,
          groups: [{ title: heading, meta: `${entries.length} accounts`, items: toItems(entries) }],
        };

  const sections = [
    section(
      "Never refreshed",
      "Connected to a customer ID but no completed sync has ever run. Usually a permissions problem on that account.",
      "overdue",
      freshness.never,
    ),
    section(
      "Last attempt failed",
      "An older sync succeeded, so the page still shows numbers — they just stopped updating on this date.",
      "overdue",
      freshness.failing,
    ),
    section(
      "Behind",
      `No completed refresh in ${SNAPSHOT_STALE_DAYS}+ days.`,
      "attention",
      freshness.stale,
    ),
  ].filter((x): x is CanarySection => x !== null);

  const detail: string[] = [];
  if (freshness.status === "overdue") {
    detail.push(
      // Every account being equally stale is the signature of the job not
      // running, which is a different fix from one account failing.
      "Every account is behind by roughly the same amount, which means the nightly job is not running rather than any one account failing.",
      "Check the Ads sync workflow on GitHub, and that CRON_SECRET matches between GitHub and Vercel.",
    );
  }
  if (freshness.freshestDays !== null) {
    detail.push(`Freshest account refreshed ${freshness.freshestDays}d ago.`);
  }

  return {
    ...base,
    status: freshness.status,
    headline:
      freshness.status === "overdue"
        ? `No ads account has refreshed in ${freshness.freshestDays ?? "any number of"} days — the nightly sync has stopped.`
        : `${freshness.stale.length + freshness.never.length} of ${freshness.considered} ads accounts are not up to date.`,
    detail,
    action: { label: "Open Ads Optimization", href: "/global-ads-optimization" },
    sections,
  };
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
    watches:
      "Client records pointing at the same Basecamp project as another client. Threads are still monitored; the labelling and per-client aggregates are what suffer.",
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
    status: "attention",
    headline: `${skippedClients} client record${skippedClients === 1 ? "" : "s"} share a Basecamp project with another client.`,
    detail: [
      // The sync walks Basecamp's project list now, so the threads themselves
      // are safe. What is wrong is that one project's history lands on one
      // client's record, and the other clients look silent when they are not.
      "The threads are monitored either way — the sync walks Basecamp directly. But only one of these records gets the project's activity, so the others read as quiet on the comms monitor.",
      "Fix by giving each client its own Basecamp project ID, or clearing it on the records that should not have one.",
    ],
    action: { label: "Open Project Wiring", href: "/basecamp-projects" },
    sections: [
      {
        heading: `Shared projects (${duplicates.length})`,
        blurb: "First listed gets the project's activity on its record; the rest show as quiet.",
        tone: "overdue",
        groups: duplicates.map((g) => ({
          title: `Basecamp project ${g.projectId}`,
          meta: `${g.clients.length} clients`,
          items: g.clients.map((c, i) => ({
            label: c.name,
            meta: i === 0 ? `client ${c.id} · gets the activity` : `client ${c.id} · reads as quiet`,
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

  const [{ data: rows, error }, { data: clients }, ignores] = await Promise.all([
    supabase
      .from("basecamp_communication_events")
      .select(
        "client_id, basecamp_project_id, basecamp_project_name, thread_title, thread_url, thread_excerpt, occurred_at, is_internal, reply_need, reply_need_reason, reply_need_escalated, classified_excerpt",
      )
      .order("occurred_at", { ascending: false })
      .returns<ThreadRow[]>(),
    supabase.from("clients").select("id, account_name"),
    listBasecampProjectIgnores(supabase).catch(() => []),
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
    { ignoredProjectIds: new Set(ignores.map((row) => row.basecamp_project_id)) },
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
        // A project with no client record is named and marked, not hidden.
        title: g.hasClient ? g.clientName : `${g.clientName} · no client record`,
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
