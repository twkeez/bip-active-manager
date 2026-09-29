import { asAdmin, readJson, watchIdParam } from "@/lib/poobah/api";
import { addLogEntry } from "@/lib/poobah/store";

/** Add a dated entry to a watched client's running log. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return asAdmin(async (admin, actor) => {
    const body = await readJson(request);
    return addLogEntry(admin, watchIdParam(id), { date: body.date, text: body.text, source: body.source }, actor);
  }, 201);
}
