export type OutputViewMode = "client" | "strategy";

interface OutputViewToggleProps {
  view: OutputViewMode;
  onChange: (view: OutputViewMode) => void;
}

export default function OutputViewToggle({
  view,
  onChange,
}: OutputViewToggleProps) {
  return (
    <div
      className="vet-output-no-print mb-6 flex rounded-lg border border-[var(--report-border,#d8dee9)] bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Output view"
    >
      {(
        [
          { id: "client" as const, label: "Client View" },
          { id: "strategy" as const, label: "Strategy View" },
        ] as const
      ).map((tab) => {
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--report-navy,#1a4a9a)] text-bip-text shadow-sm"
                : "text-[var(--report-muted,#5a6478)] hover:bg-[#f4f8fc]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
