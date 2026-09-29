import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashSecret,
  isAllowedMetadataUrl,
  isAllowedRedirectUri,
  parseAuthorizeParams,
  pkceMatches,
  redirectWith,
  safeReturnPath,
} from "./core";

const ORIGIN = "https://bip-active-manager.vercel.app";
const verifier = "a".repeat(43) + "-._~xyz";
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("connector sign-in rules", () => {
  it("sends codes only to Claude's callback or this computer", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://claude.com/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:6274/oauth/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/callback")).toBe(true);
    expect(isAllowedRedirectUri("https://claude.ai/somewhere-else")).toBe(false);
    expect(isAllowedRedirectUri("https://evil.example/api/mcp/auth_callback")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai.evil.example/api/mcp/auth_callback")).toBe(false);
    expect(isAllowedRedirectUri("http://claude.ai/api/mcp/auth_callback")).toBe(false);
    expect(isAllowedRedirectUri("https://user@claude.ai/api/mcp/auth_callback")).toBe(false);
  });

  it("fetches client metadata only from Claude's hosts", () => {
    expect(isAllowedMetadataUrl("https://claude.ai/oauth/mcp-oauth-client-metadata")).toBe(true);
    expect(isAllowedMetadataUrl("http://claude.ai/x")).toBe(false);
    expect(isAllowedMetadataUrl("https://169.254.169.254/latest")).toBe(false);
  });

  it("checks PKCE", () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches(verifier + "x", challenge)).toBe(false);
    expect(pkceMatches("short", challenge)).toBe(false);
  });

  it("never stores a secret as itself", () => {
    expect(hashSecret("abc")).not.toContain("abc");
    expect(hashSecret("abc")).toHaveLength(64);
  });

  it("returns only to same-site paths after sign-in", () => {
    expect(safeReturnPath("/oauth/authorize?client_id=x")).toBe("/oauth/authorize?client_id=x");
    expect(safeReturnPath("//evil.example")).toBe("/dashboard");
    expect(safeReturnPath("/\\evil.example")).toBe("/dashboard");
    expect(safeReturnPath("@evil.example")).toBe("/dashboard");
    expect(safeReturnPath("https://evil.example")).toBe("/dashboard");
    expect(safeReturnPath(null)).toBe("/dashboard");
  });

  it("accepts a proper authorization request and refuses a bad one", () => {
    const good = {
      client_id: "bip-abc",
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      resource: `${ORIGIN}/api/mcp`,
      scope: "poobah",
    };
    const parsed = parseAuthorizeParams(good, ORIGIN);
    expect(parsed).toMatchObject({ ok: true, request: { clientId: "bip-abc", state: "xyz", resource: `${ORIGIN}/api/mcp` } });
    expect(parseAuthorizeParams({ ...good, code_challenge_method: "plain" }, ORIGIN)).toMatchObject({ ok: false });
    expect(parseAuthorizeParams({ ...good, code_challenge: undefined }, ORIGIN)).toMatchObject({ ok: false });
    expect(parseAuthorizeParams({ ...good, resource: "https://other.example/api/mcp" }, ORIGIN)).toMatchObject({ ok: false });
    expect(parseAuthorizeParams({ ...good, scope: "admin" }, ORIGIN)).toMatchObject({ ok: false });
    expect(parseAuthorizeParams({ ...good, redirect_uri: "https://evil.example/cb" }, ORIGIN)).toMatchObject({ ok: false });
  });

  it("builds the redirect back with the code and state", () => {
    expect(redirectWith("http://localhost:6274/cb?x=1", { code: "c", state: "s", error: null })).toBe("http://localhost:6274/cb?x=1&code=c&state=s");
  });
});
