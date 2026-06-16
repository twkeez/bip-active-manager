import type { DiscoveryReport } from "@/types/onboarding";

export function truncateToSentences(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [trimmed];
  return sentences.slice(0, max).join(" ").trim();
}

export function firstSentences(text: string, count: number): string {
  return truncateToSentences(text, count);
}

export function contactFirstName(contactName?: string): string | null {
  if (!contactName?.trim()) return null;
  return contactName.trim().split(/\s+/)[0] ?? null;
}

export function splitQuickWin(win: string): { title: string; explanation: string } {
  const trimmed = win.trim();
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [trimmed];
  if (sentences.length >= 2) {
    return {
      title: sentences[0].trim(),
      explanation: truncateToSentences(sentences.slice(1).join(" "), 1),
    };
  }
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx > 0 && colonIdx < 80) {
    return {
      title: trimmed.slice(0, colonIdx).trim(),
      explanation: truncateToSentences(trimmed.slice(colonIdx + 1).trim(), 1),
    };
  }
  if (trimmed.length > 72) {
    const cut = trimmed.lastIndexOf(" ", 72);
    return {
      title: `${trimmed.slice(0, cut > 40 ? cut : 72).trim()}…`,
      explanation: "",
    };
  }
  return { title: trimmed, explanation: "" };
}

export function formatNextStep(step: string, contactName?: string): string {
  const trimmed = step.trim();
  const first = contactFirstName(contactName);
  if (!first) return trimmed;
  if (new RegExp(first, "i").test(trimmed)) return trimmed;
  return `${first} — ${trimmed}`;
}

export function inferKeywordIntent(keyword: string): string {
  const lower = keyword.toLowerCase();
  if (lower.includes("emergency") || lower.includes("urgent")) return "Emergency / urgent";
  if (lower.includes("near me")) return "Local discovery";
  if (lower.includes("exotic") || lower.includes("specialist")) return "Specialty";
  if (lower.includes("dental")) return "Service-specific";
  return "Local search";
}

export function parseLocalSearchStrategy(
  text: string,
): Array<{ keyword: string; intent: string; why: string }> {
  const rows: Array<{ keyword: string; intent: string; why: string }> = [];
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const quoted = line.match(/["']([^"']+)["']/);
    if (quoted) {
      const keyword = quoted[1].trim();
      const remainder = line.replace(quoted[0], "").replace(/^[—–\-:\s]+/, "").trim();
      rows.push({
        keyword,
        intent: inferKeywordIntent(keyword),
        why: remainder || line,
      });
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s*(.+)/);
    if (numbered) {
      const body = numbered[1].trim();
      const parts = body.split(/\s[—–-]\s/);
      const keyword = parts[0]?.replace(/^["']|["']$/g, "").trim() ?? body;
      rows.push({
        keyword,
        intent: parts[1]?.trim() || inferKeywordIntent(keyword),
        why: parts[2]?.trim() || parts.slice(1).join(" — ") || body,
      });
      continue;
    }

    if (line.includes("|")) {
      const [keyword, intent, why] = line.split("|").map((part) => part.trim());
      if (keyword) {
        rows.push({
          keyword,
          intent: intent || inferKeywordIntent(keyword),
          why: why || intent || line,
        });
      }
    }
  }

  if (rows.length === 0) {
    text
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 3)
      .forEach((part) => {
        const segments = part.split(/\s[—–-]\s/);
        const keyword = segments[0].replace(/^["']|["']$/g, "").trim();
        rows.push({
          keyword,
          intent: segments[1]?.trim() || inferKeywordIntent(keyword),
          why: segments[2]?.trim() || segments.slice(1).join(" — ") || part,
        });
      });
  }

  if (rows.length === 0) {
    return [
      {
        keyword: "Strategy overview",
        intent: "Mixed",
        why: text,
      },
    ];
  }

  return rows;
}

export function formatDisplayDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getCompetitiveEdgeQuote(discovery: DiscoveryReport): string {
  const topPricing = discovery.pricingComparison[0];
  if (topPricing?.valueAngle) return topPricing.valueAngle;
  const topCompetitor = discovery.competitorDeficitAnalysis[0];
  return topCompetitor?.yourAdvantage ?? "";
}

export function getCompetitorGapBullets(
  discovery: DiscoveryReport,
  limit = 3,
): string[] {
  const first = discovery.competitorDeficitAnalysis[0];
  if (!first?.digitalWeaknesses.length) return [];
  return first.digitalWeaknesses.slice(0, limit);
}

