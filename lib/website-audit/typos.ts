// Claude lists spelling mistakes per page, but it also files notes ("No
// misspelling found", "Remove or correct: …"), rewrites ("Dental Health Near
// Fort Mill" → "Dental Care in Indian Land"), style choices ("Dallas Hwy" →
// "Dallas Highway", "mosquitos") and things inside web addresses as typos.
// A client reads this list as "you spelled this wrong", so only a mistake we
// can stand behind is kept: a small correction of words the page really shows.

export type Typo = { text: string; suggestion: string; where?: string };

/** What the page shows a visitor: checked so a mistake Claude misread or made up isn't reported. */
export type PageWords = { title?: string | null; h1s?: string[]; navLinks?: { text: string }[]; text?: string };

const NOTE = /\b(no (misspelling|spelling|typo|change|error)s?|not (a typo|applicable|verifiable)|none needed|placeholder|remove or|possible|duplicate|or similar|inconsistent|consider|missing space)\b/i;

const normalize = (s: string) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/** Fewest single-character edits turning `needle` into some stretch of `hay`. */
function distanceToClosestPart(needle: string, hay: string): number {
  let prev = new Array(hay.length + 1).fill(0);
  for (let i = 1; i <= needle.length; i++) {
    const cur = [i];
    for (let j = 1; j <= hay.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (needle[i - 1] === hay[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return Math.min(...prev);
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Both spellings are in the dictionary: not a mistake, whichever the page uses. */
const ACCEPTED_PAIRS: [string, string][] = [
  ["preventative", "preventive"],
  ["mosquitos", "mosquitoes"],
  ["healthcare", "health care"],
  ["petcare", "pet care"],
  ["wellbeing", "well-being"],
  ["ok", "okay"],
  ["advisor", "adviser"],
  ["orthopaedic", "orthopedic"],
  ["judgement", "judgment"],
  ["cancelled", "canceled"],
  ["travelling", "traveling"],
  ["grey", "gray"],
  ["e-mail", "email"],
  ["website", "web site"],
  ["online", "on-line"],
];

/** Street and title abbreviations: writing them out is a choice, not a correction. */
const ABBREVIATIONS = /\b(hwy|rd|st|ave|blvd|dr|ste|pkwy|ln|ct|apt|mt|ft|vs|approx|appt|dept|est|inc|co|llc|am|pm|a\.m|p\.m)\b\.?/gi;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);

/** A web address, a file path, an email or a social handle rather than words a visitor reads. */
const looksLikeAddress = (s: string) => /^\/|https?:|www\.|@|\.(html?|php|com|org|net|pdf)\b/i.test(s) || (/^[a-z0-9_-]{12,}$/.test(s) && !/[A-Z ]/.test(s));

/**
 * Words swapped for different words ("antifungal infections" → "antifungal
 * medications") are a rewrite, not a spelling fix. A changed word must stay
 * close to the one it replaces; dropped or added words (a doubled "the") are fine.
 */
function swapsAWord(text: string, suggestion: string): boolean {
  const from = words(text);
  const to = words(suggestion);
  const removed = from.filter((w) => !to.includes(w));
  const added = to.filter((w) => !from.includes(w));
  if (!removed.length || !added.length) return false;
  // Words run together or split ("atEdgewater" → "at Edgewater") leave every letter in place.
  if (removed.join("") === added.join("")) return false;
  // Each new word must be a near-miss of a word it could be replacing.
  return added.some((a) => !removed.some((r) => editDistance(a, r) <= Math.min(3, Math.max(1, Math.ceil(Math.max(a.length, r.length) * 0.34))) || r.includes(a) || a.includes(r)));
}

/** True when the suggestion is a correction of the text, not a note, a rewrite or a style choice. */
export function isRealTypo(typo: Typo): boolean {
  const text = normalize(typo.text).toLowerCase();
  const suggestion = normalize(typo.suggestion).toLowerCase();
  if (!text || !suggestion || text === suggestion) return false;
  if (NOTE.test(typo.suggestion)) return false;
  // Inside a web address: changing it breaks links, and no visitor reads it as spelling.
  if (typo.where === "url" || looksLikeAddress(typo.text.trim()) || looksLikeAddress(typo.suggestion.trim())) return false;
  // Only hyphens, spaces around hyphens, or capital letters differ: a style choice.
  if (text.replace(/[-‐–]/g, " ").replace(/\s+/g, " ") === suggestion.replace(/[-‐–]/g, " ").replace(/\s+/g, " ")) return false;
  // An abbreviation written out ("Dallas Hwy" → "Dallas Highway").
  const abbreviated = text.match(ABBREVIATIONS);
  if (abbreviated && text.replace(ABBREVIATIONS, "").replace(/\s+/g, " ").trim() === suggestion.replace(ABBREVIATIONS, "").replace(/\b(highway|road|street|avenue|boulevard|drive|suite|parkway|lane|court|apartment|mount|fort|versus|approximately|appointment|department|established|incorporated|company)\b/g, "").replace(/\s+/g, " ").trim()) return false;
  for (const [a, b] of ACCEPTED_PAIRS) {
    const swap = (s: string, x: string, y: string) => s.split(x).join(y);
    if (swap(text, a, b) === suggestion || swap(text, b, a) === suggestion) return false;
  }
  if (swapsAWord(text, suggestion)) return false;
  // The suggestion may fix just part of a long quote ("…scaling, The" → "scaling. The").
  const edits = distanceToClosestPart(suggestion, text);
  return edits > 0 && edits <= Math.max(3, Math.ceil(suggestion.length * 0.25));
}

/** Does the page really show these words (in its title, headline, menu or text)? */
export function appearsOn(text: string, page: PageWords): boolean {
  const hay = normalize([page.title ?? "", ...(page.h1s ?? []), ...(page.navLinks ?? []).map((l) => l.text), page.text ?? ""].join(" \n ")).toLowerCase();
  if (!hay.trim()) return true; // Nothing to check against: don't drop on no evidence.
  return hay.includes(normalize(text).toLowerCase());
}

/**
 * The mistakes worth reporting. With the page's own words (`page`), a mistake
 * must also be something the page really shows.
 */
export function realTypos<T extends Typo>(typos: T[], page?: PageWords): T[] {
  return typos.filter((t) => isRealTypo(t) && (!page || appearsOn(t.text, page)));
}
