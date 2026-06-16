import { NextResponse } from "next/server";
import { generateGeminiContent } from "@/lib/ai/gemini";
import {
  buildMarketingUpdateContext,
  summarizeMarketingUpdateContext,
  type MarketingUpdateGbpManual,
  type MarketingUpdateUserInput,
} from "@/lib/reporting/marketing-update-context";
import { buildMarketingUpdatePrompt } from "@/lib/reporting/marketing-update-prompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type MarketingUpdateRequestBody = {
  clientId?: number;
  title?: string;
  greeting?: string;
  startDate?: string;
  endDate?: string;
  gbpManual?: MarketingUpdateGbpManual;
  clientRequests?: string;
  nextMeetingUrl?: string;
  additionalNotes?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: MarketingUpdateRequestBody;
  try {
    body = (await request.json()) as MarketingUpdateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const userInput: MarketingUpdateUserInput = {
    title: body.title,
    greeting: body.greeting,
    startDate: body.startDate,
    endDate: body.endDate,
    gbpManual: body.gbpManual,
    clientRequests: body.clientRequests,
    nextMeetingUrl: body.nextMeetingUrl,
    additionalNotes: body.additionalNotes,
  };

  try {
    const admin = createAdminClient();
    const context = await buildMarketingUpdateContext(admin, clientId, userInput);
    const markdown = await generateGeminiContent(
      [{ text: buildMarketingUpdatePrompt(context) }],
      { maxOutputTokens: 1500, temperature: 0.4 },
    );

    return NextResponse.json({
      ok: true,
      markdown,
      context: summarizeMarketingUpdateContext(context),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate marketing update.",
      },
      { status: 500 },
    );
  }
}
