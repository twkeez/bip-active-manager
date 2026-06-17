import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiText } from "@/lib/ai/gemini";

type Params = Promise<{ clientId: string }>;

type ReportSnapshot = {
  clientName: string;
  strategist: string | null;
  windowLabel: string;
  kpis: Array<{ label: string; value: string }>;
  gains: Array<{ label: string; deltaPercent: number }>;
  channels: Array<{ title: string; metrics: Array<{ label: string; current: number | null; valueSuffix?: string | null }> }>;
  recommendations: Array<{ priority: string; text: string }>;
};

export async function POST(req: Request, context: { params: Params }) {
  const { clientId } = await context.params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let snapshot: ReportSnapshot;
  try {
    snapshot = await req.json() as ReportSnapshot;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { clientName, strategist, windowLabel, kpis, gains, channels, recommendations } = snapshot;

  // Build a data summary for the prompt — focus on positives and real numbers
  const kpiLines = kpis
    .filter((k) => k.value && !["not connected", "not synced", "coming soon", "n/a"].includes(k.value.toLowerCase()))
    .map((k) => `  - ${k.label}: ${k.value}`)
    .join("\n");

  const gainLines = gains
    .slice(0, 5)
    .map((g) => `  - ${g.label}: +${g.deltaPercent.toFixed(1)}%`)
    .join("\n");

  const channelLines = channels
    .flatMap((c) =>
      c.metrics
        .filter((m) => m.current != null && m.current > 0)
        .map((m) => `  - ${c.title} / ${m.label}: ${m.current!.toLocaleString()}${m.valueSuffix ?? ""}`)
    )
    .join("\n");

  const recLines = recommendations
    .filter((r) => r.priority === "high" || r.priority === "medium")
    .slice(0, 3)
    .map((r) => `  - [${r.priority}] ${r.text}`)
    .join("\n");

  const prompt = `You are ${strategist ?? "a digital marketing strategist"} at Beyond Indigo Pets, writing a brief, warm, professional intro paragraph for a client performance report.

Client: ${clientName}
Reporting window: ${windowLabel}

KEY METRICS THIS PERIOD:
${kpiLines || "  (no numeric KPIs available)"}

PERFORMANCE GAINS VS PRIOR PERIOD:
${gainLines || "  (no prior-period comparisons available)"}

CHANNEL HIGHLIGHTS:
${channelLines || "  (limited channel data)"}

TOP PRIORITIES GOING FORWARD:
${recLines || "  (no recommendations generated)"}

Write a 2–4 sentence strategist intro in first-person ("I" or "we") that:
1. Opens with the strongest positive metric or trend from the data above
2. Briefly acknowledges 1–2 more highlights
3. Sets an optimistic but honest tone for what comes next
4. Sounds personal and direct — not corporate boilerplate

Do not use the phrase "I hope this email finds you well." Do not list every metric. Do not add a subject line or greeting. Just the paragraph text.`;

  try {
    const text = await generateGeminiText(prompt);
    if (!text?.trim()) throw new Error("Empty response from AI");
    return NextResponse.json({ intro: text.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed" },
      { status: 500 },
    );
  }
}
