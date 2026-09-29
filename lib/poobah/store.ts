import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientLifecycleStatus } from "@/lib/clients/client-status";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import {
  LIMITS,
  bipStatusLabel,
  type PoobahActor,
  type PoobahBipStatus,
  type PoobahChange,
  type PoobahDetail,
  type PoobahItem,
  type PoobahLogEntry,
  type PoobahStatus,
  type PoobahSummary,
  type PoobahWatch,
} from "./types";
import {
  PoobahError,
  freeText,
  isoDate,
  itemFields,
  optionalIsoDate,
  optionalText,
  requiredText,
} from "./validate";

/**
 * Every read and write of Poobah Client Watch, shared by the page's API and
 * the Claude connector so both behave the same.
 *
 * Reads page through every row (never the silent 1000-row cap). Writes go
 * through one database function each, which saves the change and its history
 * record together, and hand back the row as stored.
 *
 * Needs the service-role client: the tables are closed to the browser roles.
 */

type ClientName = {
  id: number;
  account_name: string | null;
  public_name: string | null;
  onboarding_status?: string | null;
  awaiting_website_launch?: boolean | null;
};

/** The linked client's lifecycle, from the row just read (never stored on the watch). */
function bipStatusOf(client: ClientName | null): PoobahBipStatus {
  if (!client) return null;
  return getClientLifecycleStatus({
    onboarding_status: client.onboarding_status === "active" || client.onboarding_status === "complete" ? client.onboarding_status : null,
    awaiting_website_launch: Boolean(client.awaiting_website_launch),
  });
}
type WatchWithClient = PoobahWatch & { client: ClientName | null };

const clientLabel = (client: ClientName | null) =>
  client ? (client.public_name?.trim() || client.account_name?.trim() || `Client ${client.id}`) : null;

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

function dbError(context: string, error: { message: string; code?: string } | null): never {
  const message = error?.message ?? "unknown error";
  if (error?.code === "23505" || /duplicate key/i.test(message)) {
    throw new PoobahError(`${context}: that client is already on the watch list.`, 409);
  }
  if (/relation .* does not exist|could not find the (table|function)/i.test(message)) {
    throw new PoobahError(
      `${context}: the Poobah Client Watch tables do not exist yet. Run supabase/migrations/20260929120000_poobah_client_watch.sql.`,
      500,
    );
  }
  throw new PoobahError(`${context}: ${message}`, 500);
}

async function loadWatches(admin: SupabaseClient): Promise<WatchWithClient[]> {
  try {
    return await fetchAllRows<WatchWithClient>(
      (from, to) =>
        admin
          .from("poobah_watches")
          .select("*, client:clients(id,account_name,public_name,onboarding_status,awaiting_website_launch)")
          .order("id")
          .range(from, to),
      "Poobah watches",
    );
  } catch (error) {
    dbError("Could not read the watch list", { message: error instanceof Error ? error.message : String(error) });
  }
}

