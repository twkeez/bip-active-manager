"use client";

import { Check, Loader2 } from "lucide-react";
import type { OnboardingController } from "./types";

// The amber "This step needs the website URL" input + Save button. Shared by the
// SEO audit, baseline rankings, and brand-assets steps. Wired to the controller's
// shared website draft so all three edit the same field.
export function WebsiteField({ controller }: { controller: OnboardingController }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
      <p className="text-[11px] text-amber-300">This step needs the website URL.</p>
      <div className="flex gap-2">
        <input
          value={controller.websiteDraft}
          onChange={(e) => controller.setWebsiteDraft(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-md bip-input text-sm shadow-none"
        />
        <button
          type="button"
          disabled={controller.websiteSaving || !controller.websiteDraft.trim()}
          onClick={() => void controller.saveWebsite()}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {controller.websiteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  );
}
