"use client";

import { getClientActiveServices } from "@/lib/clients/service-active";
import type { OnboardingReportModel } from "@/lib/onboarding/load-onboarding-report";

const INDIGO = "#3350a2";
const PINK = "#ce2084";

type ServiceKey = "seo" | "ppc" | "smm" | "blog" | "orm";

const SERVICE_LABEL: Record<ServiceKey, string> = {
  seo: "SEO",
  ppc: "Google Ads",
  smm: "Social Media",
  blog: "Blog",
  orm: "Reviews",
};

const SERVICE_DESC: Record<ServiceKey, string> = {
  seo: "Grow your visibility in local search so more pet owners find you online.",
  ppc: "Run targeted Google Ads that drive phone calls and appointment bookings.",
  smm: "Keep your Facebook & Instagram active, consistent, and on-brand.",
  blog: "Publish helpful, search-friendly articles that build trust with pet owners.",
  orm: "Grow and manage your online reviews so your reputation reflects your care.",
};

const WEB_STATUS_LINE: Record<string, string> = {
  has_site_keep: "We'll work with your existing website.",
  has_site_rebuild: "We'll work against your current site, then move to the new one at launch.",
  splash_then_full: "We'll launch a splash page early while your full website is built.",
  wait_for_launch: "Site-dependent work begins once your new website launches.",
  no_site: "No website in scope — we'll focus on off-site channels.",
};

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6" style={{ breakInside: "avoid" }}>
      <h2 className="mb-2 text-base font-semibold" style={{ color: INDIGO }}>{title}</h2>
      <div className="text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function OnboardingReport({
  model,
  mode,
}: {
  model: OnboardingReportModel;
  mode: "client" | "internal";
}) {
  const { client, serviceTiers, intake, keywords, connectionsHealth } = model;
  const active = getClientActiveServices(client);
  const activeKeys = (["seo", "ppc", "smm", "blog", "orm"] as ServiceKey[]).filter((k) => active[k]);
  const plan = intake?.service_start_plan ?? {};
  const launchDate = fmtDate(intake?.website_launch_date);

  function startLine(k: ServiceKey): string {
    const trigger = plan[k]?.startTrigger;
    if (trigger === "at_launch") return `Starts at website launch${launchDate ? ` (~${launchDate})` : ""}`;
    if (trigger === "on_date") {
      const d = fmtDate(plan[k]?.startDate);
      return d ? `Starts ${d}` : "Starts on the planned date";
    }
    return "Starts now";
  }

  const needFromClient: string[] = [];
  if (active.ppc) needFromClient.push("Add your billing details to the Google Ads account we create for you.");
  if (active.smm) {
    needFromClient.push("Grant us access to your Facebook & Instagram (we'll send a short walkthrough).");
    needFromClient.push("Share your brand assets — logo, photos, and any brand guidelines.");
  }
  if (active.seo || active.orm) needFromClient.push("Grant us access to your Google Business Profile.");
  needFromClient.push("Tell us anything unique about your practice we should highlight.");

  return (
    <div className="report-print-target mx-auto max-w-3xl bg-white px-8 py-8 text-gray-800">
      <header className="mb-6" style={{ breakInside: "avoid" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: PINK }}>Beyond Indigo Pets</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: INDIGO }}>
          Marketing Onboarding Plan{mode === "internal" ? " — Internal" : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {client.account_name}
          {client.marketing_strategist ? ` · Strategist: ${client.marketing_strategist}` : ""}
          {client.tier ? ` · ${client.tier}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {serviceTiers.map((s) => (
            <span key={s.tierKey} className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: INDIGO }}>
              {s.label} · {s.tierLabel}
            </span>
          ))}
        </div>
        {(intake?.kickoff_meeting_at || launchDate) && (
          <p className="mt-2 text-xs text-gray-500">
            {intake?.kickoff_meeting_at ? `Kickoff meeting: ${fmtDate(intake.kickoff_meeting_at)}` : ""}
            {intake?.kickoff_meeting_at && launchDate ? " · " : ""}
            {launchDate ? `Website launch: ${launchDate}` : ""}
          </p>
        )}
      </header>

      <Section title="What we're doing for you">
        <ul className="space-y-2">
          {activeKeys.map((k) => (
            <li key={k}>
              <span className="font-medium text-gray-900">{SERVICE_LABEL[k]}.</span> {SERVICE_DESC[k]}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Timeline — what happens when">
        {intake?.web_status && WEB_STATUS_LINE[intake.web_status] && (
          <p className="mb-2">{WEB_STATUS_LINE[intake.web_status]}</p>
        )}
        <ul className="space-y-1">
          {activeKeys.map((k) => (
            <li key={k}>
              <span className="font-medium text-gray-900">{SERVICE_LABEL[k]}:</span> {startLine(k)}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What we need from you">
        <ul className="list-disc space-y-1 pl-5">
          {needFromClient.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Section>

      <Section title="The plan">
        {active.seo && (
          <p className="mb-1">
            <span className="font-medium text-gray-900">SEO:</span>{" "}
            {keywords.length ? `We'll track and optimize for ${keywords.join(", ")}.` : "We'll research and target your top local keywords."}
          </p>
        )}
        {active.ppc && (
          <p className="mb-1">
            <span className="font-medium text-gray-900">Google Ads:</span>{" "}
            {intake?.campaign_plan?.adGroups?.length
              ? `Campaigns structured around ${intake.campaign_plan.adGroups.map((g) => g.name).join(", ")}.`
              : "Campaigns structured around your core services, focused on calls and bookings."}
          </p>
        )}
        {active.blog && (
          <p className="mb-1">
            <span className="font-medium text-gray-900">Blog:</span> Regular articles on your schedule, starting with proven local topics.
          </p>
        )}
        {active.smm && (
          <p className="mb-1">
            <span className="font-medium text-gray-900">Social:</span> Consistent, on-brand posting across Facebook & Instagram.
          </p>
        )}
        {active.orm && (
          <p className="mb-1">
            <span className="font-medium text-gray-900">Reviews:</span> We'll set you up in our review platform and monitor your Google reviews.
          </p>
        )}
      </Section>

      <Section title="How we'll work together">
        <p className="mb-1">We keep in touch through Basecamp and aim to respond within one business day.</p>
        <p className="mb-1">You'll get a performance report each month once your services are live.</p>
        <p className="text-gray-600">
          A note on timing: SEO and content build over time — expect meaningful search movement in about 3–6 months.
          Ads and social typically show impact sooner.
        </p>
      </Section>

      {mode === "internal" && (
        <>
          <div className="my-6 border-t border-gray-200" />
          {intake?.pipeline_notes && (
            <Section title="Strategist brief">
              <p className="whitespace-pre-line text-gray-700">{intake.pipeline_notes}</p>
            </Section>
          )}
          {intake?.discovery && (
            <Section title="Market & discovery">
              {intake.discovery.marketSnapshot && <p className="mb-1">{intake.discovery.marketSnapshot}</p>}
              {intake.discovery.searchLandscape && <p className="mb-1 text-gray-600">{intake.discovery.searchLandscape}</p>}
              {intake.discovery.competitors?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {intake.discovery.competitors.map((c, i) => (
                    <li key={i}><span className="font-medium text-gray-900">{c.name}</span> — {c.note}</li>
                  ))}
                </ul>
              ) : null}
            </Section>
          )}
          {intake?.competitor_ads?.length ? (
            <Section title="Competitor offers & counters">
              <ul className="space-y-1.5">
                {intake.competitor_ads.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium text-gray-900">{c.name}</span>
                    {c.offers ? <> — {c.offers}</> : null}
                    {c.counter ? <div className="text-gray-600">Counter: {c.counter}</div> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {intake?.campaign_plan?.negatives?.length ? (
            <Section title="Campaign negatives">
              <p className="text-gray-700">{intake.campaign_plan.negatives.join(", ")}</p>
            </Section>
          ) : null}
          <Section title="Connections status">
            <span className={`text-sm font-medium ${connectionsHealth.status === "green" ? "text-emerald-600" : connectionsHealth.status === "yellow" ? "text-amber-600" : "text-red-600"}`}>
              {connectionsHealth.connected}/{connectionsHealth.total} connected
            </span>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {connectionsHealth.items.map((it) => (
                <li key={it.label}>{it.connected ? "✓" : "○"} {it.label}</li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
