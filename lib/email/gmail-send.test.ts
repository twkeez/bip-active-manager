import { describe, expect, it } from "vitest";
import { buildRawEmail } from "./gmail-send";

describe("buildRawEmail", () => {
  it("builds a base64url message with an encoded non-ASCII subject", () => {
    const raw = buildRawEmail({ to: "tom@beyondindigo.com", subject: "BIP daily check ✓", body: "Everything ran." });
    expect(raw).not.toMatch(/[+/=]/);
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: tom@beyondindigo.com");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
    const body = decoded.split("\r\n\r\n")[1];
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("Everything ran.");
  });

  it("leaves a plain ASCII subject readable", () => {
    const decoded = Buffer.from(buildRawEmail({ to: "a@b.com", subject: "BIP: 2 jobs", body: "x" }), "base64url").toString("utf8");
    expect(decoded).toContain("Subject: BIP: 2 jobs");
  });

  it("adds a Cc header only when there is one", () => {
    const withCc = Buffer.from(buildRawEmail({ to: "a@b.com", cc: "c@d.com", subject: "s", body: "b" }), "base64url").toString("utf8");
    expect(withCc).toContain("Cc: c@d.com");
    const without = Buffer.from(buildRawEmail({ to: "a@b.com", subject: "s", body: "b" }), "base64url").toString("utf8");
    expect(without).not.toContain("Cc:");
  });
});
