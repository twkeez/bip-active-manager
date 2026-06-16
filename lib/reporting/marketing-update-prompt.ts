import type { MarketingUpdateContext } from "@/lib/reporting/marketing-update-context";

export type MarketingUpdateDraft = {
  title: string;
  markdown: string;
};

function formatGbpBlock(context: MarketingUpdateContext): string {
  const gbp = context.gbp;
  if (!gbp) return "GBP: no profile data synced.";

  const lines: string[] = [];
  if (gbp.hasManualInteractions) {
    if (gbp.totalInteractions != null) {
      lines.push(`- Total GBP interactions: ${gbp.totalInteractions.toLocaleString()}`);
    }
    if (gbp.phoneCalls != null) {
      lines.push(`- Phone calls: ${gbp.phoneCalls.toLocaleString()}`);
    }
    if (gbp.directionRequests != null) {
      lines.push(`- Direction requests: ${gbp.directionRequests.toLocaleString()}`);
    }
    if (gbp.websiteClicks != null) {
      lines.push(`- Website clicks: ${gbp.websiteClicks.toLocaleString()}`);
    }
  } else {
    lines.push("- GBP interaction metrics were not provided. Use rating/review context or include [add GBP metrics].");
  }
  if (gbp.rating != null) {
    lines.push(`- Current rating: ${gbp.rating.toFixed(2)} / 5 (${gbp.reviewCount ?? 0} total reviews)`);
  }
  if (gbp.recentReviews30d > 0) {
    lines.push(`- New reviews in last 30 days: ${gbp.recentReviews30d}`);
  }
  return lines.join("\n");
}

function formatAdsBlock(context: MarketingUpdateContext): string {
  const ads = context.ads;
  if (!ads) return "Google Ads: no completed snapshot available for this client.";
  return [
    `Date range: ${ads.dateRangeLabel}`,
    `- Clicks: ${ads.clicks} (${ads.clicksLabel})`,
    `- Impressions: ${ads.impressions} (${ads.impressionsLabel})`,
    `- Average CPC: ${ads.averageCpcLabel}`,
    `- Total spend: ${ads.costLabel}`,
    `- Conversions: ${ads.conversions}`,
  ].join("\n");
}

export function buildMarketingUpdatePrompt(context: MarketingUpdateContext): string {
  const strategist = context.client.marketingStrategist?.trim() || "Your Marketing Strategist";
  const optionalChannelBlock =
    context.optionalChannels.length > 0
      ? context.optionalChannels.map((row) => `- ${row.label}: ${row.summary}`).join("\n")
      : "None available.";

  const workHints = context.workInProgressHints.map((hint) => `- ${hint}`).join("\n");

  return [
    "You are a veteran Veterinary Marketing Strategist writing a client-facing marketing update for Beyond Indigo Pets.",
    "Write in warm, plain language for veterinary practice owners. No internal jargon.",
    "",
    "CRITICAL RULES:",
    "- Use ONLY the exact numbers provided below. Never invent or estimate metrics.",
    "- Return markdown only. No code fences.",
    `- Start with the greeting exactly as provided: ${context.greeting}`,
    `- Use this document title on the first line as an H1: ${context.title}`,
    "- Use these exact section headings in ALL CAPS:",
    "  WHAT'S NEW",
    "  Google Ads Performance",
    "  WHY IT MATTERS",
    "  WHAT WE'RE WORKING ON",
    "  NEXT STEPS",
    "",
    "Section guidance:",
    "- After the greeting, write a brief intro referencing the reporting window.",
    "- WHAT'S NEW: Focus on Google Business Profile engagement when manual metrics exist; otherwise mention reviews/rating and note [add GBP metrics] where interaction stats belong.",
    "- Google Ads Performance: Present the ads metrics as a short bullet list using the exact figures, then 1-2 sentences of plain-language analysis.",
    "- WHY IT MATTERS: Connect GBP and Ads results to real-world outcomes for a veterinary practice (calls, appointments, visibility).",
    "- WHAT WE'RE WORKING ON: Use the work hints below as inspiration; rewrite in client-friendly language with sub-bullets if helpful.",
    "- NEXT STEPS: Include any client requests. If a meeting URL is provided, add a 'Next Meeting:' line with the link.",
    `- End with a friendly closing, then a sign-off block for ${strategist}, Marketing Strategist, Beyond Indigo Pets — Veterinary Marketing.`,
    "",
    `Client: ${context.client.accountName}`,
    `Website: ${context.client.websiteLabel}`,
    `Reporting window: ${context.window.dateRangeLabel}`,
    `Active services: ${context.client.activeServices.join(", ") || "General marketing support"}`,
    "",
    "GBP data:",
    formatGbpBlock(context),
    "",
    "Google Ads data:",
    formatAdsBlock(context),
    "",
    "Other synced channels (mention only if relevant; do not invent numbers):",
    optionalChannelBlock,
    "",
    "Work-in-progress hints:",
    workHints,
    "",
    context.clientRequests ? `Client requests to include in NEXT STEPS:\n${context.clientRequests}` : "",
    context.nextMeetingUrl ? `Next meeting URL:\n${context.nextMeetingUrl}` : "",
    context.additionalNotes ? `Additional strategist notes:\n${context.additionalNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
