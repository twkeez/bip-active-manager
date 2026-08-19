import Anthropic from "@anthropic-ai/sdk";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";

type TextPart = { text: string };
type InlineDataPart = { inlineData: { mimeType: string; data: string } };
type ContentPart = TextPart | InlineDataPart;

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5";

function toClaudeContent(
  parts: ContentPart[],
): Anthropic.Messages.ContentBlockParam[] {
  return parts.map((part): Anthropic.Messages.ContentBlockParam => {
    if ("text" in part) {
      // Strip unpaired surrogates so the serialized request body stays valid JSON.
      return { type: "text", text: stripLoneSurrogates(part.text) };
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: part.inlineData.mimeType as ImageMediaType,
        data: part.inlineData.data,
      },
    };
  });
}

export async function generateClaudeContent(
  parts: ContentPart[],
  options?: { maxOutputTokens?: number; temperature?: number },
): Promise<string> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: options?.maxOutputTokens ?? 2048,
    temperature: options?.temperature,
    messages: [{ role: "user", content: toClaudeContent(parts) }],
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Claude returned an empty response.");
  return text;
}

export async function generateClaudeText(prompt: string): Promise<string> {
  return generateClaudeContent([{ text: prompt }]);
}

// Long-form synthesis (reputation reports and similar) needs a stronger model
// and far more room than the Haiku/2048 default above, which cannot hold a
// multi-section analysis over a hundred reviews. Streaming is required at this
// token ceiling or the request hits the SDK's HTTP timeout.
const REPORT_MODEL = "claude-opus-5";

export async function generateClaudeReport(
  prompt: string,
  options?: { maxOutputTokens?: number },
): Promise<{ text: string; model: string }> {
  const stream = client.messages.stream({
    model: REPORT_MODEL,
    max_tokens: options?.maxOutputTokens ?? 16000,
    thinking: { type: "adaptive" },
    messages: [
      { role: "user", content: [{ type: "text", text: stripLoneSurrogates(prompt) }] },
    ],
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to write this report.");
  }

  const text = message.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Claude returned an empty report.");
  return { text, model: REPORT_MODEL };
}
