import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import { EXPECTATION_FIELD_LABEL } from "@/lib/onboarding/service-expectations";

const INDIGO = "#3350a2";
const INDIGO_SOFT = "#eef1f9";
const PINK = "#ce2084";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6" style={{ breakInside: "avoid" }}>
      <h2 className="mb-2 text-base font-semibold" style={{ color: INDIGO }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

// One structured field within a service section — rendered only when it has content.
function Field({ label, body }: { label: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: PINK }}>
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{body}</p>
    </div>
  );
}

export default function ClientExpectationsDocument({
  model,
  generatedAt,
}: {
  model: ClientExpectationsModel;
  generatedAt: string;
}) {
  const { clientName, strategist, content } = model;

  return (
    <div className="report-print-target mx-auto max-w-3xl bg-white px-8 py-8 text-gray-800">
      <header className="mb-6" style={{ breakInside: "avoid" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: PINK }}>
          Beyond Indigo Pets
        </p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: INDIGO }}>
          Your Marketing Plan &amp; Expectations
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {clientName}
          {strategist ? ` · Strategist: ${strategist}` : ""}
          {generatedAt ? ` · ${generatedAt}` : ""}
        </p>
      </header>

      {content.intro && (
        <p
          className="mb-6 whitespace-pre-line text-sm leading-relaxed text-gray-700"
          style={{ breakInside: "avoid" }}
        >
          {content.intro}
        </p>
      )}

      {content.timetable && (
        <Section title="Your timetable">
          <div className="rounded-lg px-4 py-3" style={{ background: INDIGO_SOFT }}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{content.timetable}</p>
          </div>
        </Section>
      )}

      {content.services.map((service) => (
        <Section key={service.key} title={service.label}>
          <Field label={EXPECTATION_FIELD_LABEL.expect} body={service.expect} />
          <Field label={EXPECTATION_FIELD_LABEL.need} body={service.need} />
          <Field label={EXPECTATION_FIELD_LABEL.recommend} body={service.recommend} />
        </Section>
      ))}

      {content.closing && (
        <p
          className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700"
          style={{ breakInside: "avoid" }}
        >
          {content.closing}
        </p>
      )}
    </div>
  );
}
