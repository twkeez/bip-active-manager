import { AlertTriangle, Bird, CheckCircle2, CircleAlert } from "lucide-react";
import type { Canary, CanaryStatus } from "@/lib/coal-mines/canaries";

/**
 * The Coal Mines board. Quiet by design — a canary that has nothing to say
 * should be easy to skim past, and the ones with something to say should be the
 * only things that catch the eye.
 */

type Props = {
  canaries: Canary[];
  checkedAt: string;
};

const TONE: Record<
  CanaryStatus,
  { icon: React.ElementType; ring: string; text: string; label: string }
> = {
  ok: {
    icon: CheckCircle2,
    ring: "border-bip-border",
    text: "text-emerald-400",
    label: "All clear",
  },
  attention: {
    icon: CircleAlert,
    ring: "border-amber-500/40",
    text: "text-amber-300",
    label: "Worth a look",
  },
  overdue: {
    icon: AlertTriangle,
    ring: "border-red-500/40",
    text: "text-red-300",
    label: "Needs doing",
  },
};

function CanaryCard({ canary }: { canary: Canary }) {
  const tone = TONE[canary.status];
  const Icon = tone.icon;
  return (
    <div className={`rounded-xl border ${tone.ring} bg-bip-card p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.text}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bip-text">{canary.name}</p>
            <p className="mt-0.5 text-xs text-bip-muted">{canary.watches}</p>
          </div>
        </div>
        <span className={`shrink-0 text-[11px] font-medium ${tone.text}`}>{tone.label}</span>
      </div>

      <div className="mt-3 border-t border-bip-border pt-3">
        <p className={`text-xs ${canary.status === "ok" ? "text-bip-muted" : tone.text}`}>
          {canary.headline}
        </p>
        {canary.detail.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {canary.detail.map((line) => (
              <li key={line} className="text-[11px] text-bip-muted">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CoalMinesBoard({ canaries, checkedAt }: Props) {
  const noisy = canaries.filter((c) => c.status !== "ok");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <header>
        <div className="flex items-center gap-2">
          <Bird className="h-5 w-5 text-bip-accent" />
          <h1 className="text-xl font-semibold text-bip-text">Coal Mines</h1>
        </div>
        <p className="mt-1 text-sm text-bip-muted">
          Canaries that watch for the kind of drift nobody goes looking for. They only report —
          nothing here changes anything on its own.
        </p>
      </header>

      <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
        <p className="text-xs text-bip-muted">
          {noisy.length === 0 ? (
            <span className="text-emerald-400">
              All {canaries.length} canaries quiet.
            </span>
          ) : (
            <>
              <span className="text-bip-text">
                {noisy.length} of {canaries.length}
              </span>{" "}
              wants attention.
            </>
          )}{" "}
          Checked {new Date(checkedAt).toLocaleString()} — on page load, not on a schedule yet.
        </p>
      </div>

      {canaries.map((canary) => (
        <CanaryCard key={canary.key} canary={canary} />
      ))}

      <div className="rounded-xl border border-dashed border-bip-border p-4">
        <p className="text-xs text-bip-muted">
          More canaries go here. The obvious next one: a client with a service tier sold but no
          account ID against it — the pattern that let Harmony Animal Hospital sit six months
          without the ads they were promised.
        </p>
      </div>
    </div>
  );
}
