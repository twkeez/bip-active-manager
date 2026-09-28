import { detectTruncatedRead } from "./row-cap";

/**
 * Browser half of the row-cap tripwire, for the Supabase client used in client
 * components. A capped read is reported to /api/data-warnings, which checks
 * it again on the server and records it. Reported once per kind of query per
 * page load.
 */
const reported = new Set<string>();

export const browserGuardedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    const contentRange = response.headers.get("content-range");
    const read = detectTruncatedRead(url, method, contentRange);
    if (read && !reported.has(read.problemKey)) {
      reported.add(read.problemKey);
      void fetch("/api/data-warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, contentRange }),
      }).catch(() => {});
    }
  } catch {
    // The check must never break the read it is checking.
  }
  return response;
};
