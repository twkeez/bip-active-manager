import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildPrompt, buildResearchPrompt } from "@/lib/prompt";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import { onboardingPlanOutputFormat } from "@/lib/vet-onboarding/plan-json-schema";
import { localResearchOutputFormat } from "@/lib/vet-onboarding/research-json-schema";
import type {
  ClientFormData,
  LocalResearch,
  OnboardingPlan,
} from "@/types/onboarding";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let data: ClientFormData;
  try {
    data = (await request.json()) as ClientFormData;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const researchMessage = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: buildResearchPrompt(data) }],
      output_config: { format: localResearchOutputFormat },
    });

    // #region agent log
    fetch("http://127.0.0.1:7929/ingest/6a0fb721-e102-4933-b813-4011803d5752", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "5b21af",
      },
      body: JSON.stringify({
        sessionId: "5b21af",
        runId: "research-debug",
        hypothesisId: "A-B-C-D",
        location: "vet-onboarding/generate/route.ts:research-response",
        message: "Vet onboarding research messages.parse response metadata",
        data: {
          stopReason: researchMessage.stop_reason,
          hasParsedOutput: researchMessage.parsed_output != null,
          contentBlockTypes: researchMessage.content.map((b) => b.type),
          usage: researchMessage.usage,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const research = researchMessage.parsed_output as LocalResearch | null;
    if (!research) {
      throw new Error("Research step returned no structured output");
    }

    const planMessage = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: buildPrompt(data, research) }],
      output_config: {
        format: onboardingPlanOutputFormat,
      },
    });

    const planCore = planMessage.parsed_output;
    if (!planCore) {
      throw new Error("Plan generation returned no structured output");
    }

    const plan: OnboardingPlan = {
      ...planCore,
      goalsPlan:
        planCore.goalsPlan ||
        `We will focus on ${data.mainGoal || "your primary marketing objectives"} within your ${data.timeline || "planned"} timeline and ${data.budget || "budget"} range.`,
      competitors: research.competitors,
      marketSnapshot: research.marketSnapshot,
      searchLandscape: research.searchLandscape,
    };

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate onboarding plan",
      },
      { status: 500 },
    );
  }
}
