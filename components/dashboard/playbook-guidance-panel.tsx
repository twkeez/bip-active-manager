"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Lightbulb,
  X,
} from "lucide-react";
import {
  PLAYBOOK_SECTIONS,
  type PlaybookIssueType,
  type PlaybookSection,
} from "@/lib/playbooks/content";
type PlaybookGuidancePanelProps = {
  variant?: "accordion" | "drawer";
  sections?: PlaybookIssueType[];
  className?: string;
  drawerTriggerLabel?: string;
};
function PlaybookSectionBody({ section }: { section: PlaybookSection }) {
  return (
    <div className="space-y-3 text-xs leading-relaxed text-bip-text">
      
      <div>
        
        <p className="text-[10px] font-semibold uppercase tracking-wider text-bip-muted">
          
          The Root Cause
        </p>
        <p className="mt-0.5">{section.rootCause}</p>
      </div>
      <div className="space-y-1.5">
        
        <p className="text-[10px] font-semibold uppercase tracking-wider text-bip-muted">
          
          Step-by-Step Fix
        </p>
        {section.steps.map((step) => (
          <div key={step} className="flex gap-2">
            
            <CheckCircle
              size={12}
              className="mt-0.5 shrink-0 text-bip-accent"
            />
            <span>{step}</span>
          </div>
        ))}
      </div>
      {section.proTip ? (
        <div className="flex gap-2 rounded-lg border border-indigo-500/10 bg-bip-accent/5 p-2.5 text-bip-muted">
          
          <Lightbulb
            size={14}
            className="mt-0.5 shrink-0 text-bip-accent"
          />
          <p>
            
            <strong className="text-bip-accent">Pro Agency Tip:</strong>
            {section.proTip}
          </p>
        </div>
      ) : null}
    </div>
  );
}
function AccordionItem({
  section,
  isOpen,
  onToggle,
}: {
  section: PlaybookSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-bip-border bg-bip-card/40">
      
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left transition hover:bg-bip-card/30"
      >
        
        <div className="flex items-center gap-2 text-sm font-medium text-bip-text">
          
          <span className={`h-2 w-2 rounded-full ${section.dotClass}`} />
          {section.title}
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="shrink-0 text-bip-muted" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-bip-muted" />
        )}
      </button>
      {isOpen ? (
        <div className="border-t border-bip-border bg-bip-card/20 p-4">
          
          <PlaybookSectionBody section={section} />
        </div>
      ) : null}
    </div>
  );
}
function PlaybookAccordion({
  sectionIds,
  openSection,
  onOpenSection,
}: {
  sectionIds: PlaybookIssueType[];
  openSection: PlaybookIssueType | null;
  onOpenSection: (id: PlaybookIssueType | null) => void;
}) {
  return (
    <div className="space-y-3">
      
      {sectionIds.map((id) => {
        const section = PLAYBOOK_SECTIONS[id];
        return (
          <AccordionItem
            key={id}
            section={section}
            isOpen={openSection === id}
            onToggle={() => onOpenSection(openSection === id ? null : id)}
          />
        );
      })}
    </div>
  );
}
export default function PlaybookGuidancePanel({
  variant = "accordion",
  sections,
  className = "",
  drawerTriggerLabel = "Playbooks & best practices",
}: PlaybookGuidancePanelProps) {
  const sectionIds = useMemo(
    () => sections ?? (Object.keys(PLAYBOOK_SECTIONS) as PlaybookIssueType[]),
    [sections],
  );
  const [openSection, setOpenSection] = useState<PlaybookIssueType | null>(
    null,
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);
  const header = (
    <div className="flex items-center gap-2 border-b border-bip-border pb-3">
      
      <BookOpen className="text-bip-accent" size={18} />
      <div>
        
        <h3 className="text-base font-semibold text-bip-text">
          
          Standard Operating Playbook &amp; Best Practices
        </h3>
        <p className="text-xs text-bip-muted">
          
          Contextual agency execution playbooks for resolving flagged
          performance defects.
        </p>
      </div>
    </div>
  );
  if (variant === "drawer") {
    return (
      <>
        
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-bip-accent/10 px-3 py-2 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/20"
        >
          
          <HelpCircle size={14} /> {drawerTriggerLabel}
        </button>
        {isDrawerOpen ? (
          <div className="fixed inset-0 z-50 flex justify-end">
            
            <button
              type="button"
              aria-label="Close playbook drawer"
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={() => setIsDrawerOpen(false)}
            />
            <aside
              className={`relative flex h-full w-full max-w-md flex-col border-l border-bip-border bg-bip-page shadow-2xl ${className}`}
            >
              
              <div className="flex items-start justify-between gap-3 border-b border-bip-border p-5">
                
                {header}
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg border border-bip-border p-2 text-bip-muted transition hover:bg-bip-card/60 hover:text-bip-text"
                >
                  
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                
                <PlaybookAccordion
                  sectionIds={sectionIds}
                  openSection={openSection}
                  onOpenSection={setOpenSection}
                />
              </div>
            </aside>
          </div>
        ) : null}
      </>
    );
  }
  return (
    <div
      className={`rounded-xl border border-bip-border bg-bip-card/40 p-6 font-sans ${className}`}
    >
      
      <div className="mb-6">{header}</div>
      <PlaybookAccordion
        sectionIds={sectionIds}
        openSection={openSection}
        onOpenSection={setOpenSection}
      />
    </div>
  );
}
type PlaybookInlineTriggerProps = {
  issueType: PlaybookIssueType;
  label?: string;
};
export function PlaybookInlineTrigger({
  issueType,
  label,
}: PlaybookInlineTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const section = PLAYBOOK_SECTIONS[issueType];
  return (
    <div className="mt-3">
      
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-bip-accent transition hover:text-bip-accent"
      >
        
        <HelpCircle size={12} /> {label ?? "View repair playbook"}
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {isOpen ? (
        <div className="mt-2 rounded-lg border border-bip-border bg-bip-card/40 p-3">
          
          <p className="mb-2 text-xs font-semibold text-bip-text">
            {section.title}
          </p>
          <PlaybookSectionBody section={section} />
        </div>
      ) : null}
    </div>
  );
}
