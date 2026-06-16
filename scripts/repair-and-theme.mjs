import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGET_DIRS = [path.join(ROOT, "app"), path.join(ROOT, "components"), path.join(ROOT, "lib")];
const SKIP_DIRS = new Set(["node_modules", ".next", "vet-onboarding"]);

const COMBINED_REPLACEMENTS = [
  ["bg-zinc-50 dark:bg-zinc-950", "bg-bip-page"],
  ["border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900", "border-white/[0.08] bg-bip-card"],
  ["text-zinc-900 dark:text-zinc-50", "text-white"],
  ["text-zinc-700 dark:text-zinc-200", "text-white/75"],
  ["text-zinc-500 dark:text-zinc-400", "text-white/50"],
  ["hover:bg-zinc-100 dark:hover:bg-zinc-800", "hover:bg-white/[0.06]"],
  ["bg-[#0a1020]", "bg-bip-page"],
  ["bg-[#0f1729]", "bg-bip-page"],
  ["bg-[#141f3a]", "bg-bip-card"],
  ["bg-[#131c35]", "bg-bip-card"],
  ["text-slate-100", "text-white"],
  ["text-slate-400", "text-white/50"],
  ["text-slate-500", "text-white/50"],
  ["text-indigo-400", "text-bip-accent"],
  ["bg-indigo-600", "bg-bip-accent"],
  ["hover:bg-indigo-500", "hover:brightness-110"],
];

const TOKEN_REPLACEMENTS = [
  [/\bbg-white\b/g, "bg-bip-card"],
  [/\bbg-zinc-50\b/g, "bg-bip-page"],
  [/\bbg-zinc-950\b/g, "bg-bip-page"],
  [/\btext-zinc-900\b/g, "text-white"],
  [/\btext-zinc-700\b/g, "text-white/75"],
  [/\btext-zinc-500\b/g, "text-white/50"],
  [/\btext-zinc-400\b/g, "text-white/40"],
  [/\bborder-zinc-200\b/g, "border-white/[0.08]"],
  [/\bborder-zinc-700\b/g, "border-white/[0.08]"],
  [/\bborder-zinc-800\b/g, "border-white/[0.08]"],
  [/\bhover:bg-zinc-50\b/g, "hover:bg-white/[0.06]"],
  [/\bhover:bg-zinc-100\b/g, "hover:bg-white/[0.06]"],
  [/\bdark:[^\s"'`]+/g, ""],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

function repairFormatting(content) {
  return content
    .replace(/from"/g, 'from "')
    .replace(/import \{/g, (match, offset) => (offset === 0 ? match : `\n${match}`))
    .replace(/"use client"; import/g, '"use client";\nimport')
    .replace(/; export /g, ";\nexport ")
    .replace(/; function /g, ";\nfunction ")
    .replace(/; type /g, ";\ntype ")
    .replace(/; const /g, ";\nconst ")
    .replace(/; async function /g, ";\nasync function ")
    .replace(/\} from "@/g, '} from "@')
    .replace(/  \n/g, "\n");
}

function transform(content) {
  let next = repairFormatting(content);
  for (const [from, to] of COMBINED_REPLACEMENTS) {
    next = next.split(from).join(to);
  }
  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next.replace(/[ \t]{2,}/g, " ");
}

let changed = 0;
for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (file.endsWith(".test.ts")) continue;
    const original = fs.readFileSync(file, "utf8");
    const updated = transform(original);
    if (updated !== original) {
      fs.writeFileSync(file, updated);
      changed += 1;
    }
  }
}

console.log(`Repaired ${changed} files.`);
