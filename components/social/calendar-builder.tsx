"use client";

import { useMemo, useState } from "react";
import { getCampaignType } from "@/lib/social/campaign-types";
import type { FreshIdea } from "@/lib/social/idea-brainstorm";
import type { SocialIdea } from "@/lib/social/types";
import { ContentPlanEditor } from "./content-plan-editor";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type CalendarClient = {
  id: number;
  account_name: string;
};

type BoardFreshIdea = FreshIdea & { checked: boolean; saved?: boolean; custom?: boolean };

function IdeaCheckRow({
  checked,
  onToggle,
  title,
  description,
  badge,
  extra,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${checked ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`} data-theme="light">
      <button onClick={onToggle} className="flex items-start gap-3 flex-1 text-left">
        <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${checked ? "bg-gray-900 border-gray-900 text-white" : "border-gray-300 bg-white"}`}>
          {checked ? "✓" : ""}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            {badge}
          </span>
          {description && <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</span>}
        </span>
      </button>
      {extra}
    </div>
  );
}

export function CalendarBuilder({
  clients,
  bankIdeas,
  isAdminUser,
  initialClientId,
}: {
  clients: CalendarClient[];
  bankIdeas: SocialIdea[];
  isAdminUser: boolean;
  initialClientId?: number;
}) {
  const now = new Date();
  const defaultMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2; // default to next month
  const defaultYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();

  const [clientId, setClientId] = useState<number | "">(
    initialClientId != null && clients.some((c) => c.id === initialClientId) ? initialClientId : "",
  );
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  // Board state
  const [bankChecked, setBankChecked] = useState<number[]>([]);
  const [fresh, setFresh] = useState<BoardFreshIdea[]>([]);
  const [brainstorming, setBrainstorming] = useState(false);
  const [gettingMore, setGettingMore] = useState(false);
  const [customIdea, setCustomIdea] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Build state
  const [building, setBuilding] = useState(false);
  const [builtKey, setBuiltKey] = useState<string | null>(null); // `${clientId}-${month}-${year}` once built

  const client = clients.find((c) => c.id === clientId) ?? null;
  const selectedCount = bankChecked.length + fresh.filter((f) => f.checked).length;

  const bankByType = useMemo(() => {
    const map = new Map<string, SocialIdea[]>();
    for (const idea of bankIdeas.filter((i) => i.is_active)) {
      const key = getCampaignType(idea.campaign_type)?.label ?? idea.campaign_type;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(idea);
    }
    return [...map.entries()];
  }, [bankIdeas]);

  function resetBoard() {
    setBankChecked([]);
    setFresh([]);
    setError(null);
    setBuiltKey(null);
  }

  async function brainstorm(more: boolean) {
    if (!clientId || brainstorming || gettingMore) return;
    if (more) setGettingMore(true);
    else setBrainstorming(true);
    setError(null);
    try {
      const res = await fetch("/api/social/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          month,
          exclude: more ? fresh.map((f) => f.title) : [],
        }),
      });
      const data = (await res.json()) as { ideas?: FreshIdea[]; error?: string };
      if (!res.ok || !data.ideas) throw new Error(data.error ?? "Brainstorm failed");
      const cards = data.ideas.map((i) => ({ ...i, checked: false }));
      setFresh(more ? [...fresh, ...cards] : cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brainstorm failed");
    } finally {
      setBrainstorming(false);
      setGettingMore(false);
    }
  }

  function addCustomIdea() {
    const t = customIdea.trim();
    if (!t) return;
    setFresh([...fresh, { title: t, description: "", shot_idea: "", campaign_type: "series", checked: true, custom: true }]);
    setCustomIdea("");
  }

  async function saveToBank(index: number) {
    const idea = fresh[index];
    if (!idea || idea.saved) return;
    const res = await fetch("/api/social/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: idea.title,
        description: idea.shot_idea ? `${idea.description} Shot idea: ${idea.shot_idea}` : idea.description,
        campaign_type: idea.campaign_type,
        tags: ["ai-generated"],
      }),
    });
    if (res.ok) setFresh(fresh.map((f, i) => (i === index ? { ...f, saved: true } : f)));
  }

  async function buildCalendar() {
    if (!client || selectedCount === 0 || building) return;
    setBuilding(true);
    setError(null);
    try {
      const selectedIdeas = [
        ...bankIdeas.filter((i) => bankChecked.includes(i.id)).map((i) => ({ title: i.title, description: i.description })),
        ...fresh.filter((f) => f.checked).map((f) => ({ title: f.title, description: f.description, shot_idea: f.shot_idea || undefined })),
      ];
      const res = await fetch("/api/social/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, clientName: client.account_name, month, year, selectedIdeas }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Calendar build failed");
      }
      setBuiltKey(`${client.id}-${month}-${year}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calendar build failed");
    } finally {
      setBuilding(false);
    }
  }

  const years = [now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6" data-theme="light">
      {/* Step 1 — who and when */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Practice</label>
          <select
            value={clientId === "" ? "" : String(clientId)}
            onChange={(e) => {
              setClientId(e.target.value ? Number(e.target.value) : "");
              resetBoard();
            }}
            className="px-3 py-1.5 rounded-md border text-sm bg-white min-w-64"
          >
            <option value="">Select a practice…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.account_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Month</label>
          <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setBuiltKey(null); }} className="px-2 py-1.5 rounded-md border text-sm bg-white">
            {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Year</label>
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setBuiltKey(null); }} className="px-2 py-1.5 rounded-md border text-sm bg-white">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {client && (
          <button
            onClick={() => brainstorm(false)}
            disabled={brainstorming}
            className="px-4 py-1.5 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
          >
            {brainstorming ? "Brainstorming…" : fresh.length ? "Fresh brainstorm" : "✨ Brainstorm cute ideas"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {!client && (
        <div className="border-2 border-dashed rounded-lg py-12 text-center">
          <p className="text-sm text-gray-500">Pick a practice to start building their {MONTH_NAMES[month]} calendar.</p>
          <p className="text-xs text-gray-400 mt-1">You'll choose ideas from the Beyond Indigo idea bank plus fresh AI concepts made for that practice — then build the month around your picks.</p>
        </div>
      )}

      {client && !builtKey && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Idea bank column */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-gray-900">From the Idea Bank</h3>
              <span className="text-xs text-gray-400">{bankChecked.length} picked</span>
            </div>
            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              {bankByType.map(([label, ideas]) => (
                <div key={label} className="space-y-1.5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
                  {ideas.map((idea) => (
                    <IdeaCheckRow
                      key={idea.id}
                      checked={bankChecked.includes(idea.id)}
                      onToggle={() =>
                        setBankChecked((prev) =>
                          prev.includes(idea.id) ? prev.filter((id) => id !== idea.id) : [...prev, idea.id]
                        )
                      }
                      title={idea.title}
                      description={idea.description}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Fresh ideas column */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Fresh ideas for {client.account_name}</h3>
              <span className="text-xs text-gray-400">{fresh.filter((f) => f.checked).length} picked</span>
            </div>

            {fresh.length === 0 && !brainstorming && (
              <div className="border-2 border-dashed rounded-lg py-10 text-center px-6">
                <p className="text-sm text-gray-500">Click <strong>Brainstorm cute ideas</strong> to get practice-specific concepts —</p>
                <p className="text-xs text-gray-400 mt-1">clinic pet spotlights, trick-for-a-treat videos, staff features — each with the exact photo or video to ask the client for.</p>
              </div>
            )}
            {brainstorming && (
              <div className="border-2 border-dashed rounded-lg py-10 text-center">
                <p className="text-sm text-gray-500">Reading their website and inventing ideas… ~30 seconds</p>
              </div>
            )}

            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {fresh.map((idea, i) => {
                const ct = getCampaignType(idea.campaign_type);
                return (
                  <IdeaCheckRow
                    key={`${idea.title}-${i}`}
                    checked={idea.checked}
                    onToggle={() => setFresh(fresh.map((f, idx) => (idx === i ? { ...f, checked: !f.checked } : f)))}
                    title={idea.title}
                    description={idea.description || undefined}
                    badge={
                      <>
                        {ct && <span className={`text-[0.6rem] px-1.5 py-0.5 rounded-full ${ct.color}`}>{ct.label}</span>}
                        {idea.custom && <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">yours</span>}
                      </>
                    }
                    extra={
                      isAdminUser && !idea.custom ? (
                        <button
                          onClick={() => saveToBank(i)}
                          disabled={idea.saved}
                          title="Save to the shared Idea Bank"
                          className="text-[0.65rem] text-gray-400 hover:text-gray-900 shrink-0 mt-1 disabled:text-green-600"
                        >
                          {idea.saved ? "✓ banked" : "+ bank"}
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>

            {fresh.length > 0 && (
              <div className="flex gap-2">
                <input
                  value={customIdea}
                  onChange={(e) => setCustomIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomIdea()}
                  placeholder="Add your own idea…"
                  className="flex-1 px-3 py-1.5 rounded-md border text-sm bg-white"
                />
                <button onClick={addCustomIdea} disabled={!customIdea.trim()} className="px-3 py-1.5 rounded-md border text-xs disabled:opacity-40">Add</button>
                <button onClick={() => brainstorm(true)} disabled={gettingMore} className="px-3 py-1.5 rounded-md border text-xs disabled:opacity-50">
                  {gettingMore ? "Thinking…" : "More ideas"}
                </button>
              </div>
            )}

            {/* Shot preview for checked fresh ideas */}
            {fresh.some((f) => f.checked && f.shot_idea) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">📸 The client will need to shoot:</p>
                {fresh.filter((f) => f.checked && f.shot_idea).map((f, i) => (
                  <p key={i} className="text-xs text-amber-900"><strong>{f.title}:</strong> {f.shot_idea}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Build bar */}
      {client && !builtKey && (bankChecked.length > 0 || fresh.length > 0) && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-3 shadow-lg">
          <p className="text-sm text-gray-600">
            <strong>{selectedCount}</strong> idea{selectedCount === 1 ? "" : "s"} picked for {MONTH_NAMES[month]} — the rest of the month fills in around them.
          </p>
          <button
            onClick={buildCalendar}
            disabled={selectedCount === 0 || building}
            className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50 shrink-0"
          >
            {building ? "Writing the month…" : `Build ${MONTH_NAMES[month]} calendar`}
          </button>
        </div>
      )}

      {/* Result — the finished calendar in the existing editor */}
      {client && builtKey && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{MONTH_NAMES[month]} {year} — {client.account_name}</h3>
            <button onClick={() => setBuiltKey(null)} className="text-xs text-gray-500 hover:text-gray-900 underline">← Back to idea board</button>
          </div>
          <ContentPlanEditor key={builtKey} clientId={client.id} clientName={client.account_name} initialMonth={month} initialYear={year} />
        </div>
      )}
    </div>
  );
}
