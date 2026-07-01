import type { PartnershipContent } from "@/lib/services/partnership-content";

const MAGENTA = "#ce2084";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: MAGENTA }}>
      {children}
    </p>
  );
}

export default function PartnershipView({ content }: { content: PartnershipContent }) {
  const { onDemand } = content;
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-bip-muted">{content.intro}</p>

      {/* How We Partner */}
      <section>
        <SectionLabel>How we partner with you</SectionLabel>
        <div className="overflow-x-auto rounded-xl border border-bip-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-40 border-b border-bip-border bg-bip-page p-3 text-left text-xs font-semibold uppercase tracking-wide text-bip-muted">&nbsp;</th>
                {["Foundation", "Premium", "Premium Plus"].map((t) => (
                  <th key={t} className="border-b border-l border-bip-border bg-bip-page p-3 text-left text-base font-bold" style={{ color: MAGENTA }}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.partnerRows.map((row) => (
                <tr key={row.label} className="align-top">
                  <th className="border-b border-bip-border p-3 text-left">
                    <div className="text-sm font-semibold text-bip-text">{row.label}</div>
                    {row.note && (
                      <div className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${MAGENTA}1a`, color: MAGENTA }}>
                        {row.note}
                      </div>
                    )}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="border-b border-l border-bip-border p-3 text-sm text-bip-text">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The one move */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <SectionLabel>The one move that prevents 90% of the problem</SectionLabel>
        <p className="text-sm text-bip-text">{content.salesFramingIntro}</p>
        <blockquote className="mt-2 border-l-2 pl-3 text-sm italic text-bip-muted" style={{ borderColor: MAGENTA }}>
          &ldquo;{content.salesFramingQuote}&rdquo;
        </blockquote>
      </section>

      {/* On-demand */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <SectionLabel>On-demand / à-la-carte (Foundation)</SectionLabel>
        <p className="mb-3 text-sm text-bip-text">{onDemand.intro}</p>
        <div className="overflow-hidden rounded-lg border border-bip-border">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border-b border-bip-border p-3 font-medium text-bip-text">Current clients</td>
                <td className="border-b border-l border-bip-border p-3 font-semibold" style={{ color: MAGENTA }}>{onDemand.clientRate}</td>
                <td className="border-b border-l border-bip-border p-3 text-bip-muted">{onDemand.clientBilling}</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-bip-text">Non-clients / prospects</td>
                <td className="border-l border-bip-border p-3 font-semibold text-bip-text">{onDemand.nonClientRate}</td>
                <td className="border-l border-bip-border p-3 text-bip-muted">{onDemand.nonClientBilling}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-bip-muted">{onDemand.howItWorks}</p>
      </section>

      {/* Boundary lines */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <SectionLabel>Boundary lines (kind, consistent, always pivoting to the next tier)</SectionLabel>
        <ul className="space-y-3">
          {content.boundaryLines.map((b, i) => (
            <li key={i}>
              <p className="text-sm font-semibold text-bip-text">{b.when}</p>
              <p className="mt-0.5 text-sm italic text-bip-muted">&ldquo;{b.say}&rdquo;</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
