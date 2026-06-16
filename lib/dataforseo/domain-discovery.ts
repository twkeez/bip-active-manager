export function formatLocationName(location: string): string {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]},${parts[1]},United States`;
  }

  if (parts.length === 1) {
    return `${parts[0]},United States`;
  }

  return "United States";
}

export function domainFromUrlOrHost(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return trimmed.replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? "";
    }
  }
  return trimmed.replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? "";
}

export function businessMatchesTitle(businessName: string, title: string): boolean {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
  const normalizedBusiness = normalize(businessName);
  const normalizedTitle = normalize(title);
  if (!normalizedBusiness || !normalizedTitle) return false;
  if (
    normalizedTitle.includes(normalizedBusiness) ||
    normalizedBusiness.includes(normalizedTitle)
  ) {
    return true;
  }

  const businessTokens = normalizedBusiness.split(" ").filter((token) => token.length > 2);
  if (businessTokens.length === 0) return false;
  const matchedTokens = businessTokens.filter((token) => normalizedTitle.includes(token));
  return matchedTokens.length >= Math.min(2, businessTokens.length);
}
