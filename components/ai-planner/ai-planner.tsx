"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlannerClient } from "@/app/(app)/ai-planner/page";
import type { PlanDoc, PlanIdea, PlanSection } from "@/lib/ai-planner/plan";

// Same Classic Mac OS palette as the Control Center.
const C = {
  desktop: "#888888",
  window: "#ffffff",
  border: "#000000",
  titleBarBg: "repeating-linear-gradient(to bottom, #000 0px, #000 1px, #fff 1px, #fff 2px)",
  menuBar: "#ffffff",
  text: "#000000",
  textSecondary: "#444444",
  selection: "#0000cc",
  selectionText: "#ffffff",
  buttonFace: "#dddddd",
  shadow: "2px 2px 0px #000000",
};

const FONT = '"Chicago", "Geneva", "Helvetica Neue", Arial, sans-serif';
const FONT_DOC = '"Palatino", "Georgia", serif';

const PROJECT_TYPES = [
  "Custom goal…",
  "Increase same-day appointments",
  "New client acquisition push",
  "Seasonal campaign (spring/summer)",
  "Dental month promotion",
  "Reactivate lapsed clients",
  "Launch a new service line",
];

type BoardIdea = PlanIdea & { checked: boolean; custom?: boolean };

function MacWindow({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.window, border: `1px solid ${C.border}`, boxShadow: C.shadow, display: "flex", flexDirection: "column", overflow: "hidden", ...style }}>
      <div style={{ height: 19, background: C.titleBarBg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0, userSelect: "none" }}>
        <div style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, background: C.window, border: `1px solid ${C.border}` }} />
        <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, background: C.window, border: `1px solid ${C.border}` }} />
        <span style={{ background: C.window, padding: "0 8px", fontSize: 12, fontFamily: FONT, fontWeight: "bold", color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{title}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function MacButton({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `${primary ? 2 : 1}px solid ${C.border}`,
        borderRadius: 8,
        background: C.window,
        padding: "3px 14px",
        fontSize: 12,
        fontFamily: FONT,
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "#999" : C.text,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// Classic Mac checkbox — a crisp square with an ✕ mark.
function MacCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        width: 13,
        height: 13,
        border: `1px solid ${C.border}`,
        background: C.window,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        lineHeight: 1,
        flexShrink: 0,
        fontFamily: FONT,
      }}
    >
      {checked ? "✕" : ""}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  padding: "3px 6px",
  fontSize: 12,
  fontFamily: FONT,
  outline: "none",
  width: "100%",
  background: C.window,
};

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontFamily: FONT, color: C.textSecondary, display: "block", marginBottom: 2 }}>{children}</span>;
}

