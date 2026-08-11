"use client";

import { useState, useEffect, useMemo } from "react";
import type { ControlCenterClient } from "@/app/(app)/control-center/page";

// ─── NOVA-style palette: warm charcoal · cream · cyan ────────────────────────
const C = {
  bg: "#1c1510",
  panel: "#211c12",
  panelAlt: "#1a1610",
  border: "rgba(200, 178, 110, 0.22)",
  borderBright: "rgba(110, 206, 206, 0.5)",
  cream: "#c8b478",       // primary accent — labels, lines, most text
  cyan: "#6ecece",        // secondary accent — highlights, active states
  creamDim: "#7a6840",    // secondary text
  creamDimmer: "#3d3318", // dividers, disabled
  // severity (muted — not neon)
  red: "#c05848",
  amber: "#b08030",
  green: "#60a860",
};

const FONT = "'Courier New', 'Lucida Console', monospace";

const TICKER = "BIP CONTROL CENTER · SYSTEM OPERATIONAL · ALL SUBSYSTEMS NOMINAL · 91 CLIENTS MONITORED · BEYOND INDIGO PETS · VETERINARY MARKETING INTELLIGENCE PLATFORM · COMMS MONITOR ACTIVE · AD PERFORMANCE TRACKING ENABLED · SEO SIGNALS NOMINAL · GBP HEALTH MONITORING ON · SOCIAL PLANNER ACTIVE · ";

// ─── Decorative SVGs ─────────────────────────────────────────────────────────

function WaveformDecoration() {
  const pts = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 59) * 200;
    const y = 20 + Math.sin(i * 0.4) * 8 + Math.sin(i * 0.9 + 1) * 5 + Math.sin(i * 0.2) * 4;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 200 40" style={{ width: "100%", height: 40, opacity: 0.4 }}>
      <polyline points={pts} fill="none" stroke={C.cream} strokeWidth="0.8" />
    </svg>
  );
}

function RadarDecoration() {
  return (
    <svg viewBox="0 0 80 80" style={{ width: 80, height: 80, opacity: 0.35 }}>
      {[36, 27, 18, 9].map((r) => (
        <circle key={r} cx="40" cy="40" r={r} fill="none" stroke={C.cyan} strokeWidth="0.6" />
      ))}
      <line x1="4" y1="40" x2="76" y2="40" stroke={C.cyan} strokeWidth="0.5" />
      <line x1="40" y1="4" x2="40" y2="76" stroke={C.cyan} strokeWidth="0.5" />
      <line x1="14" y1="14" x2="66" y2="66" stroke={C.cyan} strokeWidth="0.4" strokeDasharray="2 3" />
      <line x1="66" y1="14" x2="14" y2="66" stroke={C.cyan} strokeWidth="0.4" strokeDasharray="2 3" />
      <circle cx="52" cy="28" r="2" fill={C.cyan} opacity={0.7} />
    </svg>
  );
}

function BarChartDecoration({ accent = C.cream }: { accent?: string }) {
  const heights = [12, 28, 18, 40, 24, 34, 16, 30, 20, 38, 14, 26];
  return (
    <svg viewBox="0 0 120 48" style={{ width: "100%", height: 48, opacity: 0.35 }}>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 1}
          y={48 - h}
          width={7}
          height={h}
          fill={accent}
        />
      ))}
    </svg>
  );
}

// ─── Base components ──────────────────────────────────────────────────────────

function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        background: color,
        flexShrink: 0,
        animation: pulse ? "pulse-dot 2.5s ease-in-out infinite" : undefined,
      }}
    />
  );
}

function Divider() {
  return <div style={{ width: "100%", height: 1, background: C.border }} />;
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: C.creamDim, letterSpacing: "0.12em" }}>{label}</span>
      <span style={{ fontSize: 20, color: C.cream, letterSpacing: "0.04em" }}>{value}</span>
    </div>
  );
}

