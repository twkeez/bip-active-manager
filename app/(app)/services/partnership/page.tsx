import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PartnershipView from "@/components/services/partnership-view";

export default async function PartnershipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <Link href="/services" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-bip-muted hover:text-bip-text">
        <ArrowLeft size={14} /> Services &amp; Tiers
      </Link>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-bip-text">Partnership &amp; Boundaries</h1>
        <p className="text-sm text-bip-muted">
          How we partner at each level, on-demand rates, and the lines to hold when clients ask for more.
        </p>
      </div>
      <PartnershipView />
    </div>
  );
}
