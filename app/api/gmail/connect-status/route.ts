import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ConnectStatusResponse = {
  connected: boolean;
  expiresAt: string | null;
  scope: string;
  lastSyncedAt: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_api_tokens")
    .select("expires_at,metadata")
    .eq("provider", "gmail")
    .eq("token_type", `user:${user.id}`)
    .maybeSingle<{ expires_at: string | null; metadata: Record<string, unknown> | null }>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json<ConnectStatusResponse>({
      connected: false,
      expiresAt: null,
      scope: "",
      lastSyncedAt: null,
    });
  }
  const { data: cursor } = await admin
    .from("user_email_sync_cursors")
    .select("last_synced_at")
    .eq("owner_user_id", user.id)
    .maybeSingle<{ last_synced_at: string | null }>();
  return NextResponse.json<ConnectStatusResponse>({
    connected: true,
    expiresAt: data.expires_at,
    scope: String(data.metadata?.scope ?? ""),
    lastSyncedAt: cursor?.last_synced_at ?? null,
  });
}
