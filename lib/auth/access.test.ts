import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { readAccess } from "@/lib/auth/access";

type Answer = { data: unknown; error: { code?: string; message: string } | null };

/** A profiles table that answers by the columns asked for. */
function fakeClient(answers: Record<string, Answer>) {
  const asked: string[] = [];
  const client = {
    from: () => ({
      select: (columns: string) => {
        asked.push(columns);
        const answer = answers[columns] ?? { data: null, error: { message: `unexpected select ${columns}` } };
        return { eq: () => ({ maybeSingle: async () => answer }) };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, asked };
}

describe("readAccess", () => {
  it("reads a strategist's role and sections", async () => {
    const { client } = fakeClient({
      "role, section_grants": { data: { role: "strategist", section_grants: ["playbook", "nonsense"] }, error: null },
    });
    expect(await readAccess(client, "u1")).toEqual({
      ok: true,
      access: { role: "strategist", grants: ["playbook"], grantsColumn: true },
    });
  });

  it("gives admins no grants, since they reach everything", async () => {
    const { client } = fakeClient({
      "role, section_grants": { data: { role: "admin", section_grants: ["playbook"] }, error: null },
    });
    expect(await readAccess(client, "u1")).toEqual({
      ok: true,
      access: { role: "admin", grants: [], grantsColumn: true },
    });
  });

  it("works before the migration, reading the role alone", async () => {
    const { client, asked } = fakeClient({
      "role, section_grants": { data: null, error: { code: "42703", message: "column does not exist" } },
      role: { data: { role: "strategist" }, error: null },
    });
    expect(await readAccess(client, "u1")).toEqual({
      ok: true,
      access: { role: "strategist", grants: [], grantsColumn: false },
    });
    expect(asked).toEqual(["role, section_grants", "role"]);
  });

  it("reports any other failed read instead of guessing", async () => {
    const { client } = fakeClient({
      "role, section_grants": { data: null, error: { code: "57014", message: "timeout" } },
    });
    expect(await readAccess(client, "u1")).toEqual({ ok: false, message: "timeout" });
  });

  it("treats a missing profile as no role", async () => {
    const { client } = fakeClient({ "role, section_grants": { data: null, error: null } });
    expect(await readAccess(client, "u1")).toEqual({
      ok: true,
      access: { role: null, grants: [], grantsColumn: true },
    });
  });
});
