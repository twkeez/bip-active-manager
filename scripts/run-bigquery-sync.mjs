const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

async function main() {
  const endpoint = `${appUrl}/api/reporting/bigquery/sync`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `Sync failed (${response.status})`);
  }
  console.log("BigQuery sync completed.");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error("Failed to run BigQuery sync.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
