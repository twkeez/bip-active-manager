import type { PracticeCenter } from "@/lib/local-rank/types";

type PlacesLocationResponse = {
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export async function resolvePracticeCenterFromPlaceId(
  placeId: string,
): Promise<PracticeCenter | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !placeId.trim()) return null;

  const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=location&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-Goog-FieldMask": "location",
    },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as PlacesLocationResponse;
  const lat = payload.location?.latitude;
  const lng = payload.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return { lat, lng, source: "google_place_id" };
}
