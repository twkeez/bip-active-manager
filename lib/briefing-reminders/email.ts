import type { Cadence } from "./plan";

const APP_URL = "https://bip-active-manager.vercel.app";

export type ReminderEmailInput = {
  accountName: string;
  cadence: Cadence;
  /** YYYY-MM-DD, the run's Monday. */
  runDate: string;
  recipientNames: string[];
  /** The briefing's client message, or null when there is not enough good news. */
  clientMessage: string | null;
  /** The briefing's strategist note: findings and blind spots, for the team only. */
  strategistNote: string;
  basecampProjectId: string | null;
};

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The reminder a strategist gets: time for this client's update, a draft to
 * start from (edited freely; nothing checks the wording), the private numbers
 * behind it, and where to mark it complete.
 */
export function reminderEmail(input: ReminderEmailInput): { subject: string; body: string } {
  const cadence = input.cadence === "monthly" ? "monthly" : "twice-monthly";
  const lines = [
    `Hi ${joinNames(input.recipientNames) || "there"},`,
    "",
    `It's time for ${input.accountName}'s ${cadence} client update (${dateLabel(input.runDate)}).`,
    "",
  ];
  if (input.clientMessage) {
    lines.push(
      "Here's a draft from the latest numbers. Change it however you like, then post it to the client in Basecamp:",
      "",
      "----------",
      input.clientMessage.trim(),
      "----------",
    );
  } else {
    lines.push(
      "There isn't enough new good news for a ready-made update this time, so a personal check-in is the way to go.",
    );
  }
  lines.push(
    "",
    "For you, not the client:",
    "",
    input.strategistNote.trim(),
    "",
    input.basecampProjectId
      ? `Basecamp project: https://basecamp.com/2175055/projects/${input.basecampProjectId}`
      : "No Basecamp project is linked for this client in the app.",
    `Once the update is posted, mark it complete: ${APP_URL}/follow-ups`,
  );
  return {
    subject: `Client update due: ${input.accountName}${input.cadence === "monthly" ? " (Low Contact)" : ""}`,
    body: lines.join("\n"),
  };
}
