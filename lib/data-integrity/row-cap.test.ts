import { describe, expect, it } from "vitest";
import { detectTruncatedRead, rowsReturned } from "./row-cap";

const base = "https://x.supabase.co/rest/v1";

describe("rowsReturned", () => {
  it("reads the Content-Range header", () => {
    expect(rowsReturned("0-999/*")).toBe(1000);
    expect(rowsReturned("1000-1499/5568")).toBe(500);
    expect(rowsReturned("*/0")).toBeNull();
    expect(rowsReturned(null)).toBeNull();
  });
});

describe("detectTruncatedRead", () => {
  it("flags a read that returned exactly the cap", () => {
    const hit = detectTruncatedRead(`${base}/client_ads_snapshots?select=*&order=created_at.asc&client_id=eq.4`, "GET", "0-999/*");
    expect(hit?.table).toBe("client_ads_snapshots");
    expect(hit?.detail).toContain("exactly 1000 rows");
    expect(hit?.problemKey).toBe("row_cap|client_ads_snapshots|*|created_at.asc|client_id");
  });

  it("ignores short reads, writes and RPC calls", () => {
    expect(detectTruncatedRead(`${base}/clients?select=*`, "GET", "0-247/*")).toBeNull();
    expect(detectTruncatedRead(`${base}/clients?select=*`, "POST", "0-999/*")).toBeNull();
    expect(detectTruncatedRead(`${base}/rpc/something`, "GET", "0-999/*")).toBeNull();
  });

  it("keys by the shape of the query, not its values", () => {
    const a = detectTruncatedRead(`${base}/t?select=a&client_id=eq.1`, "GET", "0-999/*");
    const b = detectTruncatedRead(`${base}/t?select=a&client_id=eq.2`, "GET", "0-999/*");
    expect(a?.problemKey).toBe(b?.problemKey);
  });
});
