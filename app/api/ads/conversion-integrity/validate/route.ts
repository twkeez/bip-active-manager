import { NextResponse } from "next/server";
import {
  runMockTrackingValidation,
  type ConversionAnomalyType,
  type ConversionAnomalySeverity,
} from "@/lib/ads/conversion-integrity";
import { createClient } from "@/lib/supabase/server";

type Body = {
  clientId?: number;
  campaignId?: string;
  anomalyType?: ConversionAnomalyType;
  severity?: ConversionAnomalySeverity;
  conversionRateLabel?: string;
  clicks?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const clientId = Number(body.clientId);
  const campaignId = (body.campaignId ?? "").trim();
  if (!Number.isInteger(clientId) || clientId <= 0 || !campaignId) {
    return NextResponse.json({ error: "Invalid clientId or campaignId" }, { status: 400 });
  }

  const anomalyType = body.anomalyType ?? "implausible_rate";
  const severity = body.severity ?? "high";

  const result = runMockTrackingValidation({
    anomaly: {
      id: `${clientId}:${campaignId}:${anomalyType}`,
      clientId,
      accountName: "",
      accountIdLabel: `#${clientId}`,
      adsCustomerId: null,
      campaignId,
      campaignName: campaignId,
      clicks: body.clicks ?? 0,
      conversions: body.clicks ?? 0,
      conversionRate: 1,
      conversionRateLabel: body.conversionRateLabel ?? "—",
      anomalyType,
      anomalyLabel:
        anomalyType === "pixel_loop" ? "Pixel Loop Detected" : "Suspect Confirmation Trigger",
      severity,
      sortWeight: 0,
    },
  });

  return NextResponse.json(result);
}
