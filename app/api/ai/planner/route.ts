import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  AI_PLANNER_MODEL,
  additionsOutputFormat,
  buildExtendPrompt,
  buildGeneratePrompt,
  buildIdeasPrompt,
  buildRefinePrompt,
  ideasOutputFormat,
  planOutputFormat,
  sectionOutputFormat,
  type PlanAddition,
  type PlanDoc,
  type PlanIdea,
  type PlanSection,
} from "@/lib/ai-planner/plan";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

type Body =
  | { action: "brainstorm"; goal?: string; clientName?: string; url?: string; notes?: string; exclude?: string[] }
  | { action: "generate"; goal?: string; clientName?: string; url?: string; notes?: string; ideas?: PlanIdea[] }
  | { action: "extend"; doc?: PlanDoc; ideas?: PlanIdea[] }
  | { action: "refine"; doc?: PlanDoc; sectionIndex?: number; instruction?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    if (body.action === "brainstorm") {
      const goal = (body.goal ?? "").trim();
      if (!goal) return NextResponse.json({ error: "Describe the goal first." }, { status: 400 });
      const url = (body.url ?? "").trim();

      const message = await anthropic.messages.parse({
        model: AI_PLANNER_MODEL,
        max_tokens: 4096,
        ...(url ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const }] } : {}),
        messages: [
          {
            role: "user",
            content: buildIdeasPrompt({
              goal,
              clientName: (body.clientName ?? "").trim(),
              url,
              notes: (body.notes ?? "").trim(),
              exclude: (body.exclude ?? []).filter((t) => typeof t === "string" && t.trim()),
            }),
          },
        ],
        output_config: { format: ideasOutputFormat },
      });

      const parsed = message.parsed_output as { ideas?: PlanIdea[] } | null;
      if (!parsed?.ideas?.length) {
        return NextResponse.json({ error: "The model returned no ideas. Try again." }, { status: 502 });
      }
      return NextResponse.json({ ideas: parsed.ideas });
    }

    if (body.action === "generate") {
      const goal = (body.goal ?? "").trim();
      if (!goal) return NextResponse.json({ error: "Describe the goal first." }, { status: 400 });
      const url = (body.url ?? "").trim();

      const message = await anthropic.messages.parse({
        model: AI_PLANNER_MODEL,
        max_tokens: 8192,
        // Web search only helps when there's a site to read.
        ...(url ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const }] } : {}),
        messages: [
          {
            role: "user",
            content: buildGeneratePrompt({
              goal,
              clientName: (body.clientName ?? "").trim(),
              url,
              notes: (body.notes ?? "").trim(),
              ideas: Array.isArray(body.ideas) ? body.ideas : undefined,
            }),
          },
        ],
        output_config: { format: planOutputFormat },
      });

      const parsed = message.parsed_output as PlanDoc | null;
      if (!parsed || !parsed.sections?.length) {
        return NextResponse.json({ error: "The model returned an empty plan. Try again." }, { status: 502 });
      }
      return NextResponse.json({ doc: parsed });
    }

    if (body.action === "extend") {
      const doc = body.doc;
      const ideas = Array.isArray(body.ideas) ? body.ideas : [];
      if (!doc?.sections?.length || ideas.length === 0) {
        return NextResponse.json({ error: "Missing plan or new ideas." }, { status: 400 });
      }

      const message = await anthropic.messages.parse({
        model: AI_PLANNER_MODEL,
        max_tokens: 8192,
        messages: [{ role: "user", content: buildExtendPrompt({ doc, ideas }) }],
        output_config: { format: additionsOutputFormat },
      });

      const parsed = message.parsed_output as { additions?: PlanAddition[] } | null;
      if (!parsed?.additions?.length) {
        return NextResponse.json({ error: "The model returned no additions. Try again." }, { status: 502 });
      }
      return NextResponse.json({ additions: parsed.additions });
    }

    if (body.action === "refine") {
      const doc = body.doc;
      const sectionIndex = body.sectionIndex;
      const instruction = (body.instruction ?? "").trim();
      if (
        !doc?.sections?.length ||
        typeof sectionIndex !== "number" ||
        sectionIndex < 0 ||
        sectionIndex >= doc.sections.length ||
        !instruction
      ) {
        return NextResponse.json({ error: "Missing section or instruction." }, { status: 400 });
      }

      const message = await anthropic.messages.parse({
        model: AI_PLANNER_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: buildRefinePrompt({ doc, sectionIndex, instruction }) }],
        output_config: { format: sectionOutputFormat },
      });

      const parsed = message.parsed_output as PlanSection | null;
      if (!parsed?.content) {
        return NextResponse.json({ error: "The model returned an empty revision. Try again." }, { status: 502 });
      }
      return NextResponse.json({ section: parsed });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Plan generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
