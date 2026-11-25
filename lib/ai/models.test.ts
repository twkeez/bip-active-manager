import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "./models";

const root = join(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// A quoted Claude model id, such as "claude-opus-5" or 'claude-haiku-4-5'.
const MODEL_ID = /["'`]claude-(?:opus|sonnet|haiku|fable)-[0-9a-z.-]+["'`]/g;
// The one file that owns them, and the price list that matches on their prefixes.
const ALLOWED = new Set(["lib/ai/models.ts", "lib/ai/usage.ts"]);

describe("AI models", () => {
  it("are only named in lib/ai/models.ts", () => {
    const strays: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(join(root, dir))) {
        const path = relative(root, file);
        if (ALLOWED.has(path)) continue;
        for (const match of readFileSync(file, "utf8").matchAll(MODEL_ID)) strays.push(`${path}: ${match[0]}`);
      }
    }
    expect(strays, "Use MODELS from lib/ai/models.ts instead of a model id").toEqual([]);
  });

  it("are all real Claude model ids", () => {
    for (const [job, id] of Object.entries(MODELS)) {
      expect(id, job).toMatch(/^claude-(opus|sonnet|haiku|fable)-[0-9][0-9a-z.-]*$/);
    }
  });
});
