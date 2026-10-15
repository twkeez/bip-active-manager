/**
 * Web domains, for matching help desk tickets to practices by URL.
 *
 * A practice's website domain is the one identifier that the Master Sheet,
 * Zendesk organizations, client email addresses and the tickets themselves
 * can all share. Names never line up; "happypawsvet.com" does.
 */

/** "https://www.HappyPawsVet.com/contact" → "happypawsvet.com". Null if it is not a domain. */
export function normalizeDomain(value: string | null | undefined): string | null {
  let text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  // An email address: keep what follows the @.
  const at = text.lastIndexOf("@");
  if (at !== -1) text = text.slice(at + 1);
  text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  text = text.split(/[/?#\s]/)[0] ?? "";
  text = text.replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
  text = text.replace(/^www\d?\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(text)) return null;
  if (!/\.[a-z]{2,24}$/.test(text)) return null;
  return text;
}

/** The domain of an email address, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  const text = (email ?? "").trim().toLowerCase();
  if (!text.includes("@")) return null;
  return normalizeDomain(text);
}

/**
 * Mailbox providers: an address at one of these says nothing about which
 * practice wrote in.
 */
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com",
  "hotmail.com", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com",
  "me.com", "mac.com", "comcast.net", "att.net", "sbcglobal.net", "bellsouth.net",
  "verizon.net", "charter.net", "cox.net", "earthlink.net", "frontier.com",
  "frontiernet.net", "windstream.net", "centurylink.net", "q.com", "optonline.net",
  "roadrunner.com", "rr.com", "twc.com", "spectrum.net", "juno.com", "netzero.net",
  "protonmail.com", "proton.me", "mail.com", "gmx.com", "zoho.com", "aim.com",
  "suddenlink.net", "mchsi.com", "embarqmail.com", "tds.net", "hughes.net",
]);

/**
 * Domains that turn up in ticket text but never identify a practice: our own,
 * the help desk's, and the services clients paste links from.
 */
const NEVER_A_PRACTICE = [
  "beyondindigo.com", "beyondindigopets.com", "zendesk.com", "google.com",
  "facebook.com", "instagram.com", "youtube.com", "youtu.be", "dropbox.com",
  "wetransfer.com", "box.com", "basecamp.com", "3.basecamp.com", "yelp.com",
  "twitter.com", "x.com", "linkedin.com", "tiktok.com", "apple.com", "microsoft.com",
  "godaddy.com", "cloudflare.com", "wordpress.com", "wordpress.org", "canva.com",
  "bit.ly", "goo.gl", "maps.app.goo.gl", "vetstoria.com", "petdesk.com",
  "vetsource.com", "covetrus.com", "chewy.com", "nextdoor.com",
];

export function isIgnorableDomain(domain: string, internalDomains: string[] = []): boolean {
  if (FREE_EMAIL_DOMAINS.has(domain)) return true;
  for (const ignored of [...NEVER_A_PRACTICE, ...internalDomains]) {
    if (domain === ignored || domain.endsWith(`.${ignored}`)) return true;
  }
  return false;
}

/**
 * Domain-looking strings in free text: "www.happypawsvet.com", an email
 * signature's "jane@happypawsvet.com", "happypawsvet.com/staff".
 */
export function extractDomains(text: string | null | undefined): string[] {
  const found = new Set<string>();
  const pattern = /(?:[a-z0-9-]+\.)+[a-z]{2,24}\b/gi;
  for (const match of (text ?? "").matchAll(pattern)) {
    const before = match.index ? text![match.index - 1] : "";
    // "file.jpg" or "image.png" pasted into a ticket is not a website.
    if (/\.(jpe?g|png|gif|pdf|docx?|xlsx?|pptx?|heic|webp|svg|zip|mp4|mov|txt|csv)$/i.test(match[0])) continue;
    if (before && /[a-z0-9_]/i.test(before) && before !== "@") continue;
    const domain = normalizeDomain(match[0]);
    if (domain) found.add(domain);
  }
  return [...found];
}

/** True if `domain` is `practiceDomain` or one of its subdomains. */
export function domainMatches(domain: string, practiceDomain: string): boolean {
  return domain === practiceDomain || domain.endsWith(`.${practiceDomain}`);
}
