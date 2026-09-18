import { ExternalLink } from "lucide-react";
import type { Canary } from "@/lib/coal-mines/canaries";

/**
 * What a canary found: its detail lines, its grouped sections, its items.
 *
 * Split out of the old card so the three-panel Coal Mines page can show it in
 * the middle panel, with the canary's description moved to the side panel
 * where it no longer competes with the findings.
 */

function ItemLink({ label, href }: { label: string; href?: string | null }) {
  if (!href) return <>{label}</>;
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-1 hover:underline"
    >
      {label}
      {external && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
    </a>
  );
}

export default function CanaryBody({ canary }: { canary: Canary }) {
  return (
    <div className="space-y-4">
      {canary.detail.length > 0 && (
        <ul className="space-y-1">
          {canary.detail.map((line) => (
            <li key={line} className="text-sm text-bip-muted">
              {line}
            </li>
          ))}
        </ul>
      )}

      {canary.sections?.map((section) => (
        <section key={section.heading} className="rounded-lg border border-bip-border p-3">
          <p
            className={`text-sm font-semibold ${
              section.tone === "overdue" ? "text-red-500" : section.tone === "attention" ? "text-amber-600" : "text-bip-text"
            }`}
          >
            {section.heading}
          </p>
          <p className="mt-0.5 text-xs text-bip-muted">{section.blurb}</p>
          <div className="mt-3 space-y-3">
            {section.groups.map((group) => (
              <div key={group.title}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs font-medium text-bip-text">
                    {group.flagged && <span className="text-red-500">⚑ </span>}
                    {group.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-bip-muted">{group.meta}</span>
                </div>
                <ul className="mt-1 space-y-1 border-l border-bip-border pl-2.5">
                  {group.items.map((item, index) => (
                    <li key={`${item.label}-${index}`} className="text-xs leading-relaxed">
                      <span className="text-bip-text">
                        <ItemLink label={item.label} href={item.href} />
                      </span>{" "}
                      <span className="text-bip-muted">{item.meta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      {canary.items && canary.items.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-bip-border p-3">
          {canary.items.map((item, index) => (
            <li key={`${item.label}-${item.meta}-${index}`} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-bip-text">
                <ItemLink label={item.label} href={item.href} />
              </span>
              <span className="shrink-0 text-[11px] text-bip-muted">{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
