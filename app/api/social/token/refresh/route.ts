import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshMetaAccessTokenNow } from "@/lib/social/token-manager";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const refreshed = await refreshMetaAccessTokenNow(admin);
    return NextResponse.json({
      ok: true,
      expiresAt: refreshed.expiresAt,
      expiresInSeconds: refreshed.expiresIn,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh Meta access token.",
      },
      { status: 500 },
    );
  }
}