// Render "- " dash lists and paragraphs from plain text content.
function SectionContent({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: number) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${key}`} style={{ margin: "4px 0 10px", paddingLeft: 22 }}>
          {list.map((li, i) => (
            <li key={i} style={{ marginBottom: 3 }}>{li}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  text.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("- ")) {
      list.push(t.slice(2));
    } else {
      flush(i);
      if (t) blocks.push(<p key={`p-${i}`} style={{ margin: "0 0 10px" }}>{t}</p>);
    }
  });
  flush(-1);
  return <>{blocks}</>;
}

export function AiPlanner({ clients }: { clients: PlannerClient[] }) {
  const [time, setTime] = useState("");

  // Brief
  const [clientId, setClientId] = useState<number | "">("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[1]);
  const [customGoal, setCustomGoal] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Idea board
  const [ideas, setIdeas] = useState<BoardIdea[] | null>(null);
  const [brainstorming, setBrainstorming] = useState(false);
  const [gettingMore, setGettingMore] = useState(false);
  const [customIdea, setCustomIdea] = useState("");

  // Document
  const [doc, setDoc] = useState<PlanDoc | null>(null);
  const [building, setBuilding] = useState(false);
  const [view, setView] = useState<"ideas" | "doc">("ideas");
  const [error, setError] = useState<string | null>(null);

  // Per-section state
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const goal = projectType === PROJECT_TYPES[0] ? customGoal.trim() : projectType;
  const checkedCount = ideas?.filter((i) => i.checked).length ?? 0;

  const grouped = useMemo(() => {
    const map = new Map<string, { idea: BoardIdea; index: number }[]>();
    (ideas ?? []).forEach((idea, index) => {
      const key = idea.category || "Ideas";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ idea, index });
    });
    return [...map.entries()];
  }, [ideas]);

  function pickClient(idStr: string) {
    if (!idStr) {
      setClientId("");
      return;
    }
    const id = Number(idStr);
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (client?.website) setUrl(client.website);
  }

  function briefPayload() {
    return {
      goal,
      clientName: selectedClient?.account_name ?? "",
      url: url.trim(),
      notes: notes.trim(),
    };
  }

  async function brainstorm(more: boolean) {
    if (!goal || brainstorming || gettingMore) return;
    if (more) setGettingMore(true);
    else {
      setBrainstorming(true);
      setDoc(null);
      setActiveSection(null);
      setEditingSection(null);
    }
    setError(null);
    setView("ideas");
    try {
      const res = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brainstorm",
          ...briefPayload(),
          exclude: more ? (ideas ?? []).map((i) => i.title) : [],
        }),
      });
      const data = (await res.json()) as { ideas?: PlanIdea[]; error?: string };
      if (!res.ok || !data.ideas) throw new Error(data.error ?? "Brainstorm failed");
      const fresh = data.ideas.map((i) => ({ ...i, checked: false }));
      setIdeas(more ? [...(ideas ?? []), ...fresh] : fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brainstorm failed");
    } finally {
      setBrainstorming(false);
      setGettingMore(false);
    }
  }

  function toggleIdea(index: number) {
    if (!ideas) return;
    setIdeas(ideas.map((idea, i) => (i === index ? { ...idea, checked: !idea.checked } : idea)));
  }

  function addCustomIdea() {
    const t = customIdea.trim();
    if (!t) return;
    setIdeas([...(ideas ?? []), { title: t, description: "", category: "Your Ideas", checked: true, custom: true }]);
    setCustomIdea("");
  }

  async function buildPlan() {
    if (!ideas || checkedCount === 0 || building) return;
    setBuilding(true);
    setError(null);
    setActiveSection(null);
    setEditingSection(null);
    try {
      const res = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          ...briefPayload(),
          ideas: ideas.filter((i) => i.checked).map(({ title, description, category }) => ({ title, description, category })),
        }),
      });
      const data = (await res.json()) as { doc?: PlanDoc; error?: string };
      if (!res.ok || !data.doc) throw new Error(data.error ?? "Plan build failed");
      setDoc(data.doc);
      setView("doc");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan build failed");
    } finally {
      setBuilding(false);
    }
  }

  async function refine(index: number) {
    if (!doc || !refineText.trim() || refining) return;
    setRefining(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refine", doc, sectionIndex: index, instruction: refineText.trim() }),
      });
      const data = (await res.json()) as { section?: PlanSection; error?: string };
      if (!res.ok || !data.section) throw new Error(data.error ?? "Refine failed");
      setDoc({ ...doc, sections: doc.sections.map((s, i) => (i === index ? data.section! : s)) });
      setRefineText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refine failed");
    } finally {
      setRefining(false);
    }
  }

  function startEdit(index: number) {
    if (!doc) return;
    setEditingSection(index);
    setEditDraft(doc.sections[index].content);
    setActiveSection(index);
  }

  function saveEdit() {
    if (!doc || editingSection === null) return;
    setDoc({ ...doc, sections: doc.sections.map((s, i) => (i === editingSection ? { ...s, content: editDraft } : s)) });
    setEditingSection(null);
  }

  function deleteSection(index: number) {
    if (!doc) return;
    setDoc({ ...doc, sections: doc.sections.filter((_, i) => i !== index) });
    setActiveSection(null);
    setEditingSection(null);
  }

  async function copyText() {
    if (!doc) return;
    const text = [
      doc.title,
      "",
      doc.intro,
      "",
      ...doc.sections.flatMap((s) => [s.heading.toUpperCase(), "", s.content, ""]),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const showingDoc = view === "doc" && doc;
  const windowTitle = showingDoc ? doc!.title : ideas ? `Idea Board — ${goal || "Untitled"}` : "Untitled Plan";

  return (
    <div style={{ background: C.desktop, minHeight: "100%", fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* Menu bar */}
      <div style={{ background: C.menuBar, borderBottom: `1px solid ${C.border}`, height: 20, display: "flex", alignItems: "center", padding: "0 8px", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>⌘</span>
        {["AI Planner", "File", "Edit"].map((item) => (
          <span key={item} style={{ fontSize: 12, fontFamily: FONT, fontWeight: "bold" }}>{item}</span>
        ))}
        <div style={{ flex: 1 }} />
        {selectedClient && (
          <span style={{ fontSize: 11, fontFamily: FONT, color: C.textSecondary }}>
            Working on: <strong style={{ color: C.text }}>{selectedClient.account_name}</strong>
          </span>
        )}
        <span style={{ fontSize: 11, fontFamily: FONT, fontWeight: "bold" }}>{time}</span>
      </div>

      {/* Desktop */}
      <div style={{ flex: 1, display: "flex", gap: 14, padding: 14, alignItems: "stretch", minHeight: 0 }}>

        {/* Brief window */}
        <MacWindow title="Project Brief" style={{ width: 320, flexShrink: 0, alignSelf: "flex-start" }}>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <Label>Client</Label>
              <select value={clientId === "" ? "" : String(clientId)} onChange={(e) => pickClient(e.target.value)} style={inputStyle}>
                <option value="">— No client / general —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.account_name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Project type</Label>
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)} style={inputStyle}>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {projectType === PROJECT_TYPES[0] && (
              <div>
                <Label>Describe the goal</Label>
                <textarea value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="e.g. Fill Saturday surgery slots" />
              </div>
            )}

            <div>
              <Label>Website URL (read for real context)</Label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} placeholder="marketplaceveterinary.com" />
            </div>

            <div>
              <Label>Notes, angles, constraints (optional)</Label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Anything you want the plan to hit — budget, tone, specific ideas…" />
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <MacButton primary onClick={() => brainstorm(false)} disabled={!goal || brainstorming || building}>
                {brainstorming ? "Thinking…" : ideas ? "New Brainstorm" : "Brainstorm Ideas"}
              </MacButton>
              {doc && view === "doc" && <MacButton onClick={copyText}>{copied ? "Copied!" : "Copy Text"}</MacButton>}
              {doc && view === "ideas" && <MacButton onClick={() => setView("doc")}>View Plan</MacButton>}
              {ideas && view === "doc" && <MacButton onClick={() => setView("ideas")}>Idea Board</MacButton>}
            </div>

            {brainstorming && (
              <div style={{ fontSize: 10, fontFamily: FONT, color: C.textSecondary }}>
                Reading the site and brainstorming… ~30 seconds.
              </div>
            )}

            {error && (
              <div style={{ border: `2px solid ${C.border}`, background: C.window, padding: 8, fontSize: 11, fontFamily: FONT, boxShadow: C.shadow }}>
                <strong>⚠ Problem:</strong> {error}
              </div>
            )}

            {ideas && !showingDoc && !brainstorming && (
              <div style={{ fontSize: 10, fontFamily: FONT, color: C.textSecondary, borderTop: "1px solid #ddd", paddingTop: 8 }}>
                Check the ideas you like, add your own, then click <strong>Build Plan</strong>. "More Ideas" brings fresh angles without repeats.
              </div>
            )}
            {showingDoc && (
              <div style={{ fontSize: 10, fontFamily: FONT, color: C.textSecondary, borderTop: "1px solid #ddd", paddingTop: 8 }}>
                Click a section in the document to edit, refine, or remove it.
              </div>
            )}
          </div>
        </MacWindow>

        {/* Document / Idea board window */}
        <MacWindow title={windowTitle} style={{ flex: 1, minWidth: 0 }}>
          {/* Idea board */}
          {!showingDoc && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {!ideas && !brainstorming && (
                  <div style={{ textAlign: "center", color: C.textSecondary, fontFamily: FONT, fontSize: 12, paddingTop: 80 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
                    Fill in the brief and click <strong>Brainstorm Ideas</strong>.<br />
                    You'll check off the ones you like before any plan is written.
                  </div>
                )}
                {!ideas && brainstorming && (
                  <div style={{ textAlign: "center", color: C.textSecondary, fontFamily: FONT, fontSize: 12, paddingTop: 80 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                    Brainstorming ideas…
                  </div>
                )}
                {grouped.map(([category, items]) => (
                  <div key={category} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: "bold", borderBottom: `1px solid ${C.border}`, paddingBottom: 2, marginBottom: 4 }}>
                      {category}
                    </div>
                    {items.map(({ idea, index }) => (
                      <button
                        key={index}
                        onClick={() => toggleIdea(index)}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          width: "100%",
                          textAlign: "left",
                          background: idea.checked ? "#e8e8ff" : "transparent",
                          border: "none",
                          borderBottom: "1px solid #eee",
                          padding: "5px 4px",
                          cursor: "pointer",
                          fontFamily: FONT,
                        }}
                      >
                        <span style={{ paddingTop: 1 }}><MacCheckbox checked={idea.checked} /></span>
                        <span style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: "bold", display: "block" }}>{idea.title}</span>
                          {idea.description && (
                            <span style={{ fontSize: 11, color: C.textSecondary, display: "block", lineHeight: 1.4 }}>{idea.description}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {gettingMore && (
                  <div style={{ fontSize: 11, fontFamily: FONT, color: C.textSecondary, padding: 8 }}>⏳ Getting more ideas…</div>
                )}
              </div>

              {/* Idea board footer */}
              {ideas && (
                <div style={{ borderTop: `1px solid ${C.border}`, background: C.buttonFace, padding: 8, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      value={customIdea}
                      onChange={(e) => setCustomIdea(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomIdea()}
                      placeholder="Add your own idea…"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <MacButton onClick={addCustomIdea} disabled={!customIdea.trim()}>Add</MacButton>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <MacButton onClick={() => brainstorm(true)} disabled={gettingMore || brainstorming || building}>
                      {gettingMore ? "Thinking…" : "More Ideas"}
                    </MacButton>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, fontFamily: FONT, color: C.textSecondary }}>{checkedCount} selected</span>
                    <MacButton primary onClick={buildPlan} disabled={checkedCount === 0 || building}>
                      {building ? "Writing…" : `Build Plan`}
                    </MacButton>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Document */}
          {showingDoc && (
            <div style={{ flex: 1, overflowY: "auto", background: "#c8c8c8", padding: 18 }}>
              <div style={{ background: C.window, border: `1px solid ${C.border}`, maxWidth: 700, margin: "0 auto", padding: "42px 52px", minHeight: "100%", boxShadow: C.shadow }}>
                <div style={{ fontFamily: FONT_DOC, fontSize: 14, lineHeight: 1.55, color: C.text }}>
                  <h1 style={{ fontSize: 24, margin: "0 0 6px", fontFamily: FONT, lineHeight: 1.2 }}>{doc!.title}</h1>
                  {selectedClient && (
                    <div style={{ fontSize: 11, fontFamily: FONT, color: C.textSecondary, marginBottom: 14 }}>
                      Prepared for {selectedClient.account_name} · Beyond Indigo
                    </div>
                  )}
                  <p style={{ margin: "0 0 20px", fontStyle: "italic" }}>{doc!.intro}</p>

                  {doc!.sections.map((section, i) => {
                    const active = activeSection === i;
                    return (
                      <div
                        key={i}
                        onClick={() => setActiveSection(active ? null : i)}
                        style={{
                          margin: "0 -12px 6px",
                          padding: "8px 12px",
                          border: active ? `1px dashed ${C.selection}` : "1px dashed transparent",
                          cursor: "pointer",
                        }}
                      >
                        <h2 style={{ fontSize: 16, fontFamily: FONT, margin: "0 0 6px", borderBottom: `1px solid ${C.border}`, paddingBottom: 3 }}>
                          {section.heading}
                        </h2>

                        {editingSection === i ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={Math.max(6, editDraft.split("\n").length + 1)}
                              style={{ ...inputStyle, fontFamily: FONT_DOC, fontSize: 13, lineHeight: 1.5, resize: "vertical" }}
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <MacButton primary onClick={saveEdit}>Save</MacButton>
                              <MacButton onClick={() => setEditingSection(null)}>Cancel</MacButton>
                            </div>
                          </div>
                        ) : (
                          <SectionContent text={section.content} />
                        )}

                        {/* Section toolbar */}
                        {active && editingSection !== i && (
                          <div onClick={(e) => e.stopPropagation()} style={{ border: `1px solid ${C.border}`, background: C.buttonFace, padding: 8, marginTop: 4, boxShadow: C.shadow }}>
                            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                              <MacButton onClick={() => startEdit(i)}>Edit Text</MacButton>
                              <MacButton onClick={() => deleteSection(i)}>Remove</MacButton>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                type="text"
                                value={refineText}
                                onChange={(e) => setRefineText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && refine(i)}
                                placeholder='Ask AI: "make this shorter", "add a timeline"…'
                                style={{ ...inputStyle, flex: 1 }}
                                disabled={refining}
                              />
                              <MacButton primary onClick={() => refine(i)} disabled={refining || !refineText.trim()}>
                                {refining ? "Working…" : "Refine"}
                              </MacButton>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </MacWindow>
      </div>
    </div>
  );
}
