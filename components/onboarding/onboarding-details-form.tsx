"use client";

import { CONVERSION_TYPES, CONVERSION_TYPE_LABEL } from "@/lib/onboarding/client-wording";
import { PRACTICE_TYPES, PRACTICE_TYPE_LABEL } from "@/lib/onboarding/practice-type";
import type { ClientServiceKey } from "@/lib/clients/types";
import type { OnboardingDetails } from "@/lib/onboarding/onboarding-details";
import type { StartTrigger, WebStatus } from "@/lib/onboarding/pipeline-intake";
import { SERVICE_OFF, SERVICE_PLAN_OPTIONS } from "@/lib/services/plan-edit";

/**
 * The facts everything else is built from, laid out to be checked at a glance.
 *
 * Used twice: after a pipeline form is read, to confirm what Claude understood
 * before a client is created, and later to correct anything. Start timing per
 * service lives here because the form reader gets it wrong sometimes and there
 * was nowhere else to fix it.
 */

const START_LABEL: Record<StartTrigger, string> = {
  start_now: "Starts now",
  at_splash: "At splash page launch",
  at_launch: "At full website launch",
  at_opening: "When the practice opens",
  on_date: "On a date",
};

const WEB_STATUS_LABEL: Array<{ value: WebStatus | ""; label: string }> = [
  { value: "", label: "Not specified" },
  { value: "has_site_keep", label: "Has a site, keeping it" },
  { value: "has_site_rebuild", label: "Has a site, we're rebuilding" },
  { value: "splash_then_full", label: "Splash page now, full site later" },
  { value: "wait_for_launch", label: "No site yet, wait for full launch" },
  { value: "no_site", label: "No site, none coming" },
];

const input =
  "w-full rounded-md border border-bip-border bg-bip-card px-2.5 py-1.5 text-sm text-bip-text placeholder:text-bip-muted focus:outline-none focus:ring-1 focus:ring-bip-accent disabled:opacity-60";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[11px] font-medium text-bip-muted">{children}</span>;
}

