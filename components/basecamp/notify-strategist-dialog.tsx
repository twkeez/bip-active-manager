"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { defaultNote, defaultNoteKind, NOTE_KIND_LABEL, type NoteKind } from "@/lib/followups/followups";
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
  const initialRecipient = staff.find((person) => person.email === suggestedEmail) ?? null;
  const [recipientEmail, setRecipientEmail] = useState(initialRecipient?.email ?? "");

  // "Waiting on us" is only true when the client spoke last, so it is the
  // default there and unavailable elsewhere. "It's been a while" is always true.
  const [kind, setKind] = useState<NoteKind>(defaultNoteKind(row.status));
  const waitingOnUsAvailable = row.status === "awaiting_us";

  // Waiting on us points at the client's thread, and the follow-up closes when
  // the person asked replies there. "It's been a while" is about the whole
  // project, so it names no thread and closes when they post anywhere in it.
  const threadTitle = kind === "waiting_on_us" ? row.last_client_thread_title : null;
  const threadUrl = kind === "waiting_on_us" ? row.last_client_thread_url : null;

  const draft = (name: string | null, forKind: NoteKind) =>
    defaultNote({
      accountName: row.account_name,
      recipientName: name ? firstName(name) : null,
      kind: forKind,
      waitingDays: row.status === "awaiting_us" ? row.waitingDays : null,
      daysSinceOurMessage: row.days_since_our_reply,
      threadTitle: forKind === "waiting_on_us" ? row.last_client_thread_title : null,
    });
  const [subject, setSubject] = useState(draft(initialRecipient?.name ?? null, kind).subject);
  const [note, setNote] = useState(draft(initialRecipient?.name ?? null, kind).note);
  const [noteEdited, setNoteEdited] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseKind(next: NoteKind) {
    if (next === kind) return;
    // A different message replaces the whole note, so do not discard hand edits unasked.
    if (noteEdited && !window.confirm("Replace what you have written with the other message?")) return;
    const person = staff.find((option) => option.email === recipientEmail);
    const fresh = draft(person?.name ?? null, next);
    setKind(next);
    setSubject(fresh.subject);
    setNote(fresh.note);
    setNoteEdited(false);
  }

  function chooseRecipient(email: string) {
    setRecipientEmail(email);
    // Re-address the greeting, unless the note has been rewritten by hand.
    if (!noteEdited) {
      const person = staff.find((option) => option.email === email);
      setNote(draft(person?.name ?? null, kind).note);
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

        <fieldset className="space-y-1">
          <legend className="text-xs text-bip-muted">Message</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Which message to send">
            {(["waiting_on_us", "been_a_while"] as NoteKind[]).map((option) => {
              const disabled = option === "waiting_on_us" && !waitingOnUsAvailable;
              const selected = kind === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => chooseKind(option)}
                  title={disabled ? "The client has not spoken last, so nobody is waiting on us here." : undefined}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-bip-accent bg-bip-fill text-bip-text"
                      : "border-bip-border text-bip-muted hover:text-bip-text"
                  }`}
                >
                  {NOTE_KIND_LABEL[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

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
            {kind === "waiting_on_us"
              ? "Links to the Basecamp thread and project are added below your note. Sent from your Gmail. It stays on Follow-ups until they reply in that thread or it is marked done."
              : "A link to the Basecamp project is added below your note. Sent from your Gmail. It stays on Follow-ups until they post anything in that project or it is marked done."}
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
