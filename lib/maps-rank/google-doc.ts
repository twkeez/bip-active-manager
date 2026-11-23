import { JWT } from "google-auth-library";
import { LOGO_VIEWBOX, PATHS } from "@/components/onboarding/beyond-indigo-logo";
import { getGoogleServiceAccountConfig } from "@/lib/env";
import { TIER } from "@/lib/maps-rank/map-image";
import type { MapsRankReport } from "@/lib/maps-rank/report";

// The Maps ranking report as a Google Doc: built as a simple web page (tables
// and pictures only, which is what Google Docs converts faithfully) and
// uploaded to a Drive folder, where Google turns it into a Doc.

const INDIGO = "#3350a2";
const PURPLE = "#603894";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The folder id from a Drive folder link, or the id itself. */
export function driveFolderId(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  const fromLink = value.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : null;
}

/** The white wordmark on the brand colour, as a picture a Google Doc can hold. */
export async function logoBanner(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="170" viewBox="0 0 1300 170"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INDIGO}"/><stop offset="0.55" stop-color="${PURPLE}"/><stop offset="1" stop-color="#962583"/></linearGradient></defs><rect width="1300" height="170" rx="18" fill="url(#g)"/><svg x="44" y="48" width="398" height="74" viewBox="${LOGO_VIEWBOX}">${PATHS.map((d) => `<path fill="#fff" d="${d}"/>`).join("")}</svg></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const dataUri = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
const th = (width: string) => `style="width:${width};background:${INDIGO};color:#ffffff;font-size:8.5pt;text-align:left;padding:3pt 5pt;border:1px solid ${INDIGO}"`;
const td = (extra = "") => `style="font-size:9.5pt;padding:2pt 5pt;border:1px solid #cbd5e1;${extra}"`;
const CHANGE_COLOR = { better: "#047857", worse: "#b91c1c", same: "#475569" } as const;

