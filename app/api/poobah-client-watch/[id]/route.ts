import { asAdmin, readJson, watchIdParam } from "@/lib/poobah/api";
import { getWatch, setBasics, setStatus } from "@/lib/poobah/store";
import { PoobahError } from "@/lib/poobah/validate";

type Context = { params: Promise<{ id: string }> };

/** One watched client, everything about it. */
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return asAdmin((admin) => getWatch(admin, watchIdParam(id)));
}

/** A new status (the old one stays as history), or new account basics. */
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return asAdmin(async (admin, actor) => {
    const watchId = watchIdParam(id);
    const body = await readJson(request);
    if ("status" in body) return setStatus(admin, watchId, body.status, actor);
    if ("basics" in body) return setBasics(admin, watchId, body.basics, actor);
    throw new PoobahError("Send status or basics.");
  });
}
