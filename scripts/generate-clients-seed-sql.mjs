/**
 * Generates supabase/migrations/20260501120001_seed_clients.sql from the CSV.
 * Run from repo root: node scripts/generate-clients-seed-sql.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";

const CSV_PATH = resolve("supabase upload - Sheet1.csv");
const OUT = resolve("supabase/migrations/20260501120001_seed_clients.sql");

function cleanText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "#N/A" || s === "N/A") return null;
  return s;
}

function cleanNum(v) {
  const t = cleanText(v);
  if (t == null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function sqlStr(v) {
  if (v == null) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlNum(v) {
  if (v == null || typeof v !== "number") return "null";
  return String(v);
}

function rowToRecord(raw) {
  return {
    account_name: cleanText(raw.Account),
    marketing_strategist: cleanText(raw["Marketing Strategist"]),
    total_package_hours: cleanNum(raw["Total Package Hours"]),
    hours_for_strategist: cleanNum(raw["Hours for Strategist"]),
    blog: cleanText(raw.Blog),
    smm: cleanText(raw.SMM),
    seo: cleanText(raw.SEO),
    ppc: cleanText(raw.PPC),
    orm: cleanText(raw.ORM),
    ads_customer_id: cleanText(raw.Ads_Customer_ID),
    ga4_id: cleanText(raw.GA4_ID),
    sc_url: cleanText(raw["SC URL: "]),
    website: cleanText(raw.Website),
    ga4_property_id: cleanText(raw.ga4_property_id),
    basecamp_project_id: cleanText(raw.basecamp_project_id),
    harvest_project_id: cleanText(raw.harvest_project_id),
    harvest_client_id: cleanText(raw.harvest_client_id),
    tier: cleanText(raw.tier),
  };
}

const buf = readFileSync(CSV_PATH, "utf8");
const rows = parse(buf, {
  columns: true,
  skip_empty_lines: true,
  trim: false,
  relax_column_count: true,
});

const records = [];
for (const raw of rows) {
  const rec = rowToRecord(raw);
  if (!rec.account_name) continue;
  records.push(rec);
}

const colList = `account_name, marketing_strategist, total_package_hours, hours_for_strategist, blog, smm, seo, ppc, orm, ads_customer_id, ga4_id, sc_url, website, ga4_property_id, basecamp_project_id, harvest_project_id, harvest_client_id, tier`;

const valuesSql = records
  .map(
    (r) =>
      `(${[
        sqlStr(r.account_name),
        sqlStr(r.marketing_strategist),
        sqlNum(r.total_package_hours),
        sqlNum(r.hours_for_strategist),
        sqlStr(r.blog),
        sqlStr(r.smm),
        sqlStr(r.seo),
        sqlStr(r.ppc),
        sqlStr(r.orm),
        sqlStr(r.ads_customer_id),
        sqlStr(r.ga4_id),
        sqlStr(r.sc_url),
        sqlStr(r.website),
        sqlStr(r.ga4_property_id),
        sqlStr(r.basecamp_project_id),
        sqlStr(r.harvest_project_id),
        sqlStr(r.harvest_client_id),
        sqlStr(r.tier),
      ].join(", ")})`,
  )
  .join(",\n");

const sql = `-- One-time seed from Sheet1 CSV (${records.length} rows). Re-run create migration only if you truncate first.
insert into public.clients (${colList})
values
${valuesSql};
`;

writeFileSync(OUT, sql, "utf8");
console.log(`Wrote ${OUT} (${records.length} rows)`);