/** The report as a web page Google Docs can convert. `maps` holds one finished map picture per search. */
export function reportHtml(report: MapsRankReport, pictures: { banner: Buffer; maps: (Buffer | null)[] }): string {
  const legend = (
    [
      ["goal", "Within your goal"],
      ["near", "In the top 10"],
      ["far", "Below the top 10"],
      ["none", `Not in the top ${report.depth}`],
    ] as const
  )
    .map(([tier, text]) => `<span style="color:${TIER[tier]};font-size:12pt">&#9679;</span> <span style="font-size:9pt;color:#475569">${esc(text)}</span>`)
    .join(" &nbsp;&nbsp; ");
  const first = report.isBaseline;
  const summaryRows = report.summary
    .map(
      (row) =>
        `<tr><td ${td("font-weight:bold")}>${esc(row.keyword)}</td><td ${td()}>Top ${row.goal}</td>${first ? "" : `<td ${td()}>${esc(row.baselineLabel)}</td><td ${td()}>${esc(row.lastLabel)}</td>`}<td ${td(`font-weight:bold;font-size:11pt;color:${row.goalMet ? "#047857" : "#0f172a"}`)}>${esc(row.todayLabel)}</td>${first ? "" : `<td ${td(`color:${row.change ? CHANGE_COLOR[row.change] : "#475569"}`)}>${esc(row.changeLabel)}</td>`}<td ${td("font-weight:bold;font-size:11pt")}>${esc(row.addressLabel)}</td></tr>`,
    )
    .join("");
  const summaryHead = first
    ? `<th ${th("36%")}>Search</th><th ${th("12%")}>Goal</th><th ${th("28%")}>Searching from ${esc(report.townLabel)}</th><th ${th("24%")}>Searching from your address</th>`
    : `<th ${th("24%")}>Search</th><th ${th("8%")}>Goal</th><th ${th("13%")}>Baseline</th><th ${th("13%")}>Last report</th><th ${th("15%")}>Today, from ${esc(report.townLabel)}</th><th ${th("14%")}>Since baseline</th><th ${th("13%")}>Today, from your address</th>`;
  const places = `<table style="border-collapse:collapse;width:100%;margin-top:6pt"><tr>
<td style="width:50%;background:#f1f5f9;border:1px solid #f1f5f9;padding:5pt 7pt;vertical-align:top"><span style="font-size:10pt;font-weight:bold"><span style="color:${INDIGO}">&#9670;</span> Searching from ${esc(report.townLabel)}</span><br><span style="font-size:9pt;color:#475569">${esc(report.places.town)} It is the blue diamond on each map.</span></td>
<td style="width:50%;background:#f1f5f9;border:1px solid #f1f5f9;padding:5pt 7pt;vertical-align:top"><span style="font-size:10pt;font-weight:bold"><span style="color:#1e1b4b">&#9711;</span> Searching from your address</span><br><span style="font-size:9pt;color:#475569">${esc(report.places.address)} It is the ringed circle in the middle of each map.</span></td>
</tr></table>`;
  const sections = report.sections
    .map((s) => {
      const map = pictures.maps[s.index];
      const rows = s.listings
        .map(
          (l) =>
            `<tr><td ${td(l.isYou ? "background:#eef2ff;font-weight:bold" : "")}>${l.position}</td><td ${td(l.isYou ? "background:#eef2ff;font-weight:bold" : "")}>${esc(l.name)}${l.isYou ? " (you)" : ""}</td><td ${td(l.isYou ? "background:#eef2ff" : "")}>${l.rating != null ? `${l.rating.toFixed(1)}★` : "—"}</td><td ${td(l.isYou ? "background:#eef2ff" : "")}>${l.reviewCount != null ? l.reviewCount.toLocaleString("en-US") : "—"}</td><td ${td(l.isYou ? "background:#eef2ff" : "")}>${l.isYou ? "—" : l.miles != null ? `${l.miles} mi` : "—"}</td></tr>`,
        )
        .join("");
      // The map comes straight after the heading: Google Docs keeps a heading with what follows it, and has no
      // page break a converted page can ask for, so this is what stops a heading being left alone at the foot of a page.
      return `
<h2 style="color:${INDIGO};font-size:14pt;margin:14pt 0 4pt 0;page-break-after:avoid">${s.index + 1}. &ldquo;${esc(s.keyword)}&rdquo;</h2>
${map ? `<p style="margin:0;page-break-after:avoid"><img src="${dataUri(map)}" width="350" height="350" alt="Map of your rank around ${esc(report.practice)}"></p><p style="margin:2pt 0 6pt 0;page-break-after:avoid">${legend}</p>` : `<p style="font-size:10pt;color:#b91c1c">The map for this search couldn't be drawn.</p>`}
<p style="font-size:10.5pt;margin:0 0 2pt 0;page-break-after:avoid"><b>${esc(s.headline)}</b></p>
<p style="font-size:10pt;color:#475569;margin:0 0 6pt 0;page-break-after:avoid">${esc(s.gridLine)}</p>
${
  s.townError
    ? `<p style="font-size:10pt;color:#b91c1c">The list from ${esc(report.townLabel)} couldn't be read on this run: ${esc(s.townError)}</p>`
    : `<p style="font-size:9pt;color:#475569;margin:0 0 3pt 0;page-break-after:avoid">What Google Maps shows from ${esc(report.townLabel)}:</p><table style="border-collapse:collapse;width:100%"><tr><th ${th("8%")}>Rank</th><th ${th("50%")}>Business</th><th ${th("13%")}>Rating</th><th ${th("13%")}>Reviews</th><th ${th("16%")}>Miles from you</th></tr>${rows}</table>`
}`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.practice)} Google Maps ranking report</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<p style="margin:0"><img src="${dataUri(pictures.banner)}" width="650" height="85" alt="Beyond Indigo Pets"></p>
<p style="font-size:9pt;color:${PURPLE};letter-spacing:1pt;margin:10pt 0 0 0"><b>GOOGLE MAPS RANKING REPORT</b></p>
<h1 style="font-size:22pt;color:#0f172a;margin:0">${esc(report.practice)}</h1>
<p style="font-size:10pt;color:#475569;margin:2pt 0 10pt 0">${esc(report.dateLabel)} · Report ${report.reportNumber}${report.goalDateLabel ? ` · Goals due ${esc(report.goalDateLabel)}` : ""}</p>
<table style="border-collapse:collapse;width:100%"><tr>${summaryHead}</tr>${summaryRows}</table>
${places}
${first ? "" : `<p style="font-size:9pt;color:#475569;margin:4pt 0 0 0">&ldquo;Baseline&rdquo;, &ldquo;Last report&rdquo; and &ldquo;Since baseline&rdquo; are all measured from ${esc(report.townLabel)}.</p>`}
${report.problems.length ? `<p style="font-size:10pt;color:#b91c1c"><b>Not everything could be read on this run:</b> ${report.problems.map(esc).join(" ")}</p>` : ""}
<h2 style="color:${INDIGO};font-size:13pt;margin:14pt 0 2pt 0">How to read this report</h2>
${report.notes.map((n) => `<p style="font-size:9.5pt;color:#334155;margin:0 0 5pt 0">${esc(n)}</p>`).join("")}
${sections}
<p style="font-size:9pt;color:#64748b;margin:14pt 0 0 0">Prepared by Beyond Indigo Pets · beyondindigopets.com</p>
</body></html>`;
}

/** Uploads the page to a Drive folder as a Google Doc and returns its link. */
export async function createGoogleDoc(folderId: string, name: string, html: string): Promise<string> {
  const { clientEmail, privateKey } = getGoogleServiceAccountConfig();
  const jwt = new JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/drive"] });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Couldn't sign in to Google Drive with the app's Google account.");
  const boundary = `bip${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId], mimeType: "application/vnd.google-apps.document" })}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n`),
    Buffer.from(html, "utf8"),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    if (response.status === 404 || response.status === 403)
      throw new Error(`Google Drive wouldn't let the app save into that folder (${response.status}). The folder must be in a shared drive, with ${clientEmail} added as Content manager.`);
    throw new Error(`Google Drive answered ${response.status}: ${detail}`);
  }
  const file = (await response.json()) as { webViewLink?: string; id?: string };
  return file.webViewLink ?? `https://docs.google.com/document/d/${file.id}/edit`;
}
