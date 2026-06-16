export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function splitUrlLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => normalizeUrl(line))
    .filter(Boolean);
}

export function joinUrlLines(urls: string[]): string {
  return urls.join("\n");
}

export function formatUrlListForPrompt(value: string): string {
  const urls = splitUrlLines(value);
  return urls.length > 0 ? urls.join(", ") : "Not provided";
}
