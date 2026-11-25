// EVERY CLAUDE MODEL BIP CONTROL USES, IN ONE PLACE.
//
// Change a model here and nowhere else. Each entry is one job, named for what
// it does, so moving one job to a newer or cheaper model doesn't move the
// others. lib/ai/models.test.ts fails if a model id is written anywhere else
// in app/, components/ or lib/ (lib/ai/usage.ts keeps its price list).
//
// Prices are in lib/ai/usage.ts; /ai-spend shows what each job costs.

export const MODELS = {
  /** Short helper calls: summaries, report text, audit notes (lib/ai/claude.ts). */
  helper: "claude-haiku-4-5",
  /** Long-form reports such as reputation analysis (lib/ai/claude.ts). */
  report: "claude-opus-5",

  /** The Assistant chat (lib/assistant/run-assistant.ts). */
  assistant: "claude-opus-5",
  assistantFallback: "claude-opus-4-8",
  /** AI Planner (lib/ai-planner/plan.ts). */
  planner: "claude-sonnet-4-6",
  /** "Ask Claude" on a task (app/api/tasks/[id]/ai-assist). */
  taskAssist: "claude-haiku-4-5",

  /** Onboarding research with web search (lib/onboarding/background.ts). */
  onboardingResearch: "claude-opus-5",
  onboardingResearchFallback: "claude-opus-4-8",
  /**
   * Older onboarding helpers: pipeline-form parsing, discovery, campaign plan,
   * competitor ads, ads drafts, llms.txt (lib/vet-onboarding/anthropic-model.ts).
   */
  onboardingHelpers: "claude-sonnet-4-6",

  /** Coal Mines: sorting Basecamp threads (lib/coal-mines/classify-threads.ts). */
  threadClassifier: "claude-haiku-5-5",
  /** Coal Mines: drafting a new canary (lib/coal-mines/draft-canary.ts). */
  canaryDraft: "claude-opus-5",
  /**
   * Client Watch: reading each client's Basecamp threads for what we owe,
   * where things stand and what to do next (lib/client-watch/read.ts).
   */
  clientWatch: "claude-sonnet-5-5",
  /** Help Desk Report categories (lib/help-desk/categorize.ts). */
  helpDeskCategories: "claude-haiku-5-5",

  /** Website & AI Audit: one page at a time, then the whole site (lib/website-audit/content.ts). */
  websiteAuditPage: "claude-haiku-5-5",
  websiteAuditSite: "claude-opus-5-5",

  /** Social posts, ideas and plans (lib/social). */
  social: "claude-opus-4-8",
} as const;

export type ModelJob = keyof typeof MODELS;
