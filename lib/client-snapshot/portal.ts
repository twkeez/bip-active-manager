import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClientSnapshot, type ClientSnapshot } from "./load";

/**
 * The client portal: published snapshots and the private links that show
 * them. The portal is its own deployment (APP_MODE=client) that serves
 * nothing but /s/<token>; see lib/client-snapshot/portal-mode.ts.
 */

/** Where client links point. Set CLIENT_PORTAL_URL once the client deployment has its domain. */
export function portalBaseUrl(): string | null {
  const url = process.env.CLIENT_PORTAL_URL?.trim().replace(/\/$/, "");
  return url || null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type PublishedSnapshot = { id: number; snapshot: ClientSnapshot; published_at: string; published_by_email: string };
export type SnapshotLink = {
  id: number;
  created_at: string;
  created_by_email: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
};

function failed(context: string, error: { message: string } | null): never {
  const message = error?.message ?? "unknown error";
  if (/could not find the table|does not exist/i.test(message)) {
    throw new Error(`${context}: the snapshot tables do not exist yet. Run supabase/migrations/20261008120000_client_snapshots.sql.`);
  }
  throw new Error(`${context}: ${message}`);
}

/**
 * Freeze today's snapshot as what the client sees. Refused when any data
 * behind it was cut short: a client must never get a number we doubt.
 */
export async function publishSnapshot(admin: SupabaseClient, clientId: number, email: string): Promise<PublishedSnapshot> {
  const snapshot = await loadClientSnapshot(admin, clientId);
  if (snapshot.incomplete) {
    throw new Error("Not published: some data behind this snapshot was cut short (see Data health). Try again after it is fixed.");
  }
  const { data, error } = await admin
    .from("client_snapshot_publications")
    .insert({ client_id: clientId, snapshot, published_by_email: email })
    .select("id,snapshot,published_at,published_by_email")
    .single();
  if (error || !data) failed("Could not publish", error);
  return data as PublishedSnapshot;
}

export async function latestPublication(admin: SupabaseClient, clientId: number): Promise<PublishedSnapshot | null> {
  const { data, error } = await admin
    .from("client_snapshot_publications")
    .select("id,snapshot,published_at,published_by_email")
    .eq("client_id", clientId)
    .order("published_at", { ascending: false })
    .limit(1);
  if (error) failed("Could not read the published snapshot", error);
  return (data?.[0] as PublishedSnapshot | undefined) ?? null;
}

export async function listLinks(admin: SupabaseClient, clientId: number): Promise<SnapshotLink[]> {
  const { data, error } = await admin
    .from("client_snapshot_links")
    .select("id,created_at,created_by_email,revoked_at,last_viewed_at,view_count")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) failed("Could not read links", error);
  return (data ?? []) as SnapshotLink[];
}

/** A new private link. The token is returned once and stored only as a hash. */
export async function createLink(admin: SupabaseClient, clientId: number, email: string): Promise<{ token: string; link: SnapshotLink }> {
  const token = randomBytes(24).toString("base64url");
  const { data, error } = await admin
    .from("client_snapshot_links")
    .insert({ client_id: clientId, token_hash: hashToken(token), created_by_email: email })
    .select("id,created_at,created_by_email,revoked_at,last_viewed_at,view_count")
    .single();
  if (error || !data) failed("Could not create the link", error);
  return { token, link: data as SnapshotLink };
}

export async function revokeLink(admin: SupabaseClient, clientId: number, linkId: number): Promise<void> {
  const { data, error } = await admin
    .from("client_snapshot_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .select("id");
  if (error) failed("Could not revoke the link", error);
  if (!data?.length) throw new Error("That link was not found or is already revoked.");
}

/** What a private link shows: the client's latest published snapshot. Counts the view. */
export async function snapshotForToken(
  admin: SupabaseClient,
  token: string,
): Promise<{ status: "ok"; publication: PublishedSnapshot } | { status: "not_found" } | { status: "not_published" }> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { status: "not_found" };
  const { data: link, error } = await admin
    .from("client_snapshot_links")
    .select("id,client_id,revoked_at,view_count")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) failed("Could not check the link", error);
  if (!link || link.revoked_at) return { status: "not_found" };
  await admin
    .from("client_snapshot_links")
    .update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count ?? 0) + 1 })
    .eq("id", link.id);
  const publication = await latestPublication(admin, link.client_id);
  return publication ? { status: "ok", publication } : { status: "not_published" };
}
