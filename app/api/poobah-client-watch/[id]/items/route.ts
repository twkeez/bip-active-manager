import { asAdmin, readJson, watchIdParam } from "@/lib/poobah/api";
import { addItem } from "@/lib/poobah/store";

/** Add an open item to a watched client. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return asAdmin(async (admin, actor) => {
    const body = await readJson(request);
    return addItem(admin, watchIdParam(id), { text: body.text, owner: body.owner, due_date: body.due_date }, actor);
  }, 201);
}
