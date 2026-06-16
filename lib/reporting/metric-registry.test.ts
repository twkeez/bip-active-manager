import { describe, expect, it } from "vitest";
import {
  applyReportingMetricPreferences,
  buildReportingMetricControls,
} from "@/lib/reporting/metric-registry";
import type { ReportingKpiCard } from "@/lib/types/client";

function metric(id: string, label: string): ReportingKpiCard {
  return {
    id,
    label,
    value: "1",
    source: "internal",
    definition: "test",
    updated_at: null,
  };
}

describe("metric registry preferences", () => {
  it("builds default controls without saved preferences", () => {
    const controls = buildReportingMetricControls([]);
    expect(controls.length).toBeGreaterThan(0);
    expect(controls[0]?.metricId).toBe("ads-clicks");
    expect(controls.some((row) => row.isEnabled === false)).toBe(true);
    expect(controls.some((row) => row.metricId === "ads-rank-lost-is")).toBe(true);
    expect(controls.some((row) => row.metricId === "ads-auction-competitors")).toBe(
      true,
    );
    expect(
      controls.find((row) => row.metricId === "ads-cost-30d")?.isEnabled,
    ).toBe(true);
    expect(
      controls.find((row) => row.metricId === "ads-cpa-30d")?.isEnabled,
    ).toBe(false);
  });

  it("applies visibility and custom ordering", () => {
    const metrics = [
      metric("ads-clicks", "Ads clicks"),
      metric("gsc-clicks", "Search clicks"),
      metric("social-reach", "Social reach"),
    ];
    const output = applyReportingMetricPreferences(metrics, [
      { metric_id: "ads-clicks", is_enabled: false, display_order: 30 },
      { metric_id: "gsc-clicks", is_enabled: true, display_order: 20 },
      { metric_id: "social-reach", is_enabled: true, display_order: 10 },
    ]);
    expect(output.map((row) => row.id)).toEqual(["social-reach", "gsc-clicks"]);
  });

  it("ignores unknown preference ids safely", () => {
    const metrics = [metric("ads-clicks", "Ads clicks")];
    const output = applyReportingMetricPreferences(metrics, [
      { metric_id: "non-existent-metric", is_enabled: false, display_order: 1 },
    ]);
    expect(output).toHaveLength(1);
    expect(output[0]?.id).toBe("ads-clicks");
  });
});
