import { describe, expect, it } from "vitest";
import { buildRawEmail } from "./notify";

describe("buildRawEmail", () => {
  it("builds a base64url message with an encoded non-ASCII subject", () => {
    const raw = buildRawEmail("tom@beyondindigo.com", "BIP daily check ✓", "Everything ran.");
    expect(raw).not.toMatch(/[+/=]/);
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: tom@beyondindigo.com");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
    const body = decoded.split("\r\n\r\n")[1];
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("Everything ran.");
  });

  it("leaves a plain ASCII subject readable", () => {
    const decoded = Buffer.from(buildRawEmail("a@b.com", "BIP: 2 jobs", "x"), "base64url").toString("utf8");
    expect(decoded).toContain("Subject: BIP: 2 jobs");
  });
});
