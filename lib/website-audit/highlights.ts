import { isCanadian } from "@/lib/website-audit/site-location";
import type { AiPrompt, AuditResults, Evidence, PromptRun, SiteContent } from "@/lib/website-audit/types";

// The Client highlights copy goes to the practice as it is, so everything on it
// has to be checkable. These helpers decide what is safe to print.

/**
 * Why this audit's highlights shouldn't go to a client yet; empty when they can.
 * Q1 Veterinary Hospital's highlights (#10) printed "we asked six AI tools" when
 * both Google tools had refused the location and 36 answers were missing.
 */
export function highlightsNotReady(audit: { city: string | null; state: string | null; results: AuditResults }): string[] {
  const reasons: string[] = [];
  const v = audit.results.aiVisibility;
  if (isCanadian(audit.city, audit.state)) reasons.push("This practice is in Canada. The AI questions were asked from the United States, so these results don't reflect what pet owners there see. Canadian practices are run separately.");
  if (!audit.city || !audit.state) reasons.push("The audit has no town and state, so the AI questions weren't about the practice's area.");
  if (!v) reasons.push("The AI visibility step hasn't run.");
  else if (!v.complete || v.missing > 0) {
    reasons.push(`The AI visibility step is unfinished: ${v.missing} answer${v.missing === 1 ? " is" : "s are"} missing${v.errors.length ? ` (${v.errors.join("; ")})` : ""}. Run that step again before sending.`);
  }
  if (!audit.results.content) reasons.push("The content step hasn't finished, so the strengths can't be checked.");
  return reasons;
}

const squash = (x: string) => x.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

export type CheckedStrength = { title: string; detail: string; backedBy: "reviews" | "website" | "both" };

/** Opening hours change and are easy to garble ("open until 10 pm every weekend"); the report doesn't state them as a strength. */
const ABOUT_HOURS = /\b\d{1,2}(:\d{2})?\s?(a\.?m\.?|p\.?m\.?)\b|\bopen (until|till|late|7 days|seven days|every)\b|\bweekends?\b|\bevenings?\b|\bhours\b/i;
/** Advice to the practice, or a claim about other practices nobody checked: not good-news copy. */
const NOT_FOR_CLIENT = [
  /^(lead|put|add|make|use|mention|highlight|feature|show|move|say|tell|promote|call out|consider)\b/i,
  /\bthis (should|could|would) be\b/i,
  /\b(website|site|homepage) (doesn't|does not|never) (mention|say|show)/i,
  /\b(few|most|many|other) (practices|vets|clinics|hospitals)\b/i,
  /\bnearby can't\b/i,
  // Commentary on the strength ("This is a strong reason for cat owners to choose you"), not the strength itself.
  /^this is\b/i,
];
/** "Every", "always", "never": a couple of reviews can't show those. */
const ABSOLUTE = /\b(every|always|never|everyone|all of)\b/i;

/** The detail without sentences that advise the practice or compare it with others. */
export function clientDetail(detail: string, onlyReviews = false): string {
  const sentences = detail.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [detail];
  return sentences
    .map((s) => s.trim())
    .filter((s) => s && !NOT_FOR_CLIENT.some((re) => re.test(s)) && !(onlyReviews && ABSOLUTE.test(s)))
    .join(" ")
    .trim();
}

/**
 * The strengths whose every quote is really on the page or in the review it
 * cites, minus anything about opening hours, with the advice taken out and
 * what backs each one: reviews, the website, or both. A strength only reviews
 * back can't claim "every" or "never": Dallas Highway's "A written report and
 * plan after every visit" (#8) rested on two reviews about one vet.
 */
export function checkedStrengths(
  differentiators: SiteContent["differentiators"],
  pageText: (url: string) => string | null,
  reviews: { text: string | null }[],
): CheckedStrength[] {
  const holds = (e: Evidence): "reviews" | "website" | null => {
    const quote = squash(e.quote);
    if (quote.length < 3) return null;
    const review = /^review\s*(\d+)$/i.exec(e.source.trim());
    if (review) return squash(reviews[Number(review[1]) - 1]?.text ?? "").includes(quote) ? "reviews" : null;
    const text = pageText(e.source);
    return text != null && squash(text).includes(quote) ? "website" : null;
  };
  const out: CheckedStrength[] = [];
  for (const d of differentiators) {
    if (ABOUT_HOURS.test(d.title) || ABOUT_HOURS.test(d.detail)) continue;
    const backing = d.evidence.map(holds);
    if (!backing.length || backing.some((b) => b == null)) continue;
    const kinds = new Set(backing);
    const backedBy: CheckedStrength["backedBy"] = kinds.size > 1 ? "both" : (backing[0] as "reviews" | "website");
    if (backedBy === "reviews" && ABSOLUTE.test(d.title)) continue;
    const detail = clientDetail(d.detail, backedBy === "reviews");
    if (!detail) continue;
    out.push({ title: d.title, detail, backedBy });
  }
  return out;
}

/**
 * The "Your practice in one sentence" line, or null when it can't go to the
 * practice as written: in the practice's own voice ("our vets") or claiming
 * "every"/"always"/"never". Dallas Highway's (#8) had both.
 */
export function clientPositioningLine(line: string | null | undefined): string | null {
  const text = (line ?? "").trim();
  if (!text || /\b(we|our|us|we're|we've)\b/i.test(text) || ABSOLUTE.test(text)) return null;
  return text;
}

export function backedByLine(b: CheckedStrength["backedBy"]): string {
  return b === "both" ? "Your reviews and website back this up." : b === "reviews" ? "Your Google reviews back this up." : "Your website says so.";
}

/** A question that really ran, for the "e.g." under each kind: one that included the practice when there is one. */
export function examplePrompt(prompts: AiPrompt[], runs: PromptRun[], kind: AiPrompt["kind"]): string | null {
  const ofKind = prompts.filter((p) => p.kind === kind);
  const hit = ofKind.find((p) => runs.some((r) => r.promptId === p.id && (r.cited || r.mentioned)));
  return (hit ?? ofKind[0])?.text ?? null;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six"];
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** "Up from 66% last time" only against a run at least four weeks older: a re-run days apart isn't progress. */
export const COMPARE_AFTER_DAYS = 28;
export function farEnoughApart(current: string, previous: string | null | undefined): boolean {
  if (!previous) return false;
  return new Date(current).getTime() - new Date(previous).getTime() >= COMPARE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
