import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildPrompt } from "../../../lib/prompt";
import type { ClientFormData, OnboardingPlan } from "@/types/onboarding";

function parsePlan(text: string): OnboardingPlan {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = fenced?.[1] ?? trimmed;
  return JSON.parse(jsonCandidate) as OnboardingPlan;
}

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
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(data) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic");
    }

    const plan = parsePlan(textBlock.text);
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
