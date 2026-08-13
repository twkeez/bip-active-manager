"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Trash2, X } from "lucide-react";
import { getCampaignType } from "@/lib/social/campaign-types";
import { POST_STATUSES, POST_STATUS_LABELS, POST_STATUS_STYLES } from "@/lib/social/post-status";
import { PostLockToggle } from "./post-lock-toggle";
import type {
  PostStatus,
  SocialAwarenessDay,
  SocialContentPost,
  SocialSeriesWithParts,
} from "@/lib/social/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function longDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth() + 1]} ${d.getUTCDate()}`;
}

type Draft = {
  caption_draft: string;
  shot_list: string;
  hashtags: string;
  status: PostStatus;
};

function draftFrom(post: SocialContentPost): Draft {
  return {
    caption_draft: post.caption_draft ?? "",
    shot_list: post.shot_list ?? "",
    hashtags: post.hashtags ?? "",
    status: post.status,
  };
}

export function PostDetailPanel({
  post,
  planId,
  series,
  awarenessDays,
  onBack,
  onClose,
  onUpdated,
  onDeleted,
  onDirtyChange,
}: {
  post: SocialContentPost;
  planId: number;
  series: SocialSeriesWithParts[];
  awarenessDays: SocialAwarenessDay[];
  onBack: () => void;
  onClose: () => void;
  onUpdated: (post: SocialContentPost) => void;
  onDeleted: (postId: number) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(post));
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Reset the form whenever a different post is opened.
  const postId = post.id;
  const lastPostId = useRef(postId);
  useEffect(() => {
    if (lastPostId.current !== postId) {
      lastPostId.current = postId;
      setDraft(draftFrom(post));
      setError(null);
      setSavedAt(null);
      setConfirmDelete(false);
    }
  }, [postId, post]);

  const dirty = useMemo(() => {
    const base = draftFrom(post);
    return (
      base.caption_draft !== draft.caption_draft ||
      base.shot_list !== draft.shot_list ||
      base.hashtags !== draft.hashtags ||
      base.status !== draft.status
    );
  }, [post, draft]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Elapsed counter while a rewrite runs.
  useEffect(() => {
    if (!rewriting) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [rewriting]);

  const seriesForPost = post.series_id != null ? series.find((s) => s.id === post.series_id) : undefined;
  const awarenessForPost =
    post.awareness_day_id != null ? awarenessDays.find((d) => d.id === post.awareness_day_id) : undefined;
  const ct = getCampaignType(post.campaign_type);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/plans/${planId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          updates: {
            caption_draft: draft.caption_draft,
            shot_list: draft.shot_list,
            hashtags: draft.hashtags,
            status: draft.status,
          },
        }),
      });
      const data = (await res.json()) as SocialContentPost & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onUpdated(data);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function rewrite() {
    if (rewriting || post.locked) return;
    setRewriting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, postIds: [post.id] }),
      });
      const data = (await res.json()) as { updated?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Rewrite failed");
      if (!data.updated) {
        setError("Nothing was rewritten — the post may be locked.");
        return;
      }
      // Pull the regenerated copy back into the form.
      const refreshed = await fetch(`/api/social/plans?clientId=${post.client_id}`).then((r) => r.json());
      const found = (Array.isArray(refreshed) ? refreshed : [])
        .flatMap((p: { posts?: SocialContentPost[] }) => p.posts ?? [])
        .find((p: SocialContentPost) => p.id === post.id);
      if (found) {
        setDraft(draftFrom(found));
        onUpdated(found);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  }

  async function remove() {
    if (post.locked) return;
    setError(null);
    try {
      const res = await fetch("/api/social/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Delete failed");
      }
      setConfirmDelete(false);
      onDeleted(post.id);
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const captionLength = draft.caption_draft.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200/80 pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={13} /> Sources
          </button>
          <div className="flex items-center gap-1">
            <PostLockToggle post={post} planId={planId} onUpdated={onUpdated} withLabel />
            <button onClick={onClose} aria-label="Close panel" className="rounded p-1 text-slate-400 hover:text-slate-900">
              <X size={15} />
            </button>
          </div>
        </div>

        <h3 className="mt-3 text-base font-bold leading-snug tracking-tight text-slate-900">
          {post.campaign_label}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{longDate(post.post_date)}</p>

        {/* Metadata */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {ct && (
            <span className="rounded-full border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
              {ct.label}
            </span>
          )}
          {seriesForPost && (
            <span className="rounded-full border border-violet-200/60 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              {seriesForPost.title}
              {post.series_part != null && ` · ${post.series_part}/${seriesForPost.parts.length}`}
            </span>
          )}
          {awarenessForPost && (
            <span className="rounded-full border border-sky-200/60 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
              {awarenessForPost.name}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
        {error && (
          <p className="rounded-lg border border-red-200/80 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {rewriting && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900">Rewriting this post…</p>
              <span className="text-xs font-medium tabular-nums text-slate-500">{elapsed}s</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-1.5 w-full animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-xs font-medium text-slate-500">Caption</label>
            <span className={`text-xs tabular-nums ${captionLength === 0 ? "text-amber-600" : "text-slate-400"}`}>
              {captionLength === 0 ? "needs caption" : `${captionLength} characters`}
            </span>
          </div>
          <textarea
            value={draft.caption_draft}
            onChange={(e) => setDraft((d) => ({ ...d, caption_draft: e.target.value }))}
            rows={12}
            placeholder="No caption yet — write one, or use Rewrite caption."
            className="w-full resize-y rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Photo / video to request</label>
          <textarea
            value={draft.shot_list}
            onChange={(e) => setDraft((d) => ({ ...d, shot_list: e.target.value }))}
            rows={4}
            placeholder="Exactly what to ask the client to capture."
            className="w-full resize-y rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Hashtags</label>
          <input
            value={draft.hashtags}
            onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
            placeholder="#VetLife #PetCare"
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {POST_STATUSES.map((s) => {
              const active = draft.status === s;
              return (
                <button
                  key={s}
                  onClick={() => setDraft((d) => ({ ...d, status: s }))}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                    active ? POST_STATUS_STYLES[s] : "border-slate-200/80 bg-white text-slate-500 hover:border-slate-400"
                  }`}
                >
                  {POST_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t border-slate-200/80 pt-3">
        {confirmDelete ? (
          <div className="rounded-xl border border-red-200/80 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-800">
              Delete &ldquo;{post.campaign_label}&rdquo; from {longDate(post.post_date)}?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void remove()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-500"
              >
                Delete post
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? "Saving…" : savedAt ? "Saved" : "Save"}
            </button>
            <button
              onClick={() => void rewrite()}
              disabled={rewriting || post.locked}
              title={post.locked ? "Unlock this post to rewrite it" : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40"
            >
              <Sparkles size={13} />
              {rewriting ? "Rewriting…" : "Rewrite caption"}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={post.locked}
              title={post.locked ? "Unlock this post to delete it" : undefined}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-400 transition hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-400"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        )}
        {dirty && !confirmDelete && (
          <p className="mt-2 text-xs font-medium text-amber-600">Unsaved changes</p>
        )}
      </div>
    </div>
  );
}
