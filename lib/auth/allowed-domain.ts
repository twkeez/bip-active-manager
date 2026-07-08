// Team accounts are restricted to the Beyond Indigo Google Workspace. Sign-in
// with any other email domain is rejected server-side in the auth callback.
export const ALLOWED_EMAIL_DOMAIN = "beyondindigo.com";

export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return domain === ALLOWED_EMAIL_DOMAIN;
}
