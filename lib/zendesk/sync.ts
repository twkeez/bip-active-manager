import { createAdminClient } from "@/lib/supabase/admin";
import { extractDomains } from "@/lib/help-desk/domains";
import { ZendeskRateLimitedError, zendeskGet } from "@/lib/zendesk/client";

/**
 * Copies Zendesk organizations, users and tickets into Supabase.
 *
 * Users and tickets come from the cursor-based incremental exports
 * (/api/v2/incremental/{users,tickets}/cursor): one request returns up to
 * 1,000 records changed since a point in time, plus a cursor for the next.
 * The cursor is saved after every page, so a run that hits its time limit (or
 * Zendesk's rate limit) loses nothing — the next run continues from it, and
 * once a stream has caught up, the same cursor fetches only what changed.
 *
 * Organizations have no cursor export worth the bother; there are few of
 * them, so each run re-reads the list.
 */

type Stream = "organizations" | "users" | "tickets";

/** "Back as far as we can go": Zendesk launched in 2007, so this predates any ticket. */
const HISTORY_START_UNIX = Math.floor(Date.UTC(2007, 0, 1) / 1000);

/** The opening message is kept only long enough to say what a ticket is about. */
const DESCRIPTION_LIMIT = 1500;
const MENTIONED_DOMAIN_LIMIT = 25;

type ZendeskOrganization = {
  id: number;
  name: string;
  domain_names?: string[] | null;
  updated_at?: string | null;
};

type ZendeskUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  organization_id?: number | null;
  updated_at?: string | null;
};

