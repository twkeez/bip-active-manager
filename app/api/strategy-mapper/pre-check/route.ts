import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildClientContext } from "@/lib/strategy-mapper/build-client-context";
import {
  buildMockPreCheckResult,
  buildMockStrategyMapperResearch,
  isAnthropicUnavailableError,
  shouldUseMockStrategyMapperResearch,
} from "@/lib/strategy-mapper/mock-research";
import { runStrategyMapperResearch } from "@/lib/strategy-mapper/run-research";
import type {
  StrategyMapperPreCheckRequest,
  StrategyMapperPreCheckResult,
} from "@/types/strategy-mapper";
import { anthropicClient } from "@/lib/ai/usage";

function mockPreCheckResponse(
  form: StrategyMapperPreCheckRequest["form"],
  options?: { mockFallbackReason?: string },
) {
  const { research, radius, activeServices, mockMode, mockFallbackReason } =
    buildMockPreCheckResult(form, options);
  const result: StrategyMapperPreCheckResult = {
    research,
    radius,
    activeServices,
    clientContext: buildClientContext(form, research),
    mockMode,
    mockFallbackReason,
  };
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StrategyMapperPreCheckRequest;
  try {
    body = (await request.json()) as StrategyMapperPreCheckRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { form, useMockResearch } = body;
  if (!form?.practiceName?.trim()) {
    return NextResponse.json({ error: "Practice name is required" }, { status: 400 });
  }
  if (!form.streetAddress?.trim()) {
    return NextResponse.json({ error: "Street address is required" }, { status: 400 });
  }

  if (shouldUseMockStrategyMapperResearch(useMockResearch)) {
    try {
      buildMockStrategyMapperResearch(form);
      return mockPreCheckResponse(form);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to build mock strategy mapper research",
        },
        { status: 400 },
      );
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const anthropic = anthropicClient("Strategy Mapper research", { apiKey });

  try {
    const { research, radius, activeServices } = await runStrategyMapperResearch(
      anthropic,
      form,
    );

    const result: StrategyMapperPreCheckResult = {
      research,
      radius,
      activeServices,
      clientContext: buildClientContext(form, research),
    };

    return NextResponse.json(result);
  } catch (error) {
    // Used to fall back to placeholder competitors here and keep using them
    // on every later run. Fake research should only ever be chosen on purpose.
    if (isAnthropicUnavailableError(error)) {
      return NextResponse.json(
        {
          error:
            "Live research isn't available right now (the AI service didn't accept the request; usually credits). Try again later, or choose Placeholder research on the form to continue with sample competitors you'll edit by hand.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run strategy mapper pre-check",
      },
      { status: 500 },
    );
  }
}
