"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import type { ReportConfig, SectionConfig } from "@/lib/reporting/report-config-types";
import { SECTION_LABELS, METRIC_LABELS } from "@/lib/reporting/report-config-types";

const BI_BLUE = "#3D52C4";

type Props = {
  config: ReportConfig;
  onChange: (config: ReportConfig) => void;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
};

export default function ReportConfigEditor({ config, onChange, saving, onSave, onReset }: Props) {
  const sections = config.sections;

  function updateSections(next: SectionConfig[]) {
    onChange({ ...config, sections: next });
  }

  function toggleSection(idx: number) {
    const next = sections.map((s, i) =>
      i === idx ? { ...s, visible: !s.visible } : s,
    ) as SectionConfig[];
    updateSections(next);
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const next = [...sections];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    updateSections(next as SectionConfig[]);
  }

  function toggleSubsection(sectionIdx: number, subIdx: number) {
    const section = sections[sectionIdx];
    if (section.key !== "kpis") return;
    const subs = section.subsections.map((s, i) =>
      i === subIdx ? { ...s, visible: !s.visible } : s,
    );
    const next = sections.map((s, i) =>
      i === sectionIdx ? { ...s, subsections: subs } : s,
    ) as SectionConfig[];
    updateSections(next);
  }

  function toggleSubMetric(sectionIdx: number, subIdx: number, metricKey: string) {
    const section = sections[sectionIdx];
    if (section.key !== "kpis") return;
    const subs = section.subsections.map((s, i) =>
      i === subIdx
        ? { ...s, metrics: { ...s.metrics, [metricKey]: !s.metrics[metricKey] } }
        : s,
    );
    const next = sections.map((s, i) =>
      i === sectionIdx ? { ...s, subsections: subs } : s,
    ) as SectionConfig[];
    updateSections(next);
  }

  function toggleSocialMetric(sectionIdx: number, metricKey: string) {
    const section = sections[sectionIdx];
    if (section.key !== "social") return;
    const next = sections.map((s, i) =>
      i === sectionIdx && s.key === "social"
        ? { ...s, metrics: { ...s.metrics, [metricKey]: !s.metrics[metricKey] } }
        : s,
    ) as SectionConfig[];
    updateSections(next);
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: BI_BLUE }}>Edit Report Layout</h3>
        <div className="flex gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
            >
              Reset to template
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-bip-text transition disabled:opacity-50"
            style={{ background: BI_BLUE }}
          >
            {saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">Drag order with ↑↓ buttons. Eye icon toggles visibility.</p>

      <div className="space-y-2">
        {sections.map((section, idx) => (
          <div key={section.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* Section header row */}
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none"
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === sections.length - 1}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none"
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <span className={`flex-1 text-sm font-medium ${section.visible ? "text-gray-800" : "text-gray-400 line-through"}`}>
                {SECTION_LABELS[section.key] ?? section.key}
              </span>

              <button
                type="button"
                onClick={() => toggleSection(idx)}
                className={`transition ${section.visible ? "text-emerald-600" : "text-gray-400"}`}
                title={section.visible ? "Hide section" : "Show section"}
              >
                {section.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {/* kpis subsections */}
            {section.key === "kpis" && section.visible && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {section.subsections.map((sub, subIdx) => (
                  <div key={sub.key} className="px-6 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`flex-1 text-xs font-semibold ${sub.visible ? "text-gray-700" : "text-gray-400 line-through"}`}>
                        {sub.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSubsection(idx, subIdx)}
                        className={`transition ${sub.visible ? "text-emerald-600" : "text-gray-400"}`}
                      >
                        {sub.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                    </div>
                    {sub.visible && (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {Object.entries(sub.metrics).map(([mk, mv]) => (
                          <button
                            key={mk}
                            type="button"
                            onClick={() => toggleSubMetric(idx, subIdx, mk)}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                              mv
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "border-gray-200 bg-gray-100 text-gray-400 line-through"
                            }`}
                          >
                            {METRIC_LABELS[sub.key]?.[mk] ?? mk}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* social metrics */}
            {section.key === "social" && section.visible && (
              <div className="border-t border-gray-100 px-6 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(section.metrics).map(([mk, mv]) => (
                    <button
                      key={mk}
                      type="button"
                      onClick={() => toggleSocialMetric(idx, mk)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                        mv
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-gray-100 text-gray-400 line-through"
                      }`}
                    >
                      {METRIC_LABELS.social?.[mk] ?? mk}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
