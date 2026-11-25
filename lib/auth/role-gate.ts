import { isAllowedInTeamMode } from "@/lib/auth/app-mode";
import type { UserRole } from "@/lib/auth/profile";
import { grantsReach, type SectionGrant } from "@/lib/auth/sections";

/**
 * Who may reach a path, decided on the server for every request (see proxy.ts).
 *
 * Until Nov 2026 the strategist view was only a trimmed sidebar on the full
 * deployment: a strategist who typed an admin URL, or a page that fetched an
 * admin API, got through, because most API routes check that someone is signed
 * in but not who. Now a signed-in non-admin can reach what the team deployment
 * serves (lib/auth/app-mode.ts), plus any section an admin granted them on the
 * Team page (lib/auth/sections.ts), pages and APIs alike.
 *
 * Requests with no session are not decided here. Cron jobs, OAuth callbacks, the
 * MCP endpoint and snapshot links carry their own credentials, and every other
 * route rejects anonymous callers itself (lib/auth/route-access.test.ts).
 *
 * A signed-in user with no profile row counts as a non-admin with no grants:
 * when access can't be read, the answer is the narrower one.
 */

/** True when any non-admin may reach this path; admins may reach everything. */
export function nonAdminMayReach(pathname: string): boolean {
  return isAllowedInTeamMode(pathname);
}

export type RoleGateDecision = "allow" | "block";

export function decideRoleGate(
  pathname: string,
  role: UserRole | null,
  grants: readonly SectionGrant[] = [],
): RoleGateDecision {
  if (role === "admin") return "allow";
  if (nonAdminMayReach(pathname)) return "allow";
  if (role === "strategist" && grantsReach(pathname, grants)) return "allow";
  return "block";
}
