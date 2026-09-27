import { getAppMode, type AppMode } from "@/lib/auth/app-mode";
import type { UserRole } from "@/lib/auth/profile";

// Cookie that lets an admin preview the restricted "user" (strategist) view.
// Pure helpers only — safe to import from both server and client components
// (getAppMode only reads an environment variable).
export const VIEW_AS_COOKIE = "bip-view-as";

/**
 * Resolves the role the UI should render as. An admin can opt into previewing
 * the strategist view via the VIEW_AS cookie; everyone else gets their real role.
 */
export function resolveEffectiveRole(
  actualRole: UserRole,
  viewAs: string | undefined | null,
): UserRole {
  if (actualRole === "admin" && viewAs === "strategist") return "strategist";
  return actualRole;
}

/**
 * Where a given role lands after login and from the app root. Admins land on
 * the Response Report (Tom's daily view since the Dashboard was retired,
 * 2026-09-26). Everyone else, and everyone on the team build (where the
 * report does not exist), lands on the client homescreen.
 */
export function landingPathForRole(role: UserRole, mode: AppMode = getAppMode()): string {
  return role === "admin" && mode === "full" ? "/response-report" : "/dashboard/clients";
}
