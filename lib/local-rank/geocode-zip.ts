type GeocodeResponse = {
  status?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

// Resolves a US ZIP code to a lat/lng using the Google Geocoding API. Returns
// null when the key is missing, the ZIP is blank, or no result is found.
// Mirrors the shape of resolvePracticeCenterFromPlaceId (places-center.ts).
export async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const trimmed = zip.trim();
  if (!apiKey || !trimmed) return null;

  const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?components=${encodeURIComponent(
    `postal_code:${trimmed}|country:US`,
  )}&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
  if (!response.ok) return null;

  const payload = (await response.json()) as GeocodeResponse;
  const location = payload.results?.[0]?.geometry?.location;
  const lat = location?.lat;
  const lng = location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return { lat, lng };
}