function PlaceholderBars({ accent = C.cream, count = 4 }: { accent?: string; count?: number }) {
  const widths = [38, 62, 28, 75, 45, 55];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: C.creamDim, width: 14, letterSpacing: "0.04em" }}>
            {String.fromCharCode(65 + i)}
          </span>
          <div style={{ flex: 1, height: 1, background: C.creamDimmer, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${widths[i % 6]}%`,
                background: accent,
                opacity: 0.45,
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: C.creamDim, width: 26, textAlign: "right" }}>─ ─</span>
        </div>
      ))}
    </div>
  );
}

function StandbyLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.6 }}>
      <span style={{ fontSize: 9, color: C.creamDim, letterSpacing: "0.18em" }}>── STANDBY ──</span>
      <span style={{ fontSize: 9, color: C.creamDim, letterSpacing: "0.07em", textAlign: "center", lineHeight: 1.6 }}>
        {label}
      </span>
    </div>
  );
}

type PanelProps = {
  title: string;
  tag?: string;
  accentHeader?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

function Panel({ title, tag = "STANDBY", accentHeader = C.cream, children, style }: PanelProps) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {/* Corner ticks */}
      {[
        { top: 0, left: 0, w: 6, h: 1 },
        { top: 0, left: 0, w: 1, h: 6 },
        { top: 0, right: 0, w: 6, h: 1 },
        { top: 0, right: 0, w: 1, h: 6 },
        { bottom: 0, left: 0, w: 6, h: 1 },
        { bottom: 0, left: 0, w: 1, h: 6 },
        { bottom: 0, right: 0, w: 6, h: 1 },
        { bottom: 0, right: 0, w: 1, h: 6 },
      ].map((tick, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            background: accentHeader,
            opacity: 0.7,
            ...tick,
          }}
        />
      ))}

      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "7px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ color: accentHeader, fontSize: 11, letterSpacing: "0.16em" }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, background: C.creamDimmer }} />
          <span style={{ color: C.creamDim, fontSize: 9, letterSpacing: "0.1em" }}>{tag}</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: "12px 14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Panel content ────────────────────────────────────────────────────────────

function ClientSelectorPanel({
  clients,
  selectedId,
  onSelect,
}: {
  clients: ControlCenterClient[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? clients.filter(
          (c) =>
            c.account_name.toLowerCase().includes(q) ||
            (c.marketing_strategist ?? "").toLowerCase().includes(q)
        )
      : clients;
  }, [clients, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, overflow: "hidden" }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 28, marginBottom: 10 }}>
        <MetricBlock label="TOTAL CLIENTS" value={String(clients.length)} />
        <MetricBlock label="SELECTED" value={selectedId ? "1" : "─"} />
      </div>
      <Divider />

      {/* Search */}
      <div style={{ padding: "8px 0 6px", position: "relative" }}>
        <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.creamDim, pointerEvents: "none" }}>
          ▶
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH CLIENT OR STRATEGIST..."
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${C.border}`,
            outline: "none",
            color: C.cream,
            fontSize: 10,
            letterSpacing: "0.1em",
            fontFamily: FONT,
            paddingLeft: 14,
            paddingBottom: 5,
          }}
        />
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginTop: 4,
        }}
      >
        {filtered.length === 0 && (
          <div style={{ color: C.creamDim, fontSize: 10, letterSpacing: "0.1em", padding: "12px 0", textAlign: "center" }}>
            NO MATCH
          </div>
        )}
        {filtered.map((client) => {
          const active = client.id === selectedId;
          return (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                background: active ? "rgba(110, 206, 206, 0.08)" : "transparent",
                border: "none",
                borderLeft: active ? `2px solid ${C.cyan}` : "2px solid transparent",
                padding: "5px 8px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: FONT,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  background: active ? C.cyan : C.creamDimmer,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: active ? C.cyan : C.cream,
                  letterSpacing: "0.06em",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {client.account_name.toUpperCase()}
              </span>
              {client.marketing_strategist && (
                <span style={{ fontSize: 8, color: C.creamDim, letterSpacing: "0.04em", flexShrink: 0 }}>
                  {client.marketing_strategist.split(" ")[0].toUpperCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SystemAlertsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      {[
        { label: "CRITICAL", color: C.red },
        { label: "WARNING", color: C.amber },
        { label: "INFO", color: C.cyan },
        { label: "NOMINAL", color: C.green },
      ].map(({ label, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, background: color }} />
          <span style={{ fontSize: 10, color, letterSpacing: "0.1em", flex: 1 }}>{label}</span>
          <span style={{ fontSize: 16, color: C.creamDim }}>─</span>
        </div>
      ))}
      <Divider />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <StandbyLabel label="CROSS-CLIENT ALERT AGGREGATOR" />
      </div>
    </div>
  );
}

function CommsMonitorPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <MetricBlock label="OPEN THREADS" value="─" />
        <MetricBlock label="AWAITING REPLY" value="─" />
        <MetricBlock label="OVERDUE" value="─" />
      </div>
      <Divider />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <WaveformDecoration />
        <StandbyLabel label="BASECAMP THREAD FEED · REPLY STATUS · OVERDUE FLAGS" />
      </div>
    </div>
  );
}

function AdPerformancePanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <MetricBlock label="TOTAL ACTIVE SPEND" value="$─ ─ ─" />
      <Divider />
      <PlaceholderBars accent={C.cyan} count={4} />
      <div style={{ flex: 1 }} />
      <BarChartDecoration accent={C.cyan} />
      <StandbyLabel label="AD SPEND · CTR · CONVERSIONS" />
    </div>
  );
}

function GbpHealthPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <MetricBlock label="AVG RATING" value="─ . ─" />
      <Divider />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <StandbyLabel label={"GBP RATINGS\nREVIEW VELOCITY\nPROFILE SCORES"} />
        <RadarDecoration />
      </div>
    </div>
  );
}

function SeoSignalsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <MetricBlock label="AVG POSITION" value="─ ─" />
        <MetricBlock label="IMPRESSIONS" value="─ ─ ─" />
      </div>
      <Divider />
      <PlaceholderBars accent={C.cream} count={3} />
      <div style={{ flex: 1 }} />
      <StandbyLabel label="GSC · GA4 · ORGANIC TRENDS" />
    </div>
  );
}

function SocialMetricsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <MetricBlock label="POSTS PLANNED" value="─" />
        <MetricBlock label="CLIENTS ACTIVE" value="─" />
      </div>
      <Divider />
      <PlaceholderBars accent={C.cream} count={3} />
      <div style={{ flex: 1 }} />
      <StandbyLabel label="SOCIAL PLANS · CONTENT STATUS · ENGAGEMENT" />
    </div>
  );
}

type IntegrationStatus = "NOMINAL" | "WARNING" | "CRITICAL" | "OFFLINE";

function PlatformStatusPanel() {
  const integrations: { name: string; status: IntegrationStatus }[] = [
    { name: "GOOGLE ADS", status: "OFFLINE" },
    { name: "GOOGLE ANALYTICS", status: "OFFLINE" },
    { name: "SEARCH CONSOLE", status: "OFFLINE" },
    { name: "GOOGLE MY BUSINESS", status: "OFFLINE" },
    { name: "BASECAMP", status: "OFFLINE" },
    { name: "META ADS", status: "OFFLINE" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, height: "100%" }}>
      {integrations.map(({ name, status }) => {
        const color =
          status === "NOMINAL" ? C.green :
          status === "WARNING" ? C.amber :
          status === "CRITICAL" ? C.red :
          C.creamDim;
        return (
          <div
            key={name}
            style={{
              border: `1px solid ${C.border}`,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, background: color }} />
              <span style={{ fontSize: 9, color, letterSpacing: "0.06em" }}>{status}</span>
            </div>
            <span style={{ fontSize: 9, color: C.creamDim, letterSpacing: "0.05em", lineHeight: 1.4 }}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ControlCenter({ clients }: { clients: ControlCenterClient[] }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [blink, setBlink] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setDate(
        now
          .toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
          .toUpperCase()
      );
      setBlink((b) => !b);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100%",
        fontFamily: FONT,
        color: C.cream,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* ── Header ── */}
      <header
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "0 20px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: C.panelAlt,
        }}
      >
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 30,
              height: 30,
              border: `1px solid ${C.borderBright}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Corner ticks on logo box */}
            {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos, i) => (
              <div key={i} style={{ position:"absolute", width:4, height:4, border:`1px solid ${C.cyan}`, ...pos, background: C.panelAlt }} />
            ))}
            <span style={{ color: C.cyan, fontSize: 13 }}>◈</span>
          </div>
          <div>
            <div style={{ fontSize: 13, letterSpacing: "0.22em", color: C.cream }}>
              BIP CONTROL CENTER
            </div>
            <div style={{ fontSize: 9, color: C.creamDim, letterSpacing: "0.14em", marginTop: 1 }}>
              BEYOND INDIGO PETS · MARKETING INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Center: selected client or status indicators */}
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {selectedClient ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 8, color: C.creamDim, letterSpacing: "0.12em" }}>WORKING ON</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 5, height: 5, background: C.cyan }} />
                <span style={{ fontSize: 11, color: C.cyan, letterSpacing: "0.1em", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedClient.account_name.toUpperCase()}
                </span>
                <button
                  onClick={() => setSelectedClientId(null)}
                  style={{ background: "none", border: "none", color: C.creamDim, fontSize: 10, cursor: "pointer", fontFamily: FONT, letterSpacing: "0.06em", padding: 0 }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <>
              {[
                { label: "SYSTEM", value: "ONLINE", color: C.green },
                { label: "SYNC", value: "IDLE", color: C.amber },
                { label: "AI", value: "READY", color: C.cyan },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 8, color: C.creamDim, letterSpacing: "0.12em" }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot color={color} pulse />
                    <span style={{ fontSize: 10, color, letterSpacing: "0.1em" }}>{value}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Right: clock */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, letterSpacing: "0.06em", color: C.cream, lineHeight: 1 }}>
            {time || "──:──:──"}
          </div>
          <div style={{ fontSize: 9, color: C.creamDim, letterSpacing: "0.1em", marginTop: 2 }}>
            {date || "─── ─── ── ────"}
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <main
        style={{
          flex: 1,
          padding: "14px",
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 10,
        }}
      >
        <Panel title="CLIENT SELECTOR" accentHeader={C.cream} style={{ gridColumn: "span 8", minHeight: 300, maxHeight: 400 }}>
          <ClientSelectorPanel
            clients={clients}
            selectedId={selectedClientId}
            onSelect={setSelectedClientId}
          />
        </Panel>
        <Panel title="SYSTEM ALERTS" accentHeader={C.red} style={{ gridColumn: "span 4", minHeight: 160 }}>
          <SystemAlertsPanel />
        </Panel>

        <Panel title="COMMS MONITOR" accentHeader={C.cyan} style={{ gridColumn: "span 5", minHeight: 180 }}>
          <CommsMonitorPanel />
        </Panel>
        <Panel title="AD PERFORMANCE" accentHeader={C.cyan} style={{ gridColumn: "span 4", minHeight: 180 }}>
          <AdPerformancePanel />
        </Panel>
        <Panel title="GBP HEALTH" accentHeader={C.cream} style={{ gridColumn: "span 3", minHeight: 180 }}>
          <GbpHealthPanel />
        </Panel>

        <Panel title="SEO SIGNALS" accentHeader={C.cream} style={{ gridColumn: "span 4", minHeight: 160 }}>
          <SeoSignalsPanel />
        </Panel>
        <Panel title="SOCIAL METRICS" accentHeader={C.cyan} style={{ gridColumn: "span 4", minHeight: 160 }}>
          <SocialMetricsPanel />
        </Panel>
        <Panel title="PLATFORM STATUS" accentHeader={C.cream} style={{ gridColumn: "span 4", minHeight: 160 }}>
          <PlatformStatusPanel />
        </Panel>
      </main>

      {/* ── Ticker ── */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          height: 28,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          background: C.panelAlt,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "0 14px",
            borderRight: `1px solid ${C.border}`,
            height: "100%",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.16em" }}>▶ LIVE</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              animation: "ticker-scroll 35s linear infinite",
              fontSize: 10,
              color: C.creamDim,
              letterSpacing: "0.1em",
            }}
          >
            {TICKER + TICKER}
          </div>
        </div>
      </div>
    </div>
  );
}
