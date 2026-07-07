export type LocalRankGridRunStatus = "queued" | "running" | "complete" | "failed";

export interface RankGridCell {
  row: number;
  col: number;
  lat: number;
  lng: number;
  label: string;
}

export interface PracticeCenter {
  lat: number;
  lng: number;
  source: "google_place_id" | "manual";
}

export interface LocalPackListing {
  rank: number;
  title: string;
  domain: string | null;
}

export interface GridCellScanResult {
  keyword: string;
  cell: RankGridCell;
  rank: number | null;
  inLocalPack: boolean;
  matchedListingTitle: string | null;
  matchedListingDomain: string | null;
  topCompetitorTitle: string | null;
}

export interface LocalRankGridRunRow {
  id: number;
  owner_user_id: string;
  client_id: number;
  status: LocalRankGridRunStatus;
  grid_size: number;
  radius_miles: number;
  center_lat: number;
  center_lng: number;
  business_name: string;
  matched_place_id: string | null;
  keywords: string[];
  api_calls_planned: number;
  api_calls_completed: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface LocalRankGridCellRow {
  id: number;
  run_id: number;
  keyword: string;
  row_idx: number;
  col_idx: number;
  lat: number;
  lng: number;
  label: string;
  rank: number | null;
  in_local_pack: boolean;
  matched_listing_title: string | null;
  matched_listing_domain: string | null;
  top_competitor_title: string | null;
}

export interface LocalRankGridRunDetail extends LocalRankGridRunRow {
  cells: LocalRankGridCellRow[];
}

export interface ZoneKeywordResultRow {
  keyword: string;
  rank: number | null;
  inLocalPack: boolean;
}

export interface ClientRankZoneRow {
  id: number;
  owner_user_id: string;
  client_id: number;
  kind: "zip" | "radius";
  zip: string | null;
  radius_miles: number | null;
  label: string;
  last_results: ZoneKeywordResultRow[] | null;
  last_scanned_at: string | null;
  created_at: string;
}

export interface GridKeywordSummary {
  keyword: string;
  avgRank: number | null;
  topThreePct: number;
  cellsInPack: number;
  bestCell: string | null;
  worstCell: string | null;
}
