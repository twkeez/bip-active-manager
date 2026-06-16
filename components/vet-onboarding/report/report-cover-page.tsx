interface ReportCoverPageProps {
  year: string;
}

export default function ReportCoverPage({ year }: ReportCoverPageProps) {
  return (
    <div className="report-cover-page hidden print:block">
      <div className="relative h-[100vh] w-full overflow-hidden">
        <img
          src="/vet-onboarding/report-cover.png"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute bottom-[12%] right-[8%] text-right">
          <p className="text-6xl font-light leading-none text-[#c8d6e5]">
            {year.slice(0, 2)}
          </p>
          <p className="text-6xl font-light leading-none text-[#c8d6e5]">
            {year.slice(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

interface StrategyCoverPageProps {
  practiceName: string;
  formattedDate: string;
}

export function StrategyCoverPage({
  practiceName,
  formattedDate,
}: StrategyCoverPageProps) {
  return (
    <div className="report-strategy-cover hidden print:flex print:min-h-[100vh] print:flex-col print:items-center print:justify-center print:bg-[var(--report-navy)] print:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
        Confidential — Internal Use Only
      </p>
      <h1 className="mt-6 text-center text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
        Internal Strategy Brief
      </h1>
      <p className="mt-4 text-center text-xl text-[var(--report-teal)]">
        {practiceName}
      </p>
      <p className="mt-2 text-sm text-white/60">{formattedDate}</p>
      <p className="mt-12 text-xs text-white/50">Beyond Indigo Pets</p>
    </div>
  );
}
