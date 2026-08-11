"use client";

import { useState, useEffect, useMemo } from "react";
import type { ControlCenterClient } from "@/app/(app)/control-center/page";

// ─── Classic Mac OS 7 palette ─────────────────────────────────────────────────
const C = {
  desktop: "#888888",
  window: "#ffffff",
  border: "#000000",
  titleBarBg: "repeating-linear-gradient(to bottom, #000 0px, #000 1px, #fff 1px, #fff 2px)",
  menuBar: "#ffffff",
  text: "#000000",
  textSecondary: "#444444",
  textDisabled: "#888888",
  selection: "#0000cc",
  selectionText: "#ffffff",
  scrollTrack: "#cccccc",
  buttonFace: "#dddddd",
  shadow: "2px 2px 0px #000000",
  // status colors — muted, no neon
  green: "#007700",
  red: "#cc0000",
  amber: "#886600",
  blue: "#0000aa",
};

const FONT = '"Chicago", "Geneva", "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = '"Monaco", "Courier New", monospace';

const TICKER = "BIP CONTROL CENTER · SYSTEM OPERATIONAL · ALL SUBSYSTEMS NOMINAL · BEYOND INDIGO PETS · VETERINARY MARKETING INTELLIGENCE PLATFORM ·";

// ─── Mac OS Window chrome ─────────────────────────────────────────────────────

type MacWindowProps = {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClose?: () => void;
};

function MacWindow({ title, children, style, onClose }: MacWindowProps) {
  return (
    <div
      style={{
        background: C.window,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 19,
          background: C.titleBarBg,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {/* Close box */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            left: 4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 11,
            height: 11,
            background: C.window,
            border: `1px solid ${C.border}`,
            padding: 0,
            cursor: onClose ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT,
            fontSize: 8,
            lineHeight: 1,
          }}
        />
        {/* Zoom box */}
        <div
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 11,
            height: 11,
            background: C.window,
            border: `1px solid ${C.border}`,
          }}
        />
        {/* Title */}
        <span
          style={{
            background: C.window,
            padding: "0 8px",
            fontSize: 12,
            fontFamily: FONT,
            fontWeight: "bold",
            color: C.text,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Classic UI primitives ────────────────────────────────────────────────────

function HRule() {
  return <div style={{ height: 1, background: C.border, margin: "6px 0" }} />;
}

function Label({ children, secondary }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: FONT,
        color: secondary ? C.textSecondary : C.text,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Label secondary>{label}</Label>
      <span style={{ fontSize: 22, fontFamily: FONT_MONO, color: C.text, lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}

function StatusRow({ label, color, value }: { label: string; color: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 10, color }}>◆</span>
      <span style={{ fontSize: 11, fontFamily: FONT, color: C.text, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 14, fontFamily: FONT_MONO, color }}>{value}</span>
    </div>
  );
}

function PlaceholderBars({ count = 4 }: { count?: number }) {
  const widths = [42, 67, 29, 81, 51, 60];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Label secondary>{String.fromCharCode(65 + i)}</Label>
          <div style={{ flex: 1, height: 8, border: `1px solid ${C.border}`, background: "#fff" }}>
            <div style={{ width: `${widths[i % 6]}%`, height: "100%", background: C.text, opacity: 0.15 }} />
          </div>
          <Label secondary>─ ─</Label>
        </div>
      ))}
    </div>
  );
}

function StandbyNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        padding: "6px 10px",
        background: "#f0f0f0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span style={{ fontSize: 11, fontFamily: FONT }}>No data</span>
      <span style={{ fontSize: 9, fontFamily: FONT, color: C.textSecondary, textAlign: "center" }}>{children}</span>
    </div>
  );
}

// ─── Waveform decoration ──────────────────────────────────────────────────────

