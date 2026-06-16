const META_GRAPH_ACCESS_TOKEN = (process.env.META_GRAPH_ACCESS_TOKEN || "").trim();

if (!META_GRAPH_ACCESS_TOKEN) {
  console.error("Missing META_GRAPH_ACCESS_TOKEN in environment.");
  process.exit(1);
}

async function main() {
  const url = new URL("https://graph.facebook.com/v20.0/me/accounts");
  url.searchParams.set(
    "fields",
    "id,name,link,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", META_GRAPH_ACCESS_TOKEN);

  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok) {
    const message =
      json?.error?.message || `Meta API failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  const pages = Array.isArray(json?.data) ? json.data : [];
  if (pages.length === 0) {
    console.log("No pages returned by me/accounts for this token.");
    return;
  }

  console.log(`Found ${pages.length} accessible page(s):\n`);
  for (const page of pages) {
    console.log(`- ${page.name || "(no name)"} (${page.id})`);
    if (page.link) console.log(`  link: ${page.link}`);
    if (page.instagram_business_account?.id) {
      console.log(
        `  instagram: ${page.instagram_business_account.id} (${page.instagram_business_account.username || "no username"})`,
      );
    }
  }
}

main().catch((error) => {
  console.error(`Failed to list Meta pages: ${error.message}`);
  process.exit(1);
});
