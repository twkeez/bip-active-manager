import type {
  DualRadiusResult,
  SalesPdfExtract,
  SiteContext,
  StrategyMapperFormData,
  StrategyMapperResearch,
  StrategyMapperService,
} from "@/types/strategy-mapper";

export interface ClientContext {
  form: StrategyMapperFormData;
  extract?: SalesPdfExtract;
  research?: StrategyMapperResearch;
  radius: DualRadiusResult;
  activePhase1Services: StrategyMapperService[];
  unselectedPhase2Upsells: StrategyMapperService[];
  siteContext: SiteContext;
}
