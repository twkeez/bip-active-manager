import { AlertTriangle, Bird, CheckCircle2, CircleAlert, ExternalLink } from "lucide-react";
import type { Canary, CanaryStatus } from "@/lib/coal-mines/canaries";
import ClassifyThreadsButton from "./classify-threads-button";

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

        {canary.sections?.map((section) => (
          <div key={section.heading} className="mt-4 border-t border-bip-border pt-3">
            <p
              className={`text-xs font-semibold ${
                section.tone === "overdue" ? "text-red-300" : "text-amber-300"
              }`}
            >
              {section.heading}
            </p>
            <p className="mt-0.5 text-[11px] text-bip-muted">{section.blurb}</p>

            <div className="mt-2.5 space-y-2.5">
              {section.groups.map((group) => (
                <div key={group.title}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs font-medium text-bip-text">
                      {group.flagged && <span className="text-red-300">⚑ </span>}
                      {group.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-bip-muted">{group.meta}</span>
                  </div>
                  <ul className="mt-1 space-y-1 border-l border-bip-border pl-2.5">
                    {group.items.map((item, i) => (
                      <li key={`${item.label}-${i}`} className="text-[11px] leading-relaxed">
                        <span className="text-bip-text">
                          {item.href ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:underline"
                            >
                              {item.label}
                              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                            </a>
                          ) : (
                            item.label
                          )}
                        </span>{" "}
                        <span className="text-bip-muted">{item.meta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}

        {canary.items && canary.items.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-bip-border pt-3">
            {canary.items.map((item, i) => (
              <li
                key={`${item.label}-${item.meta}-${i}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 truncate text-xs text-bip-text">
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {item.label}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                    </a>
                  ) : (
                    item.label
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-bip-muted">{item.meta}</span>
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

      {canaries.length > 0 && (
        <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
          <p className="text-xs text-bip-muted">
            {noisy.length === 0 ? (
              <span className="text-emerald-400">All {canaries.length} canaries quiet.</span>
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
          <div className="mt-2.5 border-t border-bip-border pt-2.5">
            <ClassifyThreadsButton />
          </div>
        </div>
      )}

      {canaries.map((canary) => (
        <CanaryCard key={canary.key} canary={canary} />
      ))}

      {canaries.length === 0 && (
        <div className="rounded-xl border border-dashed border-bip-border p-6">
          <p className="text-sm text-bip-text">No canaries down here yet.</p>
          <p className="mt-1.5 text-xs text-bip-muted">
            This is for cross-cutting checks that have no natural home in a feature. Work that
            belongs to a feature lives with that feature — the celebration-calendar review sits in
            the Social Planner, not here.
          </p>
          <p className="mt-2 text-xs text-bip-muted">
            The obvious first one: a client with a service tier sold but no account ID against it —
            the pattern that let Harmony Animal Hospital sit six months without the ads they were
            promised.
          </p>
        </div>
      )}
    </div>
  );
}
