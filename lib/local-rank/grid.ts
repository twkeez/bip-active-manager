import {
  DEFAULT_GRID_SIZE,
  MAX_GRID_POINTS,
} from "@/lib/local-rank/constants";
import type { PracticeCenter, RankGridCell } from "@/lib/local-rank/types";

const MILES_PER_DEGREE_LAT = 69.0;

function milesPerDegreeLng(lat: number) {
  return MILES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

export function buildRankGrid(
  center: PracticeCenter,
  radiusMiles: number,
  size = DEFAULT_GRID_SIZE,
): RankGridCell[] {
  if (size !== DEFAULT_GRID_SIZE) {
    throw new Error(`Grid size must be ${DEFAULT_GRID_SIZE} (${MAX_GRID_POINTS} points).`);
  }

  const cells: RankGridCell[] = [];
  const latStepMiles = size > 1 ? (radiusMiles * 2) / (size - 1) : 0;
  const lngStepMiles = latStepMiles;
  const lngScale = milesPerDegreeLng(center.lat);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const rowOffsetMiles = size > 1 ? -radiusMiles + row * latStepMiles : 0;
      const colOffsetMiles = size > 1 ? -radiusMiles + col * lngStepMiles : 0;
      const lat = center.lat + rowOffsetMiles / MILES_PER_DEGREE_LAT;
      const lng = center.lng + colOffsetMiles / lngScale;
      cells.push({
        row,
        col,
        lat,
        lng,
        label: `R${row + 1}C${col + 1}`,
      });
    }
  }

  if (cells.length !== MAX_GRID_POINTS) {
    throw new Error(`Expected ${MAX_GRID_POINTS} grid cells, got ${cells.length}.`);
  }

  return cells;
}

export function maxGridDistanceMiles(
  center: PracticeCenter,
  cell: RankGridCell,
): number {
  const dLat = (cell.lat - center.lat) * MILES_PER_DEGREE_LAT;
  const dLng = (cell.lng - center.lng) * milesPerDegreeLng(center.lat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
