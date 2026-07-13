import { refreshIlluminareBasecampToken } from "@/lib/illuminare/basecamp-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type IlluminareBasecampTokenRow = {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_id: string;
  token_type: string | null;
  scope: string | null;
};

/**
 * Loads the Illuminare Basecamp token, refreshing it when it's within 5 minutes
 * of expiry. Throws a clear message when the account hasn't been connected yet.
 */
export async function getActiveIlluminareBasecampToken(admin: AdminClient) {
  const { data, error } = await admin
    .from("illuminare_basecamp_oauth_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle<IlluminareBasecampTokenRow>();
  if (error) {
    throw new Error(`Failed to load Illuminare Basecamp token: ${error.message}`);
  }
  if (!data) {
    throw new Error("Illuminare Basecamp is not connected yet.");
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const shouldRefresh =
    Number.isNaN(expiresAt) || expiresAt - Date.now() < 5 * 60 * 1000;
  if (!shouldRefresh) return data;

  const refreshed = await refreshIlluminareBasecampToken(data.refresh_token);
  const { data: updated, error: upsertError } = await admin
    .from("illuminare_basecamp_oauth_tokens")
    .upsert({
      id: 1,
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      expires_at: refreshed.expiresAt,
      token_type: refreshed.tokenType,
      scope: refreshed.scope,
      account_id: data.account_id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single<IlluminareBasecampTokenRow>();
  if (upsertError) {
    throw new Error(
      `Failed to refresh Illuminare Basecamp token: ${upsertError.message}`,
    );
  }
  return updated;
}
