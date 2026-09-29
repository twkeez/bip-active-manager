import { preflight, protectedResourceMetadataResponse } from "@/lib/mcp-oauth/http";

/** RFC 9728, path-specific form for /api/mcp (some clients ask here first). */
export const GET = protectedResourceMetadataResponse;
export const OPTIONS = preflight;
