"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StrategyMapperOutput from "@/components/strategy-mapper/strategy-mapper-output";
import {
  SAMPLE_STRATEGY_MAPPER_FORM,
  SAMPLE_STRATEGY_MAPPER_RESULT,
} from "@/lib/strategy-mapper/sample-fixture";

export default function StrategyMapperSampleView() {
  return (
    <div>
      <div className="vet-output-no-print mb-6 rounded-lg border border-bip-accent/30 bg-bip-accent/10 px-4 py-3 text-sm text-bip-text">
        <strong className="text-bip-accent">Sample preview</strong> — placeholder
        data only. No AI was used. Use{" "}
        <strong>Copy for Google Docs</strong> below to test branded export, or{" "}
        <Link
          href="/onboarding-strategy-mapper"
          className="text-bip-accent underline hover:brightness-110"
        >
          generate a live plan
        </Link>{" "}
        for real client data.
      </div>

      <StrategyMapperOutput
        form={SAMPLE_STRATEGY_MAPPER_FORM}
        result={SAMPLE_STRATEGY_MAPPER_RESULT}
        onStartOver={() => {
          window.location.href = "/onboarding-strategy-mapper";
        }}
      />
    </div>
  );
}