function WaveformSVG() {
  const pts = Array.from({ length: 80 }, (_, i) => {
    const x = (i / 79) * 260;
    const y = 14 + Math.sin(i * 0.35) * 7 + Math.sin(i * 0.9 + 1) * 4 + Math.sin(i * 0.18) * 3;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 260 28" style={{ width: "100%", height: 28, opacity: 0.6 }}>
      <polyline points={pts} fill="none" stroke={C.text} strokeWidth="0.8" />
    </svg>
  );
}

// ─── Panel content ────────────────────────────────────────────────────────────

function ClientSelectorContent({
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Count row */}
      <div style={{ padding: "6px 10px 4px", display: "flex", gap: 20 }}>
        <BigNumber label="Total Clients" value={String(clients.length)} />
        <BigNumber label="Selected" value={selectedId ? "1" : "–"} />
      </div>
      <HRule />

      {/* Search */}
      <div style={{ padding: "0 10px 6px", display: "flex", gap: 6, alignItems: "center" }}>
        <Label>Find:</Label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="client name or strategist..."
          style={{
            flex: 1,
            border: `1px solid ${C.border}`,
            padding: "2px 5px",
            fontSize: 11,
            fontFamily: FONT,
            outline: "none",
            background: "#fff",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{ border: `1px solid ${C.border}`, background: C.buttonFace, padding: "1px 6px", fontSize: 10, fontFamily: FONT, cursor: "pointer" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Scrolling list */}
      <div
        style={{
          flex: 1,
          overflowY: "scroll",
          border: `1px solid ${C.border}`,
          margin: "0 10px 10px",
          background: "#fff",
        }}
      >
        {filtered.length === 0 && (
          <div style={{ padding: 10, fontSize: 11, fontFamily: FONT, color: C.textSecondary }}>
            No matching clients.
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
                background: active ? C.selection : "transparent",
                border: "none",
                borderBottom: `1px solid #e0e0e0`,
                padding: "3px 8px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: FONT,
              }}
            >
              <span style={{ fontSize: 11, color: active ? C.selectionText : C.text, flex: 1 }}>
                {client.account_name}
              </span>
              {client.marketing_strategist && (
                <span style={{ fontSize: 9, color: active ? "#aaaaff" : C.textSecondary }}>
                  {client.marketing_strategist}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SystemAlertsContent() {
  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
      <StatusRow label="Critical" color={C.red} value="–" />
      <StatusRow label="Warning" color={C.amber} value="–" />
      <StatusRow label="Info" color={C.blue} value="–" />
      <StatusRow label="Nominal" color={C.green} value="–" />
      <HRule />
      <StandbyNote>Cross-client alert aggregator</StandbyNote>
    </div>
  );
}

function CommsContent() {
  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <BigNumber label="Open Threads" value="–" />
        <BigNumber label="Awaiting Reply" value="–" />
        <BigNumber label="Overdue" value="–" />
      </div>
      <HRule />
      <WaveformSVG />
      <StandbyNote>Basecamp thread feed · Reply status · Overdue flags</StandbyNote>
    </div>
  );
}

function AdPerformanceContent() {
  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
      <BigNumber label="Total Active Spend" value="$–" />
      <HRule />
      <PlaceholderBars count={4} />
      <StandbyNote>Ad spend · CTR · Conversions</StandbyNote>
    </div>
  );
}

function GbpContent() {
  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
      <BigNumber label="Avg. Rating" value="–.–" />
      <HRule />
      <PlaceholderBars count={3} />
      <StandbyNote>GBP ratings · Review velocity · Profile scores</StandbyNote>
    </div>
  );
}

function SeoContent() {
  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <BigNumber label="Avg. Position" value="–" />
        <BigNumber label="Impressions" value="–" />
      </div>
      <HRule />
      <PlaceholderBars count={3} />
      <StandbyNote>GSC · GA4 · Organic trends</StandbyNote>
    </div>
  );
}

function SocialContent() {
  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <BigNumber label="Posts Planned" value="–" />
        <BigNumber label="Clients Active" value="–" />
      </div>
      <HRule />
      <PlaceholderBars count={3} />
      <StandbyNote>Social plans · Content status · Engagement</StandbyNote>
    </div>
  );
}

type IntegrationStatus = "NOMINAL" | "WARNING" | "CRITICAL" | "OFFLINE";

