import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGooglePageSpeedApiKey } from "@/lib/env";
import type { LighthouseAuditItem, LighthouseSnapshot } from "@/lib/types/client";

type LighthouseRequestBody = {
  clientId?: number;
};

type PsiCategoryScore = {
  score?: number | null;
};

type PsiAudit = {
  id?: string;
  title?: string;
  description?: string;
  displayValue?: string;
  numericValue?: number;
  score?: number | null;
  details?: {
    type?: string;
    items?: Array<{
      node?: {
        snippet?: string;
        selector?: string;
        explanation?: string;
      };
      href?: string;
      text?: string;
      url?: string;
      source?: string;
      value?: string | number;
      totalBytes?: number;
      wastedBytes?: number;
      wastedMs?: number;
    }>;
  };
};

function normalizeTargetUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function buildOccurrenceKey(
  auditId: string,
  values: Array<string | null | undefined>,
) {
  return `${auditId}::${values.map((value) => (value ?? "").trim()).join("::")}`;
}

const SEO_BLOCKER_AUDIT_IDS = [
  "document-title",
  "meta-description",
  "http-status-code",
  "is-crawlable",
  "robots-txt",
  "canonical",
  "hreflang",
  "link-text",
  "image-alt",
  "structured-data",
];

const HELPDESK_AUDIT_IDS = [
  "http-status-code",
  "is-crawlable",
  "robots-txt",
  "image-alt",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
];

const RED_TRIANGLE_STYLE_AUDIT_IDS = [
  "uses-long-cache-ttl",
  "uses-optimized-images",
  "modern-image-formats",
  "uses-responsive-images",
  "render-blocking-resources",
  "forced-reflow",
  "unused-javascript",
  "unminified-javascript",
  "unminified-css",
  "uses-text-compression",
  "server-response-time",
];

const CRITICAL_HELPDESK_AUDIT_IDS = new Set([
  "http-status-code",
  "is-crawlable",
  "robots-txt",
  "image-alt",
  "uses-long-cache-ttl",
  "uses-optimized-images",
  "render-blocking-resources",
  "forced-reflow",
]);

function isFailedAudit(audit: PsiAudit | undefined) {
  if (!audit) return false;
  const score = typeof audit.score === "number" ? audit.score : null;
  return score == null || score < 1;
}

