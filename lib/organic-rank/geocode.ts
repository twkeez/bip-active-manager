const MILES_PER_DEGREE_LAT = 69.0;

type GeocodeResponse = {
  results?: Array<{
    address_components?: Array<{ long_name?: string; types?: string[] }>;
  }>;
};

async function reverseZip(lat: number, lng: number, apiKey: string): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=postal_code&key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as GeocodeResponse;
    for (const res of payload.results ?? []) {
      const zip = (res.address_components ?? []).find((c) => (c.types ?? []).includes("postal_code"))?.long_name;
      if (zip) return zip.trim();
    }
    return null;
  } catch {
    return null;
  }
}

// Suggests the practice's ZIP plus a few nearby ZIPs (from reverse-geocoding
// points ~5 miles around the practice), so Tom can seed organic locations from
// the practice address. Falls back to just the practice ZIP.
export async function suggestLocations(center: { lat: number; lng: number }): Promise<string[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return [];

  const dLat = 5 / MILES_PER_DEGREE_LAT;
  const dLng = 5 / (MILES_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  const points = [
    { lat: center.lat, lng: center.lng }, // practice
    { lat: center.lat + dLat, lng: center.lng }, // N
    { lat: center.lat - dLat, lng: center.lng }, // S
    { lat: center.lat, lng: center.lng + dLng }, // E
    { lat: center.lat, lng: center.lng - dLng }, // W
  ];

  const zips = await Promise.all(points.map((p) => reverseZip(p.lat, p.lng, apiKey)));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const zip of zips) {
    if (zip && !seen.has(zip)) {
      seen.add(zip);
      result.push(zip);
    }
  }
  return result.slice(0, 4); // practice + up to 3 nearby
}
