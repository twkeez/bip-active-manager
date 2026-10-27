import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Every Claude call BIP Control makes goes through anthropicClient(feature),
// which records the call's tokens and cost in ai_usage, so /ai-spend can show
// where the money goes by feature. Recording never breaks or slows the call:
// it happens after the response, and a failed write is only logged.

/** US dollars per million tokens, from Anthropic's price list (2026-10). */
const PRICES: { prefix: string; input: number; output: number }[] = [
  { prefix: "claude-fable-5", input: 10, output: 50 },
  { prefix: "claude-opus-5-5", input: 4, output: 20 },
  { prefix: "claude-opus-5", input: 5, output: 25 },
  { prefix: "claude-opus-4", input: 5, output: 25 },
  { prefix: "claude-sonnet-5", input: 2, output: 10 },
  { prefix: "claude-sonnet-4", input: 3, output: 15 },
  { prefix: "claude-haiku-5-5", input: 0.1, output: 0.5 },
  { prefix: "claude-haiku-4", input: 1, output: 5 },
];
/** Web search is billed per search: $10 per 1,000. */
const WEB_SEARCH_USD = 0.01;

export type CallUsage = {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  webSearches: number;
};

export function costOf(usage: CallUsage): number {
  const price = PRICES.find((p) => usage.model.startsWith(p.prefix)) ?? { input: 5, output: 25 };
  const perToken = (perMillion: number) => perMillion / 1_000_000;
  return (
    usage.input * perToken(price.input) +
    usage.cacheRead * perToken(price.input) * 0.1 +
    usage.cacheWrite * perToken(price.input) * 1.25 +
    usage.output * perToken(price.output) +
    usage.webSearches * WEB_SEARCH_USD
  );
}

type RawUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number } | null;
};

function fromRaw(model: string, raw: RawUsage | undefined, outputOverride?: number, searchesOverride?: number): CallUsage {
  return {
    model,
    input: raw?.input_tokens ?? 0,
    output: outputOverride ?? raw?.output_tokens ?? 0,
    cacheRead: raw?.cache_read_input_tokens ?? 0,
    cacheWrite: raw?.cache_creation_input_tokens ?? 0,
    webSearches: searchesOverride ?? raw?.server_tool_use?.web_search_requests ?? 0,
  };
}

/** Usage from a streamed (server-sent events) response body. */
export function usageFromStream(text: string): CallUsage | null {
  let model = "";
  let start: RawUsage | undefined;
  let output: number | undefined;
  let searches: number | undefined;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const event = JSON.parse(line.slice(5)) as {
        type?: string;
        message?: { model?: string; usage?: RawUsage };
        usage?: RawUsage;
      };
      if (event.type === "message_start") {
        model = event.message?.model ?? model;
        start = event.message?.usage;
      } else if (event.type === "message_delta" && event.usage) {
        output = event.usage.output_tokens ?? output;
        searches = event.usage.server_tool_use?.web_search_requests ?? searches;
      }
    } catch {
      // Not JSON (a ping or a partial line): skip it.
    }
  }
  return model ? fromRaw(model, start, output, searches) : null;
}

async function record(feature: string, usage: CallUsage) {
  try {
    const { error } = await createAdminClient()
      .from("ai_usage")
      .insert({
        feature,
        model: usage.model,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_tokens: usage.cacheRead,
        cache_write_tokens: usage.cacheWrite,
        web_searches: usage.webSearches,
        cost_usd: Number(costOf(usage).toFixed(6)),
      });
    if (error) console.error(`[ai-usage] couldn't record ${feature}: ${error.message}`);
  } catch (error) {
    console.error(`[ai-usage] couldn't record ${feature}:`, error);
  }
}

function later(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    // Outside a request (a script): just run it.
    void task();
  }
}

function trackingFetch(feature: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!response.ok || !/\/v1\/messages(\?|$)/.test(url)) return response;
    const copy = response.clone();
    later(async () => {
      const type = copy.headers.get("content-type") ?? "";
      const text = await copy.text();
      const usage = type.includes("event-stream")
        ? usageFromStream(text)
        : (() => {
            const body = JSON.parse(text) as { model?: string; usage?: RawUsage };
            return body.model ? fromRaw(body.model, body.usage) : null;
          })();
      if (usage) await record(feature, usage);
    });
    return response;
  };
}

/** A Claude client whose calls are recorded under `feature` (shown on /ai-spend). */
export function anthropicClient(feature: string, options: { apiKey?: string } = {}): Anthropic {
  return new Anthropic({ ...options, fetch: trackingFetch(feature) });
}
