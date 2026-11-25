import { describe, expect, it } from "vitest";
import type { BasecampThread } from "@/lib/poobah/basecamp";
import { buildReadPrompt, buildTranscript } from "./read";

const thread = (title: string, words: string): BasecampThread => ({
  title,
  project: "Acme Vet",
  url: null,
  last_post_at: "2026-11-20T15:00:00Z",
  last_post_side: "client",
  posts: [
    { at: "2026-11-20T15:00:00Z", author: "Dr. Lee", side: "client", text: words, note: null },
    { at: "2026-11-21T15:00:00Z", author: "Alex", side: "Beyond Indigo", text: null, note: "attachment only" },
  ],
});

describe("buildTranscript", () => {
  it("writes each post with its side, and says when a post has no words", () => {
    const { text, included, leftOut } = buildTranscript([thread("Website", "Can you update the hours?")]);
    expect(included).toBe(1);
    expect(leftOut).toBe(0);
    expect(text).toContain("### Thread: Website (project: Acme Vet)");
    expect(text).toContain("Dr. Lee (client): Can you update the hours?");
    expect(text).toContain("Alex (Beyond Indigo): [no words stored for this post] [attachment only]");
  });
  it("keeps the newest threads that fit and counts the rest", () => {
    const threads = [thread("One", "x".repeat(100)), thread("Two", "y".repeat(100)), thread("Three", "z".repeat(100))];
    const { included, leftOut } = buildTranscript(threads, 250);
    expect(included).toBe(1);
    expect(leftOut).toBe(2);
  });
  it("always keeps at least the newest thread", () => {
    expect(buildTranscript([thread("Big", "x".repeat(500))], 10).included).toBe(1);
  });
});

describe("buildReadPrompt", () => {
  const prompt = buildReadPrompt(
    { clientId: 1, name: "Acme Vet", strategist: "Alex", packageValue: "Core", basecampStatus: "Waiting on us" },
    "posts here",
    90,
    new Date("2026-11-25T15:00:00Z"),
  );
  it("tells the reader the next action is a suggestion, never sent to the client", () => {
    expect(prompt).toContain("It is a suggestion the strategist checks, never something sent to the client.");
    expect(prompt).toContain("it is never shown to the client");
  });
  it("forbids guessing and copying logins", () => {
    expect(prompt).toContain("Never guess or fill gaps.");
    expect(prompt).toContain("Never copy a password, login, code or account number.");
  });
  it("names the client, strategist and window", () => {
    expect(prompt).toContain("Client: Acme Vet");
    expect(prompt).toContain("Strategist (from the Master Sheet): Alex");
    expect(prompt).toContain("from the last 90 days");
  });
});
