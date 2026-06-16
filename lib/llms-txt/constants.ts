/** Max sitemap URLs considered for curation input */
export const MAX_SITEMAP_URLS = 150;

/** Max pages fetched for full-text extraction */
export const MAX_FULL_TEXT_PAGES = 50;

/** Max concurrent page fetches */
export const FETCH_CONCURRENCY = 5;

/** Max characters per page body in full export */
export const MAX_PAGE_TEXT_CHARS = 12_000;

/** Max total bytes for llms-full.txt before truncation warning */
export const MAX_FULL_FILE_BYTES = 500_000;

export const FETCH_USER_AGENT = "BIPActiveManagerBot/1.0 (+llms-txt-generator)";
