import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectSitemapEntries } from "@/lib/site-audit/sitemap";
import type { SitemapSnapshot, SitemapUrlRow } from "@/lib/types/client";

type SyncRequestBody = {
  clientId?: number;
};

type ParsedUrlEntry = {
  loc: string;
  lastmod: string | null;
};

function normalizeWebsite(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function toIso(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function fetchLastModified(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "BIPActiveManagerBot/1.0 (+sitemap-sync)",
      },
    });
    const value = response.headers.get("last-modified");
    return toIso(value);
  } catch {
    return null;
  }
}

async function collectSitemapEntriesLocal(sitemapUrl: string) {
  return collectSitemapEntries(sitemapUrl);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id,website")
    .eq("id", clientId)
    .single<{ id: number; website: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  const baseWebsite = normalizeWebsite(clientRow.website ?? "");
  if (!baseWebsite) {
    return NextResponse.json(
      { error: "Client website is required before sitemap sync." },
      { status: 400 },
    );
  }
  const sitemapUrl = `${baseWebsite.replace(/\/$/, "")}/sitemap.xml`;

  try {
    const entries = await collectSitemapEntriesLocal(sitemapUrl);
    const withLastmodCount = entries.filter((entry) => entry.lastmod != null).length;
    const missingLastmod = entries.filter((entry) => entry.lastmod == null).slice(0, 30);
    const headChecks = await Promise.all(
      missingLastmod.map((entry) => fetchLastModified(entry.loc)),
    );
    const headByLoc = new Map<string, string | null>();
    missingLastmod.forEach((entry, index) => {
      headByLoc.set(entry.loc, headChecks[index] ?? null);
    });

    const now = Date.now();
    const staleCutoff = now - 90 * 24 * 60 * 60 * 1000;
    const urlRows = entries.map((entry) => {
      const httpLastModified = entry.lastmod == null ? headByLoc.get(entry.loc) ?? null : null;
      const effectiveUpdatedAt = entry.lastmod ?? httpLastModified;
      const stale = effectiveUpdatedAt
        ? new Date(effectiveUpdatedAt).getTime() < staleCutoff
        : false;
      return {
        loc: entry.loc,
        lastmod: entry.lastmod,
        http_last_modified: httpLastModified,
        effective_updated_at: effectiveUpdatedAt,
        is_stale_90: stale,
      };
    });
    const latestLastmod = urlRows
      .map((row) => row.effective_updated_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
    const staleCount = urlRows.filter((row) => row.is_stale_90).length;

    const { data: snapshot, error: snapshotError } = await admin
      .from("client_sitemap_snapshots")
      .insert({
        client_id: clientId,
        sitemap_url: sitemapUrl,
        fetched_at: new Date().toISOString(),
        run_status: "completed",
        error_message: null,
        url_count: urlRows.length,
        with_lastmod_count: withLastmodCount,
        latest_lastmod: latestLastmod,
        stale_90_count: staleCount,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single<SitemapSnapshot>();
    if (snapshotError || !snapshot) {
      throw new Error(snapshotError?.message ?? "Failed to store sitemap snapshot");
    }

    if (urlRows.length > 0) {
      const payload = urlRows.map((row) => ({
        client_id: clientId,
        snapshot_id: snapshot.id,
        ...row,
      }));
      const { error: rowsError } = await admin
        .from("client_sitemap_urls")
        .insert(payload);
      if (rowsError) {
        throw new Error(rowsError.message);
      }
    }

    const { data: rows } = await admin
      .from("client_sitemap_urls")
      .select("*")
      .eq("snapshot_id", snapshot.id)
      .order("effective_updated_at", { ascending: true })
      .limit(30)
      .returns<SitemapUrlRow[]>();

    return NextResponse.json({ ok: true, snapshot, urls: rows ?? [] });
  } catch (error) {
    await admin.from("client_sitemap_snapshots").insert({
      client_id: clientId,
      sitemap_url: sitemapUrl,
      fetched_at: new Date().toISOString(),
      run_status: "failed",
      error_message: error instanceof Error ? error.message : "Sitemap sync failed",
      url_count: 0,
      with_lastmod_count: 0,
      latest_lastmod: null,
      stale_90_count: 0,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sitemap sync failed" },
      { status: 500 },
    );
  }
}
