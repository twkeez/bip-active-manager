import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Profiles hold each person's role. The browser roles must never get UPDATE on
// the whole table back (see 20261125180000_profiles_lock_role.sql): a column
// grant can't narrow a table grant, and row security only checks which row.

const dir = join(__dirname, "../../supabase/migrations");
const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

describe("profiles privileges", () => {
  it("are locked to own-name updates by a migration", () => {
    const lock = files.find((name) => name.endsWith("_profiles_lock_role.sql"));
    expect(lock).toBeDefined();
    const sql = readFileSync(join(dir, lock!), "utf8");
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.profiles FROM anon, authenticated;/);
    expect(sql).toMatch(/GRANT UPDATE \(full_name\) ON public\.profiles TO authenticated;/);
  });

  it("aren't widened again by a later migration", () => {
    const lockIndex = files.findIndex((name) => name.endsWith("_profiles_lock_role.sql"));
    for (const name of files.slice(lockIndex + 1)) {
      const sql = readFileSync(join(dir, name), "utf8").replace(/--.*$/gm, "");
      const widening = /grant\s+(all|insert|update|delete)[^;]*\bon\s+(table\s+)?public\.profiles\b[^;]*\bto\b[^;]*\b(anon|authenticated)\b/i;
      const allowed = /grant\s+update\s*\(\s*full_name\s*\)\s+on\s+public\.profiles\s+to\s+authenticated/i;
      for (const statement of sql.split(";")) {
        if (widening.test(statement) && !allowed.test(statement)) {
          throw new Error(`${name} gives the browser roles write access to profiles: ${statement.trim()}`);
        }
      }
    }
  });
});
