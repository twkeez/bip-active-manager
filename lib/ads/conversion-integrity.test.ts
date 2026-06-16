import { describe, expect, it } from "vitest";
import {
  buildConversionIntegrityAnomalies,
  runMockTrackingValidation,
  summarizeConversionIntegrity,
} from "@/lib/ads/conversion-integrity";
import type { AdsSnapshot } from "@/lib/types/client";

function snapshot(
  overrides: Partial<AdsSnapshot> & Pick<AdsSnapshot, "client_id">,
): AdsSnapshot {
  return {
    id: 1,
    client_id: overrides.client_id,
    customer_id: "1234567890",
    start_date: "2026-04-01",
    end_date: "2026-04-30",
    run_status: "completed",
    error_message: null,
    totals: {
      impressions: 1000,
      clicks: 100,
      cost_micros: 1_000_000,
      conversions: 5,
      ctr: 0.1,
      average_cpc: 10_000,
    },
    campaigns: [],
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildConversionIntegrityAnomalies", () => {
  const clients = [{ id: 102, account_name: "Westside Animal Hospital", ads_customer_id: "1234567890" }];

  it("flags pixel loop when conversions meet or exceed clicks", () => {
    const anomalies = buildConversionIntegrityAnomalies({
      clients,
      snapshots: [
        snapshot({
          client_id: 102,
          campaigns: [
            {
              campaign_id: "1",
              campaign_name: "Brand-Search-Local",
              impressions: 500,
              clicks: 42,
              cost_micros: 500_000,
              conversions: 42,
              ctr: 0.08,
            },
          ],
        }),
      ],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.anomalyType).toBe("pixel_loop");
    expect(anomalies[0]?.severity).toBe("critical");
    expect(anomalies[0]?.conversionRateLabel).toBe("100.0%");
  });

  it("flags implausible conversion rate above 45% with more than 10 clicks", () => {
    const anomalies = buildConversionIntegrityAnomalies({
      clients,
      snapshots: [
        snapshot({
          client_id: 102,
          campaigns: [
            {
              campaign_id: "2",
              campaign_name: "Emergency-K9",
              impressions: 200,
              clicks: 15,
              cost_micros: 200_000,
              conversions: 11,
              ctr: 0.075,
            },
          ],
        }),
      ],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.anomalyType).toBe("implausible_rate");
    expect(anomalies[0]?.severity).toBe("high");
  });

  it("ignores high rate when clicks are at or below 10", () => {
    const anomalies = buildConversionIntegrityAnomalies({
      clients,
      snapshots: [
        snapshot({
          client_id: 102,
          campaigns: [
            {
              campaign_id: "3",
              campaign_name: "Low Sample",
              impressions: 50,
              clicks: 10,
              cost_micros: 50_000,
              conversions: 8,
              ctr: 0.2,
            },
          ],
        }),
      ],
    });

    expect(anomalies).toHaveLength(0);
  });
});

describe("summarizeConversionIntegrity", () => {
  it("counts anomalies and affected accounts", () => {
    const clients = [
      { id: 1, account_name: "A", ads_customer_id: "1234567890" },
      { id: 2, account_name: "B", ads_customer_id: "1234567891" },
    ];
    const anomalies = buildConversionIntegrityAnomalies({
      clients,
      snapshots: [
        snapshot({
          client_id: 1,
          campaigns: [
            {
              campaign_id: "c1",
              campaign_name: "One",
              impressions: 100,
              clicks: 20,
              cost_micros: 100_000,
              conversions: 20,
              ctr: 0.2,
            },
          ],
        }),
        snapshot({
          client_id: 2,
          campaigns: [
            {
              campaign_id: "c2",
              campaign_name: "Two",
              impressions: 100,
              clicks: 12,
              cost_micros: 100_000,
              conversions: 9,
              ctr: 0.12,
            },
          ],
        }),
      ],
    });

    const summary = summarizeConversionIntegrity(anomalies, {
      campaignsScanned: 2,
      accountsScanned: 2,
    });
    expect(summary.activeAnomalies).toBe(2);
    expect(summary.accountsAffected).toBe(2);
    expect(summary.criticalCount).toBe(1);
    expect(summary.highCount).toBe(1);
  });
});

describe("runMockTrackingValidation", () => {
  it("returns diagnostic findings for an anomaly", () => {
    const anomalies = buildConversionIntegrityAnomalies({
      clients: [{ id: 1, account_name: "A", ads_customer_id: "1234567890" }],
      snapshots: [
        snapshot({
          client_id: 1,
          campaigns: [
            {
              campaign_id: "c1",
              campaign_name: "Test",
              impressions: 100,
              clicks: 5,
              cost_micros: 50_000,
              conversions: 5,
              ctr: 0.05,
            },
          ],
        }),
      ],
    });
    const result = runMockTrackingValidation({ anomaly: anomalies[0]! });
    expect(result.status).toBe("suspect");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
