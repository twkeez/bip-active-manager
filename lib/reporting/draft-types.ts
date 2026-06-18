export type ReportDraft = {
  id: string;
  client_id: number;
  window_label: string;
  narrative: string | null;
  section_visibility: Record<string, boolean>;
  kpi_overrides: Record<string, { hidden?: boolean; value?: string }>;
  section_comments: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type SectionKey =
  | "kpis"
  | "gsc_top_pages"
  | "keywords"
  | "social";

export const SECTION_LABELS: Record<SectionKey, string> = {
  kpis: "Performance Overview",
  gsc_top_pages: "Search Traffic",
  keywords: "Keyword Tracking",
  social: "Social Media",
};
