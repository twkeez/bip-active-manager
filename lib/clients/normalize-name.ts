export function normalizeClientName(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\+$/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}
