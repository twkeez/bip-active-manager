import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { getRecipients, recentSends, sendSnapshotEmail, setRecipients } from "@/lib/client-snapshot/email";
import { createLink, latestPublication, listLinks, portalBaseUrl, publishSnapshot, revokeLink } from "@/lib/client-snapshot/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ clientId: string }> };

async function asAdmin(context: Context, work: (clientId: number, email: string, userId: string) => Promise<unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const clientId = Number((await context.params).clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) return NextResponse.json({ ok: false, error: "Invalid client." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...((await work(clientId, user.email, user.id)) as object) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}

/** The client's published snapshot and private links (admins). */
export async function GET(_request: Request, context: Context) {
  return asAdmin(context, async (clientId) => {
    const admin = createAdminClient();
    const [publication, links, recipients, sends] = await Promise.all([
      latestPublication(admin, clientId),
      listLinks(admin, clientId),
      getRecipients(admin, clientId),
      recentSends(admin, clientId),
    ]);
    return {
      published_at: publication?.published_at ?? null,
      published_by: publication?.published_by_email ?? null,
      links,
      portal_url: portalBaseUrl(),
      recipients,
      sends,
    };
  });
}

/** publish | create_link | revoke_link | set_recipients | send_email */
export async function POST(request: Request, context: Context) {
  const body = (await request.json().catch(() => ({}))) as { action?: string; linkId?: number; recipients?: string };
  return asAdmin(context, async (clientId, email, userId) => {
    const admin = createAdminClient();
    if (body.action === "publish") {
      const publication = await publishSnapshot(admin, clientId, email);
      return { published_at: publication.published_at };
    }
    if (body.action === "create_link") {
      const { token, link } = await createLink(admin, clientId, email);
      const base = portalBaseUrl();
      return { link, url: base ? `${base}/s/${token}` : null, path: `/s/${token}` };
    }
    if (body.action === "set_recipients") {
      return { recipients: await setRecipients(admin, clientId, String(body.recipients ?? ""), email) };
    }
    if (body.action === "send_email") {
      const sent = await sendSnapshotEmail(admin, clientId, { userId, email });
      return { sent_to: sent.recipients };
    }
    if (body.action === "revoke_link") {
      await revokeLink(admin, clientId, Number(body.linkId));
      return {};
    }
    throw new Error("Unknown action.");
  });
}
