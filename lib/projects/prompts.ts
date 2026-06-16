import type { ProjectAiContext } from "@/lib/projects/context";
import { formatProjectAiContext } from "@/lib/projects/context";

export function buildBrainstormPrompt(ctx: ProjectAiContext, userPrompt?: string) {
  const extra = userPrompt?.trim()
    ? `\nUser focus for this brainstorm:\n${userPrompt.trim()}`
    : "";
  return [
    "You are a senior veterinary marketing strategist at Beyond Indigo Pets.",
    "Brainstorm practical ideas for the client project below.",
    "Cover channels, creative angles, messaging hooks, compliance cautions, and quick wins.",
    "Write clear markdown with headings and bullet lists.",
    "End with a short 'Top 5 next experiments' section.",
    "",
    formatProjectAiContext(ctx),
    extra,
  ].join("\n");
}

export function buildPlanPrompt(ctx: ProjectAiContext, userPrompt?: string) {
  const extra = userPrompt?.trim()
    ? `\nUser constraints for the plan:\n${userPrompt.trim()}`
    : "";
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are a senior veterinary marketing strategist at Beyond Indigo Pets.",
    "Create an execution plan for the project below.",
    "",
    formatProjectAiContext(ctx),
    extra,
    "",
    `Today's date: ${today}`,
    "",
    "Return STRICT JSON only with this shape:",
    JSON.stringify(
      {
        phases: [
          {
            title: "Discovery",
            tasks: [
              {
                title: "Example task",
                priority: "high",
                dueDate: "2026-06-01",
                notes: "Optional context",
              },
            ],
          },
        ],
        assumptions: ["..."],
        risks: ["..."],
      },
      null,
      2,
    ),
    "Rules:",
    "- 3-6 phases in logical order.",
    "- 3-8 tasks per phase with realistic dueDate values (YYYY-MM-DD) within the project window.",
    "- priority must be low, medium, or high.",
    "- No markdown outside JSON.",
  ].join("\n");
}

export function buildWeeklyStatusPrompt(ctx: ProjectAiContext) {
  return [
    "You are a senior veterinary marketing strategist at Beyond Indigo Pets.",
    "Write a concise weekly project status for the account manager.",
    "Use markdown with these sections: Progress, Blockers, Next 3 Actions.",
    "Be specific and actionable. Reference phases and open tasks when relevant.",
    "",
    formatProjectAiContext(ctx),
  ].join("\n");
}

export function planJsonToMarkdown(plan: {
  phases: Array<{ title: string; tasks: Array<{ title: string }> }>;
  assumptions?: string[];
  risks?: string[];
}) {
  const lines: string[] = ["# Project plan", ""];
  for (const phase of plan.phases) {
    lines.push(`## ${phase.title}`);
    for (const task of phase.tasks) {
      lines.push(`- [ ] ${task.title}`);
    }
    lines.push("");
  }
  if (plan.assumptions?.length) {
    lines.push("## Assumptions");
    for (const item of plan.assumptions) lines.push(`- ${item}`);
    lines.push("");
  }
  if (plan.risks?.length) {
    lines.push("## Risks");
    for (const item of plan.risks) lines.push(`- ${item}`);
  }
  return lines.join("\n").trim();
}
