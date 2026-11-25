import type { UserRole } from "@/lib/auth/profile";

/**
 * PER-PERSON SECTION ACCESS.
 *
 * Access is a role plus, for strategists, a list of extra sections an admin has
 * opened for that person on the Team page (profiles.section_grants).
 *
 *   Admin       — everything.
 *   Strategist  — the Clients section and the tools it links to
 *                 (lib/auth/app-mode.ts), plus each section granted here.
 *
 * Only sections whose pages work for someone who isn't an admin can be granted.
 * Onboarding still reads every client's data with the service key and saves
 * through admin-only routes, so opening it now would show a strategist other
 * people's clients. It becomes grantable in the pull request that rebuilds it,
 * by listing its pages and APIs below and setting ready. Reporting was rebuilt
 * that way in Nov 2026: its list reads with the strategist's own session, and
 * every report route checks the client is theirs (lib/reporting/client-access.ts).
 *
 * A grant opens pages and APIs; it never opens editing that is admin-only by
 * design (the Playbook editors keep their own admin checks).
 *
 * proxy.ts enforces this on every request, and the sidebar and the Team page
 * read the same table, so what a person sees and what they can reach agree.
 */

/** Every value profiles.section_grants accepts (see its check constraint). */
export const SECTION_GRANT_KEYS = ["reporting", "onboarding", "playbook"] as const;
export type SectionGrant = (typeof SECTION_GRANT_KEYS)[number];

type SectionAccess = {
  label: string;
  /** False until the section's pages are safe for a non-admin. */
  ready: boolean;
  /** What the Team page says about the section. */
  note: string;
  /** Page prefixes the grant opens. */
  pages: string[];
  /** First path segments under /api the grant opens. */
  api: string[];
};

export const SECTION_ACCESS: Record<SectionGrant, SectionAccess> = {
  reporting: {
    label: "Reporting",
    ready: true,
    note: "See and move along the monthly reports of their own clients. Client Snapshot stays with admins.",
    // A client's report (/reports/…) and its APIs are part of the Clients
    // section already, so every strategist reaches them; the grant adds the
    // monthly list. Client Snapshot is admin-only and stays so.
    pages: ["/reporting"],
    api: [],
  },
  onboarding: {
    label: "Onboarding",
    ready: false,
    note: "Can be granted once Onboarding is rebuilt to show each person only their own clients.",
    pages: [],
    api: [],
  },
  playbook: {
    label: "Playbook",
    ready: true,
    note: "Read Services & Tiers and the Service Playbook. Editing stays with admins.",
    // Their data APIs (services,
    // playbook) are already open to strategists, and their saves check for an
    // admin themselves.
    pages: ["/playbook", "/services"],
    api: [],
  },
};

/** Sections an admin can grant today, in sidebar order. */
export const GRANTABLE_SECTIONS: SectionGrant[] = SECTION_GRANT_KEYS.filter(
  (key) => SECTION_ACCESS[key].ready,
);

/** Keeps only known section keys, once each, from whatever the database returned. */
export function parseGrants(value: unknown): SectionGrant[] {
  if (!Array.isArray(value)) return [];
  return SECTION_GRANT_KEYS.filter((key) => value.includes(key));
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True when one of these grants opens the path. Ungranted and not-ready sections open nothing. */
export function grantsReach(pathname: string, grants: readonly SectionGrant[]): boolean {
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  const namespace = isApi ? (pathname.split("/")[2] ?? "") : "";
  return grants.some((grant) => {
    const section = SECTION_ACCESS[grant];
    if (!section?.ready) return false;
    return isApi ? section.api.includes(namespace) : section.pages.some((page) => matchesPrefix(pathname, page));
  });
}

/** Grants only mean something for strategists: admins already reach everything. */
export function effectiveGrants(role: UserRole | null, grants: readonly SectionGrant[]): SectionGrant[] {
  return role === "strategist" ? [...grants] : [];
}
