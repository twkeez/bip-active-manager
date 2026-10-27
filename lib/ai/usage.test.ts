import { describe, expect, it } from "vitest";
import { costOf, usageFromStream } from "./usage";

describe("AI usage", () => {
  it("prices calls by model", () => {
    const base = { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0, webSearches: 0 };
    expect(costOf({ ...base, model: "claude-opus-5" })).toBeCloseTo(5 + 2.5);
    expect(costOf({ ...base, model: "claude-opus-5-5" })).toBeCloseTo(4 + 2);
    expect(costOf({ ...base, model: "claude-haiku-5-5" })).toBeCloseTo(0.1 + 0.05);
    expect(costOf({ ...base, model: "claude-sonnet-4-6", webSearches: 3 })).toBeCloseTo(3 + 1.5 + 0.03);
  });

  it("reads usage from a streamed response", () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"model":"claude-opus-5","usage":{"input_tokens":1200,"output_tokens":1,"cache_read_input_tokens":800}}}',
      'data: {"type":"ping"}',
      'data: {"type":"message_delta","usage":{"output_tokens":350,"server_tool_use":{"web_search_requests":2}}}',
    ].join("\n");
    expect(usageFromStream(sse)).toEqual({ model: "claude-opus-5", input: 1200, output: 350, cacheRead: 800, cacheWrite: 0, webSearches: 2 });
  });
});
