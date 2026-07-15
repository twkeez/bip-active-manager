export type BrandElements = {
  logoUrl: string | null;
  heroImage: string | null;
  themeColor: string | null;
  title: string | null;
};

function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function esc(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Meta content value, tolerant of attribute order (content before or after the
// property/name attribute).
function metaContent(html: string, value: string): string | null {
  const v = esc(value);
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${v}["'][^>]*content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${v}["']`, "i");
  return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null;
}

function linkHref(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]+rel=["'][^"']*${esc(rel)}[^"']*["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
}

// Best-effort brand elements from a practice website: logo (touch icon/favicon),
// a hero/share image, theme color, and title. Missing fields come back null.
export async function extractBrandElements(websiteUrl: string): Promise<BrandElements> {
  const base = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
  const res = await fetch(base, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BIP-brand-bot)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not load the website (${res.status}).`);
  const html = (await res.text()).slice(0, 500_000);

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
  const themeColor = metaContent(html, "theme-color");
  const ogImage = metaContent(html, "og:image");
  const logo = linkHref(html, "apple-touch-icon") ?? linkHref(html, "icon");

  return {
    logoUrl: logo ? resolveUrl(base, logo) : null,
    heroImage: ogImage ? resolveUrl(base, ogImage) : null,
    themeColor,
    title,
  };
}
