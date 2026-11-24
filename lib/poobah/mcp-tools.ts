import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBasecampActivity } from "./basecamp";
import { describeRosterEntry, loadResponseReportForClaude, resolveClientForRead } from "./roster";
import { addItem, addLogEntry, addWatch, getWatch, listWatches, resolveWatch, setBasics, setStatus, updateItem } from "./store";
import { EMAIL_COVERAGE_NOTE, POOBAH_NAME, type PoobahActor } from "./types";
import { PoobahError, todayEastern } from "./validate";

// Poobah Client Watch as tools for Claude. Every tool answers with an explicit
// success (and, for a write, the record exactly as saved) or an error saying
// why. Reads are never cut short, and say so. Nothing can be deleted.

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

function actorFrom(ctx: Ctx): PoobahActor {
  const email = ctx.http?.authInfo?.extra?.email;
  if (typeof email !== "string" || !email) throw new PoobahError("Not signed in. Reconnect the connector.", 400);
  return { kind: "claude", email };
}

async function run(ctx: Ctx, work: (actor: PoobahActor) => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await work(actorFrom(ctx));
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...(result as object) }, null, 2) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }, null, 2) }] };
  }
}

const clientRef = z
  .union([z.string().min(1), z.number().int().positive()])
  .describe("The watched client: its watch id (from list_watched_clients) or its name.");
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

