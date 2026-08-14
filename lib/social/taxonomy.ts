// Two deliberately separate lists.
//
// CATEGORIES organise the idea repository for browsing — how a strategist hunts
// ("I need something fun"). PILLARS are the strategic tag that travels with the
// post into the export sheet, which is what the SMM team and reporting read.
// An idea carries a default pillar; the strategist can change it in the editor.

export const CONTENT_PILLARS = [
  "Educational",
  "Educational/Reassuring",
  "Awareness/Engagement",
  "Awareness/Educational",
  "Attract/Engagement",
  "Build Trust",
  "Convert",
  "Community",
] as const;

export type ContentPillar = (typeof CONTENT_PILLARS)[number];

export const IDEA_CATEGORIES = [
  "Services",
  "Fun",
  "Engagement",
  "Blog",
  "Educational",
  "Promotional",
  "Community",
] as const;

export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

/** Ideas imported before categories existed. Shown first, as a visible to-do. */
export const UNCATEGORIZED = "Uncategorized";

const PILLAR_BLUE = "#2B3FE4";
const PILLAR_AMBER = "#B7791F";
const PILLAR_GREEN = "#1F7A4D";
const PILLAR_RUST = "#A03A2E";

/** Dot colour on idea rows and calendar chips. Grouped by intent, per the handoff. */
export function pillarColor(pillar: string | null | undefined): string {
  switch (pillar) {
    case "Educational":
    case "Educational/Reassuring":
      return PILLAR_BLUE;
    case "Awareness/Engagement":
    case "Awareness/Educational":
    case "Attract/Engagement":
      return PILLAR_AMBER;
    case "Build Trust":
    case "Community":
      return PILLAR_GREEN;
    case "Convert":
      return PILLAR_RUST;
    default:
      return "#A5A091";
  }
}

/** Category rows carry a dot too; colour follows the category's usual intent. */
export function categoryColor(category: string): string {
  switch (category) {
    case "Educational":
    case "Blog":
      return PILLAR_BLUE;
    case "Engagement":
    case "Fun":
      return PILLAR_AMBER;
    case "Community":
    case "Services":
      return PILLAR_GREEN;
    case "Promotional":
      return PILLAR_RUST;
    default:
      return "#A5A091";
  }
}

export function isContentPillar(value: unknown): value is ContentPillar {
  return typeof value === "string" && (CONTENT_PILLARS as readonly string[]).includes(value);
}

export function isIdeaCategory(value: unknown): value is IdeaCategory {
  return typeof value === "string" && (IDEA_CATEGORIES as readonly string[]).includes(value);
}
