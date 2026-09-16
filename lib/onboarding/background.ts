import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClassicAuthHeaders } from "@/lib/basecamp/sync";
import { loadBasecampProjectsForMatch } from "@/lib/basecamp/client";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";
import { BACKGROUND_RULES, htmlToText, isAccessThread, redactCredentials } from "./background-safety";

/**
 * Background for onboarding research, compiled from everything already known
 * about a practice: the pipeline form's notes, the website team's kickoff doc,
 * and the practice's Basecamp threads.
 *
 * The research scans read one combined text, so the market research and ad
 * research know what the website team has already learned — a practice that is
 * reopening a 30-year-old hospital under a new name, a splash page going up
 * first — instead of only what the sales form captured.
 */

export const BACKGROUND_MODEL = "claude-opus-5";
const FALLBACK_MODEL = "claude-opus-4-8";

/** Enough threads to cover a website build; beyond this is old history. */
const MAX_THREADS = 40;
const MAX_THREAD_CHARS = 6_000;
const MAX_SOURCE_CHARS = 90_000;

// ---------------------------------------------------------------------------
// Combining
// ---------------------------------------------------------------------------

export type BackgroundParts = {
  pipelineNotes: string | null;
  /** "Meeting Notes" from the client document — the client's own goals. */
  clientPriorities?: string | null;
  kickoffSummary: string | null;
  basecampBackground: string | null;
};

/** What the research scans read, labelled so the model knows each source. */
export function combineBackground(parts: BackgroundParts): string {
  const sections = [
    parts.pipelineNotes?.trim() ? `From the pipeline form:\n${parts.pipelineNotes.trim()}` : null,
    parts.clientPriorities?.trim()
      ? `What the client told us they want (meeting notes from their onboarding document):\n${parts.clientPriorities.trim()}`
      : null,
    parts.kickoffSummary?.trim() ? `From the website team's kickoff doc:\n${parts.kickoffSummary.trim()}` : null,
    parts.basecampBackground?.trim() ? `From the practice's Basecamp threads:\n${parts.basecampBackground.trim()}` : null,
  ].filter((section): section is string => Boolean(section));
  return sections.join("\n\n");
}

export async function loadOnboardingBackground(supabase: SupabaseClient, clientId: number): Promise<string> {
  // The client's stated priorities (competitors to watch, budget, areas) are
  // written in the document editor; the ad research should work from them too.
  const { data: prioritiesRow } = await supabase
    .from("client_document_edits")
    .select("body")
    .eq("client_id", clientId)
    .eq("section_key", "priorities")
    .maybeSingle();
  const clientPriorities = (prioritiesRow?.body as string | null | undefined) ?? null;

  const { data } = await supabase
    .from("client_onboarding_intake")
    .select("pipeline_notes, kickoff_doc_summary, basecamp_background")
    .eq("client_id", clientId)
    .maybeSingle();
  // Before the background migration runs, the extra columns do not exist and
  // this query errors; fall back to the pipeline notes the scans always used.
  if (!data) {
    const { data: notesOnly } = await supabase
      .from("client_onboarding_intake")
      .select("pipeline_notes")
      .eq("client_id", clientId)
      .maybeSingle();
    return combineBackground({
      pipelineNotes: (notesOnly?.pipeline_notes as string | null) ?? null,
      clientPriorities,
      kickoffSummary: null,
      basecampBackground: null,
    });
  }
  return combineBackground({
    pipelineNotes: (data.pipeline_notes as string | null) ?? null,
    clientPriorities,
    kickoffSummary: (data.kickoff_doc_summary as string | null) ?? null,
    basecampBackground: (data.basecamp_background as string | null) ?? null,
  });
}

// ---------------------------------------------------------------------------
// Summarising
// ---------------------------------------------------------------------------

/**
 * Claude turns a source into background under BACKGROUND_RULES. Credentials are
 * removed from the input before it is sent and from the summary after, so a
 * miss at either end is caught at the other.
 */
