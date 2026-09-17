import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import {
  EXPECTATION_FIELD_LABEL,
  serviceSectionTitle,
} from "@/lib/onboarding/service-expectations";

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
    `<p style="font-size:12px;font-weight:bold;color:${PINK};margin:12px 0 2px;">${esc(label)}</p>` +
    `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 4px;">${multiline(body)}</p>`
  );
}

function heading(text: string, rule = "", size = 16): string {
  const border = rule ? `border-top:2px solid ${rule};padding-top:10px;` : "";
  return `<h2 style="color:${INDIGO_DEEP};font-size:${size}px;margin:24px 0 6px;${border}">${esc(text)}</h2>`;
}

/**
 * The same document as the PDF, as HTML Word opens. Word cannot do flex or grid,
 * so the plan box and the two-column glossary are tables.
 */
export function renderExpectationsWord(model: ClientExpectationsModel, generatedAt: string): string {
  const { clientName, town, strategistContacts, timeline, market, priorities, sectionOrder, note, noteHeading, content } =
    model;

  const noteBlock = note
    ? `<table width="100%" cellpadding="10" style="border-collapse:collapse;margin:0 0 14px;"><tr>` +
      `<td style="border-left:4px solid ${PINK};background:#fdf0f7;">` +
      `<p style="font-size:12px;font-weight:bold;color:${PINK};margin:0 0 4px;">${esc(noteHeading)}</p>` +
      `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0;">${multiline(note)}</p>` +
      `</td></tr></table>`
    : "";
  const subtitle = [clientName, town, generatedAt ? `Prepared ${generatedAt}` : ""]
    .filter(Boolean)
    .join(" · ");

  const planRows: string[] = [];
  if (strategistContacts.length > 0) {
    const people = strategistContacts
      .map((c) => `<strong>${esc(c.name)}</strong>${c.email ? ` ${esc(c.email)}` : ""}`)
      .join(" and ");
    planRows.push(
      `<p style="font-size:12px;color:${INK};margin:4px 0 0;">${
        strategistContacts.length === 1 ? "Your strategist" : "Your strategists"
      }: ${people}</p>`,
    );
  }
  const planRow = (label: string, value: string) =>
    `<p style="font-size:12px;color:${INK};margin:4px 0 0;">${esc(label)}: ${value}</p>`;
  if (timeline.kickoff) planRows.push(planRow(timeline.kickoff.label, esc(timeline.kickoff.date)));
  if (timeline.website || timeline.launchDate) {
    planRows.push(
      planRow(
        "Your website",
        [timeline.website ? esc(timeline.website) : "", timeline.launchDate ? `Launch: <strong>${esc(timeline.launchDate)}</strong>` : ""]
          .filter(Boolean)
          .join(" "),
      ),
    );
  }
  if (timeline.starts) planRows.push(planRow("Timing", esc(timeline.starts)));

  const planBox =
    `<table width="100%" cellpadding="12" style="border-collapse:collapse;margin:0 0 16px;"><tr>` +
    `<td style="background:${SOFT_BG};">` +
    `<p style="font-size:11px;font-weight:bold;color:${INDIGO};text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px;">Your plan</p>` +
    `<p style="font-size:12px;font-weight:bold;color:${PINK};margin:0;">${content.services
      .map((service) => esc(serviceSectionTitle(service)))
      .join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</p>` +
    planRows.join("") +
    `</td></tr></table>`;

  const subheading = (text: string) =>
    `<p style="font-size:12px;font-weight:bold;color:${PINK};margin:12px 0 2px;">${esc(text)}</p>`;

  const prioritiesSection =
    priorities.length > 0
      ? heading("Meeting Notes") +
        priorities
          .map((item) => `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 4px;">&#8226;&nbsp;&nbsp;${esc(item)}</p>`)
          .join("")
      : "";

  const checklist =
    content.checklist.length > 0
      ? heading("What we need from you") +
        content.checklist
          .map(
            (item) =>
              `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 4px;">&#9744;&nbsp;&nbsp;${esc(item.text)}` +
              ` <span style="color:${MUTED};font-size:10px;">${esc(item.serviceLabel)}</span></p>`,
          )
          .join("")
      : "";

  // The client-safe part of onboarding research; the rest stays internal.
  const marketSection = market
    ? heading("Your local market") +
      (market.snapshot
        ? `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 6px;">${multiline(market.snapshot)}</p>`
        : "") +
      (market.landscape
        ? subheading("How pet owners search here") +
          `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 6px;">${multiline(market.landscape)}</p>`
        : "") +
      (market.competitors.length > 0
        ? subheading("Nearby practices") +
          `<p style="font-size:11px;color:${MUTED};margin:0 0 6px;">The practices most likely to come up alongside you when people search.</p>` +
          market.competitors
            .map(
              (competitor) =>
                `<p style="font-size:12px;color:${INK};line-height:1.45;margin:0 0 6px;">` +
                `<strong>${esc(competitor.name)}</strong>` +
                (competitor.location ? ` <span style="color:${MUTED};">· ${esc(competitor.location)}</span>` : "") +
                (competitor.description ? `<br/><span style="color:${MUTED};">${esc(competitor.description)}</span>` : "") +
                `</p>`,
            )
            .join("")
        : "")
    : "";

  const serviceSections = content.services
    .map(
      (service) =>
        heading(serviceSectionTitle(service), PINK) +
        field(EXPECTATION_FIELD_LABEL.expect, service.expect) +
        field(EXPECTATION_FIELD_LABEL.limits, service.limits) +
        field(EXPECTATION_FIELD_LABEL.recommend, service.recommend),
    )
    .join("");

  const glossaryRows: string[] = [];
  for (let i = 0; i < content.glossary.length; i += 2) {
    const cell = (entry?: (typeof content.glossary)[number]) =>
      entry
        ? `<td width="50%" valign="top" style="padding:0 12px 8px 0;">` +
          `<p style="font-size:12px;font-weight:bold;color:${INK};margin:0;">${esc(entry.term)}</p>` +
          `<p style="font-size:11.5px;color:${MUTED};line-height:1.45;margin:2px 0 0;">${esc(entry.definition)}</p></td>`
        : `<td width="50%"></td>`;
    glossaryRows.push(`<tr>${cell(content.glossary[i])}${cell(content.glossary[i + 1])}</tr>`);
  }
  const glossary =
    content.glossary.length > 0
      ? heading("Terms you\u2019ll see us use", SOFT_BG) +
        `<table width="100%" style="border-collapse:collapse;">${glossaryRows.join("")}</table>`
      : "";

  const reassure =
    content.reassure.normal || content.reassure.alert
      ? heading("When not to panic \u2014 and when to tell us", PINK) +
        (content.reassure.normal
          ? subheading("Normal, and not worth worrying about") +
            `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 8px;">${multiline(content.reassure.normal)}</p>`
          : "") +
        (content.reassure.alert
          ? `<div style="background:${SOFT_BG};padding:10px 12px;">` +
            `<p style="font-size:12px;font-weight:bold;color:${INDIGO};margin:0 0 2px;">Tell your strategist \u2014 though we\u2019ll be looking too</p>` +
            `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0;">${multiline(content.reassure.alert)}</p></div>`
          : "")
      : "";

  // The same sections as the PDF, in the same per-client order.
  const sections: Record<string, string> = {
    intro: content.intro
      ? `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 14px;">${multiline(content.intro)}</p>`
      : "",
    note: noteBlock,
    priorities: prioritiesSection,
    checklist,
    timetable: content.timetable
      ? heading("Your timetable") +
        `<div style="background:${SOFT_BG};padding:10px 12px;"><p style="font-size:12px;color:${INK};line-height:1.5;margin:0;">${multiline(content.timetable)}</p></div>`
      : "",
    market: marketSection,
    services: serviceSections,
    reassure,
    glossary,
    closing: content.closing
      ? `<p style="font-size:12px;color:${INK};line-height:1.5;margin:18px 0 0;">${multiline(content.closing)}</p>`
      : "",
  };

  const body =
    `<p style="font-size:11px;font-weight:bold;color:${PINK};text-transform:uppercase;letter-spacing:.12em;margin:0;">Beyond Indigo Pets</p>` +
    `<h1 style="color:${INDIGO};font-size:24px;margin:4px 0 2px;">Your Marketing Plan &amp; Expectations</h1>` +
    `<p style="font-size:12px;color:${MUTED};margin:0 0 16px;">${esc(subtitle)}</p>` +
    planBox +
    sectionOrder.map((key) => sections[key] ?? "").join("");

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
