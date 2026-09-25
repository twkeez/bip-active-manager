// The fields that make up a client's plan: which services they buy and at
// what tier. Changing them is admin-only, and removing a service mid-onboarding
// deletes that service's onboarding items, so the client PATCH checks them.
export const PLAN_FIELDS = ["seo", "ppc", "smm", "blog", "orm", "tier"] as const;

type PlanValue = string | number | boolean | null | undefined;

function same(a: PlanValue, b: PlanValue): boolean {
  const norm = (v: PlanValue) => (v == null ? "" : String(v).trim());
  return norm(a) === norm(b);
}

/**
 * The plan fields a patch would actually change. Forms that resend a field
 * with its current value do not count as changing it.
 */
export function changedPlanFields(
  patch: Record<string, PlanValue>,
  current: Record<string, PlanValue>,
): string[] {
  return PLAN_FIELDS.filter(
    (key) => Object.prototype.hasOwnProperty.call(patch, key) && !same(patch[key], current[key]),
  );
}
