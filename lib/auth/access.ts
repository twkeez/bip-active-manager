import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/auth/profile";
import { effectiveGrants, parseGrants, type SectionGrant } from "@/lib/auth/sections";

/**
 * Reads one person's role and section grants (lib/auth/sections.ts).
 *
 * profiles.section_grants comes from supabase/migrations/20261125190000_profile_section_grants.sql,
 * which is applied by hand. Until it is, Postgres answers "column does not
 * exist" (42703); that reads as no grants, with grantsColumn false so the Team
 * page can say why access can't be saved yet. Any other failed read is
 * returned as an error, never as a quiet default.
 */

export type Access = {
  role: UserRole | null;
  grants: SectionGrant[];
  /** False until the section_grants migration has been applied. */
  grantsColumn: boolean;
};

export type AccessRead = { ok: true; access: Access } | { ok: false; message: string };

const UNDEFINED_COLUMN = "42703";

type Row = { role?: string | null; section_grants?: unknown };

function toRole(value: unknown): UserRole | null {
  return value === "admin" || value === "strategist" ? value : null;
}

export async function readAccess(supabase: SupabaseClient, userId: string): Promise<AccessRead> {
  const withGrants = await supabase
    .from("profiles")
    .select("role, section_grants")
    .eq("id", userId)
    .maybeSingle<Row>();

  if (!withGrants.error) {
    const role = toRole(withGrants.data?.role);
    return {
      ok: true,
      access: { role, grants: effectiveGrants(role, parseGrants(withGrants.data?.section_grants)), grantsColumn: true },
    };
  }

  if (withGrants.error.code !== UNDEFINED_COLUMN) {
    return { ok: false, message: withGrants.error.message };
  }

  const roleOnly = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle<Row>();
  if (roleOnly.error) return { ok: false, message: roleOnly.error.message };
  return { ok: true, access: { role: toRole(roleOnly.data?.role), grants: [], grantsColumn: false } };
}
