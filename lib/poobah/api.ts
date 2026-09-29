import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PoobahActor } from "./types";
import { PoobahError } from "./validate";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Run a Poobah Client Watch API request for a signed-in admin, as that person.
 * Every answer is explicit: the saved data on success, or an error saying why.
 */
export async function asAdmin(
  work: (admin: Admin, actor: PoobahActor) => Promise<unknown>,
  successStatus = 200,
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  try {
    const result = await work(createAdminClient(), { kind: "person", email: user.email });
    return NextResponse.json({ ok: true, result }, { status: successStatus });
  } catch (error) {
    if (error instanceof PoobahError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PoobahError("Send a JSON object.");
  return body as Record<string, unknown>;
}

export function watchIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new PoobahError("Invalid watch id.");
  return id;
}
