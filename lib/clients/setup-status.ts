import {
  activeServiceLabels,
  getClientActiveServices,
} from "@/lib/clients/service-active";
import { evaluateSetupRequirements } from "@/lib/clients/setup-requirements";
import type { ClientSetupEvaluation } from "@/lib/clients/types";
import type { ClientRow } from "@/lib/types/client";

export function evaluateClientSetup(
  client: ClientRow,
  ctx: { socialConnectionCount: number },
): ClientSetupEvaluation {
  const services = getClientActiveServices(client);
  const { required, recommended } = evaluateSetupRequirements({
    client,
    services,
    socialConnectionCount: ctx.socialConnectionCount,
  });

  return {
    clientId: client.id,
    accountName: client.account_name,
    marketingStrategist: client.marketing_strategist,
    tier: client.tier,
    services,
    missingRequired: required,
    missingRecommended: recommended,
    isComplete: required.length === 0,
  };
}

export function evaluateAllClientSetup(
  clients: ClientRow[],
  socialCountsByClientId: Record<number, number>,
): ClientSetupEvaluation[] {
  return clients.map((client) =>
    evaluateClientSetup(client, {
      socialConnectionCount: socialCountsByClientId[client.id] ?? 0,
    }),
  );
}

export function filterSetupEvaluations(
  evaluations: ClientSetupEvaluation[],
  params: { filter?: string | null; service?: string | null; gap?: string | null },
) {
  let result = evaluations;

  if (params.filter === "missing") {
    result = result.filter((row) => !row.isComplete || row.missingRecommended.length > 0);
  }

  const service = (params.service ?? "").toLowerCase();
  if (service === "seo") {
    result = result.filter((row) => row.services.seo);
  } else if (service === "ppc") {
    result = result.filter((row) => row.services.ppc);
  } else if (service === "smm") {
    result = result.filter((row) => row.services.smm);
  }

  const gap = params.gap ?? "";
  if (gap === "ads") {
    result = result.filter((row) =>
      row.missingRequired.some((item) => item.id === "google_ads"),
    );
  } else if (gap === "sc") {
    result = result.filter((row) =>
      row.missingRequired.some((item) => item.id === "search_console"),
    );
  } else if (gap === "basecamp") {
    result = result.filter((row) =>
      row.missingRequired.some((item) => item.id === "basecamp"),
    );
  } else if (gap === "social") {
    result = result.filter((row) =>
      row.missingRequired.some((item) => item.id === "social_connection"),
    );
  } else if (gap === "any") {
    result = result.filter((row) => !row.isComplete);
  }

  return result;
}

export { activeServiceLabels };
