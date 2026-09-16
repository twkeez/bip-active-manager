import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import {
  EXPECTATION_FIELD_LABEL,
  serviceSectionTitle,
} from "@/lib/onboarding/service-expectations";
import BeyondIndigoLogo from "@/components/onboarding/beyond-indigo-logo";
import { Editable, Removable, useDocumentEditing } from "@/components/onboarding/document-editable";
import { checklistToLines, competitorKey, serviceKey } from "@/lib/onboarding/document-edits";

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

// One field within a service section — rendered only when it has content, or
// in the editor, where an empty field has to stay visible to be refilled.
function Field({ label, body, sectionKey }: { label: string; body: string; sectionKey: string }) {
  const editing = useDocumentEditing();
  if (!body.trim() && !editing) return null;
  return (
    <div className="mt-3" style={{ breakInside: "avoid" }}>
      <p className="text-[12.5px] font-semibold" style={{ color: PINK }}>
        {label}
      </p>
      <Editable sectionKey={sectionKey} value={body}>
        <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{body}</p>
      </Editable>
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
  const { clientName, town, strategistContacts, timeline, market, priorities, note, noteHeading, content } = model;
  // Outside the editor this is false, and every condition below behaves exactly
  // as it did before editing existed.
  const editing = useDocumentEditing();
  const hasPlanDetails =
    strategistContacts.length > 0 || timeline.kickoff || timeline.website || timeline.launchDate || timeline.starts;
  const subtitle = [clientName, town, generatedAt ? `Prepared ${generatedAt}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="report-print-target mx-auto max-w-3xl bg-white px-8 py-8 text-gray-800">
      <header className="mb-5" style={{ breakInside: "avoid" }}>
        {/* The supplied logo is the reversed, white version, so it sits on the
            brand indigo as it was designed to. */}
        <div className="flex items-center rounded-xl px-5 py-3.5" style={{ background: INDIGO }}>
          <BeyondIndigoLogo className="h-8 w-auto" />
        </div>
        <h1 className="mt-4 text-[26px] font-semibold leading-tight" style={{ color: INDIGO }}>
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
        {(hasPlanDetails || editing) && (
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
            {timeline.kickoff && (
              <>
                <dt className="text-gray-500">{timeline.kickoff.label}</dt>
                <dd className="text-gray-800">{timeline.kickoff.date}</dd>
              </>
            )}
            {(timeline.website || timeline.launchDate || editing) && (
              <>
                <dt className="text-gray-500">Your website</dt>
                <dd className="text-gray-800">
                  <Editable sectionKey="plan.website" value={timeline.website ?? ""}>
                    {timeline.website}
                  </Editable>
                  {timeline.launchDate && (
                    <>
                      {timeline.website ? " " : ""}
                      Launch: <span className="font-semibold">{timeline.launchDate}</span>
                    </>
                  )}
                </dd>
              </>
            )}
            {(timeline.starts || editing) && (
              <>
                <dt className="text-gray-500">Timing</dt>
                <dd className="text-gray-800">
                  <Editable sectionKey="plan.timing" value={timeline.starts ?? ""}>
                    {timeline.starts}
                  </Editable>
                </dd>
              </>
            )}
          </dl>
        )}
      </section>

      {(content.intro || editing) && (
        <Editable sectionKey="intro" value={content.intro}>
          <p
            className="mb-6 whitespace-pre-line text-sm leading-relaxed text-gray-700"
            style={{ breakInside: "avoid" }}
          >
            {content.intro}
          </p>
        </Editable>
      )}

      {/* The strategist's own words for this practice — the one part of the
          document not written as master copy. */}
      {(note || editing) && (
        <section
          className="mb-7 rounded-r-lg border-l-4 px-4 py-3"
          style={{ borderColor: PINK, background: "#fdf0f7", breakInside: "avoid" }}
        >
          <p className="text-[12.5px] font-semibold" style={{ color: PINK }}>
            {noteHeading}
          </p>
          <Editable sectionKey="note" value={note}>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800">{note}</p>
          </Editable>
        </section>
      )}

      {/* The client's own goals, as they gave them to us — so they can see we
          heard them before reading what we will do. */}
      {(priorities.length > 0 || editing) && (
        <section className="mb-7" style={{ breakInside: "avoid" }}>
          <Heading>Your priorities</Heading>
          <Editable sectionKey="priorities" value={priorities.join("\n")} hint="One item per line.">
            <ul className="mt-2 space-y-1.5">
              {priorities.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span
                    aria-hidden
                    className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: PINK }}
                  />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </Editable>
        </section>
      )}

      {/* The one part of the document that asks the client to act. Titled
          neutrally on purpose: some items are ongoing ("a heads-up on events
          worth posting"), so "Before kickoff" would promise a timing the list
          cannot keep. */}
      {(content.checklist.length > 0 || editing) && (
        <section className="mb-7" style={{ breakInside: "avoid" }}>
          <Removable sectionKey="checklist" label="this list">
          <Heading>What we need from you</Heading>
          <Editable
            sectionKey="checklist"
            value={checklistToLines(content.checklist)}
            hint="One item per line."
          >
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
          </Editable>
          </Removable>
        </section>
      )}

      {(content.timetable || editing) && (
        <section className="mb-7" style={{ breakInside: "avoid" }}>
          <Removable sectionKey="timetable" label="the timetable">
          <Heading>Your timetable</Heading>
          <div className="mt-2 rounded-lg px-4 py-3" style={{ background: INDIGO_SOFT }}>
            <Editable sectionKey="timetable" value={content.timetable}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {content.timetable}
            </p>
            </Editable>
          </div>
          </Removable>
        </section>
      )}

      {/* The client-safe part of onboarding research. Offers, counter-strategies
          and campaign detail stay in the internal brief. */}
      {market && (
        <section className="mb-7">
          <Removable sectionKey="market" label="the market section">
          <Heading>Your local market</Heading>
          {(market.snapshot || editing) && (
            <Editable sectionKey="market.snapshot" value={market.snapshot}>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700" style={{ breakInside: "avoid" }}>
              {market.snapshot}
            </p>
            </Editable>
          )}
          {(market.landscape || editing) && (
            <div style={{ breakInside: "avoid" }}>
              <p className="mt-4 text-[12.5px] font-semibold" style={{ color: PINK }}>
                How pet owners search here
              </p>
              <Editable sectionKey="market.landscape" value={market.landscape}>
              <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{market.landscape}</p>
              </Editable>
            </div>
          )}
          {market.competitors.length > 0 && (
            <div className="mt-4">
              <p className="text-[12.5px] font-semibold" style={{ color: PINK }}>
                Nearby practices
              </p>
              <p className="mt-0.5 text-[12.5px] text-gray-500">
                The practices most likely to come up alongside you when people search.
              </p>
              <ul className="mt-2 space-y-2">
                {market.competitors.map((competitor) => (
                  <li key={competitor.name} className="text-sm text-gray-700" style={{ breakInside: "avoid" }}>
                    <Removable sectionKey={competitorKey(competitor.name)} label="this practice">
                    <span className="font-semibold text-gray-900">{competitor.name}</span>
                    {competitor.location && <span className="text-gray-500"> · {competitor.location}</span>}
                    {(competitor.description || editing) && (
                      <Editable sectionKey={competitorKey(competitor.name)} value={competitor.description ?? ""}>
                      <span className="block text-[13px] leading-relaxed text-gray-600">{competitor.description}</span>
                      </Editable>
                    )}
                    </Removable>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </Removable>
        </section>
      )}

      {content.services.map((service) => (
        <section key={service.key} className="mb-7 border-t-2 pt-4" style={{ borderColor: PINK }}>
          <Heading>{serviceSectionTitle(service)}</Heading>
          <Field label={EXPECTATION_FIELD_LABEL.expect} body={service.expect} sectionKey={serviceKey(service.key, "expect")} />
          <Field label={EXPECTATION_FIELD_LABEL.limits} body={service.limits} sectionKey={serviceKey(service.key, "limits")} />
          <Field
            label={EXPECTATION_FIELD_LABEL.recommend}
            body={service.recommend}
            sectionKey={serviceKey(service.key, "recommend")}
          />
        </section>
      ))}

      {content.glossary.length > 0 && (
        // Last, deliberately: a reference to come back to, not something to read
        // before the plan it explains. Two columns so it takes less height.
        <section className="mb-6 border-t-2 pt-4" style={{ borderColor: INDIGO_SOFT }}>
          <Removable sectionKey="glossary" label="the glossary">
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
          </Removable>
        </section>
      )}

      {(content.closing || editing) && (
        <Editable sectionKey="closing" value={content.closing}>
          <p
            className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700"
            style={{ breakInside: "avoid" }}
          >
            {content.closing}
          </p>
        </Editable>
      )}
    </div>
  );
}