/** Every watched client, most recently updated first. */
export async function listWatches(admin: SupabaseClient): Promise<PoobahSummary[]> {
  const watches = await loadWatches(admin);
  const read = async <T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    try {
      return await fetchAllRows<T>(build, label);
    } catch (error) {
      dbError(`Could not read ${label}`, { message: error instanceof Error ? error.message : String(error) });
    }
  };
  const [statuses, openItems, log] = await Promise.all([
    read<Pick<PoobahStatus, "watch_id" | "status" | "set_at" | "id">>("statuses", (from, to) =>
      admin.from("poobah_statuses").select("id,watch_id,status,set_at").order("set_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    ),
    read<Pick<PoobahItem, "watch_id" | "id">>("open items", (from, to) =>
      admin.from("poobah_items").select("id,watch_id").eq("done", false).order("id").range(from, to),
    ),
    read<Pick<PoobahLogEntry, "watch_id" | "entry_date" | "id">>("log entries", (from, to) =>
      admin.from("poobah_log").select("id,watch_id,entry_date").order("entry_date", { ascending: false }).order("id", { ascending: false }).range(from, to),
    ),
  ]);

  const latestStatus = new Map<number, { status: string; set_at: string }>();
  for (const row of statuses) if (!latestStatus.has(row.watch_id)) latestStatus.set(row.watch_id, row);
  const openCount = new Map<number, number>();
  for (const row of openItems) openCount.set(row.watch_id, (openCount.get(row.watch_id) ?? 0) + 1);
  const lastLog = new Map<number, string>();
  for (const row of log) if (!lastLog.has(row.watch_id)) lastLog.set(row.watch_id, row.entry_date);

  return watches
    .map((watch) => ({
      id: watch.id,
      name: watch.name,
      client_id: watch.client_id,
      client_name: clientLabel(watch.client),
      bip_status: bipStatusOf(watch.client),
      bip_status_label: bipStatusLabel(bipStatusOf(watch.client)),
      status: latestStatus.get(watch.id)?.status ?? null,
      status_set_at: latestStatus.get(watch.id)?.set_at ?? null,
      open_items: openCount.get(watch.id) ?? 0,
      last_log_date: lastLog.get(watch.id) ?? null,
      updated_at: watch.updated_at,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
}

/**
 * The watched client meant by `ref`: its watch id, or a name (the watch's or
 * the linked client's). An ambiguous name is refused with the candidates,
 * never guessed.
 */
export async function resolveWatch(admin: SupabaseClient, ref: unknown): Promise<WatchWithClient> {
  const watches = await loadWatches(admin);
  const text = typeof ref === "number" ? String(ref) : typeof ref === "string" ? ref.trim() : "";
  if (!text) throw new PoobahError("Say which client: its watch id or its name.");
  if (/^#?\d+$/.test(text)) {
    const id = Number(text.replace("#", ""));
    const byId = watches.find((watch) => watch.id === id);
    if (byId) return byId;
    throw new PoobahError(`No watched client has id ${id}. Use list_watched_clients to see the ids.`, 404);
  }
  const wanted = norm(text);
  const names = (watch: WatchWithClient) => [watch.name, watch.client?.account_name, watch.client?.public_name].map(norm);
  const exact = watches.filter((watch) => names(watch).includes(wanted));
  const matches = exact.length ? exact : watches.filter((watch) => names(watch).some((name) => name && name.includes(wanted)));
  if (matches.length === 1) return matches[0];
  if (!matches.length) {
    throw new PoobahError(`"${text}" is not on the watch list. Use list_watched_clients to see who is.`, 404);
  }
  throw new PoobahError(
    `"${text}" matches ${matches.length} watched clients: ${matches.map((watch) => `${watch.name} (id ${watch.id})`).join(", ")}. Use the id.`,
    409,
  );
}

/** Everything about one watched client. */
export async function getWatch(admin: SupabaseClient, watchId: number): Promise<PoobahDetail> {
  const watch = (await loadWatches(admin)).find((row) => row.id === watchId);
  if (!watch) throw new PoobahError(`No watched client has id ${watchId}.`, 404);
  const read = async <T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    try {
      return await fetchAllRows<T>(build, label);
    } catch (error) {
      dbError(`Could not read ${label}`, { message: error instanceof Error ? error.message : String(error) });
    }
  };
  const [statuses, items, log, changes] = await Promise.all([
    read<PoobahStatus>("statuses", (from, to) =>
      admin.from("poobah_statuses").select("*").eq("watch_id", watchId).order("set_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    ),
    read<PoobahItem>("open items", (from, to) =>
      admin.from("poobah_items").select("*").eq("watch_id", watchId).order("id").range(from, to),
    ),
    read<PoobahLogEntry>("log", (from, to) =>
      admin.from("poobah_log").select("*").eq("watch_id", watchId).order("entry_date", { ascending: false }).order("id", { ascending: false }).range(from, to),
    ),
    read<PoobahChange>("change history", (from, to) =>
      admin.from("poobah_changes").select("*").eq("watch_id", watchId).order("at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    ),
  ]);
  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "") || b.id - a.id);
  const { client, ...plain } = watch;
  return {
    watch: plain,
    client: client
      ? {
          id: client.id,
          name: clientLabel(client) ?? `Client ${client.id}`,
          bip_status: bipStatusOf(client) ?? "active",
          bip_status_label: bipStatusLabel(bipStatusOf(client)),
        }
      : null,
    statuses,
    items: [...open, ...done],
    log,
    changes,
  };
}

/**
 * The BIP Control client meant by `ref` (a client id or a name), so a watch
 * links to it instead of copying it. Returns null when nothing matches.
 */
export async function findClient(
  admin: SupabaseClient,
  ref: string | number,
): Promise<{ id: number; name: string } | null> {
  let clients: ClientName[];
  try {
    clients = await fetchAllRows<ClientName>(
      (from, to) => admin.from("clients").select("id,account_name,public_name").order("id").range(from, to),
      "clients",
    );
  } catch (error) {
    dbError("Could not read clients", { message: error instanceof Error ? error.message : String(error) });
  }
  const text = String(ref).trim();
  if (/^\d+$/.test(text)) {
    const byId = clients.find((client) => client.id === Number(text));
    if (!byId) throw new PoobahError(`No BIP Control client has id ${text}.`, 404);
    return { id: byId.id, name: clientLabel(byId)! };
  }
  const wanted = norm(text);
  const names = (client: ClientName) => [client.account_name, client.public_name].map(norm);
  const exact = clients.filter((client) => names(client).includes(wanted));
  const matches = exact.length ? exact : clients.filter((client) => names(client).some((name) => name && name.includes(wanted)));
  if (matches.length === 1) return { id: matches[0].id, name: clientLabel(matches[0])! };
  if (!matches.length) return null;
  throw new PoobahError(
    `"${text}" matches ${matches.length} BIP Control clients: ${matches
      .slice(0, 10)
      .map((client) => `${clientLabel(client)} (client id ${client.id})`)
      .join(", ")}${matches.length > 10 ? ", …" : ""}. Give the client id.`,
    409,
  );
}

async function rpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>, context: string): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) dbError(context, error);
  if (data == null) throw new PoobahError(`${context}: the database did not confirm the save.`, 500);
  return data as T;
}

const actorArgs = (actor: PoobahActor) => ({ p_actor_kind: actor.kind, p_actor_email: actor.email });

/**
 * Put a client on the watch list. `client` is a BIP Control client id or name;
 * a match links the watch to that client. With `allowUnlinked`, a name that
 * matches no client is watched on its own (e.g. a prospect).
 */
export async function addWatch(
  admin: SupabaseClient,
  input: { client: unknown; status?: unknown; basics?: unknown; allowUnlinked?: boolean },
  actor: PoobahActor,
): Promise<{ watch: PoobahWatch; status: PoobahStatus | null; linkedClient: { id: number; name: string } | null }> {
  const ref = typeof input.client === "number" ? String(input.client) : requiredText(input.client, "client", LIMITS.name);
  const status = optionalText(input.status, "status", LIMITS.status);
  const basics = freeText(input.basics, "basics", LIMITS.basics);
  const linked = await findClient(admin, ref);
  if (!linked && !input.allowUnlinked) {
    throw new PoobahError(
      `No BIP Control client matches "${ref}". To watch it anyway (e.g. a prospect), add it as unlinked.`,
      404,
    );
  }
  const saved = await rpc<{ watch: PoobahWatch; status: PoobahStatus | null }>(
    admin,
    "poobah_add_watch",
    {
      p_name: linked?.name ?? ref,
      p_client_id: linked?.id ?? null,
      p_status: status,
      p_basics: basics,
      ...actorArgs(actor),
    },
    "Could not add the client",
  );
  return { watch: saved.watch, status: saved.status ?? null, linkedClient: linked };
}

export async function setStatus(admin: SupabaseClient, watchId: number, status: unknown, actor: PoobahActor): Promise<PoobahStatus> {
  return rpc<PoobahStatus>(
    admin,
    "poobah_set_status",
    { p_watch_id: watchId, p_status: requiredText(status, "status", LIMITS.status), ...actorArgs(actor) },
    "Could not save the status",
  );
}

export async function setBasics(admin: SupabaseClient, watchId: number, basics: unknown, actor: PoobahActor): Promise<PoobahWatch> {
  return rpc<PoobahWatch>(
    admin,
    "poobah_set_basics",
    { p_watch_id: watchId, p_basics: freeText(basics, "basics", LIMITS.basics), ...actorArgs(actor) },
    "Could not save the account basics",
  );
}

export async function addLogEntry(
  admin: SupabaseClient,
  watchId: number,
  input: { date: unknown; text: unknown; source: unknown },
  actor: PoobahActor,
): Promise<PoobahLogEntry> {
  return rpc<PoobahLogEntry>(
    admin,
    "poobah_add_log",
    {
      p_watch_id: watchId,
      p_entry_date: isoDate(input.date, "date"),
      p_text: requiredText(input.text, "text", LIMITS.text),
      p_source: requiredText(input.source, "source", LIMITS.source),
      ...actorArgs(actor),
    },
    "Could not save the log entry",
  );
}

export async function addItem(
  admin: SupabaseClient,
  watchId: number,
  input: { text: unknown; owner?: unknown; due_date?: unknown },
  actor: PoobahActor,
): Promise<PoobahItem> {
  return rpc<PoobahItem>(
    admin,
    "poobah_add_item",
    {
      p_watch_id: watchId,
      p_text: requiredText(input.text, "text", LIMITS.text),
      p_owner: optionalText(input.owner, "owner", LIMITS.owner),
      p_due_date: optionalIsoDate(input.due_date, "due_date"),
      ...actorArgs(actor),
    },
    "Could not save the open item",
  );
}

export async function updateItem(admin: SupabaseClient, itemId: unknown, fields: unknown, actor: PoobahActor): Promise<PoobahItem> {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new PoobahError("item_id must be a whole number.");
  const { data: existing, error } = await admin.from("poobah_items").select("id").eq("id", id).maybeSingle();
  if (error) dbError("Could not read the item", error);
  if (!existing) throw new PoobahError(`No open item has id ${id}.`, 404);
  return rpc<PoobahItem>(
    admin,
    "poobah_update_item",
    { p_item_id: id, p_fields: itemFields(fields), ...actorArgs(actor) },
    "Could not save the item",
  );
}
