import type { SupabaseClient } from "@supabase/supabase-js";
import { generateClaudeText } from "@/lib/ai/claude";

type Scorable = {
  id: number;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  snippet: string | null;
};

const VALID = new Set(["high", "medium", "low"]);

/**
 * Scores not-yet-assessed inbox emails for how urgently the owner personally
 * needs to look at them. One batched Claude call; resilient — on any failure it
 * leaves messages unscored rather than throwing (so sync still succeeds).
 */
export async function scoreUnassessedEmails(
  admin: SupabaseClient,
  userId: string,
  limit = 25,
): Promise<{ scored: number }> {
  const { data } = await admin
    .from("user_email_messages")
    .select("id, subject, from_name, from_email, snippet")
    .eq("owner_user_id", userId)
    .eq("triage_status", "inbox")
    .is("ai_assessed_at", null)
    .order("internal_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  const rows = (data ?? []) as Scorable[];
  if (rows.length === 0) return { scored: 0 };

  const list = rows
    .map(
      (r, i) =>
        `${i + 1}. [id=${r.id}] From: ${r.from_name ?? ""} <${r.from_email ?? ""}> | Subject: ${r.subject ?? "(none)"} | ${(r.snippet ?? "").replace(/\s+/g, " ").slice(0, 220)}`,
    )
    .join("\n");

  const prompt = `You triage the inbox of Tom, who runs a veterinary digital-marketing agency (Beyond Indigo Pets). For each email, decide how urgently HE personally needs to look at it.

Return ONLY a JSON array — one object per email, no prose:
[{"id": <number>, "priority": "high"|"medium"|"low", "reason": "<max 10 words>"}]

- "high": needs Tom's personal attention soon — a client question/request, a problem or complaint, money/invoices, deadlines, or anything addressed directly to him.
- "medium": useful but not urgent — FYIs, status updates, things he'd want to see eventually.
- "low": newsletters, promotions, automated notifications, receipts, nothing actionable.

Keep each reason specific and short (e.g. "client asking for report status", "invoice due Friday", "marketing newsletter").

Emails:
${list}`;

  let parsed: Array<{ id: number; priority: string; reason: string }> = [];
  try {
    const raw = await generateClaudeText(prompt);
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return { scored: 0 };
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { scored: 0 };
  }

  const now = new Date().toISOString();
  let scored = 0;
  for (const p of parsed) {
    if (typeof p?.id !== "number") continue;
    const priority = VALID.has(p.priority) ? p.priority : "low";
    const { error } = await admin
      .from("user_email_messages")
      .update({
        ai_priority: priority,
        ai_priority_reason: (p.reason ?? "").slice(0, 200) || null,
        ai_assessed_at: now,
        // Surface AI-flagged "high" in the existing High-priority view too.
        ...(priority === "high" ? { is_high_priority: true } : {}),
      })
      .eq("id", p.id)
      .eq("owner_user_id", userId);
    if (!error) scored++;
  }
  return { scored };
}
