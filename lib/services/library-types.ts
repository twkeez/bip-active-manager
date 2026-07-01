export type ServiceLibraryKind = "link" | "file";

export type ServiceLibraryItem = {
  id: number;
  kind: ServiceLibraryKind;
  label: string;
  category: string;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Storage bucket + path prefix reused for library file uploads. */
export const SERVICE_LIBRARY_BUCKET = "task-documents";
export const SERVICE_LIBRARY_PREFIX = "service-library";

export const SERVICE_LIBRARY_CATEGORIES = [
  "Branding",
  "Service Tiers",
  "Templates",
  "Onboarding",
  "General",
] as const;
