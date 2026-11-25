import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { rejectUnlessClientVisible } from "@/lib/reporting/client-access";

function clientsTable(answer: { data: unknown; error: { message: string } | null }) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => answer }) }) }),
  } as unknown as SupabaseClient;
}

describe("rejectUnlessClientVisible", () => {
  it("lets the caller through when their session can read the client", async () => {
    expect(await rejectUnlessClientVisible(clientsTable({ data: { id: 7 }, error: null }), 7)).toBeNull();
  });

  it("answers 404 when the client is someone else's or doesn't exist", async () => {
    const response = await rejectUnlessClientVisible(clientsTable({ data: null, error: null }), 7);
    expect(response?.status).toBe(404);
  });

  it("answers 503 when the check itself fails, instead of letting the caller through", async () => {
    const response = await rejectUnlessClientVisible(clientsTable({ data: null, error: { message: "timeout" } }), 7);
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "Could not check access to this client: timeout" });
  });
});
