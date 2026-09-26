import { NextResponse } from "next/server";
import { normalizeWebsiteUrl } from "@/lib/strategy-mapper/form-options";
import { runStrategyMapperPrefill } from "@/lib/strategy-mapper/prefill-from-url";
import { createClient } from "@/lib/supabase/server";
import type { StrategyMapperPrefillRequest } from "@/types/strategy-mapper";

/** Crawling six pages plus an AI pass runs past the default serverless budget. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StrategyMapperPrefillRequest;
  try {
    body = (await request.json()) as StrategyMapperPrefillRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const websiteUrl = normalizeWebsiteUrl(body?.websiteUrl ?? "");
  if (!websiteUrl) {
    return NextResponse.json({ error: "A website URL is required." }, { status: 400 });
  }

  let host: string;
  try {
    host = new URL(websiteUrl).hostname;
  } catch {
    return NextResponse.json(
      { error: `"${body.websiteUrl}" is not a valid website URL.` },
      { status: 400 },
    );
  }

  // Prefill fetches an arbitrary operator-supplied URL, so keep it off the
  // internal network.
  if (
    /^(localhost|\[?::1\]?|0\.0\.0\.0)$/i.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /\.(local|internal)$/i.test(host)
  ) {
    return NextResponse.json(
      { error: "Prefill only reads public websites." },
      { status: 400 },
    );
  }

  try {
    const result = await runStrategyMapperPrefill(websiteUrl);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read that website. Fill the form manually.",
      },
      { status: 502 },
    );
  }
}