function toAuditItem(
  id: string,
  audit: PsiAudit | undefined,
  severity: "critical" | "watch",
): LighthouseAuditItem | null {
  if (!audit) return null;
  const score = typeof audit.score === "number" ? audit.score : null;
  const failed = score == null || score < 1;
  if (!failed) return null;
  const detailsType = audit.details?.type ?? "none";
  const occurrences =
    audit.details?.items
      ?.map((item) => {
        const node = item.node;
        if (node && (node.snippet || node.selector || node.explanation)) {
          const snippet = node.snippet ?? null;
          const selector = node.selector ?? null;
          const explanation = node.explanation ?? null;
          return {
            occurrence_key: buildOccurrenceKey(id, [selector, snippet, explanation]),
            source_type: "node" as const,
            snippet,
            selector,
            explanation,
            location: selector,
            offending_value: snippet,
          };
        }

        // Table-style audits (for example link-text) generally return href/text.
        if (detailsType === "table") {
          const location = item.href ?? item.url ?? item.source ?? null;
          const offendingValue =
            item.text ??
            (typeof item.value === "string" || typeof item.value === "number"
              ? String(item.value)
              : null);
          if (!location && !offendingValue) return null;
          return {
            occurrence_key: buildOccurrenceKey(id, [location, offendingValue]),
            source_type: "table" as const,
            snippet: null,
            selector: null,
            explanation: null,
            location,
            offending_value: offendingValue,
          };
        }

        // Opportunity audits can point to URLs/resources + wasted metrics.
        if (detailsType === "opportunity") {
          const location = item.url ?? item.href ?? item.source ?? null;
          const offenders: string[] = [];
          if (typeof item.wastedMs === "number") offenders.push(`wastedMs=${item.wastedMs}`);
          if (typeof item.wastedBytes === "number")
            offenders.push(`wastedBytes=${item.wastedBytes}`);
          if (typeof item.totalBytes === "number") offenders.push(`totalBytes=${item.totalBytes}`);
          const offendingValue = offenders.length > 0 ? offenders.join(", ") : null;
          if (!location && !offendingValue) return null;
          return {
            occurrence_key: buildOccurrenceKey(id, [location, offendingValue]),
            source_type: "opportunity" as const,
            snippet: null,
            selector: null,
            explanation: null,
            location,
            offending_value: offendingValue,
          };
        }

        // Unknown shape fallback.
        const location = item.url ?? item.href ?? item.source ?? null;
        const offendingValue =
          typeof item.value === "string" || typeof item.value === "number"
            ? String(item.value)
            : null;
        if (!location && !offendingValue) return null;
        return {
          occurrence_key: buildOccurrenceKey(id, [location, offendingValue]),
          source_type: "unknown" as const,
          snippet: null,
          selector: null,
          explanation: null,
          location,
          offending_value: offendingValue,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .slice(0, 12) ?? [];
  return {
    id,
    title: audit.title ?? id,
    description: audit.description ?? null,
    score,
    display_value: audit.displayValue ?? null,
    severity,
    occurrences,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: LighthouseRequestBody;
  try {
    body = (await request.json()) as LighthouseRequestBody;
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
  const target = normalizeTargetUrl(clientRow.website ?? "");
  if (!target) {
    return NextResponse.json(
      { error: "Client website is required before running Lighthouse." },
      { status: 400 },
    );
  }

  const apiKey = getGooglePageSpeedApiKey();
  const psiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  psiUrl.searchParams.set("url", target);
  psiUrl.searchParams.set("strategy", "mobile");
  psiUrl.searchParams.set("key", apiKey);
  psiUrl.searchParams.append("category", "performance");
  psiUrl.searchParams.append("category", "seo");
  psiUrl.searchParams.append("category", "accessibility");
  psiUrl.searchParams.append("category", "best-practices");

  const response = await fetch(psiUrl.toString(), { cache: "no-store" });
  if (!response.ok) {
    const bodyText = await response.text();
    return NextResponse.json(
      { error: `PageSpeed request failed (${response.status}): ${bodyText}` },
      { status: 502 },
    );
  }

  const json = (await response.json()) as {
    lighthouseResult?: {
      categories?: Record<string, PsiCategoryScore>;
      audits?: Record<string, PsiAudit>;
      fetchTime?: string;
    };
  };
  const categories = json.lighthouseResult?.categories ?? {};
  const audits = json.lighthouseResult?.audits ?? {};
  const toScore = (value: number | null | undefined) =>
    typeof value === "number" ? Math.round(value * 100) : null;
  const seoBlockers = SEO_BLOCKER_AUDIT_IDS
    .map((id) => toAuditItem(id, audits[id], "critical"))
    .filter((item): item is LighthouseAuditItem => item != null);
  const failedOpportunityIds = Object.entries(audits)
    .filter(([, audit]) => audit?.details?.type === "opportunity" && isFailedAudit(audit))
    .map(([id]) => id);
  const helpdeskAuditIds = Array.from(
    new Set([
      ...RED_TRIANGLE_STYLE_AUDIT_IDS,
      ...failedOpportunityIds,
      ...HELPDESK_AUDIT_IDS,
    ]),
  );
  const helpdeskItems = helpdeskAuditIds
    .map((id) =>
      toAuditItem(
        id,
        audits[id],
        CRITICAL_HELPDESK_AUDIT_IDS.has(id) ? "critical" : "watch",
      ),
    )
    .filter((item): item is LighthouseAuditItem => item != null);

  const snapshot: LighthouseSnapshot = {
    client_id: clientId,
    url: target,
    fetched_at: json.lighthouseResult?.fetchTime ?? new Date().toISOString(),
    seo_blockers: seoBlockers,
    helpdesk_items: helpdeskItems,
    scores: {
      performance: toScore(categories.performance?.score),
      seo: toScore(categories.seo?.score),
      accessibility: toScore(categories.accessibility?.score),
      bestPractices: toScore(categories["best-practices"]?.score),
    },
    metrics: {
      fcp: audits["first-contentful-paint"]?.displayValue ?? null,
      lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
      cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
      tbt: audits["total-blocking-time"]?.displayValue ?? null,
      speedIndex: audits["speed-index"]?.displayValue ?? null,
    },
    updated_at: new Date().toISOString(),
  };
  const { error: upsertError } = await admin.from("client_lighthouse_snapshots").upsert({
    client_id: snapshot.client_id,
    url: snapshot.url,
    fetched_at: snapshot.fetched_at,
    seo_blockers: snapshot.seo_blockers,
    helpdesk_items: snapshot.helpdesk_items,
    scores: snapshot.scores,
    metrics: snapshot.metrics,
    updated_at: snapshot.updated_at,
  });
  if (upsertError) {
    return NextResponse.json(
      { error: `Failed to store Lighthouse snapshot: ${upsertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, snapshot });
}
