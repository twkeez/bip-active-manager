import { notFound } from "next/navigation";
import PoobahDetailView from "@/components/poobah/poobah-detail-view";
import { requirePoobahAdmin } from "@/lib/poobah/page-auth";
import { getWatch } from "@/lib/poobah/store";
import { PoobahError, todayEastern } from "@/lib/poobah/validate";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PoobahClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePoobahAdmin();
  const { id } = await params;
  const watchId = Number(id);
  if (!Number.isInteger(watchId) || watchId <= 0) notFound();
  const detail = await getWatch(createAdminClient(), watchId).catch((error: unknown) => {
    if (error instanceof PoobahError && error.status === 404) notFound();
    throw error;
  });
  return <PoobahDetailView detail={detail} today={todayEastern()} />;
}
