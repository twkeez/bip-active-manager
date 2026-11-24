"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Low contact, on the client page: a deliberately quiet account. The Response
 * Report then waits 30 days, not 15, before saying the client has not heard
 * from us. Saved on the client; nothing else about the plan changes.
 */
export default function LowContactToggle({
  clientId,
  lowContact,
  accent,
}: {
  clientId: number;
  lowContact: boolean;
  accent: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !lowContact;
    if (
      !window.confirm(
        next
          ? "Mark this client low contact? The Response Report will wait 30 days (not 15) before flagging that the client hasn't heard from us, and the client lists as Paused."
          : "Remove low contact? The Response Report goes back to flagging after 15 days without a post from us.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_low_contact: next }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not save low contact.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save low contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={saving}
        style={{ color: accent }}
        className="text-[11.5px] font-semibold hover:underline disabled:opacity-50"
        title="Low contact: a deliberately quiet account, given 30 days instead of 15 on the Response Report"
      >
        {saving ? "Saving…" : lowContact ? "Low contact: on (turn off)" : "Mark low contact"}
      </button>
      {error && <span className="text-[11.5px] text-red-600">{error}</span>}
    </>
  );
}
