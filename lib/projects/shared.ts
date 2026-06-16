import type {
  ClientProjectArtifactType,
  ClientProjectPhaseStatus,
  ClientProjectStatus,
  TaskClientOption,
} from "@/lib/types/client";

export const CLIENT_PROJECT_STATUSES: ClientProjectStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
];

export const CLIENT_PROJECT_PHASE_STATUSES: ClientProjectPhaseStatus[] = [
  "not_started",
  "in_progress",
  "done",
];

export const CLIENT_PROJECT_ARTIFACT_TYPES: ClientProjectArtifactType[] = [
  "brainstorm",
  "plan",
  "weekly_status",
  "note",
];

export function isClientProjectStatus(
  value: unknown,
): value is ClientProjectStatus {
  return (
    typeof value === "string" &&
    CLIENT_PROJECT_STATUSES.includes(value as ClientProjectStatus)
  );
}

export function isClientProjectPhaseStatus(
  value: unknown,
): value is ClientProjectPhaseStatus {
  return (
    typeof value === "string" &&
    CLIENT_PROJECT_PHASE_STATUSES.includes(value as ClientProjectPhaseStatus)
  );
}

export function isClientProjectArtifactType(
  value: unknown,
): value is ClientProjectArtifactType {
  return (
    typeof value === "string" &&
    CLIENT_PROJECT_ARTIFACT_TYPES.includes(value as ClientProjectArtifactType)
  );
}

export function normalizeProjectName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeProjectText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function normalizeProjectDate(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
}

export function parseProjectId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const INTERNAL_PROJECT_CLIENT_LABEL = "Internal (no client)";

export function projectClientLabel(client: TaskClientOption | null | undefined) {
  return client?.account_name ?? INTERNAL_PROJECT_CLIENT_LABEL;
}
