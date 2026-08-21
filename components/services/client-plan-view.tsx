import Link from "next/link";
import { Check, FileText, Layers } from "lucide-react";
import { resolveScopeRows, type ClientPlanEntry } from "@/lib/services/client-plan";

const MAGENTA = "#ce2084";

/**
 * What one client is actually paying for: their tier per service, and the scope
 * that tier includes. Read-only by design — the catalogue at /services stays the
 * place where scope is authored.
 */
export default function ClientPlanView({
  clientId,
  clientName,
  plan,
}: {
  clientId: number;
  clientName: string;
  plan: ClientPlanEntry[];
}) {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-bip-text">
            {clientName}&apos;s plan
          </h1>
          <p className="text-sm text-bip-muted">
            The services this client is on, and what each tier includes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/client-expectations-print/${clientId}`}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: MAGENTA, color: MAGENTA }}
          >
            <FileText className="h-4 w-4" /> Client expectations
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm font-medium text-bip-text transition hover:bg-bip-page"
          >
            <Layers className="h-4 w-4" /> Full catalogue
          </Link>
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="rounded-xl border border-bip-border bg-bip-card p-6">
          <p className="text-sm text-bip-text">
            No active services recorded for {clientName}.
          </p>
          <p className="mt-1 text-sm text-bip-muted">
            Services are set on the client&apos;s Profile tab.
          </p>
          <Link
            href={`/dashboard/clients/${clientId}?tab=profile`}
            className="mt-4 inline-block text-sm font-medium"
            style={{ color: MAGENTA }}
          >
            Open profile →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {plan.map((entry) => (
            <PlanCard key={entry.service} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({ entry }: { entry: ClientPlanEntry }) {
  const scopeRows =
    entry.kind === "tiered" && entry.table && entry.tierKey
      ? resolveScopeRows(entry.table, entry.tierKey)
      : [];

  return (
    <section className="rounded-xl border border-bip-border bg-bip-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-bip-border px-5 py-3">
        <h2 className="text-sm font-semibold text-bip-text">{entry.label}</h2>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: `${MAGENTA}1a`, color: MAGENTA }}
        >
          {entry.kind === "count"
            ? `${entry.rawValue} ${entry.rawValue === "1" ? "post" : "posts"}/month`
            : entry.tierLabel}
        </span>
      </header>

      {entry.kind === "tiered" ? (
        <dl className="divide-y divide-bip-border">
          {scopeRows.map((row) => (
            <div key={row.label} className="grid gap-2 px-5 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm font-semibold text-bip-text">
                {row.label}
                {row.note && (
                  <span
                    className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: `${MAGENTA}1a`, color: MAGENTA }}
                  >
                    {row.note}
                  </span>
                )}
              </dt>
              <dd>
                <ul className="space-y-1">
                  {row.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-bip-muted">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: MAGENTA }}
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-5 py-4 text-sm text-bip-muted">
          {entry.kind === "count"
            ? "Blog volume is agreed per client rather than by tier."
            : `No published scope for ${entry.label} yet — this client is on ${entry.tierLabel}.`}
        </p>
      )}
    </section>
  );
}
