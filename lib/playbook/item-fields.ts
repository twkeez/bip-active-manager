/**
 * The playbook_items columns an editor may set. Anything else in a request body
 * (id, created_at, a typo) is dropped rather than written.
 */
export const EDITABLE_PLAYBOOK_ITEM_FIELDS = [
  "tier_key",
  "category",
  "type",
  "title",
  "body",
  "auto_verify_key",
  "sort_order",
  "is_active",
] as const;

export function pickEditableItemFields(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const source = body as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of EDITABLE_PLAYBOOK_ITEM_FIELDS) {
    if (field in source) picked[field] = source[field];
  }
  return picked;
}
