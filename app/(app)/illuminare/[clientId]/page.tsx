import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ILLUMINARE_CLIENT_COLUMNS,
  type IlluminareClientRow,
} from "@/lib/illuminare/types";
import type { IlluminareDeliverableRow } from "@/lib/illuminare/deliverables";
import IlluminareDeliverables from "@/components/illuminare/illuminare-deliverables";
import IlluminareClientPlan from "@/components/illuminare/illuminare-client-plan";

export default async function IlluminareClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const id = Number(clientId);
  if (!Number.isFinite(id)) {
    notFound();
  }

  const { data } = await supabase
    .from("illuminare_clients")
    .select(ILLUMINARE_CLIENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const client = data as IlluminareClientRow;

  const { data: deliverablesData } = await supabase
    .from("illuminare_deliverables")
    .select(
      "id, client_id, title, detail, kind, cadence, status, start_date, due_date, completed_at, follow_up_interval_days, follow_up_at, last_followed_up_at, notes, created_at, updated_at",
    )
    .eq("client_id", id)
    .order("created_at", { ascending: true });

  const deliverables = (deliverablesData ?? []) as IlluminareDeliverableRow[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/illuminare"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} /> Illuminare
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {client.account_name}
        </h1>
        {client.account_lead && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Lead: {client.account_lead}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        <IlluminareClientPlan client={client} />

        <IlluminareDeliverables clientId={client.id} deliverables={deliverables} />

        <section className="rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">Communication</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Basecamp message and comment activity, once the account is connected.
          </p>
          <p className="mt-3 text-[0.7rem] uppercase tracking-wide text-[var(--text-subtle)]">
            Coming soon
          </p>
        </section>
      </div>
    </div>
  );
}
