type ParseStep = "parse-document" | "research" | "plan" | "parse-pipeline";

function extractJsonSubstring(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString) {
      if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

function parseJsonCandidate<T>(candidate: string): T {
  const trimmed = candidate.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(jsonCandidate) as T;
}

/**
 * Parse JSON from Anthropic text responses that may include prose before/after the object.
 */
export function parseAnthropicJson<T>(
  rawText: string,
  step: ParseStep,
): T {
  const trimmed = rawText.trim();
  const attempts: string[] = [trimmed];

  const embedded = extractJsonSubstring(trimmed);
  if (embedded) attempts.push(embedded);

  for (const candidate of attempts) {
    try {
      return parseJsonCandidate<T>(candidate);
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    `Model returned prose instead of JSON during ${step}. Preview: ${trimmed.slice(0, 80)}…`,
  );
}

export function parseAnthropicMessageJson<T>(
  textBlocks: string[],
  step: ParseStep,
): T {
  if (textBlocks.length === 0) {
    throw new Error("No text response from Anthropic");
  }

  const ordered = [
    textBlocks.join("\n"),
    ...[...textBlocks].reverse(),
  ];

  for (const text of ordered) {
    try {
      return parseAnthropicJson<T>(text, step);
    } catch {
      // try next block
    }
  }

  return parseAnthropicJson<T>(textBlocks.join("\n"), step);
}

export function extractTextBlocks(
  content: Array<{ type: string; text?: string }>,
): string[] {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text);
}
