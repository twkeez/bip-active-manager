import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readDocumentPayload } from "@/lib/vet-onboarding/document-input";
import { normalizeClientFormData } from "@/lib/vet-onboarding/normalize-form-data";
import {
  buildDocumentExtractionPrompt,
  buildPdfDocumentExtractionPrompt,
} from "@/lib/prompt";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import {
  extractTextBlocks,
  parseAnthropicMessageJson,
} from "@/lib/vet-onboarding/parse-anthropic-json";
import type { ClientFormData } from "@/types/onboarding";

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

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart form with a document file" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Document file is required" }, { status: 400 });
  }

  let payload: Awaited<ReturnType<typeof readDocumentPayload>>;
  try {
    payload = await readDocumentPayload(file);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read document" },
      { status: 400 },
    );
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const message =
      payload.kind === "pdf"
        ? await anthropic.messages.create({
            model: VET_ONBOARDING_MODEL,
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data: payload.base64,
                    },
                    title: payload.fileName,
                  },
                  {
                    type: "text",
                    text: buildPdfDocumentExtractionPrompt(),
                  },
                ],
              },
            ],
          })
        : await anthropic.messages.create({
            model: VET_ONBOARDING_MODEL,
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: buildDocumentExtractionPrompt(payload.text),
              },
            ],
          });

    const parsed = normalizeClientFormData(
      parseAnthropicMessageJson<ClientFormData>(
        extractTextBlocks(message.content),
        "parse-document",
      ),
    );
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract intake fields from document",
      },
      { status: 500 },
    );
  }
}
