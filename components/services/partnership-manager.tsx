"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import PartnershipView from "@/components/services/partnership-view";
import PartnershipEditor from "@/components/services/partnership-editor";
import type { PartnershipContent } from "@/lib/services/partnership-content";

export default function PartnershipManager({ initial, isAdmin }: { initial: PartnershipContent; isAdmin: boolean }) {
  const [content, setContent] = useState(initial);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PartnershipEditor
        initial={content}
        onSaved={(c) => {
          setContent(c);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      )}
      <PartnershipView content={content} />
    </div>
  );
}
