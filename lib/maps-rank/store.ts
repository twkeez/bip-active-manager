import { fetchPlaceSnapshot } from "@/lib/dataforseo/reputation";
import { getDataForSeoConfig } from "@/lib/env";
import { runMapsRankScan } from "@/lib/maps-rank/scan";
import type { MapsRankRunRow, MapsRankTrackerRow, TrackedSearch } from "@/lib/maps-rank/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export const MAX_SEARCHES = 5;

export async function loadTracker(admin: Admin, id: number): Promise<MapsRankTrackerRow | null> {
  const { data, error } = await admin.from("maps_rank_trackers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the tracker: ${error.message}`);
  return (data as MapsRankTrackerRow | null) ?? null;
}

/** Every finished run of a tracker, oldest first. Failed runs are left out: they have no ranks to compare. */
export async function loadRuns(admin: Admin, trackerId: number): Promise<MapsRankRunRow[]> {
  const { data, error } = await admin.from("maps_rank_runs").select("*").eq("tracker_id", trackerId).neq("status", "failed").order("ran_at", { ascending: true }).limit(200);
  if (error) throw new Error(`Couldn't load the tracker's runs: ${error.message}`);
  return (data ?? []) as MapsRankRunRow[];
}

/** Runs the tracker's searches now and saves the result, whatever the outcome. */
export async function runTracker(admin: Admin, tracker: MapsRankTrackerRow): Promise<MapsRankRunRow> {
  let row: Omit<MapsRankRunRow, "id" | "ran_at" | "doc_url">;
  try {
    const scan = await runMapsRankScan(tracker);
    row = { tracker_id: tracker.id, status: scan.status, results: scan.results, cost_usd: scan.costUsd, error: scan.status === "complete" ? null : scan.results.problems.join(" ") };
  } catch (e) {
    row = {
      tracker_id: tracker.id,
      status: "failed",
      results: { depth: 0, radiusMiles: Number(tracker.radius_miles), gridSize: 0, searches: [], problems: [] },
      cost_usd: 0,
      error: e instanceof Error ? e.message : "The scan failed.",
    };
  }
  const { data, error } = await admin.from("maps_rank_runs").insert(row).select("*").single();
  if (error) throw new Error(`The scan ran but couldn't be saved: ${error.message}`);
  return data as MapsRankRunRow;
}

export type NewTrackerInput = {
  clientId: number;
  searches: TrackedSearch[];
  townLabel: string;
  /** "39.0840, -77.1528", as copied from Google Maps. */
  townPoint: string;
  goalDate: string | null;
  driveFolderUrl: string | null;
};

export function parsePoint(text: string): { latitude: number; longitude: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

/** Sets up tracking for a client: reads where its Google listing is, and saves the searches and the fixed town point. */
export async function createTracker(admin: Admin, input: NewTrackerInput, createdBy: string): Promise<MapsRankTrackerRow> {
  const searches = input.searches.map((s) => ({ ...s, keyword: s.keyword.trim() })).filter((s) => s.keyword);
  if (!searches.length) throw new Error("Add at least one search to track.");
  if (searches.length > MAX_SEARCHES) throw new Error(`A tracker holds at most ${MAX_SEARCHES} searches.`);
  if (searches.some((s) => !Number.isInteger(s.goal) || s.goal < 1 || s.goal > 20)) throw new Error("Each goal must be a whole number from 1 to 20.");
  const town = parsePoint(input.townPoint);
  if (!town || !input.townLabel.trim()) throw new Error('Give the town point a name and its coordinates, like "39.0840, -77.1528" (right-click the spot in Google Maps to copy them).');
  const { data: client, error } = await admin.from("clients").select("id, account_name, public_name, website, google_place_id").eq("id", input.clientId).maybeSingle();
  if (error) throw new Error(`Couldn't load the client: ${error.message}`);
  if (!client) throw new Error("Client not found.");
  const placeId = (client.google_place_id as string | null)?.trim();
  if (!placeId) throw new Error("This client has no Google Place ID on its record, so its listing can't be found in the results. Add it on the client page first.");
  const config = getDataForSeoConfig();
  if (!config) throw new Error("DataForSEO isn't configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).");
  const place = await fetchPlaceSnapshot(config, placeId, "Maps rank tracker");
  if (!place.ok) throw new Error(`Couldn't read the practice's Google listing: ${place.error}`);
  const { latitude, longitude } = place.snapshot;
  if (latitude == null || longitude == null) throw new Error("Google didn't give a map location for the practice's listing.");
  const { data: saved, error: saveError } = await admin
    .from("maps_rank_trackers")
    .insert({
      created_by: createdBy,
      client_id: client.id,
      practice_name: ((client.public_name as string | null) || (client.account_name as string)).trim(),
      place_id: placeId,
      domain: ((client.website as string | null) ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null,
      latitude,
      longitude,
      town_label: input.townLabel.trim(),
      town_latitude: town.latitude,
      town_longitude: town.longitude,
      searches,
      goal_date: input.goalDate || null,
      drive_folder_url: input.driveFolderUrl?.trim() || null,
    })
    .select("*")
    .single();
  if (saveError) throw new Error(`Couldn't save the tracker: ${saveError.message}`);
  return saved as MapsRankTrackerRow;
}
