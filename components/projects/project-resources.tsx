"use client";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type {
  ClientProjectAttachment,
  ClientProjectLink,
} from "@/lib/types/client";
type Props = {
  projectId: number;
  ownerUserId: string;
  onError: (message: string | null) => void;
};
export default function ProjectResources({
  projectId,
  ownerUserId,
  onError,
}: Props) {
  const supabase = createSupabaseClient();
  const [links, setLinks] = useState<ClientProjectLink[]>([]);
  const [attachments, setAttachments] = useState<ClientProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  const loadResources = useCallback(async () => {
    setLoading(true);
    onErrorRef.current(null);
    try {
      const [linksRes, attachmentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/links`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/attachments`, { cache: "no-store" }),
      ]);
      const linksPayload = (await linksRes.json()) as {
        error?: string;
        links?: ClientProjectLink[];
      };
      const attachmentsPayload = (await attachmentsRes.json()) as {
        error?: string;
        attachments?: ClientProjectAttachment[];
      };
      if (!linksRes.ok)
        throw new Error(linksPayload.error ?? "Failed to load links");
      if (!attachmentsRes.ok) {
        throw new Error(
          attachmentsPayload.error ?? "Failed to load attachments",
        );
      }
      setLinks(linksPayload.links ?? []);
      setAttachments(attachmentsPayload.attachments ?? []);
    } catch (error) {
      onErrorRef.current(
        error instanceof Error ? error.message : "Failed to load resources",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void loadResources();
  }, [loadResources]);
  async function handleAddLink() {
    setSavingLink(true);
    onError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: linkLabel.trim(), url: linkUrl.trim() }),
      });
      const payload = (await response.json()) as {
        error?: string;
        link?: ClientProjectLink;
      };
      if (!response.ok || !payload.link) {
        throw new Error(payload.error ?? "Failed to add link");
      }
      setLinks((prev) => [payload.link!, ...prev]);
      setLinkLabel("");
      setLinkUrl("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to add link");
    } finally {
      setSavingLink(false);
    }
  }
  async function handleDeleteLink(linkId: number) {
    onError(null);
    const response = await fetch(`/api/projects/${projectId}/links/${linkId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      onError(payload.error ?? "Failed to remove link");
      return;
    }
    setLinks((prev) => prev.filter((link) => link.id !== linkId));
  }
  async function handleUpload(file: File) {
    setUploading(true);
    onError(null);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const uniqueSuffix = `${file.lastModified}-${file.size}`;
      const path = `${ownerUserId}/projects/${projectId}/${uniqueSuffix}-${safeName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("task-documents")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError || !uploadData) {
        throw new Error(uploadError?.message ?? "Upload failed");
      }
      const response = await fetch(`/api/projects/${projectId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: uploadData.path,
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        attachment?: ClientProjectAttachment;
      };
      if (!response.ok || !payload.attachment) {
        throw new Error(payload.error ?? "Failed to save attachment");
      }
      setAttachments((prev) => [payload.attachment!, ...prev]);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }
  async function handleOpenAttachment(storagePath: string) {
    const { data, error } = await supabase.storage
      .from("task-documents")
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      onError(error?.message ?? "Failed to open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function handleDeleteAttachment(attachmentId: number) {
    onError(null);
    const response = await fetch(
      `/api/projects/${projectId}/attachments/${attachmentId}`,
      { method: "DELETE" },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      onError(payload.error ?? "Failed to remove file");
      return;
    }
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        
        <Loader2 className="h-4 w-4 animate-spin" /> Loading resources…
      </div>
    );
  }
  return (
    <div className="space-y-6">
      
      <section className="space-y-3">
        
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
          
          Links (Google Docs, Sheets, etc.)
        </p>
        <div className="flex flex-wrap gap-2">
          
          <input
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.target.value)}
            placeholder="Label (e.g. Project brief)"
            className="min-w-[10rem] flex-1 rounded-md border border-white/10 bg-bip-card px-2 py-1.5 text-sm"
          />
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://docs.google.com/..."
            className="min-w-[14rem] flex-[2] rounded-md border border-white/10 bg-bip-card px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={savingLink}
            onClick={() => void handleAddLink()}
            className="rounded-md bg-bip-card/10 px-3 py-1.5 text-xs hover:bg-bip-card/15 disabled:opacity-60"
          >
            
            {savingLink ? "Adding…" : "Add link"}
          </button>
        </div>
        <ul className="space-y-1.5">
          
          {links.length === 0 ? (
            <li className="text-xs text-white/50">No links yet.</li>
          ) : (
            links.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-bip-page/50 px-3 py-2"
              >
                
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200"
                >
                  
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </a>
                <button
                  type="button"
                  onClick={() => void handleDeleteLink(link.id)}
                  className="text-white/50 hover:text-red-300"
                  aria-label="Remove link"
                >
                  
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="space-y-3">
        
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
          
          Uploaded files
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-white/20 px-3 py-2 text-xs text-white/75 hover:bg-bip-card/5">
          
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading…" : "Upload file"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleUpload(file);
            }}
          />
        </label>
        <ul className="space-y-1.5">
          
          {attachments.length === 0 ? (
            <li className="text-xs text-white/50">No files uploaded yet.</li>
          ) : (
            attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-bip-page/50 px-3 py-2"
              >
                
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenAttachment(attachment.storage_path)
                  }
                  className="min-w-0 flex-1 truncate text-left text-sm text-white hover:text-sky-200"
                >
                  
                  {attachment.file_name}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteAttachment(attachment.id)}
                  className="text-white/50 hover:text-red-300"
                  aria-label="Remove file"
                >
                  
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
