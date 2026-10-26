import Link from "next/link";
import BeyondIndigoLogo from "@/components/onboarding/beyond-indigo-logo";
import type { Guide } from "@/lib/guide/types";
import { HIDDEN_NAV_HREFS } from "@/lib/nav/hidden";

// The team guide, branded for Beyond Indigo Pets. The same component renders
// in the app (/guide, with links into each tool) and on the print/PDF page
// (/guide-print, linksAsText). Fixed brand colours, like the client
// documents: the guide should look the same wherever it's read.

const INDIGO = "#3350a2";
const PURPLE = "#603894";
const MAGENTA = "#962583";
const PINK = "#ce2084";
const GRADIENT = `linear-gradient(120deg, ${INDIGO} 0%, ${PURPLE} 55%, ${MAGENTA} 100%)`;

export function sectionId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function GuideDocument({ guide, linksAsText = false }: { guide: Guide; linksAsText?: boolean }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 text-slate-700">
      <header className="overflow-hidden rounded-3xl px-6 py-7 text-white sm:px-8" style={{ background: GRADIENT, breakInside: "avoid" }}>
        <BeyondIndigoLogo className="h-7 w-auto sm:h-8" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Team guide</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl" style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}>
          BIP Control: how to use it
        </h1>
        <p className="mt-2 text-sm text-white/80">Updated {guide.updated} · beyondindigopets.com</p>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" style={{ breakInside: "avoid" }}>
        {guide.intro.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-slate-700">
            {paragraph}
          </p>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          {guide.basics.map((basic) => (
            <div key={basic.heading} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold" style={{ color: INDIGO }}>
                {basic.heading}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{basic.body}</p>
            </div>
          ))}
        </div>
      </section>

      <nav className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" style={{ breakInside: "avoid" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In this guide</p>
        <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {guide.sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#${sectionId(section.title)}`} className="hover:underline" style={{ color: INDIGO }}>
                {index + 1}. {section.title}
              </a>
              <span className="text-slate-400"> · {section.items.length}</span>
            </li>
          ))}
        </ol>
      </nav>

      {guide.sections.map((section) => (
        <section key={section.title} id={sectionId(section.title)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "#0f172a", breakAfter: "avoid" }}>
            <span className="inline-block h-5 w-1.5 rounded-full" style={{ background: PINK }} aria-hidden="true" />
            {section.title}
          </h2>
          {section.intro && <p className="text-sm text-slate-600">{section.intro}</p>}
          <div className="space-y-4">
            {section.items.map((item) => (
              <div key={item.href} className="border-l-2 pl-4" style={{ borderColor: "#e2e8f0", breakInside: "avoid" }}>
                <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold" style={{ color: INDIGO }}>
                  {linksAsText ? (
                    item.label
                  ) : (
                    <Link href={item.href} className="hover:underline">
                      {item.label}
                    </Link>
                  )}
                  {HIDDEN_NAV_HREFS.has(item.href) && (
                    <span className="rounded-full bg-amber-50 px-2 py-px text-[10.5px] font-semibold uppercase tracking-wide text-amber-700">
                      Hidden for now
                    </span>
                  )}
                  {item.adminOnly && (
                    <span className="rounded-full bg-slate-100 px-2 py-px text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                      Admins
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{item.purpose}</p>
                {item.youCan.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-slate-700">
                    {item.youCan.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {item.notes && item.notes.length > 0 && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
                    <span className="font-semibold" style={{ color: PURPLE }}>
                      Good to know:{" "}
                    </span>
                    {item.notes.join(" ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className="space-y-2 pt-2 text-center">
        <div className="mx-auto h-1 w-24 rounded-full" style={{ background: GRADIENT }} aria-hidden="true" />
        <p className="text-xs font-semibold tracking-wide" style={{ color: PURPLE }}>
          Beyond Indigo Pets · beyondindigopets.com
        </p>
        <p className="text-xs text-slate-500">Questions about BIP Control? Ask Tom.</p>
      </footer>
    </article>
  );
}
