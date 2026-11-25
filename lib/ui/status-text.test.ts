import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The light theme maps Tailwind's pale status text classes to readable status
// colours in app/globals.css. A pale class the stylesheet doesn't cover shows
// as pink on pink (or yellow on cream), so this fails until it's added there.

const root = join(__dirname, "../..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const PALE_TEXT =
  /(?<![\w-])((?:hover:)?text-(?:red|rose|pink|fuchsia|amber|yellow|orange|emerald|green|teal|lime|sky|blue|indigo|cyan|violet|purple)-(?:50|100|200|300|400)(?:\/\d+)?)(?![\w-])/g;

function selectorFor(className: string): string {
  const escaped = className.replace(/:/g, "\\:").replace(/\//g, "\\/");
  return `[data-theme="light"] .${escaped}${className.startsWith("hover:") ? ":hover" : ""}`;
}

describe("status text on the light theme", () => {
  it("covers every pale status text class the pages use", () => {
    const missing = new Set<string>();
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(join(root, dir))) {
        for (const match of readFileSync(file, "utf8").matchAll(PALE_TEXT)) {
          if (!css.includes(`${selectorFor(match[1])},`) && !css.includes(`${selectorFor(match[1])} {`)) {
            missing.add(`${relative(root, file)}: ${match[1]}`);
          }
        }
      }
    }
    expect([...missing], "Add these classes to the light-theme status text rules in app/globals.css").toEqual([]);
  });

  it("maps them to the readable status colours", () => {
    expect(css).toMatch(/\.text-red-200,[^{]*\{\s*color: var\(--danger-fg\);/);
    expect(css).toMatch(/\.text-amber-300,[^{]*\{\s*color: var\(--warning-fg\);/);
    expect(css).toMatch(/\.text-emerald-400,[^{]*\{\s*color: var\(--success-fg\);/);
  });
});
