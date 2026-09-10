import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import {
  EXPECTATION_FIELD_LABEL,
  serviceSectionTitle,
} from "@/lib/onboarding/service-expectations";

/**
 * The client-facing kickoff document, as rendered for print/PDF.
 *
 * Laid out around what a practice manager actually does with it: see what they
 * bought and who to call (the plan box), then do what we need (one checklist),
 * then read the detail. The earlier version put every section in the same small
 * type under the same four labels, and read like a form.
 */

const INDIGO = "#3350a2";
const INDIGO_SOFT = "#eef1f9";
const PINK = "#ce2084";

// One field within a service section — rendered only when it has content.
function Field({ label, body }: { label: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div className="mt-3" style={{ breakInside: "avoid" }}>
      <p className="text-[12.5px] font-semibold" style={{ color: PINK }}>
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{body}</p>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold" style={{ color: INDIGO }}>
      {children}
    </h2>
  );
}

export default function ClientExpectationsDocument({
  model,
  generatedAt,
}: {
  model: ClientExpectationsModel;
  generatedAt: string;
}) {
  const { clientName, town, strategistContacts, kickoffDate, content } = model;
  const subtitle = [clientName, town, generatedAt ? `Prepared ${generatedAt}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="report-print-target mx-auto max-w-3xl bg-white px-8 py-8 text-gray-800">
      <header className="mb-5" style={{ breakInside: "avoid" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: PINK }}>
          Beyond Indigo Pets
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight" style={{ color: INDIGO }}>
          Your Marketing Plan &amp; Expectations
        </h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </header>

      {/* At a glance: what they bought, who to contact, when it started. */}
      <section
        className="mb-6 rounded-xl px-5 py-4"
        style={{ background: INDIGO_SOFT, breakInside: "avoid" }}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INDIGO }}>
          Your plan
        </p>
        {content.services.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {content.services.map((service) => (
              <span
                key={service.key}
                className="rounded-full border bg-white px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ color: PINK, borderColor: PINK }}
              >
                {serviceSectionTitle(service)}
              </span>
            ))}
          </div>
        )}
        {(strategistContacts.length > 0 || kickoffDate) && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {strategistContacts.length > 0 && (
              <>
                <dt className="text-gray-500">
                  {strategistContacts.length === 1 ? "Your strategist" : "Your strategists"}
                </dt>
                <dd className="text-gray-800">
                  {strategistContacts.map((contact, index) => (
                    <span key={contact.name}>
                      {index > 0 && (index === strategistContacts.length - 1 ? " and " : ", ")}
                      <span className="font-semibold">{contact.name}</span>
                      {contact.email && (
                        <>
                          {" "}
                          <a href={`mailto:${contact.email}`} style={{ color: INDIGO }}>
                            {contact.email}
                          </a>
                        </>
                      )}
                    </span>
                  ))}
                </dd>
              </>
            )}
            {kickoffDate && (
              <>
                <dt className="text-gray-500">Kickoff</dt>
                <dd className="text-gray-800">{kickoffDate}</dd>
              </>
            )}
          </dl>
        )}
      </section>

      {content.intro && (
        <p
          className="mb-6 whitespace-pre-line text-sm leading-relaxed text-gray-700"
          style={{ breakInside: "avoid" }}
        >
          {content.intro}
        </p>
      )}

      {/* The one part of the document that asks the client to act. Titled
          neutrally on purpose: some items are ongoing ("a heads-up on events
          worth posting"), so "Before kickoff" would promise a timing the list
          cannot keep. */}
      {content.checklist.length > 0 && (
        <section className="mb-7" style={{ breakInside: "avoid" }}>
          <Heading>What we need from you</Heading>
          <ul className="mt-2 space-y-1.5">
            {content.checklist.map((item) => (
              <li key={item.text} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span
                  aria-hidden
                  className="mt-[3px] inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border-[1.5px]"
                  style={{ borderColor: INDIGO }}
                />
                <span className="flex-1">{item.text}</span>
                <span className="shrink-0 text-[11px] text-gray-400">{item.serviceLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.timetable && (
        <section className="mb-7" style={{ breakInside: "avoid" }}>
          <Heading>Your timetable</Heading>
          <div className="mt-2 rounded-lg px-4 py-3" style={{ background: INDIGO_SOFT }}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {content.timetable}
            </p>
          </div>
        </section>
      )}

      {content.services.map((service) => (
        <section key={service.key} className="mb-7 border-t-2 pt-4" style={{ borderColor: PINK }}>
          <Heading>{serviceSectionTitle(service)}</Heading>
          <Field label={EXPECTATION_FIELD_LABEL.expect} body={service.expect} />
          <Field label={EXPECTATION_FIELD_LABEL.limits} body={service.limits} />
          <Field label={EXPECTATION_FIELD_LABEL.recommend} body={service.recommend} />
        </section>
      ))}

      {content.glossary.length > 0 && (
        // Last, deliberately: a reference to come back to, not something to read
        // before the plan it explains. Two columns so it takes less height.
        <section className="mb-6 border-t-2 pt-4" style={{ borderColor: INDIGO_SOFT }}>
          <Heading>Terms you&rsquo;ll see us use</Heading>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            {content.glossary.map((entry) => (
              <div key={entry.term} style={{ breakInside: "avoid" }}>
                <dt className="text-[13px] font-semibold text-gray-800">{entry.term}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-gray-600">
                  {entry.definition}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

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
