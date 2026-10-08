import { notFound, redirect } from "next/navigation";
import SnapshotView from "@/components/client-snapshot/snapshot-view";
import { getProfile } from "@/lib/auth/profile";
import { loadClientSnapshot } from "@/lib/client-snapshot/load";
import { PoobahError } from "@/lib/poobah/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Internal preview of a client's Monthly Snapshot (step 1 of replacing the
 * AgencyAnalytics dashboards). Admins only; nothing here is shared with the
 * client yet. The banner is for us; everything below it is what the client
 * would see.
 */
export default async function ClientSnapshotPreviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/");

  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const snapshot = await loadClientSnapshot(createAdminClient(), id).catch((error: unknown) => {
    if (error instanceof PoobahError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-1 rounded-xl border border-bip-border bg-bip-fill px-4 py-3 text-xs text-bip-muted">
        <p className="font-medium text-bip-text">Preview only: the client cannot see this page.</p>
        <p>
          &ldquo;What we did&rdquo; lists our own Basecamp posts to this client from the last 30 days (threads named INTERNAL are left out).
          Check none are private notes before this goes to clients.
        </p>
        {snapshot.incomplete && (
          <p className="text-[var(--danger-fg)]">
            Some data behind this page was cut short (see Data health). It would not be shown to the client like this.
          </p>
        )}
        {snapshot.omitted.length > 0 && (
          <ul className="list-disc pl-4">
            {snapshot.omitted.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
      <SnapshotView snapshot={snapshot} />
    </div>
  );
}
