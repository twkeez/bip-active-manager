"use client";

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import type { SocialContentPost } from "@/lib/social/types";

/**
 * Padlock toggle for a post. Behaviour and styling match the one inside
 * content-plan-editor.tsx's PostCard — optimistic flip, revert plus a red flash
 * on failure, same locked/unlocked treatment. That file is left untouched
 * because the Cockpit still imports it, so its copy stays inline; this is the
 * shared version for everything built since.
 */
export function PostLockToggle({
  post,
  planId,
  onUpdated,
  withLabel = false,
}: {
  post: SocialContentPost;
  planId: number;
  onUpdated: (post: SocialContentPost) => void;
  withLabel?: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const locked = override ?? post.locked;

  async function toggle() {
    const next = !locked;
    setOverride(next);
    setFailed(false);
    try {
      const res = await fetch(`/api/social/plans/${planId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, updates: { locked: next } }),
      });
      if (!res.ok) throw new Error("Lock failed");
      const updated = (await res.json()) as SocialContentPost;
      setOverride(null);
      onUpdated(updated);
    } catch {
      setOverride(null); // back to the server value
      setFailed(true);
      setTimeout(() => setFailed(false), 2500);
    }
  }

  const title = failed
    ? "Could not change lock — try again"
    : locked
      ? "Locked — protected from rebuild"
      : "Lock to protect from rebuild";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      title={title}
      aria-label={title}
      aria-pressed={locked}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
        failed
          ? "border-red-200 bg-red-50 text-red-600"
          : locked
            ? "border-slate-200 bg-slate-100 text-slate-700"
            : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {locked ? <Lock size={13} /> : <LockOpen size={13} />}
      {withLabel && (locked ? "Locked" : "Lock")}
    </button>
  );
}
