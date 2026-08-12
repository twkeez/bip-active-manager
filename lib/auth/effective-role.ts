import type { UserRole } from "@/lib/auth/profile";

// Cookie that lets an admin preview the restricted "user" (strategist) view.
// Pure helpers only — safe to import from both server and client components.
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

/** Where a given role should land after login / from the app root. */
// Everyone lands on the client selection homescreen; the admin dashboard
// stays reachable via the sidebar.
export function landingPathForRole(_role: UserRole): string {
  return "/dashboard/clients";
}