type ZendeskTicket = {
  id: number;
  subject?: string | null;
  raw_subject?: string | null;
  description?: string | null;
  status?: string | null;
  requester_id?: number | null;
  submitter_id?: number | null;
  organization_id?: number | null;
  tags?: string[] | null;
  via?: { channel?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CursorPage = {
  after_cursor?: string | null;
  end_of_stream?: boolean;
};

export type StreamResult = {
  stream: Stream;
  fetched: number;
  caughtUp: boolean;
  /** Set when the run stopped early (time or rate limit), not on failure. */
  pausedReason?: string;
};

export type ZendeskSyncResult = {
  done: boolean;
  streams: StreamResult[];
  counts: { organizations: number; users: number; tickets: number };
};

type Admin = ReturnType<typeof createAdminClient>;

async function loadState(admin: Admin, stream: Stream) {
  const { data, error } = await admin
    .from("zendesk_sync_state")
    .select("cursor, caught_up")
    .eq("stream", stream)
    .maybeSingle<{ cursor: string | null; caught_up: boolean }>();
  if (error) throw new Error(`zendesk_sync_state: ${error.message}`);
  return { cursor: data?.cursor ?? null, caughtUp: data?.caught_up ?? false };
}

async function saveState(
  admin: Admin,
  stream: Stream,
  patch: { cursor?: string | null; caught_up?: boolean; last_error?: string | null },
) {
  const { error } = await admin
    .from("zendesk_sync_state")
    .upsert({ stream, last_run_at: new Date().toISOString(), ...patch }, { onConflict: "stream" });
  if (error) throw new Error(`zendesk_sync_state: ${error.message}`);
}

async function upsertChunks(admin: Admin, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(table).upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function countRows(admin: Admin, table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

function pause(stream: Stream, fetched: number, caughtUp: boolean, error: unknown): StreamResult {
  if (error instanceof ZendeskRateLimitedError) {
    return { stream, fetched, caughtUp, pausedReason: `Zendesk rate limit — continuing in about ${error.retryAfterSeconds}s` };
  }
  throw error;
}

async function syncOrganizations(admin: Admin, deadline: number): Promise<StreamResult> {
  const state = await loadState(admin, "organizations");
  // A saved cursor here means an earlier run stopped part way through the list.
  let next: string | null = state.cursor
    ? `/api/v2/organizations.json?page[size]=100&page[after]=${encodeURIComponent(state.cursor)}`
    : "/api/v2/organizations.json?page[size]=100";
  let fetched = 0;

  try {
    while (next) {
      if (Date.now() > deadline) {
        return { stream: "organizations", fetched, caughtUp: false, pausedReason: "out of time for this run" };
      }
      const page: {
        organizations?: ZendeskOrganization[];
        meta?: { has_more?: boolean; after_cursor?: string | null };
      } = await zendeskGet(next, deadline);
      const organizations = page.organizations ?? [];
      const now = new Date().toISOString();
      await upsertChunks(
        admin,
        "zendesk_organizations",
        organizations.map((org) => ({
          id: org.id,
          name: org.name,
          domain_names: org.domain_names ?? [],
          source_updated_at: org.updated_at ?? null,
          synced_at: now,
        })),
      );
      fetched += organizations.length;
      const after = page.meta?.has_more ? page.meta.after_cursor ?? null : null;
      await saveState(admin, "organizations", { cursor: after, last_error: null });
      next = after ? `/api/v2/organizations.json?page[size]=100&page[after]=${encodeURIComponent(after)}` : null;
    }
  } catch (error) {
    return pause("organizations", fetched, false, error);
  }

  await saveState(admin, "organizations", { cursor: null, caught_up: true, last_error: null });
  return { stream: "organizations", fetched, caughtUp: true };
}

/** Shared loop for the two cursor-based incremental exports. */
async function syncIncremental<T>(
  admin: Admin,
  stream: "users" | "tickets",
  path: string,
  key: "users" | "tickets",
  toRow: (item: T, now: string) => Record<string, unknown>,
  deadline: number,
): Promise<StreamResult> {
  const state = await loadState(admin, stream);
  let caughtUp = state.caughtUp;
  let cursor = state.cursor;
  let fetched = 0;

  try {
    for (;;) {
      if (Date.now() > deadline) {
        return { stream, fetched, caughtUp, pausedReason: "out of time for this run" };
      }
      const query = cursor
        ? `cursor=${encodeURIComponent(cursor)}`
        : `start_time=${HISTORY_START_UNIX}`;
      const page = await zendeskGet<CursorPage & Record<string, unknown>>(
        `${path}?per_page=1000&${query}${stream === "tickets" ? "&exclude_deleted=true" : ""}`,
        deadline,
      );
      const items = (page[key] as T[] | undefined) ?? [];
      const now = new Date().toISOString();
      await upsertChunks(admin, `zendesk_${stream}`, items.map((item) => toRow(item, now)));
      fetched += items.length;

      // Keep the old cursor if Zendesk sends none, so the next run does not
      // start again from 2007.
      cursor = page.after_cursor ?? cursor;
      if (page.end_of_stream) caughtUp = true;
      await saveState(admin, stream, { cursor, caught_up: caughtUp, last_error: null });
      if (page.end_of_stream) return { stream, fetched, caughtUp };
    }
  } catch (error) {
    return pause(stream, fetched, caughtUp, error);
  }
}

function userRow(user: ZendeskUser, now: string) {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ? user.email.trim().toLowerCase() : null,
    role: user.role ?? null,
    organization_id: user.organization_id ?? null,
    source_updated_at: user.updated_at ?? null,
    synced_at: now,
  };
}

export function ticketRow(ticket: ZendeskTicket, now: string) {
  const subject = ticket.subject ?? ticket.raw_subject ?? null;
  const description = ticket.description ?? null;
  return {
    id: ticket.id,
    subject,
    description: description ? description.slice(0, DESCRIPTION_LIMIT) : null,
    status: ticket.status ?? null,
    channel: ticket.via?.channel ?? null,
    requester_id: ticket.requester_id ?? null,
    submitter_id: ticket.submitter_id ?? null,
    organization_id: ticket.organization_id ?? null,
    tags: ticket.tags ?? [],
    // Read from the full description, before it is cut short.
    mentioned_domains: extractDomains(`${subject ?? ""}\n${description ?? ""}`).slice(0, MENTIONED_DOMAIN_LIMIT),
    source_created_at: ticket.created_at ?? null,
    source_updated_at: ticket.updated_at ?? null,
    synced_at: now,
  };
}

/**
 * Pulls as much as fits before `deadline`. Call again until `done` — the first
 * full backfill takes several runs on a busy help desk.
 */
export async function syncZendesk(deadline: number): Promise<ZendeskSyncResult> {
  const admin = createAdminClient();
  const streams: StreamResult[] = [];

  try {
    const organizations = await syncOrganizations(admin, deadline);
    streams.push(organizations);
    if (!organizations.pausedReason) {
      const users = await syncIncremental<ZendeskUser>(
        admin, "users", "/api/v2/incremental/users/cursor", "users", userRow, deadline,
      );
      streams.push(users);
      if (!users.pausedReason) {
        streams.push(
          await syncIncremental<ZendeskTicket>(
            admin, "tickets", "/api/v2/incremental/tickets/cursor", "tickets", ticketRow, deadline,
          ),
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed: Stream = (["organizations", "users", "tickets"] as const)[streams.length] ?? "tickets";
    await saveState(admin, failed, { last_error: message }).catch(() => undefined);
    throw error;
  }

  const counts = {
    organizations: await countRows(admin, "zendesk_organizations"),
    users: await countRows(admin, "zendesk_users"),
    tickets: await countRows(admin, "zendesk_tickets"),
  };
  const done = streams.length === 3 && streams.every((s) => !s.pausedReason && s.caughtUp);
  return { done, streams, counts };
}
