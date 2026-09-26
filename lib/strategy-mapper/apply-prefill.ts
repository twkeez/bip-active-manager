import { INITIAL_SALES_CONTEXT } from "@/lib/strategy-mapper/form-options";
import type {
  SalesPdfExtract,
  StrategyMapperFormData,
  StrategyMapperPrefillResult,
} from "@/types/strategy-mapper";

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Merge a website prefill into the form without overwriting anything a person
 * has already entered: a field is filled only while it is still empty.
 * Specializations are the exception — they are a checklist, so found ones are
 * added to any already ticked. Returns the new form and the fields it filled.
 */
export function applyPrefill(
  form: StrategyMapperFormData,
  result: Pick<StrategyMapperPrefillResult, "form" | "salesContext">,
): { form: StrategyMapperFormData; filled: string[] } {
  const next: StrategyMapperFormData = { ...form };
  const filled: string[] = [];

  for (const [key, value] of Object.entries(result.form) as [
    keyof StrategyMapperFormData,
    unknown,
  ][]) {
    if (isEmpty(value)) continue;
    if (key === "specializations" && Array.isArray(value)) {
      const merged = [...new Set([...form.specializations, ...(value as string[])])];
      if (merged.length > form.specializations.length) {
        next.specializations = merged;
        filled.push(key);
      }
      continue;
    }
    if (isEmpty(form[key])) {
      (next as unknown as Record<string, unknown>)[key] = value;
      filled.push(key);
    }
  }

  const sales: SalesPdfExtract = { ...(form.salesPdfExtract ?? INITIAL_SALES_CONTEXT) };
  let salesChanged = false;
  for (const [key, value] of Object.entries(result.salesContext) as [
    keyof SalesPdfExtract,
    unknown,
  ][]) {
    if (key === "clientRunsOwnAds") {
      // Only ever switch it on: the site shows a live ads tag, its absence proves nothing.
      if (value === true && !sales.clientRunsOwnAds) {
        sales.clientRunsOwnAds = true;
        salesChanged = true;
        filled.push(`sales.${key}`);
      }
      continue;
    }
    if (isEmpty(value) || !isEmpty(sales[key])) continue;
    (sales as unknown as Record<string, unknown>)[key] = value;
    salesChanged = true;
    filled.push(`sales.${key}`);
  }
  if (salesChanged) next.salesPdfExtract = sales;

  return { form: next, filled };
}
