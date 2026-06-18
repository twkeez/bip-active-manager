import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateClaudeText } from "@/lib/ai/claude";

type TriageResult = {
  doToday: string[];
  stalled: string[];
  canWait: string[];
};

function daysSince(isoString: string): number {
  const ms = Date.now() - new Date(isoString).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tasks, error } = await supabase
    .from("user_tasks")
    .select("id,title,description,priority,status,due_date,updated_at")
    .eq("owner_user_id", user.id)
    .neq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json<{ triage: TriageResult }>({
      triage: { doToday: [], stalled: [], canWait: [] },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const taskLines = tasks.map((t) => {
    const days = daysSince(t.updated_at as string);
    const due = t.due_date ? ` | due: ${t.due_date}` : "";
    const overdue =
      t.due_date && (t.due_date as string) < today ? " [OVERDUE]" : "";
    return `- [${t.priority?.toUpperCase() ?? "MEDIUM"}${overdue}] "${t.title}" (status: ${t.status}, last touched: ${days}d ago${due})`;
  });

  const prompt = `You are helping Tom, the owner of Beyond Indigo Pets (a veterinary marketing agency), triage his open work tasks.

Today is ${today}.

Open tasks:
${taskLines.join("\n")}

Categorize every task into exactly one of these three groups:
1. DO_TODAY — Overdue tasks, tasks due within 2 days, high-priority in-progress items, or anything urgent
2. STALLED — Tasks last touched 5 or more days ago that are not done
3. CAN_WAIT — Everything else

Return ONLY valid JSON with this exact shape, no commentary:
{
  "doToday": ["exact task title", ...],
  "stalled": ["exact task title", ...],
  "canWait": ["exact task title", ...]
}

Every task title must appear in exactly one array. Use the exact title text.`;

  try {
    const raw = await generateClaudeText(prompt);
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced?.[1] ?? raw).trim();
    const parsed = JSON.parse(candidate) as TriageResult;
    return NextResponse.json({ triage: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Triage failed" },
      { status: 500 },
    );
  }
}
