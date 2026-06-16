export function previewText(
  input: {
    thread_excerpt?: string | null;
    thread_body?: string | null;
    thread_title?: string | null;
  },
  maxLength?: number,
) {
  const norm = (value: string | null | undefined) => (value ?? "").trim();
  const text =
    norm(input.thread_excerpt) ||
    norm(input.thread_body) ||
    norm(input.thread_title) ||
    "No preview available.";
  if (maxLength != null && text.length > maxLength) {
    return `${text.slice(0, maxLength - 3)}…`;
  }
  return text;
}

export function openableBasecampUrl(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  return raw.replace("/api/v1/", "/").replace(/\.json(\?.*)?$/, "$1");
}
