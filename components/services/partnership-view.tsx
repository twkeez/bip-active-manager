const MAGENTA = "#ce2084";

type Row = { label: string; cells: [string, string, string]; note?: string };

const PARTNER_ROWS: Row[] = [
  {
    label: "Best for",
    cells: [
      "Practices who want expert management running efficiently in the background",
      "Practices who want a strategic partner with regular touchpoints",
      "Multi-location / high-growth practices who want us deeply involved",
    ],
  },
  {
    label: "Your team",
    cells: ["Specialist team on a proven system", "Dedicated marketing strategist", "Dedicated strategist, priority access"],
  },
  {
    label: "Communication",
    cells: ["Async — email / portal", "Direct line to your strategist", "Priority line to your strategist"],
  },
  {
    label: "Strategy calls",
    cells: ["None — your monthly report tells the story", "Quarterly", "Monthly"],
  },
  {
    label: "First response",
    cells: ["Addressed in your monthly cycle", "Within 2 business days", "Within 1 business day"],
  },
  {
    label: "Reporting",
    note: "Escalates by tier",
    cells: [
      "Automated monthly data report",
      "Custom dashboard + strategist recap",
      "+ Strategic analysis: competitive benchmarking, goal & ROI tracking, forecasting",
    ],
  },
  {
    label: "Business review",
    cells: ["—", "—", "Quarterly Business Review (QBR)"],
  },
  {
    label: "Posture",
    cells: ["Reactive", "Responsive + scheduled", "Proactive — we bring you opportunities before you ask"],
  },
];

const BOUNDARY_LINES: { when: string; say: string }[] = [
  {
    when: "Wants a call (Foundation)",
    say: "Happy to make sure you're taken care of — strategy calls are part of our Premium partnership. At Foundation we keep you posted through your monthly report. Want me to show you what Premium includes?",
  },
  {
    when: "Wants faster / more contact",
    say: "Totally fair to want to be closer to it — that priority access is what Premium Plus is built for. Let's talk about moving you up.",
  },
  {
    when: "Wants rush / ad-hoc changes (Foundation)",
    say: "We'll fold that into your next monthly optimization — or if you need it on-demand, that's $149/hr at our client rate, or Premium includes it.",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: MAGENTA }}>
      {children}
    </p>
  );
}

export default function PartnershipView() {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-bip-muted">
        Quality is always high — what scales across plans is <strong className="text-bip-text">access and attention</strong>.
        Set these expectations during the sales process, framed as &ldquo;here&rsquo;s how our partnership works.&rdquo;
      </p>

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
              {PARTNER_ROWS.map((row) => (
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
        <p className="text-sm text-bip-text">
          At close, say the &ldquo;how we work together&rdquo; part out loud and positively, so it&rsquo;s agreed to — not assumed:
        </p>
        <blockquote className="mt-2 border-l-2 pl-3 text-sm italic text-bip-muted" style={{ borderColor: MAGENTA }}>
          &ldquo;At Foundation, our specialists keep your campaigns optimized and send you a monthly performance report — it runs efficiently in the background. If you ever want a dedicated strategist and regular strategy calls, that&rsquo;s exactly what Premium adds.&rdquo;
        </blockquote>
      </section>

      {/* On-demand */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <SectionLabel>On-demand / à-la-carte (Foundation)</SectionLabel>
        <p className="mb-3 text-sm text-bip-text">
          Foundation runs in the background — but clients are never boxed in. Want a call, a rush change, or extra work? We offer it on demand.
        </p>
        <div className="overflow-hidden rounded-lg border border-bip-border">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border-b border-bip-border p-3 font-medium text-bip-text">Current clients</td>
                <td className="border-b border-l border-bip-border p-3 font-semibold" style={{ color: MAGENTA }}>$149 / hour</td>
                <td className="border-b border-l border-bip-border p-3 text-bip-muted">0.5-hour minimum, billed in 30-min increments</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-bip-text">Non-clients / prospects</td>
                <td className="border-l border-bip-border p-3 font-semibold text-bip-text">$199 / hour</td>
                <td className="border-l border-bip-border p-3 text-bip-muted">Same</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-bip-muted">
          <strong className="text-bip-text">How it works:</strong> tell us what you need → we send a quick quote → you approve → we do it.
          <em> No on-demand work begins without an approved quote.</em> Always offered alongside: if a client reaches for this more than a couple times, Premium <em>includes</em> it — usually for less. Tell them when upgrading is the better deal.
        </p>
      </section>

      {/* Boundary lines */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <SectionLabel>Boundary lines (kind, consistent, always pivoting to the next tier)</SectionLabel>
        <ul className="space-y-3">
          {BOUNDARY_LINES.map((b) => (
            <li key={b.when}>
              <p className="text-sm font-semibold text-bip-text">{b.when}</p>
              <p className="mt-0.5 text-sm italic text-bip-muted">&ldquo;{b.say}&rdquo;</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
