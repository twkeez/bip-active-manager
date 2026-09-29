import { asAdmin, readJson } from "@/lib/poobah/api";
import { addWatch, listWatches } from "@/lib/poobah/store";

/** Poobah Client Watch: the watch list, and adding a client to it (admins). */
export async function GET() {
  return asAdmin((admin) => listWatches(admin));
}

export async function POST(request: Request) {
  return asAdmin(async (admin, actor) => {
    const body = await readJson(request);
    return addWatch(
      admin,
      { client: body.client, status: body.status, basics: body.basics, allowUnlinked: body.allowUnlinked === true },
      actor,
    );
  }, 201);
}
