import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchContentBlocks } from "@/lib/strategy-mapper/content-library";
import {
  normalizeWebsiteUrl,
  resolveActiveServices,
  websiteUrlRequiredForSiteContext,
} from "@/lib/strategy-mapper/form-options";
import { runStrategyMapperWebsiteAudit } from "@/lib/strategy-mapper/website-seo-audit";
import type { StrategyMapperWebsiteAuditRequest } from "@/types/strategy-mapper";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StrategyMapperWebsiteAuditRequest;
  try {
    body = (await request.json()) as StrategyMapperWebsiteAuditRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { form, research, radius, activeServices } = body;
  if (!form?.practiceName?.trim()) {
    return NextResponse.json({ error: "Practice name is required" }, { status: 400 });
  }
  if (!research) {
    return NextResponse.json({ error: "Research payload is required" }, { status: 400 });
  }
  if (!radius) {
    return NextResponse.json({ error: "Radius payload is required" }, { status: 400 });
  }

  const siteContext = form.siteContext ?? "existing_active";
  const normalizedUrl = normalizeWebsiteUrl(form.websiteUrl ?? "");
  if (websiteUrlRequiredForSiteContext(siteContext) && !normalizedUrl) {
    return NextResponse.json(
      { error: "Website URL is required for this site context." },
      { status: 400 },
    );
  }

  const services = activeServices?.length
    ? activeServices
    : resolveActiveServices(form.activeServices ?? []);

  try {
    const contentBlocks = await fetchContentBlocks(supabase);
    const audit = await runStrategyMapperWebsiteAudit({
      form: { ...form, websiteUrl: normalizedUrl || form.websiteUrl },
      research,
      radius,
      activeServices: services,
      contentBlocks,
    });
    return NextResponse.json(audit);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run website SEO audit",
      },
      { status: 500 },
    );
  }
}
