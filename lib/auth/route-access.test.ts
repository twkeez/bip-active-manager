import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every API route checks who is calling. This is a tripwire, not a proof: it
 * reads each route file and fails when none of the known checks appears in it,
 * so a new route can't ship open by accident (as /api/discovery did — a paid
 * AI call with no sign-in check, removed Nov 2026). It does not prove each
 * handler in a file runs the check; review still has to.
 *
 * Signed-in non-admins are further limited by path in proxy.ts
 * (lib/auth/role-gate.ts); that layer is tested in role-gate.test.ts.
 */

const API_DIR = join(process.cwd(), "app", "api");

/** Routes that are reachable without a session, and what protects them instead. */
const PUBLIC_ROUTES: Record<string, string> = {
  "basecamp/oauth/callback/route.ts": "OAuth callback: checked against the state cookie set when sign-in began.",
  "illuminare/basecamp/oauth/callback/route.ts": "OAuth callback: checked against the state cookie set when sign-in began.",
  "mcp/route.ts": "Claude connector: every call needs an access token from this app's OAuth (admins only).",
  "oauth/register/route.ts": "OAuth client registration: public by the MCP spec; grants nothing until an admin signs in.",
  "oauth/token/route.ts": "OAuth token exchange: needs a one-time code issued to a signed-in admin, with PKCE.",
  "tasks/from-email/route.ts": "Forwarded-email task inbox: needs the shared ingest secret, then the person's inbox token.",
};

/** Shared checks a route can call. Each rejects a caller who fails it. */
const GUARD_CALLS = [
  /\brequireSignedIn\(/,
  /\brequireAdminRole\(/,
  /\brequireAuditAdmin\(/,
  /\basAdmin\(/,
  /\bisAdmin\(/,
  /\bisAuthorizedCronRequest\(/,
];

/** A route that reads the session itself must also turn the caller away. */
const READS_SESSION = /auth\.getUser\(|getProfile\(/;
const REJECTS = /if \(!user\b|if \(!profile\b|!user\)|!profile\)|status: 401|status: 403/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

function hasCheck(source: string): boolean {
  if (GUARD_CALLS.some((pattern) => pattern.test(source))) return true;
  return READS_SESSION.test(source) && REJECTS.test(source);
}

describe("API route access", () => {
  const files = routeFiles(API_DIR);

  it("finds the API routes", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("checks the caller in every route, or says why not", () => {
    const open = files
      .map((file) => relative(API_DIR, file).split("\\").join("/"))
      .filter((route) => !(route in PUBLIC_ROUTES))
      .filter((route) => !hasCheck(readFileSync(join(API_DIR, route), "utf8")));
    expect(open, "routes with no access check").toEqual([]);
  });

  it("lists only public routes that still exist", () => {
    const existing = new Set(files.map((file) => relative(API_DIR, file).split("\\").join("/")));
    for (const route of Object.keys(PUBLIC_ROUTES)) {
      expect(existing.has(route), route).toBe(true);
    }
  });
});
