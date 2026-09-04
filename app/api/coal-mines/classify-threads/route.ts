import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import { runThreadClassification } from "@/lib/coal-mines/run-thread-classification";

/**
 * The "Read threads" button on Coal Mines.
 *
 * Shares its body with the scheduled job — see run-thread-classification. All
 * this route adds is that a signed-in admin asked for it.
 */

export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(supabase);
  // Each run is a paid Claude call, and this is an admin surface.
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  try {
    const result = await runThreadClassification(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Classification failed" },
      { status: 500 },
    );
  }
}
