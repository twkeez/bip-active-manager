// Editable content for the Partnership & Boundaries page. The default below is
// the seeded starting point; admins edit it in-app and the edited version is
// stored in the service_content table (key = "partnership").

export type PartnerRow = { label: string; note?: string; cells: [string, string, string] };
export type BoundaryLine = { when: string; say: string };

export type PartnershipContent = {
  intro: string;
  partnerRows: PartnerRow[];
  salesFramingIntro: string;
  salesFramingQuote: string;
  onDemand: {
    intro: string;
    clientRate: string;
    clientBilling: string;
    nonClientRate: string;
    nonClientBilling: string;
    howItWorks: string;
  };
  boundaryLines: BoundaryLine[];
};

export const PARTNERSHIP_DEFAULT: PartnershipContent = {
  intro:
    "Quality is always high — what scales across plans is access and attention. Set these expectations during the sales process, framed as “here’s how our partnership works.”",
  partnerRows: [
    {
      label: "Best for",
      cells: [
        "Practices who want expert management running efficiently in the background",
        "Practices who want a strategic partner with regular touchpoints",
        "Multi-location / high-growth practices who want us deeply involved",
      ],
    },
    { label: "Your team", cells: ["Specialist team on a proven system", "Dedicated marketing strategist", "Dedicated strategist, priority access"] },
    { label: "Communication", cells: ["Async — email / portal", "Direct line to your strategist", "Priority line to your strategist"] },
    { label: "Strategy calls", cells: ["None — your monthly report tells the story", "Quarterly", "Monthly"] },
    { label: "First response", cells: ["Addressed in your monthly cycle", "Within 2 business days", "Within 1 business day"] },
    {
      label: "Reporting",
      note: "Escalates by tier",
      cells: [
        "Automated monthly data report",
        "Custom dashboard + strategist recap",
        "+ Strategic analysis: competitive benchmarking, goal & ROI tracking, forecasting",
      ],
    },
    { label: "Business review", cells: ["—", "—", "Quarterly Business Review (QBR)"] },
    { label: "Posture", cells: ["Reactive", "Responsive + scheduled", "Proactive — we bring you opportunities before you ask"] },
  ],
  salesFramingIntro:
    "At close, say the “how we work together” part out loud and positively, so it’s agreed to — not assumed:",
  salesFramingQuote:
    "At Foundation, our specialists keep your campaigns optimized and send you a monthly performance report — it runs efficiently in the background. If you ever want a dedicated strategist and regular strategy calls, that’s exactly what Premium adds.",
  onDemand: {
    intro:
      "Foundation runs in the background — but clients are never boxed in. Want a call, a rush change, or extra work? We offer it on demand.",
    clientRate: "$149 / hour",
    clientBilling: "0.5-hour minimum, billed in 30-min increments",
    nonClientRate: "$199 / hour",
    nonClientBilling: "Same",
    howItWorks:
      "Tell us what you need → we send a quick quote → you approve → we do it. No on-demand work begins without an approved quote. Always offered alongside: if a client reaches for this more than a couple times, Premium includes it — usually for less. Tell them when upgrading is the better deal.",
  },
  boundaryLines: [
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
  ],
};
