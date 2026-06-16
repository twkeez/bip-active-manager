import Anthropic from "@anthropic-ai/sdk";
import { buildDiscoveryPrompt } from "@/lib/prompt";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import { discoveryReportOutputFormat } from "@/lib/vet-onboarding/discovery-json-schema";
import type {
  ClientFormData,
  DiscoveryFormData,
  DiscoveryReport,
  OnboardingPlan,
} from "@/types/onboarding";

export const runtime = "nodejs";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      clientData?: ClientFormData;
      discoveryData?: DiscoveryFormData;
      onboardingPlan?: OnboardingPlan;
    };

    const clientData = body.clientData;
    const discoveryData = body.discoveryData;
    const onboardingPlan = body.onboardingPlan;

    if (!clientData?.practiceName?.trim()) {
      return Response.json(
        { error: "Practice name is required" },
        { status: 400 },
      );
    }

    if (!discoveryData) {
      return Response.json(
        { error: "Discovery form data is required" },
        { status: 400 },
      );
    }

    const anthropic = getAnthropicClient();

    const message = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 12288,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: buildDiscoveryPrompt(
            clientData,
            discoveryData,
            onboardingPlan,
          ),
        },
      ],
      output_config: { format: discoveryReportOutputFormat },
    });

    const discovery = message.parsed_output as DiscoveryReport | null;
    if (!discovery) {
      throw new Error("Model did not return structured discovery output");
    }

    return Response.json({ discovery });
  } catch (error) {
    console.error("Discovery generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate discovery report";
    return Response.json({ error: message }, { status: 500 });
  }
}
