export function normalizeCustomerId(raw: string) {
  return raw.replace(/\D/g, "").trim();
}

export function isSyncableAdsCustomerId(raw: string | null | undefined) {
  return /^\d{10}$/.test(normalizeCustomerId(raw ?? ""));
}

export function assertValidCustomerId(customerId: string, sourceLabel: string) {
  if (!customerId) {
    throw new Error(`${sourceLabel} is required.`);
  }
  if (!/^\d{10}$/.test(customerId)) {
    throw new Error(
      `${sourceLabel} must be a 10-digit Google Ads customer ID (for example: 1234567890).`,
    );
  }
}
