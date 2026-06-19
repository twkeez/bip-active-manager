"use client";
import { ChevronDown, ChevronUp, Copy, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdsSnapshot, ClientRow } from "@/lib/types/client";
import {
  defaultMarketingUpdateGreeting,
  defaultMarketingUpdateTitle,
  formatAverageCpcFromMicros,
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatDateRangeLabel,
  type MarketingUpdateContextSummary,
} from "@/lib/reporting/marketing-update-format";
type GbpManualForm = {
  totalInteractions: string;
  phoneCalls: string;
  directionRequests: string;
  websiteClicks: string;
};
type MarketingUpdateComposerProps = {
  client: ClientRow;
  adsSnapshot: AdsSnapshot | null;
};
function emptyGbpManual(): GbpManualForm {
  return {
    totalInteractions: "",
    phoneCalls: "",
    directionRequests: "",
    websiteClicks: "",
  };
}
function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "•")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
function renderMarkdownPreview(markdown: string) {
  const blocks = markdown.split(/\n{2,}/).filter(Boolean);
  return blocks.map((block, index) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("#")) {
      return (
        <h1 key={index} className="text-xl font-semibold text-bip-text">
          
          {trimmed.slice(2)}
        </h1>
      );
    }
    if (/^[A-Z0-9][A-Z0-9\s/&'-]+$/.test(trimmed) && trimmed.length < 60) {
      return (
        <h2
          key={index}
          className="mt-4 text-sm font-bold uppercase tracking-wide text-bip-text"
        >
          
          {trimmed}
        </h2>
      );
    }
    if (/^[-*]\s/m.test(trimmed)) {
      const items = trimmed
        .split("\n")
        .filter((line) => /^[-*]\s/.test(line.trim()));
      return (
        <ul
          key={index}
          className="list-disc space-y-1 pl-5 text-sm leading-6 text-bip-text"
        >
          
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{item.replace(/^[-*]\s+/, "")}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="text-sm leading-6 text-bip-text">
        
        {trimmed}
      </p>
    );
  });
}
function AdsKpiStrip({ adsSnapshot }: { adsSnapshot: AdsSnapshot | null }) {
  if (!adsSnapshot) {
    return (
      <p className="text-xs text-bip-muted">
        
        Sync Google Ads to show KPI cards here.
      </p>
    );
  }
  const { totals } = adsSnapshot;
  const cards = [
    {
      label: "Clicks",
      value: formatCompactNumber(totals.clicks),
      tone: "bg-blue-600 text-white",
    },
    {
      label: "Impressions",
      value: formatCompactNumber(totals.impressions),
      tone: "bg-rose-600 text-white",
    },
    {
      label: "Avg. CPC",
      value: formatAverageCpcFromMicros(totals.average_cpc),
      tone: "bg-bip-card text-bip-text border border-bip-border",
    },
    {
      label: "Cost",
      value: formatCurrencyFromMicros(totals.cost_micros),
      tone: "bg-bip-card text-bip-text border border-bip-border",
    },
  ];
  return (
    <div className="space-y-2">
      
      <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
        
        Google Ads snapshot
      </p>
      <p className="text-xs text-bip-muted">
        
        {formatDateRangeLabel(
          adsSnapshot.start_date,
          adsSnapshot.end_date,
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        
        {cards.map((card) => (
          <div key={card.label} className={`rounded-md px-3 py-2 ${card.tone}`}>
            
            <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">
              {card.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function MarketingUpdateComposer({
  client,
  adsSnapshot,
}: MarketingUpdateComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState(defaultMarketingUpdateTitle());
  const [greeting, setGreeting] = useState(
    defaultMarketingUpdateGreeting(client.account_name),
  );
  const [startDate, setStartDate] = useState(adsSnapshot?.start_date ?? "");
  const [endDate, setEndDate] = useState(adsSnapshot?.end_date ?? "");
  const [gbpManual, setGbpManual] = useState<GbpManualForm>(emptyGbpManual);
  const [gbpExpanded, setGbpExpanded] = useState(false);
  const [clientRequests, setClientRequests] = useState("");
  const [nextMeetingUrl, setNextMeetingUrl] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [contextSummary, setContextSummary] =
    useState<MarketingUpdateContextSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  useEffect(() => {
    setTitle(defaultMarketingUpdateTitle());
    setGreeting(defaultMarketingUpdateGreeting(client.account_name));
    setStartDate(adsSnapshot?.start_date ?? "");
    setEndDate(adsSnapshot?.end_date ?? "");
    setMarkdown("");
    setContextSummary(null);
    setError(null);
    setCopyMessage(null);
  }, [
    client.id,
    client.account_name,
    adsSnapshot?.start_date,
    adsSnapshot?.end_date,
  ]);
  const channelsLabel = useMemo(() => {
    if (!contextSummary) return null;
    if (contextSummary.channelsIncluded.length === 0)
      return "No synced channels included.";
    return contextSummary.channelsIncluded.join(" ·");
  }, [contextSummary]);
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setCopyMessage(null);
    try {
      const response = await fetch("/api/ai/marketing-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          title,
          greeting,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          gbpManual: {
            totalInteractions: parseOptionalNumber(gbpManual.totalInteractions),
            phoneCalls: parseOptionalNumber(gbpManual.phoneCalls),
            directionRequests: parseOptionalNumber(gbpManual.directionRequests),
            websiteClicks: parseOptionalNumber(gbpManual.websiteClicks),
          },
          clientRequests: clientRequests.trim() || undefined,
          nextMeetingUrl: nextMeetingUrl.trim() || undefined,
          additionalNotes: additionalNotes.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        markdown?: string;
        context?: MarketingUpdateContextSummary;
        error?: string;
      };
      if (!response.ok || !payload.markdown) {
        throw new Error(
          payload.error ?? "Failed to generate marketing update.",
        );
      }
      setMarkdown(payload.markdown);
      setContextSummary(payload.context ?? null);
      if (textareaRef.current) {
        textareaRef.current.value = payload.markdown;
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate marketing update.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function handleCopy(mode: "markdown" | "plain") {
    const text = textareaRef.current?.value ?? markdown;
    if (!text.trim()) return;
    const output = mode === "plain" ? markdownToPlainText(text) : text;
    try {
      await navigator.clipboard.writeText(output);
      setCopyMessage(
        mode === "markdown" ? "Markdown copied." : "Plain text copied.",
      );
    } catch {
      setCopyMessage("Could not copy automatically. Please copy manually.");
    }
  }
  return (
    <section className="rounded-lg border border-emerald-200 bg-bip-card p-3">
      
      <div className="flex flex-wrap items-start justify-between gap-2">
        
        <div>
          
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            
            Client marketing update
          </p>
          <p className="mt-0.5 text-sm text-bip-text">
            
            Generate a Basecamp-style client update from synced data, then copy
            into Basecamp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
        >
          
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate update
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        
        <label className="block">
          
          <span className="text-xs text-bip-muted">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
          />
        </label>
        <label className="block">
          
          <span className="text-xs text-bip-muted">Greeting</span>
          <input
            value={greeting}
            onChange={(event) => setGreeting(event.target.value)}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
            placeholder="Hi Erika and Dr. Barnes,"
          />
        </label>
        <label className="block">
          
          <span className="text-xs text-bip-muted">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
          />
        </label>
        <label className="block">
          
          <span className="text-xs text-bip-muted">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
          />
        </label>
      </div>
      <div className="mt-3 rounded-md border border-bip-border">
        
        <button
          type="button"
          onClick={() => setGbpExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-bip-text"
        >
          
          GBP metrics (manual)
          {gbpExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {gbpExpanded && (
          <div className="grid gap-2 border-t border-bip-border px-3 py-3 md:grid-cols-2">
            
            {(
              [
                ["totalInteractions", "Total interactions"],
                ["phoneCalls", "Phone calls"],
                ["directionRequests", "Direction requests"],
                ["websiteClicks", "Website clicks"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                
                <span className="text-xs text-bip-muted">{label}</span>
                <input
                  inputMode="numeric"
                  value={gbpManual[key]}
                  onChange={(event) =>
                    setGbpManual((prev) => ({
                      ...prev,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
                  placeholder="Optional"
                />
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        
        <label className="block md:col-span-2">
          
          <span className="text-xs text-bip-muted">
            Client requests (NEXT STEPS)
          </span>
          <textarea
            value={clientRequests}
            onChange={(event) => setClientRequests(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
            placeholder="Example: Please send updated team photos for the GBP profile."
          />
        </label>
        <label className="block">
          
          <span className="text-xs text-bip-muted">Next meeting URL</span>
          <input
            value={nextMeetingUrl}
            onChange={(event) => setNextMeetingUrl(event.target.value)}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
            placeholder="https://..."
          />
        </label>
        <label className="block">
          
          <span className="text-xs text-bip-muted">
            Additional notes for AI
          </span>
          <input
            value={additionalNotes}
            onChange={(event) => setAdditionalNotes(event.target.value)}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
            placeholder="Optional context for the draft"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {channelsLabel && (
        <p className="mt-2 text-xs text-bip-muted">
          
          Channels included: {channelsLabel}
        </p>
      )}
      {(markdown || loading) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          
          <div className="space-y-3">
            
            <div className="rounded-lg border border-bip-border bg-bip-page p-4">
              
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
                
                Basecamp preview
              </p>
              {loading ? (
                <p className="text-sm text-bip-text">Generating update…</p>
              ) : (
                <div className="space-y-2">
                  {renderMarkdownPreview(markdown)}
                </div>
              )}
            </div>
            <div>
              
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                
                <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
                  
                  Editable draft
                </p>
                <div className="flex items-center gap-2">
                  
                  <button
                    type="button"
                    onClick={() => void handleCopy("markdown")}
                    disabled={!markdown.trim()}
                    className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60"
                  >
                    
                    <Copy className="h-3.5 w-3.5" /> Copy markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy("plain")}
                    disabled={!markdown.trim()}
                    className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60"
                  >
                    
                    <Copy className="h-3.5 w-3.5" /> Copy plain text
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                defaultValue={markdown}
                key={`${client.id}-${markdown.slice(0, 24)}`}
                onChange={() => {
                  if (copyMessage) setCopyMessage(null);
                }}
                rows={16}
                className="w-full bip-input shadow-none"
              />
              {copyMessage && (
                <p className="mt-2 text-xs text-bip-muted">{copyMessage}</p>
              )}
              <p className="mt-2 text-xs text-bip-muted">
                
                Attach your Google Ads dashboard screenshot separately in
                Basecamp.
              </p>
            </div>
          </div>
          <aside className="rounded-lg border border-bip-border bg-bip-card p-3">
            
            <AdsKpiStrip adsSnapshot={adsSnapshot} />
          </aside>
        </div>
      )}
    </section>
  );
}
