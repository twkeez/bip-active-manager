"use client";

import { useState, useEffect } from "react";

// ─── Color palette ──────────────────────────────────────────────────────────
const C = {
  bg: "#07090f",
  panel: "#0a0f1a",
  panelBorder: "rgba(0, 204, 255, 0.14)",
  panelBorderBright: "rgba(0, 204, 255, 0.45)",
  cyan: "#00ccff",
  green: "#00ff88",
  amber: "#ffaa00",
  red: "#ff3355",
  purple: "#cc88ff",
  textPrimary: "#a8c8e0",
  textMid: "#3a5a78",
  textDim: "#1e3048",
};

const FONT = "'Courier New', 'Lucida Console', monospace";

const TICKER = "BIP CONTROL CENTER · SYSTEM OPERATIONAL · ALL SUBSYSTEMS NOMINAL · 91 CLIENTS MONITORED · BEYOND INDIGO PETS · VETERINARY MARKETING INTELLIGENCE PLATFORM · COMMS MONITOR ACTIVE · AD PERFORMANCE TRACKING ENABLED · SEO SIGNALS NOMINAL · GBP HEALTH MONITORING ON · SOCIAL PLANNER ACTIVE · ";

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: pulse ? "pulse-dot 2s ease-in-out infinite" : undefined,
        flexShrink: 0,
      }}
    />
  );
}

type PanelProps = {
  title: string;
  accent?: string;
  status?: "STANDBY" | "NOMINAL" | "WARNING" | "CRITICAL" | "OFFLINE";
  children: React.ReactNode;
  style?: React.CSSProperties;
};

function Panel({ title, accent = C.cyan, status = "STANDBY", children, style }: PanelProps) {
  const statusColor =
    status === "NOMINAL" ? C.green :
    status === "WARNING" ? C.amber :
    status === "CRITICAL" ? C.red :
    status === "OFFLINE" ? C.textMid :
    C.textMid;

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        boxShadow: `0 0 24px rgba(0,204,255,0.04), inset 0 0 40px rgba(0,0,0,0.4)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {/* Corner decorations */}
      {(["tl","tr","bl","br"] as const).map((pos) => (
        <span
          key={pos}
          style={{
            position: "absolute",
            fontSize: 9,
            color: accent,
            opacity: 0.6,
            lineHeight: 1,
            ...(pos === "tl" ? { top: 3, left: 3 } :
                pos === "tr" ? { top: 3, right: 3 } :
                pos === "bl" ? { bottom: 3, left: 3 } :
                              { bottom: 3, right: 3 }),
          }}
        >
          {pos === "tl" ? "┌" : pos === "tr" ? "┐" : pos === "bl" ? "└" : "┘"}
        </span>
      ))}

      {/* Panel header */}
      <div
        style={{
          borderBottom: `1px solid ${C.panelBorder}`,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: accent,
            fontSize: 10,
            letterSpacing: "0.14em",
            fontWeight: "bold",
            textShadow: `0 0 8px ${accent}`,
          }}
        >
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <StatusDot color={statusColor} pulse={status === "NOMINAL" || status === "WARNING"} />
          <span style={{ color: statusColor, fontSize: 8, letterSpacing: "0.1em" }}>{status}</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: "12px 14px", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function PlaceholderBars({ count = 5, accent = C.cyan }: { count?: number; accent?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 48, fontSize: 8, color: C.textMid, letterSpacing: "0.05em" }}>
            {String.fromCharCode(65 + i)}─────
          </div>
          <div
            style={{
              flex: 1,
              height: 2,
              background: C.textDim,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${[42, 67, 31, 88, 55][i % 5]}%`,
                background: accent,
                opacity: 0.25,
              }}
            />
          </div>
          <span style={{ fontSize: 8, color: C.textMid, width: 28, textAlign: "right" }}>
            ─ ─ ─
          </span>
        </div>
      ))}
    </div>
  );
}

function StandbyMessage({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 8,
        opacity: 0.5,
      }}
    >
      <span style={{ fontSize: 9, color: C.textMid, letterSpacing: "0.12em" }}>
        ━━━━━━━ NO DATA ━━━━━━━
      </span>
      <span style={{ fontSize: 8, color: C.textMid, letterSpacing: "0.06em", textAlign: "center" }}>
        {label}
      </span>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 8, color: C.textMid, letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontSize: 18, color: C.textPrimary, letterSpacing: "0.05em", fontWeight: "bold" }}>
        {value}
      </span>
    </div>
  );
}

