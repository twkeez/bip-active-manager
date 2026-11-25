import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Turns a caller away from a client they can't see.
 *
 * Report routes take a client ID from the URL or body. The tables behind some
 * of them (report layouts, drafts, metric preferences) are open to any
 * signed-in person, so without this a strategist could read or change another
 * strategist's client by changing the ID. The check reads the client with the
 * caller's own session, so the clients table's rule decides: admins see every
 * client, a strategist only the clients assigned to them.
 *
 * Returns null when the caller may go on, or the response to send instead.
 */
export async function rejectUnlessClientVisible(
  supabase: SupabaseClient,
  clientId: number,
): Promise<NextResponse | null> {
  const { data, error } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (error) {
    return NextResponse.json({ error: `Could not check access to this client: ${error.message}` }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "No client with this ID, or it isn't one of yours." }, { status: 404 });
  }
  return null;
}
