import type { ClientServiceKey } from "@/lib/clients/types";
import { SERVICE_EXPECTATION_LABEL } from "@/lib/onboarding/service-expectations";

/**
 * When things happen, for the plan box at the top of the client document.
 *
 * Carried over from the old onboarding report when the two client documents
 * were merged (2026-09-16). The expectations document's own "Kickoff" line was
 * really the date the onboarding record was created, which is not a meeting;
 * the intake holds the actual kickoff meeting, so that wins, and the fallback
 * says what it is.
 */

export type ServiceStartPlan = Record<
  string,
  { tier?: string; startTrigger?: string; startDate?: string | null }
> | null;

export type PlanTimeline = {
  /** The kickoff meeting, or when onboarding started if no meeting is recorded. */
  kickoff: { label: "Kickoff" | "Started"; date: string } | null;
  /** One sentence about the website, when the site affects timing. */
  website: string | null;
  launchDate: string | null;
  /** "Google Ads begins when your splash page goes live. SEO begins when your full website launches." */
  starts: string | null;
};

const WEBSITE_LINE: Record<string, string> = {
  has_site_rebuild: "We'll work with your current site, then move to the new one when it launches.",
  splash_then_full: "A simple splash page goes up early while your full website is built.",
  wait_for_launch: "Work that depends on your website begins once the new site launches.",
  no_site: "No website is in scope, so we'll focus on channels beyond your site.",
};

/**
 * Meetings are moments; show them as they fall in Eastern time, where the team
 * works — except a value that is really a date.
 *
 * The onboarding wizard's kickoff field is a date picker, and it saves
 * "2026-09-16" into a timestamp column, which stores midnight UTC. Read in
 * Eastern that is the evening of the 15th, so a kickoff would print a day
 * early. Exact midnight UTC is treated as the plain date it was entered as.
 */
function formatMoment(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
    return formatPlainDate(date.toISOString());
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

/**
 * Plain dates ("2026-11-03") have no time zone; reading them in a zone west of
 * UTC would print the day before.
 */
export function formatPlainDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildPlanTimeline(input: {
  kickoffMeetingAt: string | null | undefined;
  onboardingStartedAt: string | null | undefined;
  webStatus: string | null | undefined;
  websiteLaunchDate: string | null | undefined;
  servicePlan: ServiceStartPlan;
  activeServices: ClientServiceKey[];
}): PlanTimeline {
  const meeting = formatMoment(input.kickoffMeetingAt);
  const started = formatMoment(input.onboardingStartedAt);
  const kickoff = meeting
    ? { label: "Kickoff" as const, date: meeting }
    : started
      ? { label: "Started" as const, date: started }
      : null;

  const launchDate = formatPlainDate(input.websiteLaunchDate);
  const website = input.webStatus ? (WEBSITE_LINE[input.webStatus] ?? null) : null;

  const plan = input.servicePlan ?? {};
  const splashBuild = input.webStatus === "splash_then_full";
  const now: string[] = [];
  const atSplash: string[] = [];
  const atLaunch: string[] = [];
  const onDate: string[] = [];
  for (const service of input.activeServices) {
    const label = SERVICE_EXPECTATION_LABEL[service];
    const entry = plan[service];
    const trigger = entry?.startTrigger ?? "start_now";
    const date = formatPlainDate(entry?.startDate);
    if (trigger === "at_splash") atSplash.push(label);
    else if (trigger === "at_launch") atLaunch.push(label);
    else if (trigger === "on_date" && date) onDate.push(`${label} starts ${date}`);
    else now.push(label);
  }

  // Only worth saying when something does not simply start now; "everything
  // starts now" is what a client assumes anyway.
  const parts: string[] = [];
  const begins = (services: string[]) => `${listJoin(services)} ${services.length === 1 ? "begins" : "begin"}`;
  if (atSplash.length > 0 || atLaunch.length > 0 || onDate.length > 0) {
    if (now.length > 0) parts.push(`${listJoin(now)} ${now.length === 1 ? "starts" : "start"} now.`);
    if (atSplash.length > 0) parts.push(`${begins(atSplash)} when your splash page goes live.`);
    if (atLaunch.length > 0) {
      // With a splash page first, "your website launches" is ambiguous — there
      // are two launches — so say which one.
      parts.push(
        `${begins(atLaunch)} when your ${splashBuild ? "full " : ""}website launches${launchDate ? ` (${launchDate})` : ""}.`,
      );
    }
    if (onDate.length > 0) parts.push(`${listJoin(onDate)}.`);
  }

  return { kickoff, website, launchDate, starts: parts.length ? parts.join(" ") : null };
}
