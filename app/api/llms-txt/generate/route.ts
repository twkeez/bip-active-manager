import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import { llmsTxtCurationOutputFormat } from "@/lib/llms-txt/curation-schema";
import { MAX_FULL_FILE_BYTES, MAX_FULL_TEXT_PAGES } from "@/lib/llms-txt/constants";
import {
  buildCurationInput,
  discoverSiteUrls,
  fetchPageSnapshots,
} from "@/lib/llms-txt/fetch-pages";
import { collectIndexedUrls, formatLlmsFullTxt, formatLlmsTxt } from "@/lib/llms-txt/format";
import { buildLlmsTxtCurationPrompt } from "@/lib/llms-txt/prompts";
import type { LlmsTxtCuration, LlmsTxtGenerateResult } from "@/lib/llms-txt/types";
import { domainFromWebsite, normalizeWebsite } from "@/lib/llms-txt/website";

type GenerateRequestBody = {
  clientId?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id, account_name, website")
    .eq("id", clientId)
    .single<{ id: number; account_name: string; website: string | null }>();

  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  const website = normalizeWebsite(clientRow.website ?? "");
  if (!website) {
    return NextResponse.json(
      { error: "Client website is required before generating llms.txt." },
      { status: 400 },
    );
  }

  const domain = domainFromWebsite(website);

  try {
    const discoveredUrls = await discoverSiteUrls(website);
    const previewPages = await fetchPageSnapshots(
      discoveredUrls,
      Math.min(discoveredUrls.length, MAX_FULL_TEXT_PAGES),
    );

    const inventory = buildCurationInput(previewPages);
    const anthropic = new Anthropic({ apiKey });

    const curationMessage = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: buildLlmsTxtCurationPrompt(
            clientRow.account_name,
            domain,
            inventory,
          ),
        },
      ],
      output_config: { format: llmsTxtCurationOutputFormat },
    });

    const curation = curationMessage.parsed_output as LlmsTxtCuration | null;
    if (!curation) {
      throw new Error("Curation step returned no structured output");
    }

    const llmsTxt = formatLlmsTxt(curation);
    const indexedUrls = collectIndexedUrls(curation);
    const fullTextUrls = [...new Set(indexedUrls)].slice(0, MAX_FULL_TEXT_PAGES);
    const fullPages = await fetchPageSnapshots(fullTextUrls, MAX_FULL_TEXT_PAGES);
    const pagesByUrl = new Map(fullPages.map((p) => [p.url, p]));

    const fullResult = formatLlmsFullTxt(curation, pagesByUrl, MAX_FULL_FILE_BYTES);

    const result: LlmsTxtGenerateResult = {
      clientId: clientRow.id,
      clientName: clientRow.account_name,
      domain,
      llmsTxt,
      llmsFullTxt: fullResult.content,
      stats: {
        urlsDiscovered: discoveredUrls.length,
        urlsIndexed: indexedUrls.length,
        urlsInFull: fullResult.urlsIncluded,
        truncated: fullResult.truncated || discoveredUrls.length > MAX_FULL_TEXT_PAGES,
        llmsFullBytes: Buffer.byteLength(fullResult.content, "utf8"),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate llms.txt files",
      },
      { status: 500 },
    );
  }
}
