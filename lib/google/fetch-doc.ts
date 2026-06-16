export function extractGoogleDocId(url: string) {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export async function fetchGoogleDocAsText(googleDocUrl: string) {
  const docId = extractGoogleDocId(googleDocUrl);
  if (!docId) {
    throw new Error("Invalid Google Doc URL.");
  }
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const response = await fetch(exportUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      "Could not fetch Google Doc content. Ensure the doc is shared for link access.",
    );
  }
  return await response.text();
}
