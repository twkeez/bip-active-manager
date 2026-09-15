import Link from "next/link";
import { redirect } from "next/navigation";
import { Bird } from "lucide-react";
import { getProfile } from "@/lib/auth/profile";
import { listCustomCanaries } from "@/lib/coal-mines/custom-canaries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import CanaryBuilder, { type SavedCanary } from "@/components/coal-mines/canary-builder";

export const dynamic = "force-dynamic";

/**
 * Canaries you write yourself.
 *
 * Kept off the board itself: the board is for reading, and a page you read
 * every morning should not also be a page you can break. What you make here
 * shows up there.
 */
export default async function CoalMineBotsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  let canaries: SavedCanary[] = [];
  let loadError: string | null = null;
  try {
    canaries = (await listCustomCanaries(createAdminClient(), {
      enabledOnly: false,
    })) as unknown as SavedCanary[];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load your canaries.";
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <header>
        <div className="flex items-center gap-2">
          <Bird className="h-5 w-5 text-bip-accent" />
          <h1 className="text-xl font-semibold text-bip-text">Write a canary</h1>
        </div>
        <p className="mt-1 text-sm text-bip-muted">
          Describe something worth watching and it becomes a check on the{" "}
          <Link href="/coal-mines" className="text-bip-text hover:underline">
            Coal Mines board
          </Link>
          . Canaries only read and report — nothing you make here can change anything.
        </p>
      </header>

      {loadError && (
        <div className="rounded-xl border border-amber-500/40 bg-bip-card px-4 py-3">
          <p className="text-xs text-amber-300">{loadError}</p>
          <p className="mt-1 text-[11px] text-bip-muted">
            If this is the first time: the migration that creates the canaries table has not been
            run yet.
          </p>
        </div>
      )}

      <CanaryBuilder canaries={canaries} />
    </div>
  );
}
