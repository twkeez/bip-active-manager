/**
 * The client portal is a third deployment of this codebase, set by
 * APP_MODE=client. It serves one thing: /s/<token>, a client's published
 * Monthly Snapshot. Every other page and every API is "not found" there, and
 * no sign-in runs, so nothing internal is reachable from a client's domain.
 * The client route, in turn, does not exist on BIP Control or the team build.
 * Enforced in proxy.ts.
 */
export function isClientPortal(): boolean {
  return process.env.APP_MODE === "client";
}

export function isPortalPath(pathname: string): boolean {
  return /^\/s\/[A-Za-z0-9_-]+\/?$/.test(pathname);
}
