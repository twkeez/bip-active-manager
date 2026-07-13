// Pulls messages + comments from linked Illuminare Basecamp projects into
// illuminare_comms_events, then updates each client's last-communication aggregate.
import { getInternalEmailDomains } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPaginatedRecent,
  requestBasecampJson,
} from "@/lib/basecamp/client";
import { getActiveIlluminareBasecampToken } from "@/lib/illuminare/basecamp-client";
import {
  buildCommsExcerpt,
  computeCommsAggregate,
  isInternalAuthor,
  storedIsInternal,
  type LatestCommsEvent,
} from "@/lib/illuminare/comms";

type Creator = { id?: number; email_address?: string; name?: string };
type BasecampMessage = {
  id?: number;
  subject?: string;
  title?: string;
  content?: string;
  created_at?: string;
  updated_at?: string;
  creator?: Creator;
  app_url?: string;
  url?: string;
};
type BasecampComment = {
  id?: number;
  content?: string;
  created_at?: string;
  updated_at?: string;
  creator?: Creator;
  app_url?: string;
  url?: string;
};

const FETCH_WINDOW_DAYS = 180;

function parseDate(value: string | undefined | null): string {
  const t = value ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

function trimToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

async function getMessageBoardId(
  accessToken: string,
  accountId: string,
  projectId: string,
): Promise<number | null> {
  const project = await requestBasecampJson<{
    dock?: Array<{ name?: string; enabled?: boolean; id?: number }>;
  }>(accessToken, accountId, `/projects/${projectId}.json`);
  const board = project.data.dock?.find(
    (tool) => tool.name === "message_board" && tool.enabled !== false,
  );
  return board?.id ?? null;
}

export type IlluminareCommsSyncSummary = {
  clientsSynced: number;
  eventsUpserted: number;
  errors: Array<{ clientId: number; projectId: string; error: string }>;
};

export async function runIlluminareCommsSync(): Promise<IlluminareCommsSyncSummary> {
  const admin = createAdminClient();
  const configuredDomains = getInternalEmailDomains();
  // Default to the agency's own domain when the env var isn't set.
  const internalDomains =
    configuredDomains.length > 0 ? configuredDomains : ["beyondindigo.com"];

  const token = await getActiveIlluminareBasecampToken(admin);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const cutoffMs = nowMs - FETCH_WINDOW_DAYS * 86_400_000;

  const { data: clientsData, error: clientsError } = await admin
    .from("illuminare_clients")
    .select("id, basecamp_project_id")
    .not("basecamp_project_id", "is", null);
  if (clientsError) {
    throw new Error(`Failed loading linked clients: ${clientsError.message}`);
  }
  const clients = (clientsData ?? []) as {
    id: number;
    basecamp_project_id: string;
  }[];

  const emailCache = new Map<number, string | null>();
  async function resolveEmail(personId: number | null): Promise<string | null> {
    if (!personId) return null;
    if (emailCache.has(personId)) return emailCache.get(personId) ?? null;
    try {
      const person = await requestBasecampJson<{ email_address?: string }>(
        token.access_token,
        token.account_id,
        `/people/${personId}.json`,
      );
      const email = trimToNull(person.data.email_address);
      emailCache.set(personId, email);
      return email;
    } catch {
      emailCache.set(personId, null);
      return null;
    }
  }

  const summary: IlluminareCommsSyncSummary = {
    clientsSynced: 0,
    eventsUpserted: 0,
    errors: [],
  };

  for (const client of clients) {
    const projectId = client.basecamp_project_id;
    try {
      const events: Record<string, unknown>[] = [];
      const boardId = await getMessageBoardId(
        token.access_token,
        token.account_id,
        projectId,
      );

      if (boardId) {
        const messages = await fetchPaginatedRecent<BasecampMessage>(
          token.access_token,
          token.account_id,
          `/message_boards/${boardId}/messages.json?sort=updated_at&direction=desc`,
          (m) => new Date(parseDate(m.updated_at ?? m.created_at)).getTime() >= cutoffMs,
        );

        for (const message of messages) {
          if (!message.id) continue;
          const personId = message.creator?.id ?? null;
          const email =
            trimToNull(message.creator?.email_address) ??
            (await resolveEmail(personId));
          const isInternal = storedIsInternal(
            isInternalAuthor(email, internalDomains),
            email,
          );
          const title = trimToNull(message.subject) ?? trimToNull(message.title);
          events.push({
            client_id: client.id,
            basecamp_project_id: projectId,
            recording_id: message.id,
            kind: "message",
            occurred_at: parseDate(message.updated_at ?? message.created_at),
            author_name: trimToNull(message.creator?.name),
            author_email: email,
            is_internal: isInternal,
            title,
            excerpt: buildCommsExcerpt(message.content),
            url: trimToNull(message.app_url) ?? trimToNull(message.url),
            updated_at: nowIso,
          });

          // Basecamp comments live under the bucketed recordings path.
          let comments: BasecampComment[] = [];
          try {
            comments = await fetchPaginatedRecent<BasecampComment>(
              token.access_token,
              token.account_id,
              `/buckets/${projectId}/recordings/${message.id}/comments.json`,
              (c) =>
                new Date(parseDate(c.updated_at ?? c.created_at)).getTime() >= cutoffMs,
            );
          } catch {
            // A single message's comments failing shouldn't drop the whole client.
            comments = [];
          }
          for (const comment of comments) {
            if (!comment.id) continue;
            const cPersonId = comment.creator?.id ?? null;
            const cEmail =
              trimToNull(comment.creator?.email_address) ??
              (await resolveEmail(cPersonId));
            events.push({
              client_id: client.id,
              basecamp_project_id: projectId,
              recording_id: comment.id,
              kind: "comment",
              occurred_at: parseDate(comment.updated_at ?? comment.created_at),
              author_name: trimToNull(comment.creator?.name),
              author_email: cEmail,
              is_internal: storedIsInternal(
                isInternalAuthor(cEmail, internalDomains),
                cEmail,
              ),
              title,
              excerpt: buildCommsExcerpt(comment.content),
              url: trimToNull(comment.app_url) ?? trimToNull(comment.url),
              updated_at: nowIso,
            });
          }
        }
      }

      if (events.length > 0) {
        const { error: upsertError } = await admin
          .from("illuminare_comms_events")
          .upsert(events, {
            onConflict: "basecamp_project_id,recording_id,kind",
          });
        if (upsertError) {
          throw new Error(upsertError.message);
        }
        summary.eventsUpserted += events.length;
      }

      // Recompute the aggregate from the most recent stored event.
      const { data: latest } = await admin
        .from("illuminare_comms_events")
        .select("occurred_at, is_internal")
        .eq("client_id", client.id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle<LatestCommsEvent>();

      const aggregate = computeCommsAggregate(latest ?? null, nowMs);
      const { error: updateError } = await admin
        .from("illuminare_clients")
        .update({ ...aggregate, comms_synced_at: nowIso })
        .eq("id", client.id);
      if (updateError) {
        throw new Error(updateError.message);
      }

      summary.clientsSynced += 1;
    } catch (error) {
      summary.errors.push({
        clientId: client.id,
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return summary;
}
