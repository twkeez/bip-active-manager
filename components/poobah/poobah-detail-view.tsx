"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown } from "lucide-react";
import { BipStatusBadge, onboardingAccent } from "@/components/poobah/bip-status";
import { ToolPage } from "@/components/ui/tool-page";
import { actorLabel, calendarDate, whenEastern } from "@/lib/poobah/format";
import { LOG_SOURCES, POOBAH_NAME, type PoobahDetail, type PoobahItem } from "@/lib/poobah/types";

const input = "w-full rounded-md border border-bip-border bg-transparent px-3 py-2 text-sm text-bip-text";
const primary = "rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const secondary = "rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-muted hover:text-bip-text disabled:opacity-50";

/** Send a change and refresh the page from the server, so what shows is what was saved. */
function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(key: string, url: string, method: "POST" | "PATCH", body: unknown): Promise<boolean> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? `Not saved (HTTP ${res.status}).`);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not saved.");
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, save };
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function PoobahDetailView({ detail, today }: { detail: PoobahDetail; today: string }) {
  const { watch, client, statuses, items, log, changes } = detail;
  const base = `/api/poobah-client-watch/${watch.id}`;
  const { busy, error, save } = useSave();

  const current = statuses[0] ?? null;
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState(current?.status ?? "");
  const [showStatusHistory, setShowStatusHistory] = useState(false);

  const [editingBasics, setEditingBasics] = useState(false);
  const [basicsDraft, setBasicsDraft] = useState(watch.basics);

  const [newItem, setNewItem] = useState({ text: "", owner: "", due_date: "" });
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState({ text: "", owner: "", due_date: "" });
  const [showDone, setShowDone] = useState(false);

  const [newLog, setNewLog] = useState({ date: today, source: "note", text: "" });
  const [showChanges, setShowChanges] = useState(false);

  const openItems = items.filter((item) => !item.done);
  const doneItems = items.filter((item) => item.done);

  function startEditItem(item: PoobahItem) {
    setEditingItem(item.id);
    setItemDraft({ text: item.text, owner: item.owner ?? "", due_date: item.due_date ?? "" });
  }

  const itemRow = (item: PoobahItem) => (
    <li key={item.id} className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={item.done}
        disabled={busy === `item-${item.id}`}
        onChange={(event) => void save(`item-${item.id}`, `/api/poobah-client-watch/items/${item.id}`, "PATCH", { done: event.target.checked })}
        aria-label={item.done ? "Reopen" : "Mark done"}
      />
      {editingItem === item.id ? (
        <div className="flex-1 space-y-2">
          <input className={input} value={itemDraft.text} onChange={(e) => setItemDraft({ ...itemDraft, text: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <input className={`${input} max-w-[12rem]`} placeholder="Owner" value={itemDraft.owner} onChange={(e) => setItemDraft({ ...itemDraft, owner: e.target.value })} />
            <input type="date" className={`${input} max-w-[11rem]`} value={itemDraft.due_date} onChange={(e) => setItemDraft({ ...itemDraft, due_date: e.target.value })} />
            <button
              className={primary}
              disabled={busy === `edit-${item.id}` || !itemDraft.text.trim()}
              onClick={async () => {
                const ok = await save(`edit-${item.id}`, `/api/poobah-client-watch/items/${item.id}`, "PATCH", {
                  text: itemDraft.text,
                  owner: itemDraft.owner || null,
                  due_date: itemDraft.due_date || null,
                });
                if (ok) setEditingItem(null);
              }}
            >
              Save
            </button>
            <button className={secondary} onClick={() => setEditingItem(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="min-w-0 flex-1 text-left" onClick={() => startEditItem(item)} title="Edit">
          <p className={`text-sm ${item.done ? "text-bip-muted line-through" : "text-bip-text"}`}>{item.text}</p>
          <p className="text-xs text-bip-muted">
            {item.owner ? `${item.owner} · ` : ""}
            {item.due_date ? `due ${calendarDate(item.due_date)} · ` : ""}
            added {whenEastern(item.created_at)} by {actorLabel(item.created_by_kind, item.created_by_email)}
            {item.done && ` · done ${whenEastern(item.done_at)} by ${actorLabel(item.done_by_kind, item.done_by_email)}`}
          </p>
        </button>
      )}
    </li>
  );

  return (
    <ToolPage
      title={watch.name}
      icon={Crown}
      maxWidth="4xl"
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/client-watch" className="inline-flex items-center gap-1 text-bip-muted hover:text-bip-text">
            <ArrowLeft className="h-3.5 w-3.5" /> {POOBAH_NAME}
          </Link>
          {client ? (
            <Link href={`/dashboard/clients/${client.id}`} className="text-bip-accent hover:underline">
              Open client record: {client.name}
            </Link>
          ) : (
            <span className="text-bip-muted">Not linked to a BIP Control client</span>
          )}
          <span className="text-bip-muted">Watched since {whenEastern(watch.created_at)} ({actorLabel(watch.created_by_kind, watch.created_by_email)})</span>
        </span>
      }
    >
      {error && <p className="rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-fg)]">Not saved: {error}</p>}

      <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-bip-border bg-bip-card px-4 py-2 text-sm ${onboardingAccent(client?.bip_status ?? null)}`}>
        <span className="text-bip-muted">BIP status:</span>
        {client ? (
          <>
            <span className="font-medium text-bip-text">{client.bip_status_label}</span>
            <BipStatusBadge status={client.bip_status} />
            <span className="text-xs text-bip-muted">live from the client record</span>
          </>
        ) : (
          <BipStatusBadge status={null} />
        )}
      </div>

      <Section
        title="Current status"
        aside={
          !editingStatus && (
            <button className={secondary} onClick={() => { setStatusDraft(current?.status ?? ""); setEditingStatus(true); }}>
              {current ? "Update" : "Add status"}
            </button>
          )
        }
      >
        {editingStatus ? (
          <div className="space-y-2">
            <textarea className={input} rows={4} value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} autoFocus />
            <p className="text-xs text-bip-muted">The current status is kept in the history below, not overwritten.</p>
            <div className="flex gap-2">
              <button
                className={primary}
                disabled={busy === "status" || !statusDraft.trim()}
                onClick={async () => {
                  if (await save("status", base, "PATCH", { status: statusDraft })) setEditingStatus(false);
                }}
              >
                Save status
              </button>
              <button className={secondary} onClick={() => setEditingStatus(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : current ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-bip-text">{current.status}</p>
            <p className="text-xs text-bip-muted">
              Set {whenEastern(current.set_at)} by {actorLabel(current.set_by_kind, current.set_by_email)}
              {statuses.length > 1 && (
                <>
                  {" · "}
                  <button className="underline" onClick={() => setShowStatusHistory(!showStatusHistory)}>
                    {showStatusHistory ? "Hide" : "Show"} {statuses.length - 1} earlier
                  </button>
                </>
              )}
            </p>
            {showStatusHistory && (
              <ul className="space-y-2 border-l border-bip-border pl-3">
                {statuses.slice(1).map((status) => (
                  <li key={status.id}>
                    <p className="whitespace-pre-wrap text-sm text-bip-muted">{status.status}</p>
                    <p className="text-xs text-bip-muted">
                      {whenEastern(status.set_at)} · {actorLabel(status.set_by_kind, status.set_by_email)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-bip-muted">No status yet.</p>
        )}
      </Section>

      <Section title={`Open items (${openItems.length})`}>
        {openItems.length ? <ul className="divide-y divide-bip-border">{openItems.map(itemRow)}</ul> : <p className="text-sm text-bip-muted">Nothing open.</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <input className={`${input} min-w-[14rem] flex-1`} placeholder="New item" value={newItem.text} onChange={(e) => setNewItem({ ...newItem, text: e.target.value })} />
          <input className={`${input} max-w-[10rem]`} placeholder="Owner" value={newItem.owner} onChange={(e) => setNewItem({ ...newItem, owner: e.target.value })} />
          <input type="date" className={`${input} max-w-[11rem]`} value={newItem.due_date} onChange={(e) => setNewItem({ ...newItem, due_date: e.target.value })} aria-label="Due date (optional)" />
          <button
            className={primary}
            disabled={busy === "item" || !newItem.text.trim()}
            onClick={async () => {
              const ok = await save("item", `${base}/items`, "POST", {
                text: newItem.text,
                owner: newItem.owner || null,
                due_date: newItem.due_date || null,
              });
              if (ok) setNewItem({ text: "", owner: "", due_date: "" });
            }}
          >
            Add
          </button>
        </div>
        {doneItems.length > 0 && (
          <>
            <button className="text-xs text-bip-muted underline" onClick={() => setShowDone(!showDone)}>
              {showDone ? "Hide" : "Show"} {doneItems.length} done
            </button>
            {showDone && <ul className="divide-y divide-bip-border">{doneItems.map(itemRow)}</ul>}
          </>
        )}
      </Section>

      <Section title={`Running log (${log.length})`}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input type="date" className={`${input} max-w-[11rem]`} value={newLog.date} onChange={(e) => setNewLog({ ...newLog, date: e.target.value })} aria-label="Date" />
            <input list="poobah-sources" className={`${input} max-w-[10rem]`} value={newLog.source} onChange={(e) => setNewLog({ ...newLog, source: e.target.value })} aria-label="Source" />
            <datalist id="poobah-sources">
              {LOG_SOURCES.map((source) => (
                <option key={source} value={source} />
              ))}
            </datalist>
          </div>
          <textarea className={input} rows={2} placeholder="What happened" value={newLog.text} onChange={(e) => setNewLog({ ...newLog, text: e.target.value })} />
          <button
            className={primary}
            disabled={busy === "log" || !newLog.text.trim() || !newLog.source.trim() || !newLog.date}
            onClick={async () => {
              if (await save("log", `${base}/log`, "POST", newLog)) setNewLog({ ...newLog, text: "" });
            }}
          >
            Add to log
          </button>
        </div>
        {log.length ? (
          <ul className="divide-y divide-bip-border">
            {log.map((entry) => (
              <li key={entry.id} className="py-2">
                <p className="text-xs text-bip-muted">
                  <span className="font-medium text-bip-text">{calendarDate(entry.entry_date)}</span> · {entry.source} · added by{" "}
                  {actorLabel(entry.created_by_kind, entry.created_by_email)}
                </p>
                <p className="whitespace-pre-wrap text-sm text-bip-text">{entry.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-bip-muted">No entries yet.</p>
        )}
      </Section>

      <Section
        title="Account basics"
        aside={
          !editingBasics && (
            <button className={secondary} onClick={() => { setBasicsDraft(watch.basics); setEditingBasics(true); }}>
              Edit
            </button>
          )
        }
      >
        {editingBasics ? (
          <div className="space-y-2">
            <textarea
              className={input}
              rows={8}
              value={basicsDraft}
              onChange={(e) => setBasicsDraft(e.target.value)}
              placeholder="Services, contacts, budget, targeting…"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                className={primary}
                disabled={busy === "basics"}
                onClick={async () => {
                  if (await save("basics", base, "PATCH", { basics: basicsDraft })) setEditingBasics(false);
                }}
              >
                Save basics
              </button>
              <button className={secondary} onClick={() => setEditingBasics(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : watch.basics.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-bip-text">{watch.basics}</p>
        ) : (
          <p className="text-sm text-bip-muted">No notes yet: services, contacts, budget, targeting.</p>
        )}
      </Section>

      <Section
        title={`Change history (${changes.length})`}
        aside={
          <button className={secondary} onClick={() => setShowChanges(!showChanges)}>
            {showChanges ? "Hide" : "Show"}
          </button>
        }
      >
        {showChanges && (
          <ul className="space-y-1 text-xs text-bip-muted">
            {changes.map((change) => (
              <li key={change.id}>
                {whenEastern(change.at)} · {actorLabel(change.actor_kind, change.actor_email)} · {change.entity} {change.action}
                {change.entity_id != null && change.entity !== "watch" && change.entity !== "basics" ? ` #${change.entity_id}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </ToolPage>
  );
}
