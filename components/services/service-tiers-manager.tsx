"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import ServiceTiersView from "@/components/services/service-tiers-view";
import ServiceTiersEditor from "@/components/services/service-tiers-editor";
import type { ServiceTierTable } from "@/lib/services/tier-content";

export default function ServiceTiersManager({ initial, isAdmin }: { initial: ServiceTierTable[]; isAdmin: boolean }) {
  const [tables, setTables] = useState(initial);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ServiceTiersEditor
        initial={tables}
        onSaved={(t) => {
          setTables(t);
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
      <ServiceTiersView tables={tables} />
    </div>
  );
}
