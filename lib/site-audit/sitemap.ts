export type SitemapUrlEntry = {
  loc: string;
  lastmod: string | null;
};

function toIso(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function parseUrlSet(xml: string): SitemapUrlEntry[] {
  const locMatches = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi)];
  return locMatches
    .map((match) => {
      const urlBlock = match[0] ?? "";
      const loc = (match[1] ?? "").trim();
      if (!loc) return null;
      const lastmodMatch = urlBlock.match(/<lastmod>([^<]+)<\/lastmod>/i);
      return {
        loc,
        lastmod: toIso(lastmodMatch?.[1] ?? null),
      } as SitemapUrlEntry;
    })
    .filter((item): item is SitemapUrlEntry => item != null);
}

export function parseSitemapIndex(xml: string) {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
}

export async function fetchSitemapText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "BIPActiveManagerBot/1.0 (+site-audit)",
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap (${response.status})`);
  }
  return response.text();
}

export async function collectSitemapEntries(sitemapUrl: string, maxUrls = 500) {
  const rootXml = await fetchSitemapText(sitemapUrl);
  const rootEntries = parseUrlSet(rootXml);
  if (rootEntries.length > 0) return rootEntries.slice(0, maxUrls);

  const nestedSitemaps = parseSitemapIndex(rootXml).slice(0, 5);
  const nestedResults = await Promise.all(
    nestedSitemaps.map(async (url) => {
      try {
        const xml = await fetchSitemapText(url);
        return parseUrlSet(xml);
      } catch {
        return [];
      }
    }),
  );
  return nestedResults.flat().slice(0, maxUrls);
}