function PlatformContent() {
  const integrations: { name: string; status: IntegrationStatus }[] = [
    { name: "Google Ads", status: "OFFLINE" },
    { name: "Google Analytics", status: "OFFLINE" },
    { name: "Search Console", status: "OFFLINE" },
    { name: "Google My Business", status: "OFFLINE" },
    { name: "Basecamp", status: "OFFLINE" },
    { name: "Meta Ads", status: "OFFLINE" },
  ];

  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
      {integrations.map(({ name, status }) => {
        const color =
          status === "NOMINAL" ? C.green :
          status === "WARNING" ? C.amber :
          status === "CRITICAL" ? C.red :
          C.textDisabled;
        return (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 9, color }}>◆</span>
            <span style={{ fontSize: 11, fontFamily: FONT, flex: 1, color: C.text }}>{name}</span>
            <span style={{ fontSize: 9, fontFamily: FONT, color }}>{status}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ControlCenter({ clients }: { clients: ControlCenterClient[] }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit" }));
      setDate(
        now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      );
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        background: C.desktop,
        minHeight: "100%",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Mac OS menu bar ── */}
      <div
        style={{
          background: C.menuBar,
          borderBottom: `1px solid ${C.border}`,
          height: 20,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14 }}>⌘</span>
        {["BIP Control", "View", "Special"].map((item) => (
          <span key={item} style={{ fontSize: 12, fontFamily: FONT, fontWeight: "bold" }}>{item}</span>
        ))}
        <div style={{ flex: 1 }} />
        {selectedClient && (
          <span style={{ fontSize: 11, fontFamily: FONT, color: C.textSecondary }}>
            Working on: <strong style={{ color: C.text }}>{selectedClient.account_name}</strong>
          </span>
        )}
        <span style={{ fontSize: 11, fontFamily: FONT }}>{date}</span>
        <span style={{ fontSize: 11, fontFamily: FONT, fontWeight: "bold" }}>{time}</span>
      </div>

      {/* ── Window grid ── */}
      <main
        style={{
          flex: 1,
          padding: 14,
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 12,
        }}
      >
        <MacWindow
          title="Client Selector"
          style={{ gridColumn: "span 8", minHeight: 300, maxHeight: 420 }}
        >
          <ClientSelectorContent
            clients={clients}
            selectedId={selectedClientId}
            onSelect={setSelectedClientId}
          />
        </MacWindow>

        <MacWindow title="System Alerts" style={{ gridColumn: "span 4", minHeight: 300, maxHeight: 420 }}>
          <SystemAlertsContent />
        </MacWindow>

        <MacWindow title="Comms Monitor" style={{ gridColumn: "span 5", minHeight: 220 }}>
          <CommsContent />
        </MacWindow>

        <MacWindow title="Ad Performance" style={{ gridColumn: "span 4", minHeight: 220 }}>
          <AdPerformanceContent />
        </MacWindow>

        <MacWindow title="GBP Health" style={{ gridColumn: "span 3", minHeight: 220 }}>
          <GbpContent />
        </MacWindow>

        <MacWindow title="SEO Signals" style={{ gridColumn: "span 4", minHeight: 200 }}>
          <SeoContent />
        </MacWindow>

        <MacWindow title="Social Metrics" style={{ gridColumn: "span 4", minHeight: 200 }}>
          <SocialContent />
        </MacWindow>

        <MacWindow title="Platform Status" style={{ gridColumn: "span 4", minHeight: 200 }}>
          <PlatformContent />
        </MacWindow>
      </main>

      {/* ── Ticker ── */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          background: C.menuBar,
          height: 18,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 10px", borderRight: `1px solid ${C.border}`, height: "100%", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontFamily: FONT, fontWeight: "bold" }}>◀ Status</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ display: "inline-block", whiteSpace: "nowrap", animation: "ticker-scroll 40s linear infinite", fontSize: 10, fontFamily: FONT, color: C.textSecondary }}>
            {TICKER + " " + TICKER}
          </div>
        </div>
      </div>
    </div>
  );
}
