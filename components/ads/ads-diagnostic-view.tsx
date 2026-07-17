"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Check, Copy, ExternalLink, Loader2, Search, Sparkles, Stethoscope, TrendingUp } from "lucide-react";
import type { AccountDiagnostic, Finding } from "@/lib/ads/account-diagnostic";
import { RSA_DESCRIPTION_MAX, RSA_HEADLINE_MAX, type RsaDraft } from "@/lib/ads/draft-rsa";

type ClientOption = { name: string; customerId: string };

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pctOrDash = (n: number | null) => (n == null ? "—" : `${n}%`);

const SEV: Record<Finding["severity"], { ring: string; text: string; label: string }> = {
  critical: { ring: "border-red-500/40 bg-red-500/5", text: "text-red-300", label: "Critical" },
  warning: { ring: "border-amber-500/40 bg-amber-500/5", text: "text-amber-300", label: "Warning" },
  opportunity: { ring: "border-sky-500/40 bg-sky-500/5", text: "text-sky-300", label: "Opportunity" },
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

export default function AdsDiagnosticView({ clients }: { clients: ClientOption[] }) {
  const [customerId, setCustomerId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountDiagnostic | null>(null);
  const [playbook, setPlaybook] = useState<Record<string, { label: string; content: string }>>({});

  async function run(id: string) {
    const cid = id.trim();
    if (!cid) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ads-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: cid }),
      });
      const payload = (await res.json()) as {
        diagnostic?: AccountDiagnostic;
        playbook?: Record<string, { label: string; content: string }>;
        error?: string;
      };
      if (!res.ok || !payload.diagnostic) throw new Error(payload.error ?? "Diagnosis failed");
      setResult(payload.diagnostic);
      setPlaybook(payload.playbook ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnosis failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-bip-text">
          <Stethoscope className="h-5 w-5 text-bip-accent" /> Ads Diagnostic
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-bip-muted">
          Diagnose a Google Ads account on the metrics that move the needle — top-of-page presence and the
          budget-vs-rank split behind it — then get the specific changes to make. Trailing 30 days.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-bip-border bg-bip-card p-4">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              setCustomerId(e.target.value);
              void run(e.target.value);
            }
          }}
          className="rounded-md bip-input text-sm shadow-none"
        >
          <option value="">Pick a client…</option>
          {clients.map((c) => (
            <option key={c.customerId} value={c.customerId}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-bip-muted">or</span>
        <input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Customer ID (123-456-7890)"
          className="min-w-[190px] rounded-md bip-input text-sm shadow-none"
        />
        <button
          type="button"
          disabled={running || !customerId.trim()}
          onClick={() => void run(customerId)}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {running ? "Diagnosing…" : "Run diagnosis"}
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="space-y-6">
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Spend (30d)" value={usd(result.totals.cost)} sub={`prev ${usd(result.totals.prevCost)}`} />
            <Stat label="Conversions" value={String(result.totals.conv)} sub={`prev ${result.totals.prevConv}`} />
            <Stat label="Cost / conv" value={result.totals.cpa == null ? "—" : usd(result.totals.cpa)} sub={null} />
            <Stat label="Findings" value={String(result.findings.length)} sub={null} />
          </div>

          {/* Tracking gate */}
          {result.tracking.severity !== "ok" && (
            <div className={`rounded-xl border p-4 ${result.tracking.severity === "critical" ? "border-red-500/40 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
              <p className={`flex items-center gap-1.5 text-sm font-semibold ${result.tracking.severity === "critical" ? "text-red-300" : "text-amber-300"}`}>
                <AlertTriangle className="h-4 w-4" /> Conversion tracking
              </p>
              <p className="mt-1 text-sm text-bip-muted">{result.tracking.note}</p>
            </div>
          )}

          {/* Findings */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-bip-text">What to fix, most impactful first</h2>
            <div className="space-y-2">
              {result.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  customerId={result.customerId}
                  entry={f.issueKey ? playbook[f.issueKey] : undefined}
                />
              ))}
              {result.findings.length === 0 && (
                <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">
                  No threshold-level issues found — the account looks healthy on visibility, waste, and prominence.
                </p>
              )}
            </div>
          </section>

          {/* Prominence spine */}
          {result.spine.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-bip-text">Top-of-page spine (Search campaigns)</h2>
              <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
                      <th className="px-4 py-2 font-medium">Campaign</th>
                      <th className="px-4 py-2 text-right font-medium">Spend</th>
                      <th className="px-4 py-2 text-right font-medium">CPA</th>
                      <th className="px-4 py-2 text-right font-medium">Abs-top IS</th>
                      <th className="px-4 py-2 text-right font-medium">Lost: budget</th>
                      <th className="px-4 py-2 text-right font-medium">Lost: rank</th>
                      <th className="px-4 py-2 font-medium">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.spine.map((r) => (
                      <tr key={r.campaign} className="border-b border-bip-border last:border-b-0">
                        <td className="max-w-[220px] truncate px-4 py-2 text-bip-text">{r.campaign}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-bip-muted">{usd(r.cost)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-bip-muted">{r.cpa == null ? "—" : usd(r.cpa)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-bip-text">{pctOrDash(r.absTopIS)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-bip-muted">{pctOrDash(r.lostBudget)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-bip-muted">{pctOrDash(r.lostRank)}</td>
                        <td className="px-4 py-2 text-xs text-bip-muted">{r.verdict}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Drafts */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-bip-text">Drafted changes</h2>

            {result.drafts.negatives.length > 0 && (
              <div className="rounded-xl border border-bip-border bg-bip-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-bip-text">
                    Negative keywords ({result.drafts.negatives.length}) · {usd(result.drafts.wastedSpend)} wasted
                  </p>
                  <CopyButton text={result.drafts.negatives.map((n) => n.term).join("\n")} label="Copy list" />
                </div>
                <p className="mt-1 text-[11px] text-bip-muted">Add as exact-match negatives. Terms that spent with zero conversions.</p>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-bip-border bg-bip-fill p-2 font-mono text-xs text-bip-muted">
                  {result.drafts.negatives.map((n) => (
                    <div key={n.term} className="flex justify-between gap-3">
                      <span className="truncate text-bip-text">{n.term}</span>
                      <span className="shrink-0">{usd(n.cost)} · {n.clicks} clk</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.drafts.budgetMoves.length > 0 && (
              <div className="rounded-xl border border-bip-border bg-bip-card p-4">
                <p className="mb-2 text-sm font-medium text-bip-text">Budget moves</p>
                <div className="space-y-2">
                  {result.drafts.budgetMoves.map((m) => (
                    <div key={m.campaign} className="text-sm">
                      <span className="text-bip-text">{m.campaign}</span>{" "}
                      <span className="tabular-nums text-bip-muted">{usd(m.currentBudget)}/day →</span>{" "}
                      <span className="font-medium tabular-nums text-emerald-400">{usd(m.suggestedBudget)}/day</span>
                      <p className="text-[11px] text-bip-muted">{m.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.drafts.bidMoves.length > 0 && (
              <div className="rounded-xl border border-bip-border bg-bip-card p-4">
                <p className="mb-2 text-sm font-medium text-bip-text">Bid / rank moves</p>
                <div className="space-y-2">
                  {result.drafts.bidMoves.map((m) => (
                    <div key={m.campaign} className="text-sm">
                      <span className="text-bip-text">{m.campaign}</span>{" "}
                      <span className="text-[11px] text-bip-muted">({m.issue})</span>
                      <p className="text-bip-muted">{m.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.drafts.deviceMoves.length > 0 && (
              <div className="rounded-xl border border-bip-border bg-bip-card p-4">
                <p className="mb-2 text-sm font-medium text-bip-text">Device bid adjustments</p>
                <div className="space-y-1.5">
                  {result.drafts.deviceMoves.map((m) => (
                    <div key={m.device} className="text-sm">
                      <span className="text-bip-text">{m.device}</span>{" "}
                      <span className="text-[11px] text-bip-muted">— {m.detail}.</span>{" "}
                      <span className="text-bip-muted">{m.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// Pull the numbered items under a "HOW TO FIX" header out of a playbook entry.
// Falls back to [] if the strategist reformatted the entry (view shows the raw
// content instead, so nothing is ever lost).
function extractFixSteps(content: string): string[] {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => /how to fix/i.test(l));
  if (start === -1) return [];
  const steps: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (steps.length) break;
      continue;
    }
    if (/^[A-Z][A-Z0-9 /&]+$/.test(line) && line.length < 40) break; // next section header
    steps.push(line.replace(/^\d+[.)]\s*/, ""));
  }
  return steps;
}

function FindingCard({
  finding,
  customerId,
  entry,
}: {
  finding: Finding;
  customerId: string;
  entry?: { label: string; content: string };
}) {
  const f = finding;
  const [draft, setDraft] = useState<RsaDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState<string | null>(null);

  async function draftAds() {
    if (!f.fix?.draft) return;
    setDrafting(true);
    setDraftErr(null);
    try {
      const res = await fetch("/api/ads-diagnostic/draft-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, campaign: f.fix.draft.campaign, keywords: f.fix.draft.keywords, weakInput: f.fix.weakInput }),
      });
      const payload = (await res.json()) as { draft?: RsaDraft; error?: string };
      if (!res.ok || !payload.draft) throw new Error(payload.error ?? "Draft failed");
      setDraft(payload.draft);
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  const playbookSteps = entry ? extractFixSteps(entry.content) : [];
  const fallbackSteps = f.fix?.steps ?? [];
  const showBox = !!f.fix || !!entry;

  return (
    <div className={`rounded-xl border p-4 ${SEV[f.severity].ring}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-bip-text">{f.title}</p>
        <span className={`shrink-0 text-[11px] font-medium ${SEV[f.severity].text}`}>{f.impactLabel ?? SEV[f.severity].label}</span>
      </div>
      <p className="mt-1 text-sm text-bip-muted">{f.why}</p>
      <p className="mt-1.5 text-[11px] text-bip-muted">{f.evidence}</p>

      {showBox ? (
        <div className="mt-3 rounded-lg border border-bip-border bg-bip-fill/40 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">How to fix it</p>

          {f.fix?.headline && (
            <p className="mb-2 flex items-start gap-1.5 text-sm font-medium text-bip-text">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bip-accent" /> {f.fix.headline}
            </p>
          )}

          {entry && playbookSteps.length > 0 ? (
            <ol className="space-y-1">
              {playbookSteps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-bip-text">
                  <span className="text-bip-muted">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          ) : entry ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-bip-text">{entry.content}</p>
          ) : (
            <ol className="space-y-1">
              {fallbackSteps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-bip-text">
                  <span className="text-bip-muted">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}

          {f.fix && f.fix.culprits.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-bip-muted">Worst offenders:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {f.fix.culprits.map((c) => (
                  <span key={c.kw} className="inline-flex items-center gap-1 rounded-md bg-bip-card px-2 py-0.5 text-[11px] text-bip-text">
                    {c.kw} <span className="text-bip-muted">{usd(c.cost)}{c.note ? ` · ${c.note}` : ""}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {f.fix?.deepLink && (
              <a
                href={f.fix.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2.5 py-1 text-xs text-bip-text hover:bg-bip-fill"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open {f.fix.deepLinkLabel ?? "in Google Ads"}
              </a>
            )}
            {f.fix?.draft && (
              <button
                type="button"
                disabled={drafting}
                onClick={() => void draftAds()}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {drafting ? "Drafting…" : draft ? "Re-draft ad copy" : "Draft ad copy"}
              </button>
            )}
            {entry && (
              <a
                href={`/best-practices?q=${encodeURIComponent(entry.label)}`}
                className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2.5 py-1 text-xs text-bip-muted hover:bg-bip-fill hover:text-bip-text"
              >
                <BookOpen className="h-3.5 w-3.5" /> Playbook: {entry.label}
              </a>
            )}
          </div>
          {draftErr && <p className="mt-2 text-xs text-red-300">{draftErr}</p>}
          {draft && (
            <div className="mt-3 space-y-2 rounded-md border border-bip-border bg-bip-card p-2.5">
              <RsaList title={`Headlines (≤${RSA_HEADLINE_MAX} chars)`} items={draft.headlines} />
              <RsaList title={`Descriptions (≤${RSA_DESCRIPTION_MAX} chars)`} items={draft.descriptions} />
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-bip-text">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bip-accent" /> {f.action}
        </p>
      )}
    </div>
  );
}

function RsaList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">{title}</p>
        <CopyButton text={items.join("\n")} label="Copy" />
      </div>
      <div className="space-y-0.5">
        {items.map((s) => (
          <div key={s} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-bip-text">{s}</span>
            <span className="shrink-0 tabular-nums text-bip-muted">{s.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string | null }) {
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
      <p className="text-2xl font-semibold text-bip-text">{value}</p>
      <p className="text-xs text-bip-muted">{label}{sub ? ` · ${sub}` : ""}</p>
    </div>
  );
}
