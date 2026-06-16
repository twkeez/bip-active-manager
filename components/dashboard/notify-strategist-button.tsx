"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, Copy, Loader2 } from "lucide-react";
import {
  buildStrategistNotifyMailto,
  matchStrategistByName,
  type StrategistContact,
} from "@/lib/team/strategist-roster";
import type { BasecampThreadEvent, ClientRow } from "@/lib/types/client";
type Props = {
  client: ClientRow;
  thread: BasecampThreadEvent;
  roster: StrategistContact[];
  userEmail?: string;
  appUrl?: string;
  className?: string;
};
export default function NotifyStrategistButton({
  client,
  thread,
  roster,
  userEmail,
  appUrl = typeof window !== "undefined" ? window.location.origin : "",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggested = useMemo(
    () => matchStrategistByName(client.marketing_strategist, roster),
    [client.marketing_strategist, roster],
  );
  useEffect(() => {
    if (!open) return;
    setSelectedName((current) => current ?? suggested?.name ?? null);
    setCopyMessage(null);
  }, [open, suggested?.name]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const selectedContact =
    roster.find((entry) => entry.name === selectedName) ?? null;
  const configuredCount = roster.filter((entry) => entry.email).length;
  const canNotify = Boolean(selectedContact?.email);
  function buildMailtoUrl(contact: StrategistContact) {
    if (!contact.email) return null;
    return buildStrategistNotifyMailto({
      to: contact.email,
      client,
      thread,
      appUrl,
      senderEmail: userEmail,
    });
  }
  async function handleOpenDraft() {
    if (!selectedContact?.email) return;
    const mailtoUrl = buildMailtoUrl(selectedContact);
    if (!mailtoUrl) return;
    setOpening(true);
    setCopyMessage(null);
    try {
      const opened = window.open(mailtoUrl, "_blank");
      if (!opened) {
        window.location.href = mailtoUrl;
      }
      setOpen(false);
    } finally {
      setOpening(false);
    }
  }
  async function handleCopyDraft() {
    if (!selectedContact?.email) return;
    const mailtoUrl = buildMailtoUrl(selectedContact);
    if (!mailtoUrl) return;
    try {
      await navigator.clipboard.writeText(mailtoUrl);
      setCopyMessage("Draft link copied.");
    } catch {
      setCopyMessage("Could not copy — open draft instead.");
    }
  }
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-indigo-500/30 bg-bip-accent/10 px-4 py-2 text-sm font-medium text-bip-accent transition hover:bg-bip-accent/20"
      >
        
        <Bell size={14} /> Notify strategist
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-white/[0.08]/80 bg-bip-card p-3 shadow-xl">
          
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            
            Select recipient
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/50">
            
            Opens a pre-filled email draft in your mail app.
          </p>
          {configuredCount === 0 ? (
            <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              
              No strategist emails configured. Set{""}
              <code className="text-amber-200">STRATEGIST_CONTACTS</code> in
              .env.local.
            </p>
          ) : (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              
              {roster.map((contact) => {
                const isSelected = selectedName === contact.name;
                const disabled = !contact.email;
                return (
                  <li key={contact.name}>
                    
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedName(contact.name)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${disabled ? "cursor-not-allowed border-white/[0.08] bg-bip-card/40 text-slate-600" : isSelected ? "border-indigo-500/40 bg-bip-accent/10 text-indigo-200" : "border-white/[0.08] bg-bip-card/60 text-white/75 hover:border-white/[0.08] hover:bg-bip-card/60"}`}
                    >
                      
                      <span>
                        
                        {contact.name}
                        {suggested?.name === contact.name ? (
                          <span className="ml-1.5 text-[10px] font-normal text-bip-accent">
                            
                            suggested
                          </span>
                        ) : null}
                      </span>
                      {isSelected && !disabled ? (
                        <Check size={14} className="shrink-0 text-bip-accent" />
                      ) : null}
                    </button>
                    {disabled ? (
                      <p className="px-1 pt-0.5 text-[10px] text-slate-600">
                        Email not configured
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            
            <button
              type="button"
              onClick={() => void handleOpenDraft()}
              disabled={!canNotify || opening}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-bip-accent disabled:opacity-50"
            >
              
              {opening ? (
                <Loader2 size={12} className="animate-spin" />
              ) : null}
              Open draft
            </button>
            <button
              type="button"
              onClick={() => void handleCopyDraft()}
              disabled={!canNotify}
              title="Copy mailto link"
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-white/50 transition hover:bg-bip-card/60 hover:text-white/75 disabled:opacity-50"
            >
              
              <Copy size={14} />
            </button>
          </div>
          {copyMessage ? (
            <p className="mt-2 text-[11px] text-white/50">{copyMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
