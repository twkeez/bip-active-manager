import { describe, expect, it } from "vitest";
import { buildRankGrid } from "@/lib/local-rank/grid";
import { DEFAULT_GRID_SIZE, MAX_GRID_POINTS } from "@/lib/local-rank/constants";

const center = { lat: 38.7521, lng: -121.288, source: "manual" as const };

describe("buildRankGrid", () => {
  it("returns 25 cells for a 5×5 grid", () => {
    const grid = buildRankGrid(center, 5);
    expect(grid).toHaveLength(MAX_GRID_POINTS);
    expect(new Set(grid.map((cell) => `${cell.row},${cell.col}`)).size).toBe(MAX_GRID_POINTS);
  });

  it("places center cell at practice coordinates", () => {
    const grid = buildRankGrid(center, 5);
    const centerCell = grid.find((cell) => cell.row === 2 && cell.col === 2);
    expect(centerCell?.lat).toBeCloseTo(center.lat, 5);
    expect(centerCell?.lng).toBeCloseTo(center.lng, 5);
  });

  it("spaces cells across the configured radius on each axis", () => {
    const radiusMiles = 5;
    const grid = buildRankGrid(center, radiusMiles);
    for (const cell of grid) {
      const dLat = Math.abs(cell.lat - center.lat) * 69;
      const dLng =
        Math.abs(cell.lng - center.lng) *
        69 *
        Math.cos((center.lat * Math.PI) / 180);
      expect(dLat).toBeLessThanOrEqual(radiusMiles + 0.01);
      expect(dLng).toBeLessThanOrEqual(radiusMiles + 0.01);
    }
  });

  it("rejects non-default grid sizes", () => {
    expect(() => buildRankGrid(center, 5, 4)).toThrow(
      `Grid size must be ${DEFAULT_GRID_SIZE} (${MAX_GRID_POINTS} points).`,
    );
  });
});
