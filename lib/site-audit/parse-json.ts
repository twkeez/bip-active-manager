export function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  const closedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (closedFence?.[1]) return closedFence[1].trim();

  const unclosedFence = trimmed.match(/^```(?:json)?\s*\n?([\s\S]+)$/i);
  if (unclosedFence?.[1]) return unclosedFence[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  if (start >= 0) return trimmed.slice(start);

  return trimmed;
}

function salvageTruncatedJson(raw: string): string | null {
  let s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;

  s = s.replace(/,\s*"(?:keyword|evidence|alignment|title|description|query|page|keyword|gaps)"\s*:\s*"[^"]*$/i, "");
  s = s.replace(/,\s*{\s*"[^"]*"\s*:\s*"[^"]*"\s*,\s*"[^"]*"\s*:\s*"[^"]*"\s*,\s*"[^"]*"\s*:\s*"[^"]*$/i, "");
  s = s.replace(/,\s*{\s*"[^"]*"\s*:\s*"[^"]*"\s*,\s*"[^"]*"\s*:\s*"[^"]*$/i, "");
  s = s.replace(/,\s*{\s*"[^"]*"\s*:\s*"[^"]*$/i, "");
  s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/i, "");
  s = s.replace(/,\s*$/, "");

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braces += 1;
    if (ch === "}") braces -= 1;
    if (ch === "[") brackets += 1;
    if (ch === "]") brackets -= 1;
  }
  if (inString) s += '"';
  while (brackets > 0) {
    s += "]";
    brackets -= 1;
  }
  while (braces > 0) {
    s += "}";
    braces -= 1;
  }
  return s;
}

export function jsonBlockToObject<T>(text: string): T | null {
  const candidate = extractJsonCandidate(text);
  try {
    return JSON.parse(candidate) as T;
  } catch (firstError) {
    const salvaged = salvageTruncatedJson(candidate);
    if (!salvaged) return null;
    try {
      return JSON.parse(salvaged) as T;
    } catch {
      return null;
    }
  }
}

export function jsonBlockParseMeta(text: string) {
  const candidate = extractJsonCandidate(text);
  let parseError: string | null = null;
  let salvaged = false;
  try {
    JSON.parse(candidate);
    return { candidate, candidateLength: candidate.length, parseError, salvaged, ok: true };
  } catch (error) {
    parseError = error instanceof Error ? error.message : "parse failed";
    const repaired = salvageTruncatedJson(candidate);
    if (repaired) {
      try {
        JSON.parse(repaired);
        return {
          candidate,
          candidateLength: candidate.length,
          parseError,
          salvaged: true,
          ok: true,
        };
      } catch (retryError) {
        parseError =
          retryError instanceof Error ? retryError.message : parseError;
      }
    }
    return { candidate, candidateLength: candidate.length, parseError, salvaged, ok: false };
  }
}
