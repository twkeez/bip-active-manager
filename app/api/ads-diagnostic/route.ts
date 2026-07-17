import { NextResponse } from "next/server";
import { diagnoseAccount } from "@/lib/ads/account-diagnostic";
import { fetchAccountDiagnostic } from "@/lib/ads/account-diagnostic-fetch";
import { isSyncableAdsCustomerId, normalizeCustomerId } from "@/lib/ads/customer-id";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { customerId?: string };
  try {
    body = (await request.json()) as { customerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const customerId = normalizeCustomerId(body.customerId ?? "");
  if (!isSyncableAdsCustomerId(customerId)) {
    return NextResponse.json({ error: "Enter a valid 10-digit Google Ads customer ID." }, { status: 400 });
  }

  try {
    const raw = await fetchAccountDiagnostic(customerId);
    const diagnostic = diagnoseAccount(raw);

    // Pull the curated playbook entries for the issues these findings raise, so
    // the fix guidance comes from Best Practices (editable) rather than code.
    const issueKeys = [...new Set(diagnostic.findings.map((f) => f.issueKey).filter((k): k is string => !!k))];
    const playbook: Record<string, { label: string; content: string }> = {};
    if (issueKeys.length > 0) {
      const { data: rows } = await supabase
        .from("best_practices")
        .select("key, label, content")
        .in("key", issueKeys);
      for (const row of (rows ?? []) as { key: string; label: string; content: string | null }[]) {
        if (row.content) playbook[row.key] = { label: row.label, content: row.content };
      }
    }

    return NextResponse.json({ diagnostic, playbook });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Diagnosis failed" },
      { status: 502 },
    );
  }
}
