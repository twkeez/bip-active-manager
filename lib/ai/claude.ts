import Anthropic from "@anthropic-ai/sdk";

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
      return { type: "text", text: part.text };
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
    thinking: { type: "adaptive" },
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
