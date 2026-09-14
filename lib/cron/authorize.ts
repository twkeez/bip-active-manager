import { timingSafeEqual } from "node:crypto";

/**
 * Shared-secret auth for the scheduled jobs.
 *
 * There is no user on a cron request, so these endpoints authenticate with
 * CRON_SECRET rather than a session. Extracted from the Basecamp watch route
 * once a second job needed the same rule: two copies of an auth check is two
 * chances to fix only one of them.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Refuse rather than run open when the secret is unset — an unauthenticated
  // endpoint that spends money is worse than one that does not work.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (presented.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(presented), Buffer.from(secret));
}

/** Whether a secret is configured at all — safe to return in a 401 body. */
export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}
