"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { ToolPage } from "@/components/ui/tool-page";

export type SnapshotRow = {
  id: number;
  name: string;
  publishedAt: string | null;
  activeLinks: number;
  views: number;
  recipients: string[];
  lastSend: { at: string; status: string; to: string[] } | null;
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

/** The pilot clients' snapshot status, and a way to open any client's snapshot. */
export default function SnapshotIndex({ rows, clients }: { rows: SnapshotRow[]; clients: { id: number; name: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const match = clients.find((client) => client.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <ToolPage
      title="Client Snapshot"
      icon={BarChart3}
      maxWidth="5xl"
      description="Each client's Monthly Snapshot: a few basic numbers and the work we did, replacing the AgencyAnalytics dashboards. Clients see only what you publish, at their own private link on beyond-indigo-reports.vercel.app."
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-bip-border bg-bip-card p-3">
        <input
          list="snapshot-clients"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && match) router.push(`/client-snapshot/${match.id}`);
          }}
          placeholder="Open a client's snapshot: start typing a name"
          className="min-w-[16rem] flex-1 rounded-md border border-bip-border bg-transparent px-3 py-2 text-sm text-bip-text"
        />
        <datalist id="snapshot-clients">
          {clients.map((client) => (
            <option key={client.id} value={client.name} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={!match}
          onClick={() => match && router.push(`/client-snapshot/${match.id}`)}
          className="rounded-md bg-bip-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Open
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">In the pilot ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-bip-muted">No client has a published snapshot, link or recipients yet. Open one above to start.</p>
        ) : (
          <ul className="divide-y divide-bip-border rounded-xl border border-bip-border bg-bip-card">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/client-snapshot/${row.id}`} className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-bip-hover sm:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
                  <span className="font-medium text-bip-text">{row.name}</span>
                  <span className={row.publishedAt ? "text-bip-text" : "text-bip-muted"}>
                    {row.publishedAt ? `Published ${when(row.publishedAt)}` : "Not published"}
                  </span>
                  <span className="text-bip-muted">
                    {row.activeLinks} {row.activeLinks === 1 ? "link" : "links"} · {row.views} {row.views === 1 ? "view" : "views"}
                  </span>
                  <span className="text-bip-muted">
                    {row.lastSend
                      ? `${row.lastSend.status === "sent" ? "Emailed" : "Email FAILED"} ${when(row.lastSend.at)} to ${row.lastSend.to.join(", ")}`
                      : row.recipients.length
                        ? `Recipients: ${row.recipients.join(", ")}`
                        : "No email yet"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ToolPage>
  );
}
