"use client";

import { getClientActiveServices } from "@/lib/clients/service-active";
import { buildPlanTimeline } from "@/lib/onboarding/client-timeline";
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

// Oxford-comma join for a human sentence.
function listJoin(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
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
}: {
  model: OnboardingReportModel;
}) {
  const { client, serviceTiers, intake, keywords, connectionsHealth, kickoff } = model;
  const active = getClientActiveServices(client);
  const activeKeys = (["seo", "ppc", "smm", "blog", "orm"] as ServiceKey[]).filter((k) => active[k]);
  const plan = intake?.service_start_plan ?? {};
  const launchDate = fmtDate(intake?.website_launch_date);

  const buildingSite =
    intake?.web_status === "has_site_rebuild" ||
    intake?.web_status === "splash_then_full" ||
    intake?.web_status === "wait_for_launch";

  // Milestones for the visual timeline.
  const milestones: { label: string; when: string }[] = [
    { label: "Kickoff", when: fmtDate(intake?.kickoff_meeting_at) ?? "To be scheduled" },
  ];
  if (intake?.web_status === "splash_then_full") milestones.push({ label: "Splash page", when: "Early" });
  if (buildingSite) milestones.push({ label: "Website launch", when: launchDate ?? "At launch" });
  milestones.push({ label: "First report", when: "Once live" });
  const edge = 100 / (milestones.length * 2);

  // Which services begin when — the same sentence the client document prints,
  // so the brief and what the client reads cannot disagree about timing.
  const startsLine =
    buildPlanTimeline({
      kickoffMeetingAt: intake?.kickoff_meeting_at,
      onboardingStartedAt: client.onboarding_started_at,
      webStatus: intake?.web_status,
      websiteLaunchDate: intake?.website_launch_date,
      servicePlan: plan,
      activeServices: activeKeys,
    }).starts ??
    (activeKeys.length > 0
      ? `${listJoin(activeKeys.map((k) => SERVICE_LABEL[k]))} ${activeKeys.length === 1 ? "starts" : "start"} now.`
      : null);

  // The specific plan line per service, merged into the service list.
  function planDetail(k: ServiceKey): string {
    if (k === "seo")
      return keywords.length
        ? `We'll track and optimize for ${keywords.join(", ")}.`
        : "We'll research and target your top local keywords.";
    if (k === "ppc")
      return intake?.campaign_plan?.adGroups?.length
        ? `Campaigns structured around ${intake.campaign_plan.adGroups.map((g) => g.name).join(", ")}.`
        : "Campaigns structured around your core services, focused on calls and bookings.";
    if (k === "blog") return "Regular articles on your schedule, starting with proven local topics.";
    if (k === "smm") return "Consistent, on-brand posting across Facebook & Instagram.";
    return "We'll set you up in our review platform and monitor your Google reviews.";
  }

  return (
    <div className="report-print-target mx-auto max-w-3xl bg-white px-8 py-8 text-gray-800">
      <header className="mb-6" style={{ breakInside: "avoid" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: PINK }}>Beyond Indigo Pets</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: INDIGO }}>
          Onboarding Brief — Internal
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

      <Section title="Your plan">
        <ul className="space-y-2.5">
          {activeKeys.map((k) => (
            <li key={k}>
              <span className="font-medium text-gray-900">{SERVICE_LABEL[k]}.</span> {SERVICE_DESC[k]}{" "}
              <span className="text-gray-600">{planDetail(k)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Your timeline">
        {intake?.web_status && WEB_STATUS_LINE[intake.web_status] && (
          <p className="mb-3">{WEB_STATUS_LINE[intake.web_status]}</p>
        )}
        <div className="relative mb-3 mt-1">
          <div
            className="absolute top-[7px] h-px"
            style={{ background: "#dfe3ea", left: `${edge}%`, right: `${edge}%` }}
          />
          <div className="relative flex justify-between gap-2">
            {milestones.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center text-center">
                <span className="h-3.5 w-3.5 rounded-full border-2 bg-white" style={{ borderColor: INDIGO }} />
                <span className="mt-2 text-xs font-semibold text-gray-900">{m.label}</span>
                <span className="text-[11px] text-gray-500">{m.when}</span>
              </div>
            ))}
          </div>
        </div>
        {startsLine && <p className="text-sm text-gray-700">{startsLine}</p>}
      </Section>

      {/* What the client is promised lives in one place now: the client
          document (plan, expectations and local market). This brief used to
          carry its own hardcoded copy that contradicted it. */}
      <p className="mb-5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        What this client is told to expect, and what we need from them, is in the client document. This brief is
        for the team.
      </p>

      <>
          <div className="my-6 border-t border-gray-200" />
          <Section title="Basecamp kickoff message">
            <p className="mb-1.5 text-xs text-gray-500">
              Ready to send{kickoff.isOverride ? " · customized for this client" : ""} · Thread title:{" "}
              <span className="font-medium text-gray-700">{kickoff.title}</span>
            </p>
            {kickoff.body.trim() ? (
              <div
                className="whitespace-pre-line rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-800"
                style={{ breakInside: "avoid" }}
              >
                {kickoff.body}
              </div>
            ) : (
              <p className="text-gray-500">
                No kickoff template configured yet — set it up under Onboarding Basecamp Message.
              </p>
            )}
          </Section>
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
    </div>
  );
}
