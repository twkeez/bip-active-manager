import { asAdmin, readJson } from "@/lib/poobah/api";
import { updateItem } from "@/lib/poobah/store";

/** Change an open item's text, owner, due date, or done state. Nothing is deleted. */
export async function PATCH(request: Request, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  return asAdmin(async (admin, actor) => updateItem(admin, itemId, await readJson(request), actor));
}
