import type { PageContent } from "@/lib/website-audit/types";

// Which services does the site promote without giving them a page? The site
// pass (Opus) used to answer this, and answered differently on every run
// (10 services one day, 14 the next, counting single procedures like "mass
// removals"), which moved the score on a website that hadn't changed. This is
// the same question answered by counting: a service named on several pages
// (in practice, the menu or a services list) that no service page covers.

/** Words that say nothing about which service it is. */
const FILLER = new Set(["and", "the", "for", "pet", "pets", "care", "service", "services", "veterinary", "vet", "animal", "your", "our", "with", "dog", "dogs", "cat", "cats"]);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !FILLER.has(w));

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** "dental" and "dentistry", "allergy" and "allergies", "opthalmology" and "ophthalmology" are the same service. */
const sameWord = (a: string, b: string) => a === b || a.slice(0, 5) === b.slice(0, 5) || (Math.min(a.length, b.length) >= 7 && editDistance(a, b) <= 2) || (a.slice(0, 4) === b.slice(0, 4) && Math.min(a.length, b.length) <= 6);

const key = (name: string) => words(name).sort().join(" ");

/**
 * Services named on at least `minPages` pages that no service page covers.
 * `described` adds what the crawl knows of each service page (its title), so a
 * page called "Routine Care for a Healthier Life" still counts as Wellness.
 */
export function promotedServicesWithoutPage(pages: PageContent[], described: Map<string, string> = new Map()): string[] {
  const readable = pages.filter((p) => !p.error);
  const servicePages = readable.filter((p) => p.pageType === "service");
  const covered = servicePages.flatMap((p) => words(`${decodeURIComponent(p.url.split("/").filter(Boolean).pop() ?? "")} ${p.currentH1 ?? ""} ${described.get(p.url) ?? ""}`));
  const minPages = readable.length < 8 ? 2 : 3;

  // One entry per service, however it's spelled or capitalised from page to page.
  const named = new Map<string, { pages: number; spellings: Map<string, number> }>();
  for (const page of readable) {
    const here = new Map<string, string>();
    for (const name of page.servicesNamed) if (key(name) && !here.has(key(name))) here.set(key(name), name.trim());
    for (const [k, name] of here) {
      const entry = named.get(k) ?? { pages: 0, spellings: new Map() };
      entry.pages += 1;
      entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
      named.set(k, entry);
    }
  }

  // A menu label that pairs a covered service with another word ("Dental / CORES") makes that word the same service.
  for (const k of named.keys()) {
    const mine = k.split(" ");
    if (mine.length > 1 && mine.some((w) => covered.some((c) => sameWord(w, c)))) covered.push(...mine);
  }

  const missing: string[] = [];
  for (const [k, entry] of [...named.entries()].sort((a, b) => b[1].pages - a[1].pages || a[0].localeCompare(b[0]))) {
    if (entry.pages < minPages) continue;
    const mine = k.split(" ");
    // Covered when any of its telling words is a service page's word.
    if (mine.some((w) => covered.some((c) => sameWord(w, c)))) continue;
    // Not twice under two names ("Laser Therapy", "Laser Therapy for Pets").
    if (missing.some((m) => words(m).some((w) => mine.some((x) => sameWord(w, x))))) continue;
    const spelling = [...entry.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    missing.push(spelling);
  }
  return missing;
}
