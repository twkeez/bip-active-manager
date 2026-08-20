/**
 * Two deployments run from this one codebase, told apart by the APP_MODE env var:
 *
 *   APP_MODE unset (or "full") — the experimental app. Everything is reachable.
 *   APP_MODE="team"            — the team app. Only the Clients section and the
 *                                tools reachable from it exist. Everything else
 *                                redirects to /dashboard/clients.
 *
 * Team mode is enforced in proxy.ts, so a blocked route is genuinely unreachable
 * rather than merely hidden — an experiment can't leak into the team's app via a
 * bookmark or a stale link. The sidebars filter their nav against the same lists
 * so the two never drift.
 *
 * Mode and role are separate layers, and both apply. Mode decides what *exists*
 * on a deployment; role (admin vs strategist) still decides who sees what within
 * it. A route can be allowed here and remain admin-only in the nav.
 *
 * To let the team into a new tool: add its page route to TEAM_PAGES, and any API
 * namespace the tool fetches to TEAM_API_NAMESPACES.
 */

export type AppMode = "full" | "team";

export function getAppMode(): AppMode {
  return process.env.APP_MODE === "team" ? "team" : "full";
}

/** Sign-in and the root redirect work in every mode. */
const ALWAYS_ALLOWED = ["/", "/login", "/signup", "/auth"];

/**
 * Page routes the team app serves: the Clients section, plus the standalone
 * tools the team is allowed into. Add a route here to hand the team a new tool.
 *
 * Note this only governs standalone pages. The tabs inside a client workspace
 * (reporting, seo, ads, social, onboarding, playbook…) are part of
 * /dashboard/clients and come along with it.
 */
export const TEAM_PAGES = [
  "/dashboard/clients",

  "/reports",
  "/reputation",
  "/social-planner",
  "/site-audit",
  "/sitemaps",
  "/local-rank",

  // Ads tools — the whole Ads section, plus the audit linked from a client
  // workspace. Several are still admin-only by role, which applies on top.
  "/ads-audit",
  "/ads-calls",
  "/ads-diagnostic",
  "/ads-health",
  "/ads-planner",
  "/ad-spend-trends",
  "/conversion-integrity",
  "/ppc-defense",
  "/global-ads-optimization",

  // Print/export views those tools open in a new tab
  "/reports-print",
  "/onboarding-report-print",
];

/**
 * First path segment under /api that the team app serves. Anything not listed
 * 404s, which is what keeps the experimental features (Gmail triage, Illuminare,
 * Sales Lab, the strategy mapper) genuinely absent rather than just unlinked.
 */
export const TEAM_API_NAMESPACES = [
  "ads",
  "ads-diagnostic",
  "ads-planner",
  "ai",
  "basecamp",
  "client-seo-audits",
  "clients",
  "ga4",
  "gbp",
  "google",
  "harvest",
  "local-rank",
  "onboarding",
  "onboarding-kickoff",
  "organic-rank",
  "places",
  "playbook",
  "projects",
  "reporting",
  "reports",
  "reputation",
  "seo",
  "service-expectations",
  "services",
  "site-audit",
  "sitemaps",
  "social",
  "tasks",
];

/** Prefix match that respects path segments, so /reports doesn't match /reportsfoo. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True if the team deployment should serve this path. */
export function isAllowedInTeamMode(pathname: string): boolean {
  if (ALWAYS_ALLOWED.some((prefix) => matchesPrefix(pathname, prefix))) {
    return true;
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const namespace = pathname.split("/")[2] ?? "";
    return TEAM_API_NAMESPACES.includes(namespace);
  }

  return TEAM_PAGES.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * True if a nav item should be shown. Sidebars call this so team mode hides the
 * links it would otherwise bounce.
 */
export function isNavItemVisible(href: string, mode: AppMode): boolean {
  return mode === "full" || isAllowedInTeamMode(href);
}
