"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { defaultNote } from "@/lib/followups/followups";
import type { ShapedReportRow } from "@/lib/basecamp/response-report";

export type StaffOption = { name: string; email: string };

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text focus:border-bip-accent focus:outline-none";

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/**
 * The Notify box: who, subject, and an editable note pre-written from where
 * the conversation stands. Sends from the signed-in person's Gmail.
 */
export default function NotifyStrategistDialog({
  row,
  staff,
  suggestedEmail,
  onClose,
  onSent,
}: {
  row: ShapedReportRow;
  staff: StaffOption[];
  /** The client's strategist when their name resolves to one teammate. */
  suggestedEmail: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  // Waiting on us: point at the client's thread. Otherwise at our last one.
  const threadTitle =
    row.status === "awaiting_us" ? row.last_client_thread_title : row.last_internal_thread_title;
  const threadUrl =
    row.status === "awaiting_us" ? row.last_client_thread_url : row.last_internal_thread_url;

  const initialRecipient = staff.find((person) => person.email === suggestedEmail) ?? null;
  const [recipientEmail, setRecipientEmail] = useState(initialRecipient?.email ?? "");
  const draft = (name: string | null) =>
    defaultNote({
      accountName: row.account_name,
      recipientName: name ? firstName(name) : null,
      status: row.status,
      waitingDays: row.waitingDays,
      threadTitle,
    });
  const [subject, setSubject] = useState(draft(initialRecipient?.name ?? null).subject);
  const [note, setNote] = useState(draft(initialRecipient?.name ?? null).note);
  const [noteEdited, setNoteEdited] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseRecipient(email: string) {
    setRecipientEmail(email);
    // Re-address the greeting, unless the note has been rewritten by hand.
    if (!noteEdited) {
      const person = staff.find((option) => option.email === email);
      setNote(draft(person?.name ?? null).note);
    }
  }

  async function send() {
    const recipient = staff.find((person) => person.email === recipientEmail);
    if (!recipient) {
      setError("Choose who to send it to.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: row.basecamp_project_id,
          projectName: row.account_name,
          clientId: row.client_id,
          recipientEmail: recipient.email,
          recipientName: firstName(recipient.name),
          subject,
          note,
          threadTitle,
          threadUrl,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not send the note.");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the note.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Notify strategist about ${row.account_name}`}
    >
      <div
        className="w-full max-w-lg space-y-3 rounded-xl border border-bip-border bg-bip-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-bip-text">Notify strategist</h2>
            <p className="truncate text-xs text-bip-muted">{row.account_name}</p>
          </div>
          <button onClick={onClose} className="text-bip-muted hover:text-bip-text" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-bip-muted">To</span>
          <select value={recipientEmail} onChange={(e) => chooseRecipient(e.target.value)} className={inputClass}>
            <option value="">Choose a teammate…</option>
            {staff.map((person) => (
              <option key={person.email} value={person.email}>
                {person.name} ({person.email})
              </option>
            ))}
          </select>
          {!initialRecipient && (
            <span className="block text-[11px] text-bip-muted">
              {row.client_id == null
                ? "This project has no client record, so there is no strategist on file."
                : row.marketing_strategist
                  ? `The strategist field says "${row.marketing_strategist}", which is not one teammate.`
                  : "No strategist is on file for this client."}
            </span>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-bip-muted">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-bip-muted">Note</span>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteEdited(true);
            }}
            rows={6}
            className={inputClass}
          />
          <span className="block text-[11px] text-bip-muted">
            Links to the Basecamp thread and project are added below your note. Sent from your Gmail.
            It stays on Follow-ups until they reply in that thread or it is marked done.
          </span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-bip-border px-3 py-1.5 text-sm text-bip-muted hover:text-bip-text"
          >
            Cancel
          </button>
          <button
            onClick={() => void send()}
            disabled={sending || !recipientEmail || !subject.trim() || !note.trim()}
            className="rounded-lg bg-bip-accent px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
