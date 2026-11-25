import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// No new silent caps. A .limit(n) on a list someone relies on quietly drops
// whatever comes after row n. Read whole lists with fetchAllRows
// (lib/data-integrity/fetch-all.ts), which pages through everything and
// throws on an error, or show the person that the list was cut and where.
//
// The counts below are the row limits the code had on 2026-11-25, file by
// file. A file may lose them (lower its number, or delete its line) but not
// gain them, and a new file may not add one. .limit(1), for "the one row",
// is fine and not counted. If a limit is genuinely right (a "latest 5" panel
// that says so), raise that file's number here in the same change and say
// why in the commit.

const BASELINE: Record<string, number> = {
  "app/api/local-rank/runs/route.ts": 1,
  "app/api/seo/ops/[clientId]/route.ts": 1,
  "app/api/seo/page2-opportunities/route.ts": 1,
  "app/api/seo/search-console/sync/route.ts": 2,
  "app/api/sitemaps/sync/route.ts": 1,
  "lib/briefing/load.ts": 2,
  "lib/client-snapshot/email.ts": 1,
  "lib/dashboard/load-client-workspace-data.ts": 7,
  "lib/dashboard/snapshot-queries.ts": 2,
  "lib/projects/access.ts": 1,
  "lib/routines/load.ts": 1,
  "lib/seo/ops/load.ts": 2,
  "lib/social/meta.ts": 2,
  "lib/social/sync-client.ts": 2,
  "lib/tasks/priority-tasks.ts": 1,
};

const root = join(__dirname, "../..");
const LIMIT = /\.limit\(\s*(?!1\s*\))/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("row limits", () => {
  it("are not added anywhere new", () => {
    const grown: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(join(root, dir))) {
        const path = relative(root, file);
        const count = readFileSync(file, "utf8").match(LIMIT)?.length ?? 0;
        const allowed = BASELINE[path] ?? 0;
        if (count > allowed) grown.push(`${path}: ${count} row limits, allowed ${allowed}`);
      }
    }
    expect(grown, "Read the whole list with fetchAllRows instead of adding .limit()").toEqual([]);
  });
});