export function registerPoobahTools(server: McpServer) {
  const admin = () => createAdminClient();

  server.registerTool(
    "list_watched_clients",
    {
      title: "List watched clients",
      description: `Every client on ${POOBAH_NAME}, most recently updated first, with current status, open item count, last log date, and the client's live BIP Control lifecycle (bip_status: onboarding, launch = onboarding and waiting on the website, active, or null = not a BIP client). Always the complete list.`,
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async (_args, ctx) =>
      run(ctx as Ctx, async () => {
        const watches = await listWatches(admin());
        return { count: watches.length, complete: true, note: `${watches.length} of ${watches.length} shown.`, coverage_note: EMAIL_COVERAGE_NOTE, watches };
      }),
  );

  server.registerTool(
    "get_client_watch",
    {
      title: "Get a watched client",
      description: "Everything about one watched client: its live BIP Control lifecycle (bip_status), current status and earlier ones, all open and done items, the full running log, account basics, and the change history. Nothing is left out.",
      inputSchema: z.object({ client: clientRef }),
      annotations: readOnly,
    },
    async ({ client }, ctx) =>
      run(ctx as Ctx, async () => {
        const watch = await resolveWatch(admin(), client);
        const detail = await getWatch(admin(), watch.id);
        return {
          complete: true,
          coverage_note: EMAIL_COVERAGE_NOTE,
          bip_status: detail.client?.bip_status ?? null,
          bip_status_label: detail.client?.bip_status_label ?? "Not a BIP client",
          counts: {
            statuses: detail.statuses.length,
            open_items: detail.items.filter((item) => !item.done).length,
            done_items: detail.items.filter((item) => item.done).length,
            log_entries: detail.log.length,
            changes: detail.changes.length,
          },
          current_status: detail.statuses[0] ?? null,
          ...detail,
        };
      }),
  );

  server.registerTool(
    "get_basecamp_activity",
    {
      title: "Read a client's Basecamp conversation",
      description:
        "Read-only. Works for any client on the Master Sheet with a Package, watched or not, and for any watched client: pass `client` (a name or a watch id) or `bip_client_id` (from get_response_report). The answer says whether the client is watched and gives its Master Sheet row (strategist, package). A client's Basecamp activity from BIP Control's own sync: every post in the window with its words (who, when, Beyond Indigo or client), grouped by thread, newest thread first; plus the Response Report's who-is-waiting-on-whom and days waiting. Says when Basecamp last synced and flags it if stale. Words of threads for logins/access are never shown and credential-looking lines are removed. Posts from before 2026-09-29 may have no words until the backfill finishes (each says so).",
      inputSchema: z.object({
        client: z
          .union([z.string().min(1), z.number().int().positive()])
          .optional()
          .describe("A client name (watch list or Master Sheet practice name), or a watch id."),
        bip_client_id: z.number().int().positive().optional().describe("The BIP Control client id of a Master Sheet client, from get_response_report. Use instead of `client`."),
        since_days: z.number().int().min(1).max(365).optional().describe("How many days back. Default 30."),
      }),
      annotations: readOnly,
    },
    async ({ client, bip_client_id, since_days }, ctx) =>
      run(ctx as Ctx, async () => {
        const found = await resolveClientForRead(admin(), { client, bipClientId: bip_client_id });
        return {
          client: found.name,
          bip_client_id: found.clientId,
          on_watch_list: found.watched,
          master_sheet: describeRosterEntry(found.roster),
          ...(await loadBasecampActivity(admin(), found.clientId, since_days ?? 30)),
        };
      }),
  );

  server.registerTool(
    "get_response_report",
    {
      title: "Basecamp Response Report for every Master Sheet client",
      description:
        "Read-only. The Basecamp Response Report exactly as BIP Control shows it: one line for every client on Master Sheet 2026 with a Package (the Strategist is the owner), flagged \"waiting on us\" when the client posted last and \"haven't heard from us\" when our last post is 15+ days old (30+ for low-contact clients and Alex's). Always says how many clients were checked and names every one not reported: could not be read, excluded as cancelling or former, or not matched. `complete` is false when anything is missing. Use `only: \"flagged\"` or `strategist` to narrow the list; the counts always cover the whole roster. Only Basecamp is read; email and calls are not counted.",
      inputSchema: z.object({
        only: z.enum(["all", "flagged"]).optional().describe("\"flagged\" lists only clients waiting on us or who haven't heard from us. Default all."),
        strategist: z.string().optional().describe("Only clients whose Strategist on the sheet contains this name, e.g. \"Alex\"."),
      }),
      annotations: readOnly,
    },
    async ({ only, strategist }, ctx) => run(ctx as Ctx, async () => loadResponseReportForClaude(admin(), { only, strategist })),
  );

  server.registerTool(
    "add_client_to_watch",
    {
      title: "Add a client to the watch list",
      description:
        "Put a client on the watch list. `client` is a BIP Control client name or client id; it links to that client rather than copying it. If the name matches several clients, the answer lists them so you can pass the client id. Set not_a_bip_client to watch someone who is not a client (e.g. a prospect).",
      inputSchema: z.object({
        client: z.union([z.string().min(1), z.number().int().positive()]).describe("BIP Control client name or client id."),
        status: z.string().optional().describe("Current status, a short summary paragraph."),
        basics: z.string().optional().describe("Account basics: services, contacts, budget, targeting."),
        not_a_bip_client: z.boolean().optional().describe("True to watch a name that matches no BIP Control client."),
      }),
      annotations: write,
    },
    async ({ client, status, basics, not_a_bip_client }, ctx) =>
      run(ctx as Ctx, async (actor) => {
        const saved = await addWatch(admin(), { client, status, basics, allowUnlinked: not_a_bip_client === true }, actor);
        return {
          saved: true,
          linked_to_bip_client: saved.linkedClient,
          watch: saved.watch,
          status: saved.status,
        };
      }),
  );

  server.registerTool(
    "update_status",
    {
      title: "Update a client's status",
      description: "Set a watched client's current status. The previous status is kept as history, not overwritten.",
      inputSchema: z.object({ client: clientRef, status: z.string().min(1).describe("The new status, a short summary paragraph.") }),
      annotations: write,
    },
    async ({ client, status }, ctx) =>
      run(ctx as Ctx, async (actor) => {
        const watch = await resolveWatch(admin(), client);
        return { saved: true, client: watch.name, status: await setStatus(admin(), watch.id, status, actor) };
      }),
  );

  server.registerTool(
    "update_basics",
    {
      title: "Update account basics",
      description: "Replace a watched client's account basics (free-form notes: services, contacts, budget, targeting). The old text is kept in the change history.",
      inputSchema: z.object({ client: clientRef, basics: z.string().describe("The full new text of the account basics.") }),
      annotations: write,
    },
    async ({ client, basics }, ctx) =>
      run(ctx as Ctx, async (actor) => {
        const watch = await resolveWatch(admin(), client);
        const saved = await setBasics(admin(), watch.id, basics, actor);
        return { saved: true, client: watch.name, basics: saved.basics, updated_at: saved.updated_at };
      }),
  );

  server.registerTool(
    "add_log_entry",
    {
      title: "Add a log entry",
      description: "Add a dated entry to a watched client's running log.",
      inputSchema: z.object({
        client: clientRef,
        date: z.string().optional().describe("YYYY-MM-DD. Defaults to today (Eastern)."),
        text: z.string().min(1).describe("What happened."),
        source: z.string().min(1).describe('Where it came from, e.g. "email", "Basecamp", "meeting", "Claude".'),
      }),
      annotations: write,
    },
    async ({ client, date, text, source }, ctx) =>
      run(ctx as Ctx, async (actor) => {
        const watch = await resolveWatch(admin(), client);
        return { saved: true, client: watch.name, entry: await addLogEntry(admin(), watch.id, { date: date ?? todayEastern(), text, source }, actor) };
      }),
  );

  server.registerTool(
    "add_open_item",
    {
      title: "Add an open item",
      description: "Add an item to a watched client's open-items checklist.",
      inputSchema: z.object({
        client: clientRef,
        text: z.string().min(1),
        owner: z.string().optional().describe("Who is responsible."),
        due_date: z.string().optional().describe("YYYY-MM-DD, optional."),
      }),
      annotations: write,
    },
    async ({ client, text, owner, due_date }, ctx) =>
      run(ctx as Ctx, async (actor) => {
        const watch = await resolveWatch(admin(), client);
        return { saved: true, client: watch.name, item: await addItem(admin(), watch.id, { text, owner, due_date }, actor) };
      }),
  );

  server.registerTool(
    "update_open_item",
    {
      title: "Change an open item",
      description: "Change an item's text, owner, due date or done state. Only the fields given change; unknown fields are refused. Set owner or due_date to null to clear it.",
      inputSchema: z.object({
        item_id: z.number().int().positive(),
        fields: z
          .object({
            text: z.string().min(1).optional(),
            owner: z.string().nullable().optional(),
            due_date: z.string().nullable().optional().describe("YYYY-MM-DD or null."),
            done: z.boolean().optional(),
          })
          .strict(),
      }),
      annotations: write,
    },
    async ({ item_id, fields }, ctx) =>
      run(ctx as Ctx, async (actor) => ({ saved: true, item: await updateItem(admin(), item_id, fields, actor) })),
  );

  server.registerTool(
    "complete_open_item",
    {
      title: "Complete an open item",
      description: "Mark an item done. It stays on the list, marked done, with who completed it and when.",
      inputSchema: z.object({ item_id: z.number().int().positive() }),
      annotations: write,
    },
    async ({ item_id }, ctx) =>
      run(ctx as Ctx, async (actor) => ({ saved: true, item: await updateItem(admin(), item_id, { done: true }, actor) })),
  );
}
