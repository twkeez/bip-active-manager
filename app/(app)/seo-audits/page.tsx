import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStrategistRoster } from "@/lib/team/strategist-roster";
import SeoAuditManager from "@/components/seo-audit/seo-audit-manager";
import type {
  ClientSeoAudit,
  ClientSeoAuditSchedule,
  ClientSeoAuditScheduleWithClient,
  ClientSeoAuditWithClient,
} from "@/lib/site-audit/seo-audit-types";

type ClientRow = {
  id: number;
  account_name: string;
  website: string | null;
  marketing_strategist: string | null;
};

export default async function SeoAuditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [clientsRes, schedulesRes, auditsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, account_name, website, marketing_strategist")
      .order("account_name", { ascending: true }),
    supabase
      .from("client_seo_audit_schedules")
      .select("*, clients(account_name, marketing_strategist, website)")
      .eq("owner_user_id", user.id)
      .order("next_due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("client_seo_audits")
      .select("*, clients(account_name)")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const clients = (clientsRes.data ?? []) as ClientRow[];

  const schedules: ClientSeoAuditScheduleWithClient[] = (schedulesRes.data ?? []).map((row) => {
    const { clients: c, ...schedule } = row as ClientSeoAuditSchedule & {
      clients: { account_name: string; marketing_strategist: string | null; website: string | null } | null;
    };
    return {
      ...schedule,
      account_name: c?.account_name ?? "Unknown client",
      marketing_strategist: c?.marketing_strategist ?? null,
      website: c?.website ?? null,
    };
  });

  const audits: ClientSeoAuditWithClient[] = (auditsRes.data ?? []).map((row) => {
    const { clients: c, ...audit } = row as ClientSeoAudit & { clients: { account_name: string } | null };
    return { ...audit, account_name: c?.account_name ?? "Unknown client" };
  });

  return (
    <SeoAuditManager
      clients={clients}
      initialSchedules={schedules}
      initialAudits={audits}
      roster={getStrategistRoster()}
      userEmail={user.email}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
    />
  );
}
