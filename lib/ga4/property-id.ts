/**
 * GA4 property IDs, in the one form the Analytics APIs take: digits only.
 *
 * Until Nov 2026 three forms were in use. The cockpit's help text asked for
 * "properties/123456789", which the nightly sync skipped (it accepted digits
 * only), and website discovery stored the measurement ID ("G-1TVHPD8VRN"),
 * which the API rejects outright. A blank ga4_property_id also hid a usable
 * ga4_id, because `??` only falls through on null.
 */

/** "123456789" or "properties/123456789" -> "123456789"; anything else -> null. */
export function ga4PropertyNumber(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/^properties\//i, "");
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

/** A measurement ID ("G-…") is a tag on the website, not a property the API can read. */
export function isGa4MeasurementId(value: string | null | undefined): boolean {
  return /^G-[A-Z0-9]+$/i.test((value ?? "").trim());
}

/** The client's usable property number: ga4_property_id first, then ga4_id. */
export function clientGa4Property(client: {
  ga4_property_id?: string | null;
  ga4_id?: string | null;
}): string | null {
  return ga4PropertyNumber(client.ga4_property_id) ?? ga4PropertyNumber(client.ga4_id);
}

/** Why a client's stored value can't be synced, in words a strategist can act on. */
export function ga4PropertyProblem(client: {
  ga4_property_id?: string | null;
  ga4_id?: string | null;
}): string | null {
  if (clientGa4Property(client)) return null;
  const stored = [client.ga4_property_id, client.ga4_id].map((v) => (v ?? "").trim()).filter(Boolean);
  if (stored.length === 0) return "No GA4 property is set. Pick one on the client's Connections tab.";
  if (stored.some(isGa4MeasurementId)) {
    return `${stored.find(isGa4MeasurementId)} is the website's measurement ID, not its property. Pick the property on the client's Connections tab.`;
  }
  return `"${stored[0]}" isn't a GA4 property ID. Pick the property on the client's Connections tab.`;
}
