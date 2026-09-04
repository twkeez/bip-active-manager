"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanText } from "lucide-react";

/**
 * Triggers the AI pass that reads each thread's last message.
 *
 * Deliberately a button rather than something that runs on load: opening Coal
 * Mines should never cost an API call. Threads whose last message has not
 * changed since they were read are skipped, so pressing it twice is nearly free.
 */

type Result = {
  considered?: number;
  classified?: number;
  needsReply?: number;
  escalated?: number;
  message?: string;
  error?: string;
};

export default function ClassifyThreadsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/coal-mines/classify-threads", { method: "POST" });
      const payload = (await res.json()) as Result;
      setResult(payload);
      if (res.ok) router.refresh();
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={running}
        onClick={() => void run()}
        className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanText className="h-3.5 w-3.5" />
        )}
        {running ? "Reading threads…" : "Read threads"}
      </button>

      {result && (
        <span className="text-[11px] text-bip-muted">
          {result.error ? (
            <span className="text-red-300">{result.error}</span>
          ) : result.classified === 0 ? (
            (result.message ?? "Nothing new to read.")
          ) : (
            <>
              Read {result.classified} of {result.considered} —{" "}
              <span className="text-bip-text">{result.needsReply} need a reply</span>
              {result.escalated ? `, ${result.escalated} chasing us` : ""}.
            </>
          )}
        </span>
      )}
    </div>
  );
}
