"use server";

import { redirect } from "next/navigation";
import { redirectWith } from "@/lib/mcp-oauth/core";
import { createAuthorizationCode } from "@/lib/mcp-oauth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTHORIZE_PARAMS, checkAuthorize } from "./logic";

/** Allow or Deny on the consent screen. Everything is checked again here. */
export async function decide(formData: FormData) {
  const params = Object.fromEntries(
    AUTHORIZE_PARAMS.map((key) => [key, formData.get(key)?.toString() || undefined]),
  ) as Record<string, string | undefined>;
  const check = await checkAuthorize(params);
  if (check.kind !== "ready") {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
    redirect(`/oauth/authorize?${query.toString()}`);
  }
  if (formData.get("decision") !== "allow") {
    redirect(redirectWith(check.request.redirectUri, { error: "access_denied", error_description: "Access was declined.", state: check.request.state, iss: check.origin }));
  }
  const code = await createAuthorizationCode(createAdminClient(), check.request, check.user);
  redirect(redirectWith(check.request.redirectUri, { code, state: check.request.state, iss: check.origin }));
}
