import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import ServiceTiersManager from "@/components/services/service-tiers-manager";
import { SERVICE_TIER_TABLES, type ServiceTierTable } from "@/lib/services/tier-content";

export default async function ServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  const isAdmin = profile?.role === "admin";

  const { data: row } = await supabase
    .from("service_content")
    .select("data")
    .eq("content_key", "tiers")
    .maybeSingle<{ data: ServiceTierTable[] }>();
  const tables = row?.data ?? SERVICE_TIER_TABLES;

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-bip-text">Services &amp; Tiers</h1>
          <p className="text-sm text-bip-muted">
            What we offer and how the Foundation / Premium / Premium Plus plans differ.
          </p>
        </div>
        <Link
          href="/services/library"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
          style={{ borderColor: "#ce2084", color: "#ce2084" }}
        >
          <FolderOpen className="h-4 w-4" /> Reference Library
        </Link>
      </div>
      <ServiceTiersManager initial={tables} isAdmin={isAdmin} />
    </div>
  );
}