export default function OnboardingDetailsForm({
  value,
  onChange,
  staffNames = [],
  disabled = false,
}: {
  value: OnboardingDetails;
  onChange: (next: OnboardingDetails) => void;
  staffNames?: string[];
  disabled?: boolean;
}) {
  const set = <K extends keyof OnboardingDetails>(key: K, next: OnboardingDetails[K]) =>
    onChange({ ...value, [key]: next });
  const setService = (key: ClientServiceKey, plan: string) =>
    onChange({ ...value, services: { ...value.services, [key]: plan } });
  const setStart = (key: ClientServiceKey, patch: Partial<OnboardingDetails["starts"][ClientServiceKey]>) =>
    onChange({ ...value, starts: { ...value.starts, [key]: { ...value.starts[key], ...patch } } });

  const splashBuild = value.webStatus === "splash_then_full";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <Label>Practice name</Label>
          <input className={input} disabled={disabled} value={value.accountName} onChange={(e) => set("accountName", e.target.value)} />
        </label>
        <label className="block">
          <Label>Strategist</Label>
          <input
            className={input}
            disabled={disabled}
            list="onboarding-staff"
            placeholder="e.g. Melissa"
            value={value.strategist}
            onChange={(e) => set("strategist", e.target.value)}
          />
          <datalist id="onboarding-staff">
            {staffNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr_0.6fr]">
        <label className="block">
          <Label>Website</Label>
          <input className={input} disabled={disabled} placeholder="https://" value={value.website} onChange={(e) => set("website", e.target.value)} />
        </label>
        <label className="block">
          <Label>Town</Label>
          <input className={input} disabled={disabled} value={value.city} onChange={(e) => set("city", e.target.value)} />
        </label>
        <label className="block">
          <Label>State</Label>
          <input
            className={`${input} uppercase`}
            disabled={disabled}
            maxLength={2}
            value={value.state}
            onChange={(e) => set("state", e.target.value.toUpperCase())}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_0.6fr]">
        <label className="block">
          <Label>Street address (makes the market research exact)</Label>
          <input
            className={input}
            disabled={disabled}
            placeholder="e.g. 9512 Harford Rd"
            value={value.streetAddress}
            onChange={(e) => set("streetAddress", e.target.value)}
          />
        </label>
        <label className="block">
          <Label>ZIP</Label>
          <input className={input} disabled={disabled} maxLength={10} value={value.zip} onChange={(e) => set("zip", e.target.value)} />
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-bip-border p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <Label>Practice type</Label>
            <select className={input} disabled={disabled} value={value.practiceType} onChange={(e) => set("practiceType", e.target.value)}>
              <option value="">Not set (general practice wording)</option>
              {PRACTICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PRACTICE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <Label>Opening date (if not open yet)</Label>
            <input type="date" className={input} disabled={disabled} value={value.openingDate} onChange={(e) => set("openingDate", e.target.value)} />
          </label>
          <label className="block">
            <Label>Agreed ad budget, per month</Label>
            <input
              className={input}
              disabled={disabled}
              placeholder="e.g. $400–$700"
              value={value.adBudget}
              onChange={(e) => set("adBudget", e.target.value)}
            />
          </label>
        </div>
        <div>
          <Label>Leads come from</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-bip-text">
            {CONVERSION_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={value.conversionTypes.includes(type)}
                  onChange={(e) =>
                    set(
                      "conversionTypes",
                      e.target.checked ? [...value.conversionTypes, type] : value.conversionTypes.filter((t) => t !== type),
                    )
                  }
                />
                {CONVERSION_TYPE_LABEL[type]}
              </label>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-bip-muted">
          Used by the market research and the client&apos;s plan document. Anything left empty keeps the standard wording.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <Label>Website situation</Label>
          <select
            className={input}
            disabled={disabled}
            value={value.webStatus}
            onChange={(e) => set("webStatus", e.target.value as OnboardingDetails["webStatus"])}
          >
            {WEB_STATUS_LABEL.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>{splashBuild ? "Full website launch" : "Website launch"}</Label>
          <input
            type="date"
            className={input}
            disabled={disabled}
            value={value.websiteLaunchDate}
            onChange={(e) => set("websiteLaunchDate", e.target.value)}
          />
        </label>
        <label className="block">
          <Label>Kickoff meeting</Label>
          <input type="date" className={input} disabled={disabled} value={value.kickoffDate} onChange={(e) => set("kickoffDate", e.target.value)} />
        </label>
      </div>

      <div>
        <Label>Services and when each starts</Label>
        <div className="divide-y divide-bip-border rounded-lg border border-bip-border">
          {SERVICE_PLAN_OPTIONS.map((option) => {
            const stored = value.services[option.service] ?? SERVICE_OFF;
            const bought = stored !== SERVICE_OFF && stored.trim() !== "";
            const known = option.choices.some((choice) => choice.value === stored);
            const start = value.starts[option.service];
            return (
              <div key={option.service} className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[110px_1fr_1fr]">
                <span className="text-xs font-medium text-bip-text">{option.label}</span>
                <select className={input} disabled={disabled} value={stored} onChange={(e) => setService(option.service, e.target.value)}>
                  <option value={SERVICE_OFF}>Not bought</option>
                  {option.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                  {/* A value we do not sell is kept as it is, never silently changed. */}
                  {bought && !known && <option value={stored}>{stored} (as recorded)</option>}
                </select>
                <div className="flex gap-2">
                  <select
                    className={input}
                    disabled={disabled || !bought}
                    value={start.startTrigger}
                    onChange={(e) => setStart(option.service, { startTrigger: e.target.value as StartTrigger })}
                  >
                    {(Object.keys(START_LABEL) as StartTrigger[])
                      .filter((trigger) => trigger !== "at_splash" || splashBuild || start.startTrigger === "at_splash")
                      .map((trigger) => (
                        <option key={trigger} value={trigger}>
                          {START_LABEL[trigger]}
                        </option>
                      ))}
                  </select>
                  {start.startTrigger === "on_date" && bought && (
                    <input
                      type="date"
                      className={input}
                      disabled={disabled}
                      value={start.startDate ?? ""}
                      onChange={(e) => setStart(option.service, { startDate: e.target.value || null })}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
