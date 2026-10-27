import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { ToolPage } from "@/components/ui/tool-page";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { loadSpend, type SpendSummary } from "@/lib/ai/spend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const usd = (n: number) => (n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/**
 * What BIP Control's AI features cost, by feature, from every recorded Claude
 * call (lib/ai/usage.ts). Admins only.
 */
export default async function AiSpendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");

  let spend: SpendSummary | null = null;
  let error: string | null = null;
  try {
    spend = await loadSpend(createAdminClient());
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Could not read AI usage.";
  }

  const monthName = new Date().toLocaleString("en-US", { month: "long" });
  const maxDay = Math.max(0.01, ...(spend?.byDay.map((d) => d.cost) ?? [0]));

  return (
    <ToolPage
      title="AI Spend"
      icon={Coins}
      description="What each AI feature costs, from every Claude call BIP Control makes. Estimated from Anthropic's list prices; the Anthropic Console bill is the final word."
    >
      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          AI usage couldn&apos;t be read: {error}
        </p>
      )}
      {spend && (
        <>
          <StatTiles>
            <StatTile label={`${monthName} so far`} value={usd(spend.monthTotal)} />
            <StatTile label="AI calls this month" value={String(spend.monthCalls)} />
            <StatTile label="Features used" value={String(spend.byFeature.length)} />
          </StatTiles>

          <section className="rounded-xl border border-bip-border bg-bip-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-bip-text">Last 14 days</h2>
            <div className="flex h-28 items-end gap-1.5">
              {spend.byDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${usd(d.cost)}`}>
                  <div className="w-full rounded-t bg-bip-accent/70" style={{ height: `${Math.max(2, (d.cost / maxDay) * 96)}px` }} />
                  <span className="text-[9px] text-bip-muted">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
                  <th className="px-4 py-2">Feature</th>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2 text-right">Calls</th>
                  <th className="px-4 py-2 text-right">Tokens in / out</th>
                  <th className="px-4 py-2 text-right">Web searches</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {spend.byFeature.map((f) => (
                  <tr key={f.feature} className="border-b border-bip-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium text-bip-text">{f.feature}</td>
                    <td className="px-4 py-2 text-xs text-bip-muted">{f.models.join(", ")}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{f.calls}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-bip-muted">
                      {tokens(f.inputTokens)} / {tokens(f.outputTokens)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-bip-muted">{f.webSearches || "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{usd(f.cost)}</td>
                  </tr>
                ))}
                {spend.byFeature.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-bip-muted">
                      No AI calls recorded this month yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <p className="text-xs text-bip-muted">
            Recording started {spend.firstRecordedAt ? new Date(spend.firstRecordedAt).toLocaleDateString() : "October 27, 2026"}; calls
            before that aren&apos;t included.
          </p>
        </>
      )}
    </ToolPage>
  );
}
