const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}
