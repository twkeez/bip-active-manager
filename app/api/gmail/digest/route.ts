import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { generateClaudeText } from "@/lib/ai/claude";
import {
  BULK_CATEGORIES,
  CATEGORY_LABELS,
  categorizeEmail,
  type EmailCategory,
} from "@/lib/gmail/categorize";

export const maxDuration = 60;

type MsgRow = {
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
};

async function loadInbox(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin
    .from("user_email_messages")
    .select("from_email, from_name, subject, snippet")
    .eq("owner_user_id", userId)
    .eq("triage_status", "inbox")
    .order("internal_date", { ascending: false, nullsFirst: false })
    .limit(500);
  return (data ?? []) as MsgRow[];
}

// GET → category counts (no AI).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const inbox = await loadInbox(createAdminClient(), user.id);
  const counts = new Map<EmailCategory, number>();
  for (const m of inbox) {
    const cat = categorizeEmail({ fromEmail: m.from_email, fromName: m.from_name, subject: m.subject });
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const groups = BULK_CATEGORIES
    .map((category) => ({ category, label: CATEGORY_LABELS[category], count: counts.get(category) ?? 0 }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
  return NextResponse.json({ groups, peopleCount: counts.get("people") ?? 0 });
}

// POST { category } → AI summary for one group.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  let body: { category?: string } = {};
  try { body = (await request.json()) as { category?: string }; } catch { body = {}; }
  const category = body.category as EmailCategory | undefined;
  if (!category || !(category in CATEGORY_LABELS)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }

  const inbox = await loadInbox(createAdminClient(), user.id);
  const messages = inbox
    .filter((m) => categorizeEmail({ fromEmail: m.from_email, fromName: m.from_name, subject: m.subject }) === category)
    .slice(0, 40);

  if (messages.length === 0) {
    return NextResponse.json({ summary: "No messages in this group right now." });
  }

  const label = CATEGORY_LABELS[category];
  const lines = messages
    .map((m, i) => `${i + 1}. [${m.from_name || m.from_email || "?"}] ${m.subject || "(no subject)"} — ${(m.snippet || "").slice(0, 160)}`)
    .join("\n");
  const prompt = `You are triaging Tom's veterinary-marketing inbox. Below are ${messages.length} emails in the "${label}" group.\n\nWrite a tight digest so Tom can skip reading them individually:\n- One or two sentences summarizing what's in this batch overall.\n- Then a short bulleted list of ONLY items that may need Tom's attention (ad disapprovals, billing/payment issues, client or teammate messages, deadlines, anything unusual). If nothing needs attention, say "Nothing needs your attention — routine notifications." Do not invent details.\nKeep it under 120 words. Plain text with simple "- " bullets.\n\nEmails:\n${lines}`;

  try {
    const summary = (await generateClaudeText(prompt)).trim();
    return NextResponse.json({ summary, count: messages.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to summarize" },
      { status: 500 },
    );
  }
}
