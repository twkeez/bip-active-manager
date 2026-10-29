// Claude lists spelling mistakes per page, but it also files notes ("No
// misspelling found", "Remove or correct: …"), rewrites ("Dental Health Near
// Fort Mill" → "Dental Care in Indian Land") and curly-apostrophe swaps as
// typos (Edgewater, Oct 2026: 27 listed, 10 of them not mistakes). A real
// correction is a small edit of something the page actually says.

const NOTE = /\b(no (misspelling|spelling|typo|change|error)s?|not (a typo|applicable|verifiable)|none needed|placeholder|remove or|possible|duplicate|or similar|inconsistent|consider)\b/i;

const normalize = (s: string) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').trim();

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

/** True when the suggestion is a correction of the text, not a note or a rewrite. */
export function isRealTypo(typo: { text: string; suggestion: string }): boolean {
  const text = normalize(typo.text).toLowerCase();
  const suggestion = normalize(typo.suggestion).toLowerCase();
  if (!text || !suggestion || text === suggestion) return false;
  if (NOTE.test(typo.suggestion)) return false;
  // The suggestion may fix just part of a long quote ("…scaling, The" → "scaling. The").
  const edits = distanceToClosestPart(suggestion, text);
  return edits > 0 && edits <= Math.max(3, Math.ceil(suggestion.length * 0.25));
}

export function realTypos<T extends { text: string; suggestion: string }>(typos: T[]): T[] {
  return typos.filter(isRealTypo);
}
