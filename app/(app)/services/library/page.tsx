import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import ServiceLibraryView from "@/components/services/service-library-view";

export default async function ServiceLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  const isAdmin = profile?.role === "admin";

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <Link href="/services" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-bip-muted hover:text-bip-text">
        <ArrowLeft size={14} /> Services &amp; Tiers
      </Link>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-bip-text">Reference Library</h1>
        <p className="text-sm text-bip-muted">
          Documents, templates, and links strategists need — brand guides, tier breakdowns, and more.
        </p>
      </div>
      <ServiceLibraryView isAdmin={isAdmin} />
    </div>
  );
}
