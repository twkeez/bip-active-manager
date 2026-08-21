import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import ServiceTiersManager from "@/components/services/service-tiers-manager";
import { SERVICE_TIER_TABLES, type ServiceTierTable } from "@/lib/services/tier-content";
import ClientPlanView from "@/components/services/client-plan-view";
import { buildClientPlan } from "@/lib/services/client-plan";
import type { ClientRow } from "@/lib/types/client";
import type { ClientServiceKey } from "@/lib/clients/types";

type ClientPlanSource = Pick<ClientRow, ClientServiceKey>;

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
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

  // Opened from a client workspace: show that client's plan instead of the
  // catalogue — their services, their tier, and what that tier includes.
  const requested = Number((await searchParams).clientId);
  if (Number.isInteger(requested) && requested > 0) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id, account_name, blog, smm, seo, ppc, orm")
      .eq("id", requested)
      .maybeSingle();

    if (clientRow) {
      return (
        <ClientPlanView
          clientId={clientRow.id as number}
          clientName={clientRow.account_name as string}
          plan={buildClientPlan(clientRow as ClientPlanSource, tables)}
        />
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-bip-text">Services &amp; Tiers</h1>
          <p className="text-sm text-bip-muted">
            What we offer and how the Foundation / Premium / Premium Plus plans differ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/playbook"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "#ce2084", color: "#ce2084" }}
          >
            <BookOpen className="h-4 w-4" /> Service Playbook
          </Link>
          <Link
            href="/services/library"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "#ce2084", color: "#ce2084" }}
          >
            <FolderOpen className="h-4 w-4" /> Reference Library
          </Link>
        </div>
      </div>
      <ServiceTiersManager initial={tables} isAdmin={isAdmin} />
    </div>
  );
}
