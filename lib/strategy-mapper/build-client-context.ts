import { resolveActiveServices, resolveSiteContext } from "@/lib/strategy-mapper/form-options";
import { getUnselectedServices } from "@/lib/strategy-mapper/upsell-rules";
import { calculateDualRadius, dualRadiusFromResearch } from "@/lib/strategy-mapper/radius";
import type { ClientContext } from "@/types/client-context";
import type {
  StrategyMapperFormData,
  StrategyMapperResearch,
} from "@/types/strategy-mapper";

export function buildClientContext(
  form: StrategyMapperFormData,
  research?: StrategyMapperResearch,
): ClientContext {
  const activePhase1Services = resolveActiveServices(
    form.activeServices ?? [],
    form.salesPdfExtract?.purchasedServices,
  );
  const radius = research ? dualRadiusFromResearch(research) : calculateDualRadius(form);

  return {
    form,
    extract: form.salesPdfExtract,
    research,
    radius,
    activePhase1Services,
    unselectedPhase2Upsells: getUnselectedServices(activePhase1Services),
    siteContext: resolveSiteContext(form),
  };
}
