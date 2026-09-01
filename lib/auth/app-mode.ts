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

  // What we promised a client at kickoff. Read-only rendering; the editor that
  // authors these blocks stays on the admin build.
  "/client-expectations-print",

  // Print/export views those tools open in a new tab
  "/reports-print",
  "/onboarding-report-print",
];

/**
 * Pages the team app serves at exactly this path and no deeper.
 *
 * /services shows the tier catalogue, and /services?clientId= a single client's
 * plan — both wanted. Its children are not: /services/library is a file store of
 * internal reference material and /services/partnership is admin-authored, so a
 * prefix match would hand over more than intended.
 */
export const TEAM_EXACT_PAGES = ["/services"];

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

/**
 * Nav items the team app shows in its sidebar.
 *
 * Deliberately narrower than TEAM_PAGES, and separate from it on purpose: the
 * team still has to *reach* the tools a client workspace links out to — the
 * Modules row on the client overview goes to /reports, /social-planner,
 * /reputation and /ads-diagnostic — they just shouldn't clutter the sidebar
 * while the client view is where the work happens. Route access stays governed
 * by TEAM_PAGES; this only decides what gets a link.
 *
 * Narrowed to Clients alone on 2026-08-28. Widen by adding routes here.
 */
export const TEAM_NAV = ["/dashboard/clients"];

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

  if (TEAM_EXACT_PAGES.includes(pathname)) return true;

  return TEAM_PAGES.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * True if a nav item should be shown. Sidebars call this so the team app's
 * sidebar stays to the point — note a hidden link is not a blocked route, so
 * anything the client view links out to still works when followed.
 */
export function isNavItemVisible(href: string, mode: AppMode): boolean {
  if (mode === "full") return true;
  return TEAM_NAV.some((prefix) => matchesPrefix(href, prefix));
}

/**
 * Nav visibility given both layers at once — what the sidebars actually call.
 *
 * Mode decides what a deployment serves and role decides who sees what within
 * it, but for the sidebar the two collapse: a strategist gets the trimmed nav
 * whichever deployment they are on. Otherwise the same person sees a different
 * sidebar on the experimental build than on the team app, and the two lists
 * drift apart every time one is edited.
 *
 * Admins still see everything their own deployment serves.
 */
export function isNavItemVisibleForRole(
  href: string,
  mode: AppMode,
  isAdmin: boolean,
): boolean {
  return isNavItemVisible(href, isAdmin ? mode : "team");
}
