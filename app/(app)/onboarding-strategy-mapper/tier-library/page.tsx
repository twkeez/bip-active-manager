import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BrandHeader from "@/components/vet-onboarding/brand-header";
import TierLibraryEditor from "@/components/strategy-mapper/tier-library-editor";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StrategyMapperTierLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bip-page font-sans text-bip-text">
      <BrandHeader />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto mb-8 flex max-w-4xl items-center justify-between">
          <Link
            href="/onboarding-strategy-mapper"
            className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text transition hover:bg-bip-fill"
          >
            <ArrowLeft className="h-4 w-4" />
            Strategy Mapper
          </Link>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-bip-text">Service Tier Library</h1>
            <p className="mt-2 text-sm text-bip-muted">
              Manage approved Phase 1 blurbs and standardized upsell language for the
              Onboarding Strategy Mapper.
            </p>
          </div>
          <TierLibraryEditor />
        </div>
      </div>
    </div>
  );
}
