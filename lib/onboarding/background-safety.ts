/**
 * Keeping credentials out of onboarding background.
 *
 * The website team's Basecamp projects have threads whose stated purpose is
 * access codes, FTP details and logins ("INTERNAL: Access, Tools, & Forms",
 * "INTERNAL: Build & Code" on Tiburon). Kickoff docs can carry the same. None of
 * it belongs in a research prompt, a brief, or a document a client receives.
 *
 * Three layers, because each can miss: threads named for access are never
 * read; lines that look like a credential are removed before Claude sees the
 * text; and the summary Claude writes is scrubbed the same way afterwards.
 */

/** Thread titles that exist to hold access details. Read none of them. */
const ACCESS_THREAD =
  /\b(access|logins?|log-ins?|passwords?|credentials?|ftp|sftp|ssh|hosting|dns|registrar|build\s*(&|and)\s*code|tools?\s*(,\s*)?(&|and)\s*forms)\b/i;

export function isAccessThread(title: string | null | undefined): boolean {
  return ACCESS_THREAD.test(title ?? "");
}

/**
 * A line that labels or carries a secret: "Password: …", "user/pass", "FTP
 * host", an API key, a long token. The whole line goes, not just the value —
 * the label alone ("GoDaddy login below") says where to look.
 */
const CREDENTIAL_LINE =
  /\b(pass(word|wd|code)?|pwd|pin|user\s*name|username|log\s*-?\s*in|sign\s*-?\s*in|credential|ftp|sftp|ssh|api[\s_-]*key|secret|token|2fa|mfa|otp|verification code|security question|account (number|#))\b|\b[A-Za-z0-9_\-]{32,}\b/i;

export function redactCredentials(text: string): { text: string; removed: number } {
  let removed = 0;
  const kept = text.split("\n").filter((line) => {
    if (CREDENTIAL_LINE.test(line)) {
      removed += 1;
      return false;
    }
    return true;
  });
  return { text: kept.join("\n"), removed };
}

/** Basecamp content is HTML; background needs readable text. */
export function htmlToText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The instruction every background summary is written under. */
export const BACKGROUND_RULES = `Write background that helps a marketing strategist onboard this veterinary practice: practice facts (doctors, services, specialties, hours, location, opening or launch dates), brand and website (look and feel, splash page or site status, domain), the client's goals and priorities, who the client-side contacts are and what they handle (names and roles only — no email addresses or phone numbers, which live on the client record), and anything still undecided or in progress.

Never include passwords, usernames, logins, access codes, PINs, FTP/DNS/hosting details, API keys, account numbers, or any instruction about how to access an account. If the source mentions that access was granted or shared, say only that ("website team has domain access"), never the details.

Be factual and specific, and only use what the source says. Plain text, short headed sections with bullet points. Skip any section the source says nothing about. No preamble.`;
