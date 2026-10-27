import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { ToolPage } from "@/components/ui/tool-page";
import NewWebsiteAuditForm from "@/components/website-audit/new-audit-form";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_STAGES, type WebsiteAuditRow } from "@/lib/website-audit/types";

export const dynamic = "force-dynamic";

/** Website, SEO & AI Search Audit: start one, and the audits run so far. */
export default async function WebsiteAuditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");

  const admin = createAdminClient();
  const [{ data: audits, error }, clients] = await Promise.all([
    admin
      .from("website_audits")
      .select("id,created_at,created_by,domain,practice_name,city,state,stage_status,score")
      .order("created_at", { ascending: false })
      .limit(100),
    fetchAllRows<{ id: number; account_name: string; website: string | null; city: string | null; state: string | null }>(
      (from, to) => admin.from("clients").select("id,account_name,website,city,state").order("account_name").range(from, to),
      "clients",
    ),
  ]);

  return (
    <ToolPage
      title="Website & AI Search Audit"
      icon={ScanSearch}
      maxWidth="6xl"
      description="Audit any client's or prospect's website: technical crawl, outside authority, how AI search sees the practice, content and trust signals, and a citability score, delivered as a branded report."
    >
      <NewWebsiteAuditForm clients={clients.filter((c) => c.website)} />
      {error && <p className="text-sm text-red-300">Audits couldn&apos;t be loaded: {error.message}</p>}
      <section className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
              <th className="px-4 py-2">Practice</th>
              <th className="px-4 py-2">Website</th>
              <th className="px-4 py-2">Steps done</th>
              <th className="px-4 py-2">Started</th>
            </tr>
          </thead>
          <tbody>
            {((audits ?? []) as Pick<WebsiteAuditRow, "id" | "created_at" | "created_by" | "domain" | "practice_name" | "city" | "state" | "stage_status">[]).map((a) => (
              <tr key={a.id} className="border-b border-bip-border/60 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/website-audits/${a.id}`} className="font-medium text-bip-text hover:underline">
                    {a.practice_name}
                  </Link>
                  <span className="block text-xs text-bip-muted">{[a.city, a.state].filter(Boolean).join(", ")}</span>
                </td>
                <td className="px-4 py-2 text-bip-muted">{a.domain}</td>
                <td className="px-4 py-2 text-bip-muted">
                  {AUDIT_STAGES.filter((s) => a.stage_status?.[s]?.status === "done").length} of {AUDIT_STAGES.length}
                </td>
                <td className="px-4 py-2 text-xs text-bip-muted">
                  {new Date(a.created_at).toLocaleDateString()} {a.created_by ? `· ${a.created_by}` : ""}
                </td>
              </tr>
            ))}
            {(audits ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-bip-muted">
                  No audits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </ToolPage>
  );
}
