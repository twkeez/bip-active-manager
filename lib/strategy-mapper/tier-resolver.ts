import { mapPurchasedProductToService } from "@/lib/strategy-mapper/form-options";
import {
  getTierByKey,
  getTiersForService,
  type ServiceTierTemplate,
} from "@/lib/strategy-mapper/tier-library";
import type {
  StrategyMapperFormData,
  StrategyMapperService,
  UpsellDirective,
} from "@/types/strategy-mapper";

export type SelectedTierMap = Partial<Record<StrategyMapperService, string>>;

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
}

function labelMatchesTier(label: string, tier: ServiceTierTemplate): boolean {
  const normalized = normalizeLabel(label);
  if (normalizeLabel(tier.tierLabel) === normalized) return true;
  return tier.matchAliases.some((alias) => normalizeLabel(alias) === normalized);
}

function inferTierFromKeywords(
  label: string,
  service: StrategyMapperService,
  tiers: ServiceTierTemplate[],
): ServiceTierTemplate | undefined {
  const normalized = normalizeLabel(label);
  const serviceTiers = getTiersForService(tiers, service);
  if (!serviceTiers.length) return undefined;

  if (normalized.includes("premium plus") || normalized.includes("premium+")) {
    return serviceTiers.reduce((best, t) => (t.tierRank > best.tierRank ? t : best));
  }
  if (normalized.includes("premium")) {
    const premiumTiers = serviceTiers.filter((t) => t.tierRank >= 2);
    return premiumTiers.sort((a, b) => a.tierRank - b.tierRank)[0] ?? serviceTiers.at(-1);
  }
  if (normalized.includes("foundation") || normalized.includes("standard") || normalized.includes("local")) {
    return serviceTiers.sort((a, b) => a.tierRank - b.tierRank)[0];
  }

  return undefined;
}

export function resolveTierKeyFromLabel(
  label: string,
  service: StrategyMapperService,
  tiers: ServiceTierTemplate[],
): string | null {
  const serviceTiers = getTiersForService(tiers, service);
  const exact = serviceTiers.find((t) => labelMatchesTier(label, t));
  if (exact) return exact.tierKey;

  const inferred = inferTierFromKeywords(label, service, tiers);
  if (inferred) return inferred.tierKey;

  return null;
}

function highestTierForService(
  service: StrategyMapperService,
  tiers: ServiceTierTemplate[],
): string | undefined {
  const serviceTiers = getTiersForService(tiers, service);
  if (!serviceTiers.length) return undefined;
  return serviceTiers.reduce((best, t) => (t.tierRank > best.tierRank ? t : best)).tierKey;
}

function entryTierForService(
  service: StrategyMapperService,
  tiers: ServiceTierTemplate[],
): string | undefined {
  const serviceTiers = getTiersForService(tiers, service);
  if (!serviceTiers.length) return undefined;
  return serviceTiers.sort((a, b) => a.tierRank - b.tierRank)[0]?.tierKey;
}

export function resolveSelectedTiers(
  form: StrategyMapperFormData,
  activeServices: StrategyMapperService[],
  tiers: ServiceTierTemplate[],
): SelectedTierMap {
  const selected: SelectedTierMap = {};
  const extract = form.salesPdfExtract;
  const labels = [
    ...(extract?.purchasedProductLabels ?? []),
    ...(extract?.ormProgramName ? [extract.ormProgramName] : []),
  ];

  for (const service of activeServices) {
    if (form.tierOverrides?.[service]) {
      selected[service] = form.tierOverrides[service];
      continue;
    }

    let matched: string | null = null;
    for (const label of labels) {
      const mappedService = mapPurchasedProductToService(label);
      if (mappedService !== service) continue;
      matched = resolveTierKeyFromLabel(label, service, tiers);
      if (matched) break;
    }

    selected[service] = matched ?? highestTierForService(service, tiers)!;
  }

  return selected;
}

export interface UpsellTierCandidate {
  tierKey: string;
  service: StrategyMapperService;
  directive?: UpsellDirective;
}

export function getUpsellTierCandidates(
  selectedTiers: SelectedTierMap,
  activeServices: StrategyMapperService[],
  allTiers: ServiceTierTemplate[],
  upsellDirectives: UpsellDirective[],
): UpsellTierCandidate[] {
  const activeSet = new Set(activeServices);
  const directiveByService = new Map(
    upsellDirectives.map((d) => [d.service, d] as const),
  );
  const candidates: UpsellTierCandidate[] = [];

  for (const directive of upsellDirectives) {
    const { service } = directive;
    if (activeSet.has(service)) {
      const selectedKey = selectedTiers[service];
      const selectedTier = selectedKey ? getTierByKey(allTiers, selectedKey) : undefined;
      const higherTiers = getTiersForService(allTiers, service).filter(
        (t) => (selectedTier ? t.tierRank > selectedTier.tierRank : false),
      );
      for (const tier of higherTiers) {
        candidates.push({ tierKey: tier.tierKey, service, directive });
      }
    } else {
      const entryKey = entryTierForService(service, allTiers);
      if (entryKey) {
        candidates.push({ tierKey: entryKey, service, directive });
      }
    }
  }

  return candidates;
}

export function resolveTierSelectionsForDisplay(
  form: StrategyMapperFormData,
  activeServices: StrategyMapperService[],
  tiers: ServiceTierTemplate[],
): Array<{ service: StrategyMapperService; tierKey: string; tierLabel: string }> {
  const selected = resolveSelectedTiers(form, activeServices, tiers);
  return activeServices.map((service) => {
    const tierKey = selected[service] ?? "";
    const tier = getTierByKey(tiers, tierKey);
    return {
      service,
      tierKey,
      tierLabel: tier?.tierLabel ?? tierKey,
    };
  });
}
