import type { GridPoint } from "@/lib/maps-rank/types";

// The report's map: a Google Static Map of the area with one numbered circle
// per grid point (the practice's rank searching from there), drawn on top as
// one picture so it works in a PDF and in a Google Doc alike. The numbers are
// drawn as shapes, not text: the server that makes the picture has no fonts.

const SIZE = 640; // Static Maps' largest free size; doubled by scale=2.
const SCALE = 2;
const TILE = 256;

export const TIER = { goal: "#059669", near: "#d97706", far: "#dc2626", none: "#64748b", failed: "#cbd5e1" } as const;

/** Green within the goal, amber within the top 10, red beyond, grey when not in the results read. */
export function tierOf(point: Pick<GridPoint, "rank" | "failed">, goal: number): keyof typeof TIER {
  if (point.failed) return "failed";
  if (point.rank == null) return "none";
  if (point.rank <= goal) return "goal";
  return point.rank <= Math.max(10, goal) ? "near" : "far";
}

const worldX = (lng: number, zoom: number) => ((lng + 180) / 360) * TILE * 2 ** zoom;
const worldY = (lat: number, zoom: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** zoom;
};

/** The closest zoom at which every point fits inside the picture with room for its circle. */
export function fitZoom(center: { lat: number; lng: number }, points: { lat: number; lng: number }[], margin = 70): number {
  for (let zoom = 16; zoom > 1; zoom -= 1) {
    const fits = points.every((p) => Math.abs(worldX(p.lng, zoom) - worldX(center.lng, zoom)) <= SIZE / 2 - margin && Math.abs(worldY(p.lat, zoom) - worldY(center.lat, zoom)) <= SIZE / 2 - margin);
    if (fits) return zoom;
  }
  return 2;
}

/** Where a place falls in the finished picture, in its own pixels. */
export function toPixel(center: { lat: number; lng: number }, zoom: number, p: { lat: number; lng: number }): { x: number; y: number } {
  return {
    x: (worldX(p.lng, zoom) - worldX(center.lng, zoom) + SIZE / 2) * SCALE,
    y: (worldY(p.lat, zoom) - worldY(center.lat, zoom) + SIZE / 2) * SCALE,
  };
}

// Each character in a 10 x 16 box, drawn as a stroke.
const GLYPH: Record<string, string> = {
  "0": "M5 1C1.6 1 1 4.2 1 8s.6 7 4 7 4-3.2 4-7-.6-7-4-7Z",
  "1": "M2.4 4.2 5.6 1v14",
  "2": "M1.4 4.6C1.4 0 8.6 0 8.6 4.5c0 3-3.4 5-7.4 10.5H9",
  "3": "M1.5 3.4C2.6.2 8.5.5 8.5 4.2c0 2.6-2 3.6-4 3.6 2.5 0 4.5 1.2 4.5 3.7 0 4.3-7 4.5-8 .7",
  "4": "M7 15V1L1 10.8h8.4",
  "5": "M8.5 1H2.3l-.7 6.4C3.5 5.6 9 5.8 9 10.4c0 5.2-6.5 5.6-8 2.2",
  "6": "M8 2.2C5.5-.2 1 1.5 1 8.5c0 7.5 8 7.7 8 2.3 0-4.6-6.5-5-7.9-.8",
  "7": "M1 1h8L4 15",
  "8": "M5 7.6C1.2 7.6 1.2 1 5 1s3.8 6.6 0 6.6C.4 7.6.4 15 5 15s4.6-7.4 0-7.4Z",
  "9": "M2 13.8c2.5 2.4 7 .7 7-6.3C9 0 1-.2 1 5.2c0 4.6 6.5 5 7.9.8",
  "+": "M1.5 8h7M5 4.5v7",
  "-": "M2 8h6",
};

function label(text: string, cx: number, cy: number, height: number, color: string): string {
  const k = height / 16;
  const advance = 11.5 * k;
  const width = text.length * advance - 1.5 * k;
  return [...text]
    .map((ch, i) => `<path d="${GLYPH[ch] ?? GLYPH["-"]}" transform="translate(${(cx - width / 2 + i * advance).toFixed(1)} ${(cy - height / 2).toFixed(1)}) scale(${k.toFixed(3)})" fill="none" stroke="${color}" stroke-width="${(2.1 / Math.sqrt(k)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
}

/** The circles, pin and town marker, as a transparent layer the size of the map picture. */
export function overlaySvg(input: {
  center: { lat: number; lng: number };
  zoom: number;
  grid: GridPoint[];
  goal: number;
  depth: number;
  town?: { lat: number; lng: number } | null;
}): string {
  const px = (p: { lat: number; lng: number }) => toPixel(input.center, input.zoom, p);
  const full = SIZE * SCALE;
  const middle = (Math.sqrt(input.grid.length) - 1) / 2;
  const parts: string[] = [];
  for (const point of input.grid) {
    const { x, y } = px(point);
    const tier = tierOf(point, input.goal);
    const isPractice = point.row === middle && point.col === middle;
    const r = 44;
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${TIER[tier]}" fill-opacity="0.93" stroke="${isPractice ? "#1e1b4b" : "#ffffff"}" stroke-width="${isPractice ? 9 : 5}"/>`);
    const text = point.failed ? "-" : point.rank == null ? `${input.depth}+` : String(point.rank);
    parts.push(label(text, x, y, text.length > 2 ? 30 : 38, tier === "failed" ? "#334155" : "#ffffff"));
  }
  if (input.town) {
    const { x, y } = px(input.town);
    if (x > 20 && x < full - 20 && y > 20 && y < full - 20)
      parts.push(`<rect x="${(x - 15).toFixed(1)}" y="${(y - 15).toFixed(1)}" width="30" height="30" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})" fill="#3350a2" stroke="#ffffff" stroke-width="5"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${full}" viewBox="0 0 ${full} ${full}">${parts.join("")}</svg>`;
}

/** The finished map picture for one search, as a PNG. */
export async function renderMapPng(input: {
  center: { lat: number; lng: number };
  grid: GridPoint[];
  goal: number;
  depth: number;
  town?: { lat: number; lng: number } | null;
}): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new Error("The Google Maps key isn't configured (GOOGLE_MAPS_API_KEY), so the map can't be drawn.");
  const zoom = fitZoom(input.center, input.grid);
  const params = new URLSearchParams({ center: `${input.center.lat},${input.center.lng}`, zoom: String(zoom), size: `${SIZE}x${SIZE}`, scale: String(SCALE), maptype: "roadmap", key: apiKey });
  // A quieter map, so the circles are what the eye lands on.
  const styles = ["feature:poi|visibility:off", "feature:transit|visibility:off", "feature:all|saturation:-55", "feature:road|element:labels.icon|visibility:off"];
  const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&${styles.map((s) => `style=${encodeURIComponent(s)}`).join("&")}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google's map picture service answered ${response.status}: ${(await response.text()).slice(0, 160)}`);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(await response.arrayBuffer()))
    .composite([{ input: Buffer.from(overlaySvg({ ...input, zoom })), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