function GridLine() {
  return <div style={{ width: "100%", height: 1, background: C.panelBorder }} />;
}

// ─── Panel content components (all placeholder) ──────────────────────────────

function ClientPulsePanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", gap: 24 }}>
        <MetricBlock label="ACTIVE CLIENTS" value="─ ─ ─" />
        <MetricBlock label="NEEDS REPLY" value="─ ─ ─" />
        <MetricBlock label="CRITICAL ALERTS" value="─ ─ ─" />
        <MetricBlock label="NEW THIS MONTH" value="─ ─ ─" />
      </div>
      <GridLine />
      <div style={{ flex: 1 }}>
        <StandbyMessage label={"WILL DISPLAY: CLIENT HEALTH · ALERT COUNTS · STRATEGIST BREAKDOWN"} />
      </div>
    </div>
  );
}

function SystemAlertsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {[
        { label: "CRITICAL", color: C.red, count: "─" },
        { label: "WARNING", color: C.amber, count: "─" },
        { label: "INFO", color: C.cyan, count: "─" },
        { label: "NOMINAL", color: C.green, count: "─" },
      ].map(({ label, color, count }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot color={color} />
          <span style={{ fontSize: 9, color, letterSpacing: "0.08em", flex: 1 }}>{label}</span>
          <span style={{ fontSize: 14, color, fontWeight: "bold" }}>{count}</span>
        </div>
      ))}
      <GridLine />
      <StandbyMessage label="CROSS-CLIENT ALERT AGGREGATOR" />
    </div>
  );
}

function CommsMonitorPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", gap: 16 }}>
        <MetricBlock label="OPEN THREADS" value="─" />
        <MetricBlock label="AWAITING REPLY" value="─" />
        <MetricBlock label="OVERDUE" value="─" />
      </div>
      <GridLine />
      <div style={{ flex: 1 }}>
        <StandbyMessage label="WILL DISPLAY: BASECAMP THREAD FEED · REPLY STATUS · OVERDUE FLAGS" />
      </div>
    </div>
  );
}

function AdPerformancePanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <MetricBlock label="TOTAL ACTIVE SPEND" value="$─ ─ ─" />
      <GridLine />
      <PlaceholderBars count={4} accent={C.amber} />
      <StandbyMessage label="AD SPEND · CTR · CONVERSIONS" />
    </div>
  );
}

function GbpHealthPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <MetricBlock label="AVG RATING" value="─.─" />
      <GridLine />
      <PlaceholderBars count={3} accent={C.green} />
      <StandbyMessage label="GBP RATINGS · REVIEW VELOCITY · PROFILE SCORES" />
    </div>
  );
}

function SeoSignalsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", gap: 16 }}>
        <MetricBlock label="AVG POSITION" value="─ ─" />
        <MetricBlock label="IMPRESSIONS" value="─ ─ ─" />
      </div>
      <GridLine />
      <StandbyMessage label="GSC · GA4 · ORGANIC TRENDS" />
    </div>
  );
}

function SocialMetricsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", gap: 16 }}>
        <MetricBlock label="POSTS PLANNED" value="─" />
        <MetricBlock label="CLIENTS ACTIVE" value="─" />
      </div>
      <GridLine />
      <PlaceholderBars count={3} accent={C.purple} />
      <StandbyMessage label="SOCIAL PLANS · CONTENT STATUS · ENGAGEMENT" />
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {integrations.map(({ name, status }) => {
        const color = status === "NOMINAL" ? C.green : status === "WARNING" ? C.amber : C.textMid;
        return (
          <div
            key={name}
            style={{
              border: `1px solid ${C.panelBorder}`,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <StatusDot color={color} />
              <span style={{ fontSize: 7, color, letterSpacing: "0.06em" }}>{status}</span>
            </div>
            <span style={{ fontSize: 8, color: C.textMid, letterSpacing: "0.06em", lineHeight: 1.3 }}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ControlCenter() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [blink, setBlink] = useState(true);

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
        color: C.textPrimary,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* CSS keyframes */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
      `}</style>

      {/* Scanlines overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 100,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
        }}
      />

      {/* Subtle grid background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            `linear-gradient(rgba(0,204,255,0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(0,204,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Header ── */}
      <header
        style={{
          borderBottom: `1px solid ${C.panelBorder}`,
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
          background: "rgba(7,9,15,0.95)",
          backdropFilter: "blur(4px)",
        }}
      >
        {/* Left: Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: `1px solid ${C.panelBorderBright}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 12px rgba(0,204,255,0.3)`,
            }}
          >
            <span style={{ color: C.cyan, fontSize: 12, fontWeight: "bold", textShadow: `0 0 6px ${C.cyan}` }}>
              ◈
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.22em",
                fontWeight: "bold",
                color: C.cyan,
                textShadow: `0 0 10px rgba(0,204,255,0.6)`,
              }}
            >
              BIP CONTROL CENTER
            </div>
            <div style={{ fontSize: 8, color: C.textMid, letterSpacing: "0.12em" }}>
              BEYOND INDIGO PETS · MARKETING INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Center: Status indicators */}
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {[
            { label: "SYSTEM", value: "ONLINE", color: C.green },
            { label: "SYNC", value: "IDLE", color: C.amber },
            { label: "AI", value: "READY", color: C.cyan },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 7, color: C.textMid, letterSpacing: "0.1em" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <StatusDot color={color} pulse />
                <span style={{ fontSize: 9, color, letterSpacing: "0.08em" }}>{value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Clock */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.08em",
              color: C.textPrimary,
              fontWeight: "bold",
              lineHeight: 1,
            }}
          >
            {time || "──:──:──"}
            <span style={{ opacity: blink ? 0 : 1, transition: "opacity 0.1s" }}> </span>
          </div>
          <div style={{ fontSize: 8, color: C.textMid, letterSpacing: "0.08em", marginTop: 2 }}>
            {date || "─── ─── ── ────"}
          </div>
        </div>
      </header>

      {/* ── Panel grid ── */}
      <main
        style={{
          flex: 1,
          padding: "16px",
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gridTemplateRows: "auto",
          gap: 12,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Row 1 */}
        <Panel
          title="CLIENT PULSE"
          accent={C.cyan}
          status="STANDBY"
          style={{ gridColumn: "span 8", minHeight: 160 }}
        >
          <ClientPulsePanel />
        </Panel>

        <Panel
          title="SYSTEM ALERTS"
          accent={C.red}
          status="STANDBY"
          style={{ gridColumn: "span 4", minHeight: 160 }}
        >
          <SystemAlertsPanel />
        </Panel>

        {/* Row 2 */}
        <Panel
          title="COMMS MONITOR"
          accent={C.purple}
          status="STANDBY"
          style={{ gridColumn: "span 5", minHeight: 180 }}
        >
          <CommsMonitorPanel />
        </Panel>

        <Panel
          title="AD PERFORMANCE"
          accent={C.amber}
          status="STANDBY"
          style={{ gridColumn: "span 4", minHeight: 180 }}
        >
          <AdPerformancePanel />
        </Panel>

        <Panel
          title="GBP HEALTH"
          accent={C.green}
          status="STANDBY"
          style={{ gridColumn: "span 3", minHeight: 180 }}
        >
          <GbpHealthPanel />
        </Panel>

        {/* Row 3 */}
        <Panel
          title="SEO SIGNALS"
          accent={C.cyan}
          status="STANDBY"
          style={{ gridColumn: "span 4", minHeight: 160 }}
        >
          <SeoSignalsPanel />
        </Panel>

        <Panel
          title="SOCIAL METRICS"
          accent={C.purple}
          status="STANDBY"
          style={{ gridColumn: "span 4", minHeight: 160 }}
        >
          <SocialMetricsPanel />
        </Panel>

        <Panel
          title="PLATFORM STATUS"
          accent={C.green}
          status="STANDBY"
          style={{ gridColumn: "span 4", minHeight: 160 }}
        >
          <PlatformStatusPanel />
        </Panel>
      </main>

      {/* ── Ticker ── */}
      <div
        style={{
          borderTop: `1px solid ${C.panelBorder}`,
          height: 28,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          background: "rgba(0,10,20,0.8)",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Left badge */}
        <div
          style={{
            padding: "0 12px",
            borderRight: `1px solid ${C.panelBorder}`,
            height: "100%",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            background: `rgba(0,204,255,0.08)`,
          }}
        >
          <span style={{ fontSize: 8, color: C.cyan, letterSpacing: "0.14em", fontWeight: "bold" }}>
            ▶ LIVE
          </span>
        </div>

        {/* Scrolling text */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              animation: "ticker-scroll 30s linear infinite",
              fontSize: 9,
              color: C.textMid,
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
