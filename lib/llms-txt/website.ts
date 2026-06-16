export function normalizeWebsite(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value.replace(/\/$/, "");
  return `https://${value.replace(/\/$/, "")}`;
}

export function domainFromWebsite(website: string): string {
  try {
    return new URL(normalizeWebsite(website)).hostname;
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export function sitemapUrlForWebsite(website: string): string {
  return `${normalizeWebsite(website)}/sitemap.xml`;
}