export async function summariseBackground(
  source: string | Anthropic.Beta.BetaContentBlockParam[],
  { clientName, sourceLabel }: { clientName: string; sourceLabel: string },
): Promise<string> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    typeof source === "string"
      ? [{ type: "text", text: stripLoneSurrogates(redactCredentials(source.slice(0, MAX_SOURCE_CHARS)).text) }]
      : source;

  const stream = client.beta.messages.stream({
    model: BACKGROUND_MODEL,
    max_tokens: 16_000,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: BACKGROUND_RULES,
    messages: [
      {
        role: "user",
        content: [
          ...content,
          {
            type: "text",
            text: `Above is ${sourceLabel} for ${clientName}. Write the background.`,
          },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to summarise this source.");
  const text = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("The summary came back empty.");
  return redactCredentials(text).text;
}

// ---------------------------------------------------------------------------
// Basecamp
// ---------------------------------------------------------------------------

export type ProjectThread = { title: string; text: string };

type ClassicTopic = { title?: string; topicable?: { type?: string; id?: number } };
type ClassicMessage = {
  subject?: string;
  content?: string;
  creator?: { name?: string };
  comments?: Array<{ content?: string; creator?: { name?: string } }>;
};

async function classicGet<T>(path: string): Promise<T> {
  const { accountId, headers } = buildClassicAuthHeaders();
  const response = await fetch(`https://basecamp.com/${accountId}/api/v1${path}`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`Basecamp ${path} failed (HTTP ${response.status})`);
  return (await response.json()) as T;
}

/**
 * Every message thread in a project, with its comments, as plain text — except
 * threads named for access details, which are listed as skipped and never
 * fetched.
 */
export async function readProjectThreads(
  projectId: string,
): Promise<{ threads: ProjectThread[]; skipped: string[] }> {
  const topics: ClassicTopic[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await classicGet<ClassicTopic[]>(
      `/projects/${encodeURIComponent(projectId)}/topics.json?page=${page}`,
    );
    topics.push(...batch);
    if (batch.length < 25) break;
  }

  const skipped: string[] = [];
  const wanted = topics
    .filter((topic) => topic.topicable?.type === "Message" && topic.topicable.id)
    .filter((topic) => {
      if (!isAccessThread(topic.title)) return true;
      skipped.push(topic.title ?? "(untitled)");
      return false;
    })
    .slice(0, MAX_THREADS);

  const threads: ProjectThread[] = [];
  // Four at a time keeps a large project quick without hammering Basecamp.
  for (let index = 0; index < wanted.length; index += 4) {
    const batch = await Promise.all(
      wanted.slice(index, index + 4).map(async (topic) => {
        const message = await classicGet<ClassicMessage>(
          `/projects/${encodeURIComponent(projectId)}/messages/${topic.topicable!.id}.json`,
        );
        const parts = [
          `${message.creator?.name ?? "Someone"}: ${htmlToText(message.content)}`,
          ...(message.comments ?? []).map(
            (comment) => `${comment.creator?.name ?? "Someone"}: ${htmlToText(comment.content)}`,
          ),
        ];
        const text = redactCredentials(parts.join("\n\n")).text.slice(0, MAX_THREAD_CHARS);
        return { title: message.subject ?? topic.title ?? "(untitled)", text };
      }),
    );
    threads.push(...batch.filter((thread) => thread.text.trim()));
  }
  return { threads, skipped };
}

/**
 * The practice's Basecamp project, linking it when it is plainly theirs.
 *
 * New clients often already have a website-team project (Tiburon did) that was
 * never linked to the client record. A project is linked only on an exact name
 * match that no other client already claims; anything less is left for Project
 * Wiring, because a wrong link would mix two practices' threads.
 */
export async function resolveBasecampProject(
  admin: SupabaseClient,
  client: { id: number; account_name: string; basecamp_project_id: string | null },
): Promise<{ projectId: string | null; projectName: string | null; linked: boolean; reason: string | null }> {
  if (client.basecamp_project_id?.trim()) {
    return { projectId: client.basecamp_project_id.trim(), projectName: null, linked: false, reason: null };
  }

  const { projects } = await loadBasecampProjectsForMatch(normalizeClientName);
  const target = normalizeClientName(client.account_name);
  const matches = projects.filter((project) => project.normalizedName === target);
  if (matches.length !== 1) {
    return {
      projectId: null,
      projectName: null,
      linked: false,
      reason:
        matches.length === 0
          ? "No Basecamp project matches this practice's name. Link one on Project Wiring."
          : `${matches.length} Basecamp projects match this name. Pick the right one on Project Wiring.`,
    };
  }

  const project = matches[0];
  const { data: claimed } = await admin
    .from("clients")
    .select("id, account_name")
    .eq("basecamp_project_id", project.id)
    .neq("id", client.id)
    .limit(1);
  if (claimed && claimed.length > 0) {
    return {
      projectId: null,
      projectName: project.name,
      linked: false,
      reason: `"${project.name}" is already linked to ${claimed[0].account_name as string}. Check Project Wiring.`,
    };
  }

  const { error } = await admin.from("clients").update({ basecamp_project_id: project.id }).eq("id", client.id);
  if (error) throw new Error(error.message);
  return { projectId: project.id, projectName: project.name, linked: true, reason: null };
}
