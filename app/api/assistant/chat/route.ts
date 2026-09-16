import { getProfile } from "@/lib/auth/profile";
import { loadDayContext } from "@/lib/assistant/day-context";
import { runAssistant, type AssistantEvent, type ChatTurn } from "@/lib/assistant/run-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * One turn of the assistant conversation, streamed.
 *
 * The response is newline-delimited JSON: progress events as each lookup
 * happens, then a final "done" with the answer. A full day plan is a dozen
 * lookups and a couple of minutes, and a spinner that long looks broken.
 *
 * Nothing is stored. The page holds the conversation and sends it back each
 * turn; the model's own intermediate work stays on the server.
 */

// A day plan can run past two minutes of lookups.
export const maxDuration = 300;

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 20_000;

function parseHistory(raw: unknown): ChatTurn[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Send the conversation so far.";
  if (raw.length > MAX_TURNS) return "This conversation is too long; start a new one.";
  const turns: ChatTurn[] = [];
  for (const [index, item] of raw.entries()) {
    const turn = item as { role?: unknown; text?: unknown };
    const expected = index % 2 === 0 ? "user" : "assistant";
    if (turn?.role !== expected || typeof turn.text !== "string" || !turn.text.trim()) {
      return "The conversation must alternate you, assistant, you — starting and ending with you.";
    }
    if (turn.text.length > MAX_TURN_CHARS) return "One of the messages is too long.";
    turns.push({ role: expected, text: turn.text });
  }
  if (turns[turns.length - 1].role !== "user") return "The last message must be yours.";
  return turns;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  // Admins only for now: its lookups read past row-level security, and every
  // question costs a few Claude calls.
  if (!profile) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { history?: unknown } | null;
  const history = parseHistory(body?.history);
  if (typeof history === "string") return Response.json({ error: history }, { status: 400 });

  const admin = createAdminClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: AssistantEvent | Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        // Only the opening turn gets today's snapshot; follow-ups look things up.
        let context = null;
        if (history.length === 1) {
          send({ type: "status", text: "Gathering your tasks, calendar and Coal Mines…" });
          context = await loadDayContext(supabase, admin, profile.id);
        }
        const result = await runAssistant(history, context, { supabase, admin, userId: profile.id }, send);
        send({ type: "done", reply: result.reply, stopReason: result.stopReason });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "The assistant failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
