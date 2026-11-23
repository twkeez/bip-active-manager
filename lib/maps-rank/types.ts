// Maps Rank Tracker: where a practice ranks in Google Maps for a few searches,
// re-checked on a schedule from the same points every time, so a client can be
// shown movement against a fixed baseline and a goal.

export type TrackedSearch = {
  /** The exact words searched in Google Maps, e.g. "dog boarding Rockville MD". */
  keyword: string;
  /** The rank the client wants to reach (3 = top 3). */
  goal: number;
  /** A rank measured before tracking began, from the town point, to compare against. Otherwise the first run is the baseline. */
  baseline?: { rank: number | null; date: string } | null;
};

export type MapsRankTrackerRow = {
  id: number;
  created_at: string;
  created_by: string | null;
  client_id: number | null;
  practice_name: string;
  place_id: string;
  domain: string | null;
  latitude: number;
  longitude: number;
  /** The fixed point the headline rank is searched from, e.g. "Rockville town center". */
  town_label: string;
  town_latitude: number;
  town_longitude: number;
  /** How far the grid reaches from the practice in each direction. */
  radius_miles: number;
  searches: TrackedSearch[];
  goal_date: string | null;
  every_days: number;
  active: boolean;
  /** A Google Drive folder (in a shared drive the app's Google account can write to) for the Google Doc version. */
  drive_folder_url: string | null;
};

export type MapsListing = {
  position: number;
  name: string;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Miles from the practice. */
  miles: number | null;
  isYou: boolean;
};

export type GridPoint = {
  row: number;
  col: number;
  lat: number;
  lng: number;
  /** The practice's rank searching from here; null = not in the results read. */
  rank: number | null;
  /** True when the search from this point failed, so there is no rank to show. */
  failed?: boolean;
};

export type SearchResult = {
  keyword: string;
  goal: number;
  town: { rank: number | null; listings: MapsListing[]; error: string | null };
  address: { rank: number | null; listings: MapsListing[]; error: string | null };
  grid: GridPoint[];
};

export type MapsRankResults = {
  /** How many results were read at each point: a rank beyond this shows as "not in the top N". */
  depth: number;
  radiusMiles: number;
  gridSize: number;
  searches: SearchResult[];
  /** Searches that failed, in plain words. Empty when everything was read. */
  problems: string[];
};

export type MapsRankRunRow = {
  id: number;
  tracker_id: number;
  ran_at: string;
  status: "complete" | "partial" | "failed";
  results: MapsRankResults;
  cost_usd: number;
  error: string | null;
  doc_url: string | null;
};
