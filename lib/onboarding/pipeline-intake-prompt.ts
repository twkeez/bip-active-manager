// Extraction prompt for the BIP internal pipeline form. Tuned to the real form
// layout: staff filler, "This is a" type, client info, contacts, a Purchased
// Products table (Product / Anticipated Start Date / Start Date Notes / Product
// Notes), account notes, goals, and meeting AI-notes.

const MAPPING_RULES = `
Return ONLY a single JSON object (no prose, no markdown fences) with this exact shape:

{
  "formType": "new_client" | "service_change" | "cancellation" | "unknown",
  "contractSigned": true | false | null,
  "practiceName": string | null,
  "ownerName": string | null,
  "location": string | null,
  "primaryContactName": string | null,
  "primaryContactEmail": string | null,
  "primaryContactPhone": string | null,
  "pims": string | null,
  "websiteUrl": string | null,
  "website": { "purchased": boolean, "tier": "none"|"foundation"|"premium"|"premium_plus", "pages": number|null, "startDate": "YYYY-MM-DD"|null, "notes": string|null } | null,
  "webStatus": "has_site_keep"|"has_site_rebuild"|"splash_then_full"|"wait_for_launch"|"no_site"|null,
  "websiteLaunchDate": "YYYY-MM-DD"|null,
  "services": {
    "seo":  { "tier": <tier>, "startTrigger": "start_now"|"at_launch"|"on_date", "startDate": "YYYY-MM-DD"|null, "notes": string|null },
    "ppc":  { ... }, "smm": { ... }, "blog": { ... }, "orm": { ... }
  },
  "notes": string | null,
  "locationConflict": string | null
}

Rules:
- "This is a" → formType (New Client → "new_client", change → "service_change", cancellation → "cancellation").
- Client info: Practice Name → practiceName; Practice Owner Name → ownerName; Location → location.
  Primary Contact fields → primaryContact*. PIMS → pims.
- websiteUrl: the practice's EXISTING/live website URL if the form mentions one (their current site) —
  distinct from the "website" product being purchased. Null if they have no current site.
- Purchased Products table: each row is one purchased product with an Anticipated Start Date and notes.
  - A "Website" product is NOT a service — map it to the "website" object. Read its tier from the label
    (e.g. "Premium Website (10 pages)" → tier "premium", pages 10) and its start date.
  - "Ads" maps to the "ppc" service. "SEO" → "seo". "Social"/"SMM" → "smm". "Blog" → "blog". "ORM"/reputation → "orm".
  - Read each service's tier from its label ("Foundation" → "foundation", "Premium" → "premium",
    "Premium Plus" → "premium_plus"). Services NOT listed on the form get tier "none".
- startTrigger for each service, inferred from the Start Date Notes:
  - notes like "start with website launch" / "at launch" → "at_launch".
  - a specific date tied to opening/launch ("based on his opening date", a concrete future date) → "on_date"
    and set startDate to that date.
  - immediate / contract-signing date / no delay → "start_now".
- webStatus, inferred from the website purchase + account notes:
  - mentions a splash page while the full site is built → "splash_then_full".
  - rebuilding/replacing an existing site → "has_site_rebuild".
  - existing site kept as-is (no new build) → "has_site_keep".
  - new site, no splash, wait for full launch → "wait_for_launch".
  - no website at all and none coming → "no_site".
- websiteLaunchDate: the SEO/full-site launch date if stated, else null.
- notes: concatenate the useful free-text context for the strategist — Account Notes, Client Goals,
  BIP Approach, and the meeting AI-notes/summary. Keep it readable.
- locationConflict: compare the structured "Location (City, State)" field against the practice location
  described in the goals / account notes / meeting summary. If they name a MATERIALLY different place —
  a different city or region that a client would not confuse, NOT merely neighboring towns or a metro and
  its suburb — set a one-line note like "Location field says X, but notes describe Y — verify." If they
  match, are the same metro, or are plausibly neighboring, set null. Do not flag minor differences.
- Use null for anything genuinely absent. Do not invent values.`;

export function buildPipelineIntakePrompt(documentText?: string): string {
  const header =
    "You extract structured intake data from a Beyond Indigo (BIP) internal pipeline form for a veterinary practice.";
  if (documentText) {
    return `${header}\n${MAPPING_RULES}\n\nPIPELINE FORM TEXT:\n"""\n${documentText}\n"""`;
  }
  return `${header}\nThe pipeline form is attached as a document.\n${MAPPING_RULES}`;
}
