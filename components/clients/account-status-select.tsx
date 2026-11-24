"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_STATUSES, ACCOUNT_STATUS_LABEL, type AccountStatus } from "@/lib/clients/account-status";

/**
 * Active / cancelling / former, on the client page. Cancelling and former
 * clients come off the Response Report and are listed there under Excluded.
 */
export default function AccountStatusSelect({ clientId, status }: { clientId: number; status: AccountStatus }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: AccountStatus) {
    if (next === status) return;
    if (
      next !== "active" &&
      !window.confirm(
        `Mark this client as ${ACCOUNT_STATUS_LABEL[next].toLowerCase()}? It comes off the Response Report and is listed there under Excluded.`,
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
        body: JSON.stringify({ account_status: next }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not save the client's status.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the client's status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold">
      Status
      <select
        value={status}
        disabled={saving}
        onChange={(event) => void change(event.target.value as AccountStatus)}
        className="rounded border border-black/15 bg-white px-1 py-0.5 text-[11.5px] font-normal text-black disabled:opacity-50"
        title="Cancelling and former clients come off the Response Report"
      >
        {ACCOUNT_STATUSES.map((option) => (
          <option key={option} value={option}>
            {ACCOUNT_STATUS_LABEL[option]}
          </option>
        ))}
      </select>
      {error && <span className="font-normal text-red-600">{error}</span>}
    </label>
  );
}
