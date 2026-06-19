import { MARKETING_MANAGED_BY_OPTIONS } from "@/lib/vet-onboarding/form-options";
import type { ClientFormData } from "@/types/onboarding";

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2.5 text-sm text-bip-text placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-bip-text">
        {label}
        {required ? <span className="text-bip-danger"> *</span> : null}
      </span>
      {children}
      {hint ? <p className="mt-1 text-xs text-bip-muted">{hint}</p> : null}
    </label>
  );
}

interface DigitalFootprintFieldsProps {
  form: ClientFormData;
  onUpdateField: <K extends keyof ClientFormData>(
    key: K,
    value: ClientFormData[K],
  ) => void;
  compact?: boolean;
}

export default function DigitalFootprintFields({
  form,
  onUpdateField,
  compact = false,
}: DigitalFootprintFieldsProps) {
  const showPreviousAgency =
    form.marketingManagedBy === "Previous agency" ||
    form.marketingManagedBy === "Mix (in-house + vendor)";

  return (
    <div
      className={`border-t border-bip-border pt-5 ${compact ? "space-y-4" : "space-y-5"}`}
    >
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-bip-accent">
          Digital Footprint
        </h3>
        <p className="mt-1 text-xs text-bip-muted">
          Optional — helps us audit your current online presence before building
          your plan.
        </p>
      </div>

      <Field label="Website URL">
        <input
          type="url"
          value={form.websiteUrl}
          onChange={(e) => onUpdateField("websiteUrl", e.target.value)}
          className={inputClass}
          placeholder="https://www.yourpractice.com"
        />
      </Field>

      <Field
        label="Google Business Profile URL(s)"
        hint="One URL per line for multiple locations"
      >
        <textarea
          value={form.googleBusinessProfileUrls}
          onChange={(e) =>
            onUpdateField("googleBusinessProfileUrls", e.target.value)
          }
          rows={compact ? 2 : 3}
          className={inputClass}
          placeholder={"https://maps.google.com/?cid=...\nhttps://maps.google.com/?cid=..."}
        />
      </Field>

      <div className={compact ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        <Field label="Facebook URL">
          <input
            type="url"
            value={form.facebookUrl}
            onChange={(e) => onUpdateField("facebookUrl", e.target.value)}
            className={inputClass}
            placeholder="https://facebook.com/yourpractice"
          />
        </Field>
        <Field label="Instagram URL">
          <input
            type="url"
            value={form.instagramUrl}
            onChange={(e) => onUpdateField("instagramUrl", e.target.value)}
            className={inputClass}
            placeholder="https://instagram.com/yourpractice"
          />
        </Field>
      </div>

      <Field
        label="Other social profiles"
        hint="YouTube, TikTok, LinkedIn, etc. — one URL per line"
      >
        <textarea
          value={form.otherSocialUrls}
          onChange={(e) => onUpdateField("otherSocialUrls", e.target.value)}
          rows={compact ? 2 : 3}
          className={inputClass}
          placeholder={"https://youtube.com/@yourpractice\nhttps://tiktok.com/@yourpractice"}
        />
      </Field>

      <div className={compact ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        <Field label="Practice phone">
          <input
            type="tel"
            value={form.practicePhone}
            onChange={(e) => onUpdateField("practicePhone", e.target.value)}
            className={inputClass}
            placeholder="(555) 123-4567"
          />
        </Field>
        <Field label="Online booking URL">
          <input
            type="url"
            value={form.onlineBookingUrl}
            onChange={(e) => onUpdateField("onlineBookingUrl", e.target.value)}
            className={inputClass}
            placeholder="https://booking.yourpractice.com"
          />
        </Field>
      </div>

      <Field label="Service area / neighborhoods">
        <textarea
          value={form.serviceAreaNotes}
          onChange={(e) => onUpdateField("serviceAreaNotes", e.target.value)}
          rows={compact ? 2 : 3}
          className={inputClass}
          placeholder="e.g. Downtown Austin, Westlake, Round Rock"
        />
      </Field>

      <Field label="Who manages marketing today?">
        <select
          value={form.marketingManagedBy}
          onChange={(e) => onUpdateField("marketingManagedBy", e.target.value)}
          className={inputClass}
        >
          <option value="">Select (optional)</option>
          {MARKETING_MANAGED_BY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      {showPreviousAgency ? (
        <Field label="Previous agency name">
          <input
            type="text"
            value={form.previousAgencyName}
            onChange={(e) =>
              onUpdateField("previousAgencyName", e.target.value)
            }
            className={inputClass}
            placeholder="Agency or vendor name"
          />
        </Field>
      ) : null}
    </div>
  );
}
