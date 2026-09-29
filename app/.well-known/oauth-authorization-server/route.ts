import { authorizationServerMetadataResponse, preflight } from "@/lib/mcp-oauth/http";

/** RFC 8414: how to sign in to the Claude connector. */
export const GET = authorizationServerMetadataResponse;
export const OPTIONS = preflight;
