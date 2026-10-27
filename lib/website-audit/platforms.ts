import type { AiPlatform } from "@/lib/website-audit/types";

// Shared with the browser (no server imports here).
export const AI_PLATFORMS: AiPlatform[] = ["ai_overview", "ai_mode", "chatgpt", "gemini", "perplexity", "claude"];

export const PLATFORM_LABEL: Record<AiPlatform, string> = {
  ai_overview: "Google AI Overview",
  ai_mode: "Google AI Mode",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
};
