export function normalizeAuditUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

export function parseAuditRunId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function hostFromUrl(raw: string) {
  try {
    const normalized = normalizeAuditUrl(raw);
    if (!normalized) return null;
    const url = new URL(normalized);
    return url.host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function fetchTextWithTimeout(
  url: string,
  options?: { timeoutMs?: number; accept?: string },
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "BIPActiveManagerBot/1.0 (+site-audit)",
        Accept: options?.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}
