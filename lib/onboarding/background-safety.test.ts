import { describe, expect, it } from "vitest";
import { htmlToText, isAccessThread, redactCredentials } from "./background-safety";

describe("isAccessThread", () => {
  // Tiburon's actual website-team threads.
  it("skips the threads that exist to hold access details", () => {
    expect(isAccessThread("INTERNAL: Access, Tools, & Forms")).toBe(true);
    expect(isAccessThread("INTERNAL: Build & Code")).toBe(true);
    expect(isAccessThread("GoDaddy login")).toBe(true);
    expect(isAccessThread("Hosting and DNS")).toBe(true);
  });

  it("reads the threads with useful background", () => {
    expect(isAccessThread("INTERNAL: Account Notes")).toBe(false);
    expect(isAccessThread("INTERNAL: Design & Content")).toBe(false);
    expect(isAccessThread("INTERNAL: Splash Page")).toBe(false);
    expect(isAccessThread("Website Communication")).toBe(false);
    expect(isAccessThread("We have updated the Dr. 's bio picture. Please use this instead:")).toBe(false);
  });
});

describe("redactCredentials", () => {
  it("removes whole lines that carry or label a secret", () => {
    const { text, removed } = redactCredentials(
      [
        "Dr. Rathjen is the owner.",
        "GoDaddy username: tiburonvet",
        "Password: hunter2!",
        "Open Monday to Saturday.",
        "FTP host ftp.example.com",
        "api key sk_live_abc",
        "Their logo is complete.",
      ].join("\n"),
    );
    expect(text).toBe(["Dr. Rathjen is the owner.", "Open Monday to Saturday.", "Their logo is complete."].join("\n"));
    expect(removed).toBe(4);
  });

  it("removes a long token even with no label", () => {
    expect(redactCredentials("see a8f3k29dk39fj20dk3kd93kd83kd93kd8".padEnd(40, "x")).text).toBe("");
  });

  it("leaves ordinary practice information alone", () => {
    const source = "Hours are 7:30 to 6.\nThey want a homey, neighborhood feel.\nSplash page first, full site in December.";
    expect(redactCredentials(source)).toEqual({ text: source, removed: 0 });
  });
});

describe("htmlToText", () => {
  it("turns Basecamp HTML into readable lines", () => {
    expect(htmlToText("<div>Hey Ashley,<br>The contact is <strong>Kristina</strong>.</div><ul><li>Logo done</li><li>Hero video?</li></ul>")).toBe(
      "Hey Ashley,\nThe contact is Kristina.\n- Logo done\n- Hero video?",
    );
  });
});
