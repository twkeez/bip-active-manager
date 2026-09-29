import { preflight, protectedResourceMetadataResponse } from "@/lib/mcp-oauth/http";

/** RFC 9728: /api/mcp is protected by this app's own sign-in. */
export const GET = protectedResourceMetadataResponse;
export const OPTIONS = preflight;
