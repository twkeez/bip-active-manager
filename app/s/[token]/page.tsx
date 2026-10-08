import type { Metadata } from "next";
import SnapshotView from "@/components/client-snapshot/snapshot-view";
import { snapshotForToken } from "@/lib/client-snapshot/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monthly Snapshot · Beyond Indigo Pets",
  robots: { index: false, follow: false },
};

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-2 rounded-2xl border border-bip-border bg-bip-card p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-bip-muted">Beyond Indigo Pets</p>
        <h1 className="text-lg font-semibold text-bip-text">{title}</h1>
        <p className="text-sm text-bip-muted">{body}</p>
      </div>
    </main>
  );
}

/** A client's private link: their latest published Monthly Snapshot. Client portal only (see proxy.ts). */
export default async function ClientSnapshotLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await snapshotForToken(createAdminClient(), token);
  if (result.status === "not_found") {
    return <Message title="This link isn't active" body="Please ask your Beyond Indigo team for a current link." />;
  }
  if (result.status === "not_published") {
    return <Message title="Your snapshot is on its way" body="Your first Monthly Snapshot hasn't been published yet. Check back soon." />;
  }
  return (
    <main className="p-4 sm:p-8">
      <SnapshotView snapshot={result.publication.snapshot} />
    </main>
  );
}
