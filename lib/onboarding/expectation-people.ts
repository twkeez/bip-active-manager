/**
 * Who a client's strategist is, and how to reach them.
 *
 * `marketing_strategist` is free text and holds more than names. Among the 93
 * clients buying a marketing service, 17 say "Low Contact"; across the book 151
 * say "Website Only", and others "Onboarding" or "Dont Know". Pairs are written
 * "Melissa/Stephanie". Merged straight into the intro, that printed "Low
 * Contact will go through it with you at kickoff."
 *
 * So a value only counts where it names someone on the team, matched against
 * staff profiles by first name. Anything else is treated as no strategist, which
 * the copy already handles ("Your strategist will go through it…").
 */

export type StaffProfile = { full_name: string | null; email: string | null };

export type StrategistContact = {
  name: string;
  /** Null unless exactly one profile matches — two "Tom"s means we cannot say which. */
  email: string | null;
};

const firstName = (full: string | null | undefined) =>
  (full ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";

const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export function resolveStrategistContacts(
  value: string | null | undefined,
  profiles: StaffProfile[],
): StrategistContact[] {
  const parts = (value ?? "")
    .split(/\/|&|,|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const contacts: StrategistContact[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    const matches = profiles.filter((profile) => firstName(profile.full_name) === key);
    // Not someone on the team: a status like "Low Contact", or a typo.
    if (matches.length === 0) continue;
    seen.add(key);
    const emails = [
      ...new Set(matches.map((m) => (m.email ?? "").trim().toLowerCase()).filter(Boolean)),
    ];
    contacts.push({ name: capitalise(part), email: emails.length === 1 ? emails[0]! : null });
  }
  return contacts;
}

/** "Stephanie", "Melissa and Stephanie", "A, B and C" — or "" for no strategist. */
export function strategistDisplayName(contacts: StrategistContact[]): string {
  const names = contacts.map((contact) => contact.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
