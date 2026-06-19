"use client";

import { useRef, useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import ReportConfigEditor from "./report-config-editor";
import {
  DEFAULT_REPORT_CONFIG,
  type ReportConfig,
  type SectionConfig,
} from "@/lib/reporting/report-config-types";

const BI_BLUE = "#3D52C4";
const BI_PURPLE = "#7B35B0";
const BI_MAGENTA = "#E4177F";

// ── Mock data ─────────────────────────────────────────────────────────────────

const CLIENT_NAME = "Lakewood Animal Hospital";
const STRATEGIST = "Melissa";
const WINDOW = "May 19 – Jun 18, 2026";

const NARRATIVE = `Hi Dr. Chen,

Here's your performance summary for the past 30 days. Your organic search traffic is up 12% and ad conversions hit a new high this month — 67 new appointment requests through Google Ads. Your top blog post on summer pet safety drove 41 clicks on its own, which is great momentum for SEO.

A couple of things to keep an eye on: your average search position improved from 11.4 to 9.2, which means more of your pages are creeping toward page one. We'll keep pushing on the dental and surgery service pages next month.

– Melissa`;

type Metric = { key: string; label: string; value: string; delta: number | null };

const GSC_METRICS: Metric[] = [
  { key: "clicks", label: "Organic Clicks", value: "284", delta: 12.4 },
  { key: "impressions", label: "Impressions", value: "18,340", delta: 8.7 },
  { key: "ctr", label: "Click-Through Rate", value: "1.55%", delta: 3.2 },
  { key: "avg_position", label: "Avg Search Position", value: "9.2", delta: -19.3 },
];

const ADS_METRICS: Metric[] = [
  { key: "ad_clicks", label: "Ad Clicks", value: "312", delta: 7.3 },
  { key: "impressions", label: "Impressions", value: "4,120", delta: -2.1 },
  { key: "conversions", label: "Conversions", value: "67", delta: 18.5 },
  { key: "ctr", label: "Click-Through Rate", value: "7.57%", delta: 9.6 },
  { key: "avg_cpc", label: "Avg Cost Per Click", value: "$3.12", delta: -4.2 },
  { key: "cost_per_conversion", label: "Cost Per Conversion", value: "$14.50", delta: -18.9 },
  { key: "interactions", label: "Interactions", value: "318", delta: 6.8 },
  { key: "all_conversions", label: "All Conversions", value: "74", delta: 15.2 },
  { key: "view_through_conversions", label: "View-Through Conv.", value: "7", delta: null },
  { key: "conversions_value", label: "Conversion Value", value: "$1,944", delta: 22.1 },
  { key: "conversion_rate", label: "Conversion Rate", value: "21.5%", delta: 10.3 },
  { key: "roas", label: "ROAS", value: "6.23x", delta: 14.8 },
  { key: "search_impression_share", label: "Impression Share", value: "48.3%", delta: 3.1 },
  { key: "search_top_impression_share", label: "Top Impression Share", value: "31.2%", delta: 5.4 },
  { key: "search_absolute_top_impression_share", label: "Abs. Top IS", value: "18.7%", delta: 2.9 },
  { key: "search_rank_lost_impression_share", label: "Lost IS (Rank)", value: "22.1%", delta: -4.3 },
  { key: "search_budget_lost_impression_share", label: "Lost IS (Budget)", value: "11.4%", delta: -8.7 },
];

const GA4_METRICS: Metric[] = [
  { key: "sessions", label: "Sessions", value: "1,847", delta: 9.2 },
  { key: "new_users", label: "New Users", value: "1,203", delta: 14.6 },
  { key: "avg_session_duration", label: "Avg Session Duration", value: "2m 14s", delta: 5.1 },
];

const TOP_PAGES = [
  { url: "/", label: "/  (Home)", clicks: 89 },
  { url: "/services/preventive-care", label: "/services/preventive-care", clicks: 41 },
  { url: "/appointments", label: "/appointments", clicks: 38 },
  { url: "/about-us", label: "/about-us", clicks: 24 },
  { url: "/services/dental", label: "/services/dental", clicks: 19 },
  { url: "/services/surgery", label: "/services/surgery", clicks: 14 },
  { url: "/blog/summer-pet-safety-tips", label: "/blog/summer-pet-safety-tips", clicks: 11 },
  { url: "/contact", label: "/contact", clicks: 9 },
];

const KEYWORDS = [
  { keyword: "veterinarian near me", tag: "local", position: 4.2, prevPosition: 5.8, clicks: 38, prevClicks: 31 },
  { keyword: "animal hospital lakewood", tag: "branded", position: 1.4, prevPosition: 1.2, clicks: 29, prevClicks: 26 },
  { keyword: "dog vaccinations lakewood", tag: "service", position: 3.1, prevPosition: 4.7, clicks: 17, prevClicks: 9 },
  { keyword: "cat dental cleaning near me", tag: "service", position: 8.3, prevPosition: 12.1, clicks: 11, prevClicks: 4 },
  { keyword: "emergency vet lakewood", tag: "local", position: 6.7, prevPosition: 6.5, clicks: 8, prevClicks: 9 },
];

const SOCIAL_DATA: { key: string; label: string; value: number }[] = [
  { key: "reach", label: "People reached", value: 2847 },
  { key: "engagements", label: "Engagements", value: 312 },
  { key: "impressions", label: "Impressions", value: 8920 },
  { key: "link_clicks", label: "Link clicks", value: 87 },
  { key: "new_followers", label: "New followers", value: 23 },
];

const DAILY_TREND = [
  { date: "May 22", clicks: 8, impressions: 542 },
  { date: "May 23", clicks: 11, impressions: 618 },
  { date: "May 24", clicks: 6, impressions: 490 },
  { date: "May 25", clicks: 4, impressions: 381 },
  { date: "May 26", clicks: 13, impressions: 701 },
  { date: "May 27", clicks: 15, impressions: 744 },
  { date: "May 28", clicks: 14, impressions: 728 },
  { date: "May 29", clicks: 9, impressions: 563 },
  { date: "May 30", clicks: 7, impressions: 502 },
  { date: "May 31", clicks: 5, impressions: 420 },
  { date: "Jun 1",  clicks: 4, impressions: 398 },
  { date: "Jun 2",  clicks: 12, impressions: 655 },
  { date: "Jun 3",  clicks: 17, impressions: 791 },
  { date: "Jun 4",  clicks: 16, impressions: 762 },
  { date: "Jun 5",  clicks: 10, impressions: 589 },
  { date: "Jun 6",  clicks: 8,  impressions: 531 },
  { date: "Jun 7",  clicks: 5,  impressions: 444 },
  { date: "Jun 8",  clicks: 4,  impressions: 402 },
  { date: "Jun 9",  clicks: 14, impressions: 712 },
  { date: "Jun 10", clicks: 18, impressions: 834 },
  { date: "Jun 11", clicks: 19, impressions: 867 },
  { date: "Jun 12", clicks: 13, impressions: 681 },
  { date: "Jun 13", clicks: 9,  impressions: 557 },
  { date: "Jun 14", clicks: 6,  impressions: 471 },
  { date: "Jun 15", clicks: 5,  impressions: 438 },
  { date: "Jun 16", clicks: 16, impressions: 776 },
  { date: "Jun 17", clicks: 20, impressions: 891 },
  { date: "Jun 18", clicks: 18, impressions: 843 },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta, invertGood = false }: { delta: number | null; invertGood?: boolean }) {
  if (delta == null) return null;
  const isGood = invertGood ? delta < 0 : delta > 0;
  const neutral = delta === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      neutral ? "bg-gray-100 text-gray-500"
      : isGood ? "bg-emerald-50 text-emerald-700"
      : "bg-red-50 text-red-600"
    }`}>
      {!neutral && (isGood ? "▲" : "▼")}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function MetricCard({ metric, invertGood = false }: { metric: Metric; invertGood?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-2">
      <p className="text-xs text-gray-500">{metric.label}</p>
      <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
      {metric.delta != null && (
        <div className="flex items-center gap-1.5">
          <DeltaBadge delta={metric.delta} invertGood={invertGood} />
          <span className="text-[10px] text-gray-400">vs prior period</span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: BI_BLUE }}>
      {children}
    </h2>
  );
}

// ── Main template ──────────────────────────────────────────────────────────────

export default function ReportTemplate() {
  const mainRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);

  // Config state
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);

  // Edit-mode state
  const [editMode, setEditMode] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [saving, setSaving] = useState(false);

  // Password lock
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);

  useEffect(() => {
    fetch("/api/reporting/template-config")
      .then((r) => r.json())
      .then((d: { config?: ReportConfig }) => {
        if (d.config) setConfig(d.config);
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  async function checkPassword() {
    setCheckingPassword(true);
    setPasswordError("");
    try {
      const res = await fetch("/api/reporting/template-config/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        setShowPasswordModal(false);
        setPasswordInput("");
        setDraftConfig(config);
        setEditMode(true);
      } else {
        setPasswordError("Incorrect password");
      }
    } catch {
      setPasswordError("Could not verify password");
    } finally {
      setCheckingPassword(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/reporting/template-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: draftConfig }),
      });
      if (res.ok) {
        setConfig(draftConfig);
        setEditMode(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const activeConfig = editMode ? draftConfig : config;

  function sectionVisible(key: string) {
    return activeConfig.sections.find((s) => s.key === key)?.visible ?? true;
  }

  function getKips() {
    return activeConfig.sections.find((s): s is Extract<SectionConfig, { key: "kpis" }> => s.key === "kpis");
  }

  function getSocial() {
    return activeConfig.sections.find((s): s is Extract<SectionConfig, { key: "social" }> => s.key === "social");
  }

  function subVisible(subKey: string) {
    return getKips()?.subsections.find((s) => s.key === subKey)?.visible ?? true;
  }

  function metricVisible(subKey: string, metricKey: string) {
    return getKips()?.subsections.find((s) => s.key === subKey)?.metrics[metricKey] ?? true;
  }

  function socialMetricVisible(metricKey: string) {
    return getSocial()?.metrics[metricKey] ?? true;
  }

  const maxClicks = Math.max(...TOP_PAGES.map((p) => p.clicks));

  async function downloadPdf() {
    if (!mainRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(mainRef.current, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        ignoreElements: (el) => el.classList.contains("no-print"),
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let remaining = imgH; let offset = 0;
      pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
      remaining -= pageH;
      while (remaining > 0) { offset -= pageH; pdf.addPage(); pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH); remaining -= pageH; }
      const fileName = "bip-report-template.pdf";
      if ("showSaveFilePicker" in window) {
        const blob = pdf.output("blob");
        const handle = await (window as unknown as { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "PDF Document", accept: { "application/pdf": [".pdf"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob); await writable.close();
      } else { pdf.save(fileName); }
    } finally { setExporting(false); }
  }

  if (configLoading) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-gray-400">Loading template…</div>;
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Unlock master template</h2>
            <p className="text-xs text-gray-500">Enter the template password to enable editing.</p>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": BI_BLUE } as React.CSSProperties}
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !checkingPassword && passwordInput) void checkPassword(); }}
              autoFocus
            />
            {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowPasswordModal(false); setPasswordInput(""); setPasswordError(""); }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void checkPassword()}
                disabled={checkingPassword || !passwordInput}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: BI_BLUE }}
              >
                {checkingPassword ? "Checking…" : "Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top banner */}
      <div className="no-print bg-amber-50 border-b border-amber-200 px-8 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-amber-700 font-medium">
          ⚠ Master template — placeholder data only. Changes here become the default layout for all clients.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {editMode ? (
            <button
              type="button"
              onClick={() => { setDraftConfig(config); setEditMode(false); }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              <Lock size={12} /> Lock &amp; discard changes
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: BI_BLUE }}
            >
              <Unlock size={12} /> Edit layout
            </button>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editMode && (
        <div className="no-print border-b border-blue-100 bg-blue-50 px-8 py-4">
          <ReportConfigEditor
            config={draftConfig}
            onChange={setDraftConfig}
            saving={saving}
            onSave={() => void saveConfig()}
          />
        </div>
      )}

      <main ref={mainRef} className="mx-auto max-w-4xl space-y-8 px-8 py-6 text-gray-800">

        {/* ── Header ── */}
        <header className="rounded-2xl overflow-hidden shadow-sm">
          <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${BI_BLUE}, ${BI_PURPLE}, ${BI_MAGENTA})` }} />
          <div className="border border-t-0 border-gray-200 rounded-b-2xl px-7 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: `linear-gradient(135deg, ${BI_BLUE}, ${BI_PURPLE})` }}>B</div>
                  <span className="text-sm font-semibold tracking-tight" style={{ color: BI_BLUE }}>Beyond Indigo Pets</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Client Performance Report</h1>
                <p className="mt-0.5 text-base font-medium" style={{ color: BI_PURPLE }}>{CLIENT_NAME}</p>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <p>{WINDOW}</p>
                <p>Generated: {new Date().toLocaleDateString()}</p>
                <p>Strategist: {STRATEGIST}</p>
              </div>
            </div>
            <div className="no-print mt-4 flex justify-end">
              <button type="button" onClick={() => void downloadPdf()} disabled={exporting}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: BI_BLUE, color: BI_BLUE }}>
                {exporting ? "Generating PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
        </header>

        {/* ── From your strategist ── */}
        <section className="rounded-2xl border border-gray-200 px-7 py-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: BI_BLUE }}>
            From your strategist
          </h2>
          <p className="text-sm leading-6 text-gray-700 whitespace-pre-line">{NARRATIVE}</p>
        </section>

        {/* ── Performance Overview ── */}
        {sectionVisible("kpis") && (
          <section>
            <SectionLabel>Performance Overview</SectionLabel>
            <p className="text-xs text-gray-400 mb-4">{WINDOW} · changes vs prior period</p>

            {subVisible("organic_search") && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Organic Search</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {GSC_METRICS.filter((m) => metricVisible("organic_search", m.key)).map((m) => (
                    <MetricCard key={m.key} metric={m} invertGood={m.key === "avg_position"} />
                  ))}
                </div>
              </div>
            )}

            {subVisible("google_ads") && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Google Ads</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ADS_METRICS.filter((m) => metricVisible("google_ads", m.key)).map((m) => (
                    <MetricCard key={m.key} metric={m}
                      invertGood={m.key === "avg_cpc" || m.key === "cost_per_conversion"} />
                  ))}
                </div>
              </div>
            )}

            {subVisible("ga4") && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Website Traffic (GA4)</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {GA4_METRICS.filter((m) => metricVisible("ga4", m.key)).map((m) => (
                    <MetricCard key={m.key} metric={m} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Search Performance Trend ── */}
        {sectionVisible("gsc_trend") && (
          <section>
            <SectionLabel>Search Performance Trend</SectionLabel>
            <p className="text-xs text-gray-400 mb-4">Daily clicks and impressions over the past 28 days</p>
            <div className="rounded-2xl border border-gray-200 px-6 py-5">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={DAILY_TREND} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    interval={6}
                  />
                  <YAxis
                    yAxisId="clicks"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <YAxis
                    yAxisId="impressions"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    itemStyle={{ padding: "1px 0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line
                    yAxisId="clicks"
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke={BI_BLUE}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="impressions"
                    type="monotone"
                    dataKey="impressions"
                    name="Impressions"
                    stroke={BI_MAGENTA}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Search Traffic ── */}
        {sectionVisible("gsc_top_pages") && (
          <section>
            <SectionLabel>Search Traffic</SectionLabel>
            <p className="text-xs text-gray-400 mb-4">Your top-performing pages in organic search this period</p>
            <div className="rounded-2xl border border-gray-200 px-6 py-5">
              <div className="space-y-2.5">
                {TOP_PAGES.map((page) => {
                  const pct = Math.round((page.clicks / maxClicks) * 100);
                  return (
                    <div key={page.url} className="grid items-center gap-3" style={{ gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 44px" }}>
                      <span className="truncate text-xs text-gray-700">{page.label}</span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BI_BLUE }} />
                      </div>
                      <span className="text-right text-xs text-gray-500">{page.clicks}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
                {[
                  { label: "Total clicks", value: TOP_PAGES.reduce((s, p) => s + p.clicks, 0).toLocaleString() },
                  { label: "Total impressions", value: "18,340" },
                  { label: "Avg position", value: "9.2" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-400">{stat.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Keyword Rankings ── */}
        {sectionVisible("keywords") && (
          <section>
            <SectionLabel>Keyword Rankings</SectionLabel>
            <p className="text-xs text-gray-400 mb-4">Tracked keywords — position and click trends vs prior period</p>
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="px-5 pb-3 pt-3">Keyword</th>
                    <th className="px-3 pb-3 pt-3 text-right">Position</th>
                    <th className="px-3 pb-3 pt-3 text-right">Change</th>
                    <th className="px-5 pb-3 pt-3 text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {KEYWORDS.map((kw) => {
                    const delta = kw.position - kw.prevPosition;
                    const improved = delta < 0;
                    const worsened = delta > 0;
                    return (
                      <tr key={kw.keyword} className="border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3">
                          <span className="font-medium text-gray-800">{kw.keyword}</span>
                          {kw.tag && <span className="ml-2 text-[10px] text-gray-400">{kw.tag}</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700">{kw.position.toFixed(1)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            improved ? "bg-emerald-50 text-emerald-700"
                            : worsened ? "bg-red-50 text-red-600"
                            : "bg-gray-100 text-gray-500"
                          }`}>
                            {improved ? "▲" : worsened ? "▼" : "—"}{Math.abs(delta).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs">
                          <span className="font-medium text-gray-800">{kw.clicks}</span>
                          <span className="ml-1 text-gray-400">/ {kw.prevClicks}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Social Media ── */}
        {sectionVisible("social") && (
          <section>
            <SectionLabel>Social Media</SectionLabel>
            <p className="text-xs text-gray-400 mb-4">30-day totals across connected platforms</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SOCIAL_DATA.filter((s) => socialMetricVisible(s.key)).map((s) => (
                <div key={s.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="border-t border-gray-200 pt-4 pb-8 flex items-center justify-between text-xs text-gray-400">
          <span style={{ color: BI_BLUE }} className="font-medium">Beyond Indigo Pets</span>
          <span>Confidential · {new Date().getFullYear()}</span>
        </footer>

      </main>
    </div>
  );
}
