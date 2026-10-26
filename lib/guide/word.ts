import type { Guide } from "@/lib/guide/types";
import { HIDDEN_NAV_HREFS } from "@/lib/nav/hidden";

// The team guide as HTML that Word opens as an editable .doc (served as
// application/msword, like the client document's Word export). Inline hex
// colours only; Word can't read CSS variables.
const INDIGO = "#3350a2";
const PURPLE = "#603894";
const PINK = "#ce2084";
const INK = "#374151";
const MUTED = "#6c7488";
const SOFT_BG = "#eef1f9";

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderGuideWord(guide: Guide): string {
  const body: string[] = [];
  body.push(
    `<table width="100%" cellpadding="16" style="background:${INDIGO};border-collapse:collapse;"><tr><td>` +
      `<p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0;">Beyond Indigo Pets</p>` +
      `<p style="color:#ffffff;font-size:11px;letter-spacing:2px;margin:12px 0 0;">TEAM GUIDE</p>` +
      `<h1 style="color:#ffffff;font-size:24px;margin:2px 0 4px;">BIP Control: how to use it</h1>` +
      `<p style="color:#dfe5f5;font-size:12px;margin:0;">Updated ${esc(guide.updated)} · beyondindigopets.com</p>` +
      `</td></tr></table>`,
  );
  for (const paragraph of guide.intro) {
    body.push(`<p style="font-size:12px;color:${INK};line-height:1.5;">${esc(paragraph)}</p>`);
  }
  for (const basic of guide.basics) {
    body.push(
      `<p style="font-size:12px;color:${INK};line-height:1.5;background:${SOFT_BG};padding:6px;margin:4px 0;">` +
        `<b style="color:${INDIGO};">${esc(basic.heading)}.</b> ${esc(basic.body)}</p>`,
    );
  }
  for (const section of guide.sections) {
    body.push(
      `<h2 style="color:${INDIGO};font-size:17px;margin:24px 0 6px;border-top:2px solid ${PINK};padding-top:10px;">${esc(section.title)}</h2>`,
    );
    if (section.intro) body.push(`<p style="font-size:12px;color:${MUTED};">${esc(section.intro)}</p>`);
    for (const item of section.items) {
      const badge =
        (item.adminOnly ? ` <span style="font-size:10px;color:${MUTED};">(ADMINS)</span>` : "") +
        (HIDDEN_NAV_HREFS.has(item.href) ? ` <span style="font-size:10px;color:${MUTED};">(HIDDEN FOR NOW)</span>` : "");
      body.push(`<h3 style="color:${INDIGO};font-size:14px;margin:14px 0 2px;">${esc(item.label)}${badge}</h3>`);
      body.push(`<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 4px;">${esc(item.purpose)}</p>`);
      if (item.youCan.length) {
        body.push(
          `<ul style="margin:0 0 4px;">${item.youCan.map((line) => `<li style="font-size:12px;color:${INK};">${esc(line)}</li>`).join("")}</ul>`,
        );
      }
      if (item.notes?.length) {
        body.push(
          `<p style="font-size:11px;color:${MUTED};line-height:1.5;margin:0 0 4px;"><b style="color:${PURPLE};">Good to know:</b> ${esc(item.notes.join(" "))}</p>`,
        );
      }
    }
  }
  body.push(
    `<p style="text-align:center;font-size:11px;color:${PURPLE};margin-top:28px;"><b>Beyond Indigo Pets · beyondindigopets.com</b><br/>` +
      `<span style="color:${MUTED};">Questions about BIP Control? Ask Tom.</span></p>`,
  );
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta charset="utf-8"><title>BIP Control team guide</title></head>` +
    `<body style="font-family:Arial,sans-serif;">${body.join("\n")}</body></html>`
  );
}
