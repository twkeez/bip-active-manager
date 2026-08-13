

// A series is either a 'recurring' slot (cadence + day_of_week) or an 'arc'
// (spacing_days + ordered parts). The database CHECK enforces that split, so
// payloads are normalised here before they ever reach an insert.

export type SeriesPartInput = {
  title: string;
  description: string;
  suggested_shot?: string | null;
};

export type SeriesInput = {
  client_id?: number | null;
  title?: string;
  description?: string;
  kind?: "recurring" | "arc";
  campaign_type?: string;
  purpose?: string | null;
  tags?: string[];
  cadence?: string | null;
  day_of_week?: number | null;
  spacing_days?: number | null;
  parts?: SeriesPartInput[];
};

const VALID_KINDS = new Set(["recurring", "arc"]);
const VALID_CADENCE = new Set(["weekly", "biweekly", "monthly"]);
const VALID_PURPOSES = new Set([
  "services", "fun", "engagement", "educational", "promotional", "community",
]);

/** Shared validation + normalisation for POST and PUT. */
export function normaliseSeriesInput(body: SeriesInput):
  | { ok: true; row: Record<string, unknown>; parts: SeriesPartInput[] }
  | { ok: false; error: string } {
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const kind = body.kind;
  const campaignType = (body.campaign_type ?? "").trim();

  if (!title) return { ok: false, error: "title required" };
  if (!description) return { ok: false, error: "description required" };
  if (!kind || !VALID_KINDS.has(kind)) return { ok: false, error: "kind must be recurring or arc" };
  if (!campaignType) return { ok: false, error: "campaign_type required" };

  const purpose = body.purpose?.trim() || null;
  if (purpose && !VALID_PURPOSES.has(purpose)) {
    return { ok: false, error: `purpose must be one of: ${[...VALID_PURPOSES].join(", ")}` };
  }

  const clientId =
    body.client_id == null ? null : Number.isInteger(Number(body.client_id)) ? Number(body.client_id) : null;
  const tags = Array.isArray(body.tags) ? body.tags.map(String).map((t) => t.trim()).filter(Boolean) : [];

  // Only the fields belonging to this kind are written; the rest go null so the
  // social_series_kind_fields_check constraint holds.
  if (kind === "recurring") {
    const cadence = body.cadence ?? null;
    if (!cadence || !VALID_CADENCE.has(cadence)) {
      return { ok: false, error: "recurring series need a cadence of weekly, biweekly, or monthly" };
    }
    const dow = body.day_of_week;
    const dayOfWeek = dow == null || dow === undefined ? null : Number(dow);
    if (dayOfWeek != null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
      return { ok: false, error: "day_of_week must be 0-6" };
    }
    return {
      ok: true,
      parts: [],
      row: {
        client_id: clientId,
        title,
        description,
        kind,
        campaign_type: campaignType,
        purpose,
        tags,
        cadence,
        day_of_week: dayOfWeek,
        spacing_days: null,
      },
    };
  }

  const spacing = Number(body.spacing_days);
  if (!Number.isInteger(spacing) || spacing <= 0) {
    return { ok: false, error: "arc series need spacing_days greater than 0" };
  }
  const parts = (body.parts ?? [])
    .map((p) => ({
      title: (p.title ?? "").trim(),
      description: (p.description ?? "").trim(),
      suggested_shot: p.suggested_shot?.trim() || null,
    }))
    .filter((p) => p.title);
  if (parts.length === 0) return { ok: false, error: "arc series need at least one part" };

  return {
    ok: true,
    parts,
    row: {
      client_id: clientId,
      title,
      description,
      kind,
      campaign_type: campaignType,
      purpose,
      tags,
      cadence: null,
      day_of_week: null,
      spacing_days: spacing,
    },
  };
}
