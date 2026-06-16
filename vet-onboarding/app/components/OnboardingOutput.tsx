import type { OnboardingPlan } from "@/types/onboarding";

interface OnboardingOutputProps {
  plan: OnboardingPlan;
}

export default function OnboardingOutput({ plan }: OnboardingOutputProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 print:space-y-6">
      <header className="border-b border-slate-200 pb-6 print:border-slate-300">
        <h1 className="text-2xl font-bold text-slate-900">
          Your Onboarding Plan
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-700">
          {plan.welcome}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Why It Matters
        </h2>
        <p className="mt-2 leading-relaxed text-slate-700">
          {plan.whyItMatters}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plan.stats.map((stat, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm print:shadow-none"
          >
            <p className="text-3xl font-bold text-teal-600">{stat.num}</p>
            <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Service Strategy
        </h2>
        <p className="mt-2 leading-relaxed text-slate-700">
          {plan.serviceStrategy}
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-teal-700">
          30 / 60 / 90 Day Roadmap
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plan.roadmap.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:shadow-none"
            >
              <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                {item.phase}
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
              <ul className="mt-3 space-y-2">
                {item.actions.map((action, j) => (
                  <li
                    key={j}
                    className="flex gap-2 text-sm text-slate-600 before:mt-1.5 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-teal-500"
                  >
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-700">
          Quick Wins
        </h2>
        <ul className="space-y-2">
          {plan.quickWins.map((win, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700"
            >
              <span className="font-bold text-emerald-600">✓</span>
              {win}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-700">
          Next Steps
        </h2>
        <ol className="space-y-2">
          {plan.nextSteps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <div className="border-t border-slate-200 pt-6 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500"
        >
          Download / Print Plan
        </button>
      </div>
    </div>
  );
}
