"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ControlCenterClient } from "@/app/(app)/control-center/page";

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
  buttonFace: "#dddddd",
  shadow: "2px 2px 0px #000000",
};

const FONT = '"Chicago", "Geneva", "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = '"Monaco", "Courier New", monospace';

// ─── Mac window chrome ────────────────────────────────────────────────────────

function MacWindow({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.window, border: `1px solid ${C.border}`, boxShadow: C.shadow, display: "flex", flexDirection: "column", overflow: "hidden", ...style }}>
      {/* Title bar */}
      <div style={{ height: 19, background: C.titleBarBg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0, userSelect: "none" }}>
        <div style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, background: C.window, border: `1px solid ${C.border}` }} />
        <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, background: C.window, border: `1px solid ${C.border}` }} />
        <span style={{ background: C.window, padding: "0 8px", fontSize: 12, fontFamily: FONT, fontWeight: "bold", color: C.text }}>{title}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ─── Desktop icon ─────────────────────────────────────────────────────────────

type DesktopIconProps = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

function DesktopIcon({ label, href, icon }: DesktopIconProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(false);

  return (
    <button
      onClick={() => setSelected((s) => !s)}
      onDoubleClick={() => router.push(href)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "default", padding: 6, width: 80 }}
    >
      {/* Icon image */}
      <div
        style={{
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: selected ? "invert(1)" : "none",
        }}
      >
        {icon}
      </div>
      {/* Label */}
      <span
        style={{
          fontSize: 11,
          fontFamily: FONT,
          color: selected ? C.selectionText : C.text,
          background: selected ? C.selection : "transparent",
          padding: "1px 4px",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 76,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Mac-style pixel icons (SVG) ──────────────────────────────────────────────

const AdsIcon = () => (
  <svg viewBox="0 0 32 32" width={40} height={40} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="30" width="28" height="2" fill="#000" />
    <rect x="3" y="18" width="7" height="12" fill="#000" />
    <rect x="12.5" y="11" width="7" height="19" fill="#000" />
    <rect x="22" y="5" width="7" height="25" fill="#000" />
    <polyline points="4,22 12,14 19,18 27,8" fill="none" stroke="#000" strokeWidth="1.5" />
    <circle cx="27" cy="8" r="2" fill="#000" />
  </svg>
);

const OnboardingIcon = () => (
  <svg viewBox="0 0 32 32" width={40} height={40} xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="8" width="18" height="22" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <rect x="11" y="5" width="10" height="6" rx="2" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <line x1="11" y1="16" x2="21" y2="16" stroke="#000" strokeWidth="1.5" />
    <line x1="11" y1="21" x2="21" y2="21" stroke="#000" strokeWidth="1.5" />
    <line x1="11" y1="26" x2="17" y2="26" stroke="#000" strokeWidth="1.5" />
    <polyline points="11,16 13,18 17,13" fill="none" stroke="#000" strokeWidth="1.3" />
  </svg>
);

const SocialIcon = () => (
  <svg viewBox="0 0 32 32" width={40} height={40} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="20" height="14" rx="3" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <polygon points="5,17 11,17 5,24" fill="#fff" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
    <circle cx="7" cy="10" r="1.8" fill="#000" />
    <circle cx="12" cy="10" r="1.8" fill="#000" />
    <circle cx="17" cy="10" r="1.8" fill="#000" />
    <rect x="12" y="14" width="18" height="12" rx="3" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <polygon points="27,26 21,26 27,31" fill="#fff" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
    <circle cx="17" cy="20" r="1.8" fill="#000" />
    <circle cx="22" cy="20" r="1.8" fill="#000" />
    <circle cx="27" cy="20" r="1.8" fill="#000" />
  </svg>
);

const PlannerIcon = () => (
  <svg viewBox="0 0 32 32" width={40} height={40} xmlns="http://www.w3.org/2000/svg">
    {/* Document page */}
    <path d="M7 3 h13 l5 5 v21 h-18 z" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <path d="M20 3 v5 h5" fill="none" stroke="#000" strokeWidth="1.5" />
    <line x1="10" y1="13" x2="22" y2="13" stroke="#000" strokeWidth="1.5" />
    <line x1="10" y1="17" x2="22" y2="17" stroke="#000" strokeWidth="1.5" />
    <line x1="10" y1="21" x2="17" y2="21" stroke="#000" strokeWidth="1.5" />
    {/* Sparkle */}
    <path d="M25 18 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" fill="#000" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 32 32" width={40} height={40} xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="5" fill="#fff" stroke="#000" strokeWidth="1.5" />
    {/* Teeth */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const r = deg * Math.PI / 180;
      const x1 = 16 + 9 * Math.cos(r);
      const y1 = 16 + 9 * Math.sin(r);
      const x2 = 16 + 13 * Math.cos(r);
      const y2 = 16 + 13 * Math.sin(r);
      return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth="3" strokeLinecap="square" />;
    })}
  </svg>
);

// ─── Client selector content ──────────────────────────────────────────────────

function ClientSelectorContent({ clients, selectedId, onSelect }: { clients: ControlCenterClient[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? clients.filter((c) => c.account_name.toLowerCase().includes(q) || (c.marketing_strategist ?? "").toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Stats */}
      <div style={{ padding: "6px 10px 4px", display: "flex", gap: 24, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 9, fontFamily: FONT, color: C.textSecondary }}>Total Clients</span>
          <span style={{ fontSize: 22, fontFamily: FONT_MONO }}>{clients.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 9, fontFamily: FONT, color: C.textSecondary }}>Selected</span>
          <span style={{ fontSize: 22, fontFamily: FONT_MONO }}>{selectedId ? "1" : "–"}</span>
        </div>
      </div>

      <div style={{ height: 1, background: C.border, margin: "4px 0" }} />

      {/* Search */}
      <div style={{ padding: "4px 10px 6px", display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontFamily: FONT }}>Find:</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="client name or strategist…"
          style={{ flex: 1, border: `1px solid ${C.border}`, padding: "2px 5px", fontSize: 11, fontFamily: FONT, outline: "none" }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ border: `1px solid ${C.border}`, background: C.buttonFace, padding: "1px 7px", fontSize: 11, fontFamily: FONT, cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "scroll", border: `1px solid ${C.border}`, margin: "0 10px 10px" }}>
        {filtered.length === 0 && <div style={{ padding: 10, fontSize: 11, fontFamily: FONT, color: C.textSecondary }}>No matching clients.</div>}
        {filtered.map((client) => {
          const active = client.id === selectedId;
          return (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              style={{ display: "flex", alignItems: "center", width: "100%", background: active ? C.selection : "transparent", border: "none", borderBottom: "1px solid #e0e0e0", padding: "3px 8px", cursor: "pointer", textAlign: "left", fontFamily: FONT, gap: 8 }}
            >
              <span style={{ fontSize: 11, color: active ? C.selectionText : C.text, flex: 1 }}>{client.account_name}</span>
              {client.marketing_strategist && (
                <span style={{ fontSize: 9, color: active ? "#aaaaff" : C.textSecondary }}>{client.marketing_strategist}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ControlCenter({ clients }: { clients: ControlCenterClient[] }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
      setDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const ICONS = [
    { label: "Ads", href: "/ads-health", icon: <AdsIcon /> },
    { label: "Onboarding", href: "/onboarding", icon: <OnboardingIcon /> },
    { label: "Social Media", href: "/social-planner", icon: <SocialIcon /> },
    { label: "AI Planner", href: "/ai-planner", icon: <PlannerIcon /> },
    { label: "Settings", href: "/dashboard/cockpit", icon: <SettingsIcon /> },
  ];

  return (
    <div style={{ background: C.desktop, minHeight: "100%", fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* Menu bar */}
      <div style={{ background: C.menuBar, borderBottom: `1px solid ${C.border}`, height: 20, display: "flex", alignItems: "center", padding: "0 8px", gap: 16, flexShrink: 0 }}>
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

      {/* Desktop */}
      <div style={{ flex: 1, display: "flex", gap: 14, padding: 14, alignItems: "flex-start" }}>

        {/* Client selector window */}
        <MacWindow title="Client Selector" style={{ flex: 1, minHeight: 380, maxHeight: 560 }}>
          <ClientSelectorContent clients={clients} selectedId={selectedClientId} onSelect={setSelectedClientId} />
        </MacWindow>

        {/* Desktop icons — right column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 6 }}>
          {ICONS.map((icon) => (
            <DesktopIcon key={icon.label} label={icon.label} href={icon.href} icon={icon.icon} />
          ))}
          {/* Spacer to signal room for more */}
          <div style={{ marginTop: 8, width: 48, height: 1, background: "rgba(0,0,0,0.2)" }} />
        </div>
      </div>
    </div>
  );
}
