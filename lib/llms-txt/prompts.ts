export function buildLlmsTxtCurationPrompt(
  clientName: string,
  domain: string,
  pageInventory: string,
): string {
  return `You are an SEO strategist for Beyond Indigo Pets curating an llms.txt file for a veterinary clinic website.

CLIENT: ${clientName}
DOMAIN: ${domain}

The llms.txt spec (llmstxt.org) requires structured curation — you return JSON only; code assembles the markdown file.

CURATION RULES:
- h1Title: practice/site name (usually "${clientName}" or close variant)
- blockquoteSummary: 1-3 sentences describing what the practice is and who it serves
- guidanceNotes: optional markdown paragraph or bullet list with notes for LLMs (location, specialties, hours context if inferable)
- sections: group the most important pages into H2 sections (e.g. Services, New Clients, About, Policies)
- Each link: title (human-readable), url (exact URL from inventory), description (brief why it matters), optional (true for blog archives, tag pages, paginated low-value URLs)
- Prefer: core services (TPLO, dental, urgent care, surgery), location/contact, new client, pricing/transparency pages
- Deprioritize: blog tag pages, pagination (?page=), PDFs, admin/login URLs — mark those optional: true
- Include a section named "Optional" OR mark individual links optional: true for skippable content
- Select 15-40 high-value links for the index; do not list every URL if inventory is large
- Use absolute URLs exactly as provided in the inventory
- Only include URLs from the inventory below

PAGE INVENTORY:
${pageInventory}`;
}
