import { redirect } from "next/navigation";
import { FileDown, Printer } from "lucide-react";
import GuideDocument from "@/components/guide/guide-document";
import { GUIDE } from "@/lib/guide/content";
import { createClient } from "@/lib/supabase/server";

/**
 * The BIP Control team guide: what every sidebar link is for. The printable
 * version (/guide-print) and the Word download come from the same content.
 */
export default async function GuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4 p-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
        <a
          href="/guide-print"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--bip-hover)]"
        >
          <Printer size={14} /> Print / Save as PDF
        </a>
        <a
          href="/api/guide/word"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--bip-hover)]"
        >
          <FileDown size={14} /> Download Word
        </a>
      </div>
      <GuideDocument guide={GUIDE} />
    </div>
  );
}
