import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import { EXPECTATION_FIELD_LABEL } from "@/lib/onboarding/service-expectations";

// Renders the client-expectations document as HTML that Word opens as an editable
// .doc (served with Content-Type application/msword — same trick as the reporting
// Word export). All colors inline-hex; Word can't read CSS variables.
const INDIGO = "#3350a2";
const INDIGO_DEEP = "#23376e";
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

/** Escapes then converts newlines to <br/> so multi-line blurbs keep their breaks. */
function multiline(text: string): string {
  return esc(text).replace(/\n/g, "<br/>");
}

function field(label: string, body: string): string {
  if (!body.trim()) return "";
  return (
    `<p style="font-size:11px;font-weight:bold;color:${PINK};text-transform:uppercase;letter-spacing:.04em;margin:10px 0 2px;">${esc(label)}</p>` +
    `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 4px;">${multiline(body)}</p>`
  );
}

export function renderExpectationsWord(model: ClientExpectationsModel, generatedAt: string): string {
  const { clientName, strategist, content } = model;
  const subtitleParts = [clientName];
  if (strategist) subtitleParts.push(`Strategist: ${strategist}`);
  if (generatedAt) subtitleParts.push(generatedAt);

  const serviceSections = content.services
    .map(
      (service) =>
        `<h2 style="color:${INDIGO_DEEP};font-size:15px;margin:22px 0 6px;">${esc(service.label)}</h2>` +
        field(EXPECTATION_FIELD_LABEL.expect, service.expect) +
        field(EXPECTATION_FIELD_LABEL.need, service.need) +
        field(EXPECTATION_FIELD_LABEL.recommend, service.recommend),
    )
    .join("");

  const body =
    `<p style="font-size:11px;font-weight:bold;color:${PINK};text-transform:uppercase;letter-spacing:.12em;margin:0;">Beyond Indigo Pets</p>` +
    `<h1 style="color:${INDIGO};font-size:22px;margin:4px 0 2px;">Your Marketing Plan &amp; Expectations</h1>` +
    `<p style="font-size:12px;color:${MUTED};margin:0 0 16px;">${esc(subtitleParts.join(" · "))}</p>` +
    (content.intro
      ? `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 14px;">${multiline(content.intro)}</p>`
      : "") +
    (content.timetable
      ? `<h2 style="color:${INDIGO_DEEP};font-size:15px;margin:22px 0 6px;">Your timetable</h2>` +
        `<div style="background:${SOFT_BG};padding:10px 12px;"><p style="font-size:12px;color:${INK};line-height:1.5;margin:0;">${multiline(content.timetable)}</p></div>`
      : "") +
    serviceSections +
    (content.closing
      ? `<p style="font-size:12px;color:${INK};line-height:1.5;margin:18px 0 0;">${multiline(content.closing)}</p>`
      : "");

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<title>${esc(clientName)} — Expectations</title></head>` +
    `<body style="font-family:Calibri,Arial,sans-serif;color:${INK};">${body}</body></html>`
  );
}

/** Safe, descriptive download filename, e.g. "happy-paws-vet-expectations.doc". */
export function expectationsWordFilename(model: ClientExpectationsModel): string {
  const slug = model.clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "client"}-expectations.doc`;
}
