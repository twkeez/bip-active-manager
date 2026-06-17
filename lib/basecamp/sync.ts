import { Buffer } from "node:buffer";
import {
  getBasecampClassicConfig,
  getInternalEmails,
  getInternalEmailDomains,
} from "@/lib/env";
import {
  fetchPaginated,
  fetchPaginatedRecent,
  getActiveBasecampToken,
  requestBasecampJson,
} from "@/lib/basecamp/client";
import {
  computeClientCommsAggregate,
  storedAuthorIsInternal,
} from "@/lib/basecamp/comms-aggregate";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type BasecampInternalIdentityRow = {
  basecamp_person_id: number | null;
  email: string | null;
  email_domain: string | null;
  is_internal: boolean;
};

type BasecampPerson = {
  id?: number;
  email_address?: string | null;
  name?: string | null;
};

type BasecampMessage = {
  id?: number;
  created_at?: string;
  updated_at?: string;
  subject?: string | null;
  title?: string | null;
  content?: string | null;
  description?: string | null;
  app_url?: string | null;
  url?: string | null;
  creator?: BasecampPerson;
};

type BasecampComment = {
  id?: number;
  created_at?: string;
  updated_at?: string;
  content?: string | null;
  body?: string | null;
  app_url?: string | null;
  url?: string | null;
  creator?: BasecampPerson;
};

type ClientProject = {
  id: number;
  basecamp_project_id: string | null;
  reply_acknowledged_at: string | null;
  reply_acknowledged_for_occurred_at: string | null;
};

type CommunicationEvent = {
  client_id: number;
  basecamp_project_id: string;
  basecamp_recording_id: number;
  parent_recording_id: number | null;
  kind: "message" | "comment";
  occurred_at: string;
  author_person_id: number | null;
  author_email: string | null;
  is_internal: boolean;
  source_updated_at: string | null;
  thread_title: string | null;
  thread_excerpt: string | null;
  thread_body: string | null;
  thread_url: string | null;
  updated_at: string;
};

type BasecampSyncMode = "oauth" | "classic";

const CLASSIC_TOPICS_MAX_PAGES = 50;

type ClassicMessageTopicSnapshot = {
  basecamp_recording_id: number;
  occurred_at: string;
  author_person_id: number | null;
  author_email: string | null;
  thread_title: string | null;
  thread_excerpt: string | null;
  thread_body: string | null;
  thread_url: string | null;
};

function parseDateOrNow(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : value;
}

function parseClassicDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return value.trim();
}

function toDomain(email: string | null | undefined) {
  if (!email) return null;
  const match = email.toLowerCase().match(/@(.+)$/);
  return match?.[1] ?? null;
}

function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function normalizeDomain(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeBasecampThreadUrl(value: string | null | undefined) {
  const raw = trimToNull(value);
  if (!raw) return null;
  // Convert API JSON endpoints into human-openable Basecamp pages.
  return raw.replace("/api/v1/", "/").replace(/\.json(\?.*)?$/, "$1");
}

type InternalLookup = {
  personRules: Map<number, boolean>;
  emailRules: Map<string, boolean>;
  domainRules: Map<string, boolean>;
  fallbackInternalEmails: Set<string>;
  fallbackInternalDomains: Set<string>;
};

type ClassificationResult = {
  isInternal: boolean | null;
  source: "person_id" | "email" | "domain" | "env_email" | "env_domain" | "unknown";
};

function buildInternalLookup(
  rows: BasecampInternalIdentityRow[] | null,
  fallbackDomains: string[],
  fallbackEmails: string[],
): InternalLookup {
  const personRules = new Map<number, boolean>();
  const emailRules = new Map<string, boolean>();
  const domainRules = new Map<string, boolean>();

  for (const row of rows ?? []) {
    if (row.basecamp_person_id != null) {
      personRules.set(row.basecamp_person_id, row.is_internal);
    }
    const normalizedEmail = normalizeEmail(row.email);
    if (normalizedEmail) {
      emailRules.set(normalizedEmail, row.is_internal);
    }
    const normalizedDomain = normalizeDomain(row.email_domain);
    if (normalizedDomain) {
      domainRules.set(normalizedDomain, row.is_internal);
    }
  }

  return {
    personRules,
    emailRules,
    domainRules,
    fallbackInternalEmails: new Set(fallbackEmails.map((email) => email.toLowerCase())),
    fallbackInternalDomains: new Set(
      fallbackDomains.map((domain) => domain.toLowerCase()),
    ),
  };
}

async function loadInternalLookup(
  admin: AdminClient,
  fallbackDomains: string[],
  fallbackEmails: string[],
) {
  const fallbackLookup = buildInternalLookup(null, fallbackDomains, fallbackEmails);
  const { data, error } = await admin
    .from("basecamp_internal_identities")
    .select("basecamp_person_id,email,email_domain,is_internal")
    .returns<BasecampInternalIdentityRow[]>();
  if (error) {
    // Missing table or policies should not break sync; use env fallback.
    if (
      /does not exist|relation|permission denied|could not find the table/i.test(
        error.message,
      )
    ) {
      return fallbackLookup;
    }
    throw new Error(`Failed loading internal identity rules: ${error.message}`);
  }
  return buildInternalLookup(data, fallbackDomains, fallbackEmails);
}

function classifyAuthor(
  personId: number | null,
  email: string | null,
  lookup: InternalLookup,
): ClassificationResult {
  if (personId != null && lookup.personRules.has(personId)) {
    return {
      isInternal: lookup.personRules.get(personId) ?? false,
      source: "person_id",
    };
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail && lookup.emailRules.has(normalizedEmail)) {
    return {
      isInternal: lookup.emailRules.get(normalizedEmail) ?? false,
      source: "email",
    };
  }

  const domain = toDomain(normalizedEmail);
  if (domain && lookup.domainRules.has(domain)) {
    return {
      isInternal: lookup.domainRules.get(domain) ?? false,
      source: "domain",
    };
  }

  if (normalizedEmail && lookup.fallbackInternalEmails.has(normalizedEmail)) {
    return { isInternal: true, source: "env_email" };
  }
  if (domain && lookup.fallbackInternalDomains.has(domain)) {
    return { isInternal: true, source: "env_domain" };
  }
  return { isInternal: null, source: "unknown" };
}

function stripHtml(input: string) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeContent(value: unknown) {
  if (typeof value !== "string") return null;
  const stripped = stripHtml(value);
  return stripped ? stripped : null;
}

function buildExcerpt(body: string | null, maxLength = 160) {
  if (!body) return null;
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength - 1)}…`;
}

function buildClassicAuthHeaders() {
  const config = getBasecampClassicConfig();
  const authorization = config.token
    ? `Bearer ${config.token}`
    : `Basic ${Buffer.from(
        `${config.basicUser}:${config.basicPassword}`,
        "utf8",
      ).toString("base64")}`;
  return {
    accountId: config.accountId,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "User-Agent": "BIPClientManager (ops@beyondindigo.com)",
    },
  };
}

function mapClassicTopicToSnapshot(
  topic: Record<string, unknown>,
): ClassicMessageTopicSnapshot | null {
  const topicable =
    topic.topicable && typeof topic.topicable === "object"
      ? (topic.topicable as Record<string, unknown>)
      : null;
  if (!topicable) return null;
  if (String(topicable.type ?? "") !== "Message") return null;
  const idRaw = topicable.id;
  const recordingId =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? Math.trunc(idRaw)
      : typeof idRaw === "string" && idRaw.trim() && /^\d+$/.test(idRaw.trim())
        ? Number(idRaw.trim())
        : null;
  if (!recordingId) return null;
  const occurredAt = parseClassicDate(topic.updated_at) ?? new Date().toISOString();
  const lastUpdater =
    topic.last_updater && typeof topic.last_updater === "object"
      ? (topic.last_updater as Record<string, unknown>)
      : null;
  const authorPersonIdRaw = lastUpdater?.id;
  const authorPersonId =
    typeof authorPersonIdRaw === "number" && Number.isFinite(authorPersonIdRaw)
      ? Math.trunc(authorPersonIdRaw)
      : typeof authorPersonIdRaw === "string" &&
          authorPersonIdRaw.trim() &&
          /^\d+$/.test(authorPersonIdRaw.trim())
        ? Number(authorPersonIdRaw.trim())
        : null;
  const authorEmailRaw = lastUpdater?.email_address ?? lastUpdater?.email;
  const authorEmail =
    typeof authorEmailRaw === "string" && authorEmailRaw.trim()
      ? authorEmailRaw.trim()
      : null;
  const threadTitle = normalizeContent(topicable.title ?? topic.title);
  const threadBody = normalizeContent(
    topicable.content ?? topicable.body ?? topic.excerpt ?? topic.title,
  );
  const threadExcerpt = normalizeContent(topic.excerpt) ?? buildExcerpt(threadBody);
  const threadUrl = trimToNull(
    typeof topicable.url === "string"
      ? topicable.url
      : typeof topic.url === "string"
        ? topic.url
        : null,
  );
  return {
    basecamp_recording_id: recordingId,
    occurred_at: occurredAt,
    author_person_id: authorPersonId,
    author_email: authorEmail,
    thread_title: threadTitle,
    thread_excerpt: threadExcerpt,
    thread_body: threadBody,
    thread_url: normalizeBasecampThreadUrl(threadUrl),
  };
}

async function fetchClassicMessageTopics(
  accountId: string,
  projectId: string,
  headers: Record<string, string>,
) {
  const snapshots: ClassicMessageTopicSnapshot[] = [];
  let page = 1;
  let previousPageFirstId: number | null = null;

  while (page <= CLASSIC_TOPICS_MAX_PAGES) {
    const url = `https://basecamp.com/${accountId}/api/v1/projects/${encodeURIComponent(projectId)}/topics.json?page=${page}`;
    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Basecamp classic topics failed (${response.status}) project=${projectId}: ${body}`,
      );
    }
    const json = (await response.json()) as unknown;
    if (!Array.isArray(json) || json.length === 0) {
      break;
    }

    const pageFirstSnapshot = json[0] && typeof json[0] === "object"
      ? mapClassicTopicToSnapshot(json[0] as Record<string, unknown>)
      : null;
    const pageFirstId = pageFirstSnapshot?.basecamp_recording_id ?? null;
    if (pageFirstId != null && pageFirstId === previousPageFirstId) {
      break;
    }
    previousPageFirstId = pageFirstId;

    for (const row of json) {
      if (!row || typeof row !== "object") continue;
      const snapshot = mapClassicTopicToSnapshot(row as Record<string, unknown>);
      if (snapshot) snapshots.push(snapshot);
    }

    if (json.length < 25) {
      break;
    }
    page += 1;
  }

  snapshots.sort(
    (left, right) =>
      new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime(),
  );
  return snapshots;
}

async function requestClassicBasecampJson<T>(
  accountId: string,
  headers: Record<string, string>,
  path: string,
) {
  const url = `https://basecamp.com/${accountId}${path}`;
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Basecamp classic request failed (${response.status}) for ${path}: ${body}`,
    );
  }
  return (await response.json()) as T;
}

async function getProjectMessageBoardId(
  accessToken: string,
  accountId: string,
  projectId: string,
) {
  const project = await requestBasecampJson<{
    dock?: Array<{ name?: string; enabled?: boolean; id?: number }>;
  }>(accessToken, accountId, `/projects/${projectId}.json`);
  const board = project.data.dock?.find(
    (tool) => tool.name === "message_board" && tool.enabled !== false,
  );
  return board?.id ?? null;
}

async function resolvePersonEmail(
  admin: AdminClient,
  accessToken: string,
  accountId: string,
  personId: number | null,
) {
  if (!personId) return null;
  const { data: cached, error } = await admin
    .from("basecamp_people_cache")
    .select("email")
    .eq("person_id", personId)
    .maybeSingle<{ email: string | null }>();
  if (error) {
    throw new Error(`Failed to read people cache: ${error.message}`);
  }
  if (cached?.email) {
    return cached.email;
  }

  const person = await requestBasecampJson<{ email_address?: string; name?: string }>(
    accessToken,
    accountId,
    `/people/${personId}.json`,
  );
  const email = trimToNull(person.data.email_address);
  const { error: upsertError } = await admin.from("basecamp_people_cache").upsert({
    person_id: personId,
    email,
    name: trimToNull(person.data.name),
    fetched_at: new Date().toISOString(),
  });
  if (upsertError) {
    throw new Error(`Failed to update people cache: ${upsertError.message}`);
  }
  return email;
}

async function resolveClassicPersonEmail(
  admin: AdminClient,
  accountId: string,
  headers: Record<string, string>,
  personId: number | null,
) {
  if (!personId) return null;
  const { data: cached, error } = await admin
    .from("basecamp_people_cache")
    .select("email")
    .eq("person_id", personId)
    .maybeSingle<{ email: string | null }>();
  if (error) {
    throw new Error(`Failed to read people cache: ${error.message}`);
  }
  if (cached?.email) {
    return cached.email;
  }

  const person = await requestClassicBasecampJson<{
    email_address?: string;
    email?: string;
    name?: string;
  }>(accountId, headers, `/api/v1/people/${personId}.json`);
  const email = trimToNull(person.email_address) ?? trimToNull(person.email);
  const { error: upsertError } = await admin.from("basecamp_people_cache").upsert({
    person_id: personId,
    email,
    name: trimToNull(person.name),
    fetched_at: new Date().toISOString(),
  });
  if (upsertError) {
    throw new Error(`Failed to update people cache: ${upsertError.message}`);
  }
  return email;
}

function splitChunks<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function updateClientCommsAggregate(
  admin: AdminClient,
  clientId: number,
  acknowledgedForOccurredAt: string | null,
  cutoffIso: string,
) {
  const { data: latest, error } = await admin
    .from("basecamp_communication_events")
    .select("occurred_at,is_internal")
    .eq("client_id", clientId)
    .gte("occurred_at", cutoffIso)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ occurred_at: string; is_internal: boolean }>();
  if (error) {
    throw new Error(`Failed loading latest comms event for client ${clientId}: ${error.message}`);
  }

  const aggregate = computeClientCommsAggregate(latest, acknowledgedForOccurredAt);
  const { error: updateError } = await admin
    .from("clients")
    .update(aggregate)
    .eq("id", clientId);
  if (updateError) {
    throw new Error(`Failed updating client aggregate for ${clientId}: ${updateError.message}`);
  }
}

export async function runBasecampSync(mode: BasecampSyncMode = "oauth") {
  const admin = createAdminClient();
  const fallbackInternalDomains = getInternalEmailDomains();
  const fallbackInternalEmails = getInternalEmails();
  const internalLookup = await loadInternalLookup(
    admin,
    fallbackInternalDomains,
    fallbackInternalEmails,
  );
  const nowIso = new Date().toISOString();
  const thirtyDaysMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(thirtyDaysMs).toISOString(); // prune/aggregate window always 30 days

  // Fetch window: use last sync time so we only pull new messages, not the full 30 days.
  // Subtract 5 minutes as a safety buffer for clock skew or in-flight events.
  // Fall back to 30 days on first run or if last sync was too long ago.
  const { data: syncState } = await admin
    .from("basecamp_sync_state")
    .select("last_synced_at")
    .eq("id", 1)
    .maybeSingle<{ last_synced_at: string | null }>();
  const lastSyncedAt = syncState?.last_synced_at ?? null;
  const lastSyncMs = lastSyncedAt ? new Date(lastSyncedAt).getTime() - 5 * 60 * 1000 : null;
  const fetchCutoffMs =
    lastSyncMs && lastSyncMs > thirtyDaysMs ? lastSyncMs : thirtyDaysMs;
  const fetchCutoffIso = new Date(fetchCutoffMs).toISOString();
  const isIncremental = fetchCutoffMs > thirtyDaysMs;

  const oauth = mode === "oauth" ? await getActiveBasecampToken(admin) : null;
  const classic = mode === "classic" ? buildClassicAuthHeaders() : null;

  let projects: ClientProject[] | null = null;
  let projectsError: { message: string; code?: string | null } | null = null;
  {
    const primaryQuery = await admin
      .from("clients")
      .select(
        "id,basecamp_project_id,reply_acknowledged_at,reply_acknowledged_for_occurred_at",
      )
      .not("basecamp_project_id", "is", null)
      .returns<ClientProject[]>();
    if (
      primaryQuery.error &&
      /reply_acknowledged_at|reply_acknowledged_for_occurred_at/i.test(
        primaryQuery.error.message,
      )
    ) {
      const fallbackQuery = await admin
        .from("clients")
        .select("id,basecamp_project_id")
        .not("basecamp_project_id", "is", null)
        .returns<Array<{ id: number; basecamp_project_id: string | null }>>();
      if (fallbackQuery.error) {
        projectsError = fallbackQuery.error;
      } else {
        projects = (fallbackQuery.data ?? []).map((row) => ({
          ...row,
          reply_acknowledged_at: null,
          reply_acknowledged_for_occurred_at: null,
        }));
      }
    } else {
      projects = primaryQuery.data ?? null;
      projectsError = primaryQuery.error;
    }
  }
  if (projectsError) {
    throw new Error(`Failed to load clients for sync: ${projectsError.message}`);
  }

  let syncedProjects = 0;
  let skippedProjects = 0;
  let failedProjects = 0;
  const projectErrors: Array<{ projectId: string; clientId: number; error: string }> = [];
  let eventsUpserted = 0;
  let internalCount = 0;
  let externalCount = 0;
  let unknownCount = 0;

  for (const project of projects ?? []) {
    const projectId = trimToNull(project.basecamp_project_id);
    if (!projectId) continue;

    try {
      const events: CommunicationEvent[] = [];
      if (mode === "oauth") {
        const boardId = await getProjectMessageBoardId(
          oauth!.access_token,
          oauth!.account_id,
          projectId,
        );
        if (!boardId) {
          // No message board on this project — update aggregate from existing DB events
          // without overwriting if we simply couldn't find the board.
          skippedProjects += 1;
          await updateClientCommsAggregate(
            admin,
            project.id,
            project.reply_acknowledged_for_occurred_at,
            cutoffIso,
          );
          continue;
        }
        const oauthMessages = await fetchPaginatedRecent<BasecampMessage>(
          oauth!.access_token,
          oauth!.account_id,
          `/message_boards/${boardId}/messages.json?sort=updated_at&direction=desc`,
          (message) => {
            const occurredAt = parseDateOrNow(message.updated_at ?? message.created_at);
            return new Date(occurredAt).getTime() >= fetchCutoffMs;
          },
        );

        for (const message of oauthMessages) {
          if (!message.id) continue;
          const messageOccurredAt = parseDateOrNow(message.updated_at ?? message.created_at);
          const messagePersonId = message.creator?.id ?? null;
          const messageEmail =
            trimToNull(message.creator?.email_address) ??
            (await resolvePersonEmail(
              admin,
              oauth!.access_token,
              oauth!.account_id,
              messagePersonId,
            ));
          const messageClassification = classifyAuthor(
            messagePersonId,
            messageEmail,
            internalLookup,
          );
          if (messageClassification.isInternal === true) internalCount += 1;
          else if (messageClassification.isInternal === false) externalCount += 1;
          else unknownCount += 1;

          events.push({
            client_id: project.id,
            basecamp_project_id: projectId,
            basecamp_recording_id: message.id,
            parent_recording_id: null,
            kind: "message",
            occurred_at: messageOccurredAt,
            author_person_id: messagePersonId,
            author_email: messageEmail,
            is_internal: storedAuthorIsInternal(
              messageClassification.isInternal,
              messageEmail,
            ),
            source_updated_at: trimToNull(message.updated_at),
            thread_title:
              normalizeContent(message.subject) ?? normalizeContent(message.title),
            thread_body:
              normalizeContent(message.content) ??
              normalizeContent(message.description),
            thread_excerpt: buildExcerpt(
              normalizeContent(message.content) ??
                normalizeContent(message.description),
            ),
            thread_url: normalizeBasecampThreadUrl(
              trimToNull(message.app_url) ?? trimToNull(message.url),
            ),
            updated_at: nowIso,
          });

          // Only fetch comments within the fetch window — stop pagination early
          const comments = await fetchPaginatedRecent<BasecampComment>(
            oauth!.access_token,
            oauth!.account_id,
            `/messages/${message.id}/comments.json`,
            (comment) => {
              const t = parseDateOrNow(comment.updated_at ?? comment.created_at);
              return new Date(t).getTime() >= fetchCutoffMs;
            },
          );

          for (const comment of comments) {
            if (!comment.id) continue;
            const commentOccurredAt = parseDateOrNow(
              comment.updated_at ?? comment.created_at,
            );
            const commentPersonId = comment.creator?.id ?? null;
            const commentEmail =
              trimToNull(comment.creator?.email_address) ??
              (await resolvePersonEmail(
                admin,
                oauth!.access_token,
                oauth!.account_id,
                commentPersonId,
              ));
            const commentClassification = classifyAuthor(
              commentPersonId,
              commentEmail,
              internalLookup,
            );
            if (commentClassification.isInternal === true) internalCount += 1;
            else if (commentClassification.isInternal === false) externalCount += 1;
            else unknownCount += 1;

            events.push({
              client_id: project.id,
              basecamp_project_id: projectId,
              basecamp_recording_id: comment.id,
              parent_recording_id: message.id,
              kind: "comment",
              occurred_at: commentOccurredAt,
              author_person_id: commentPersonId,
              author_email: commentEmail,
              is_internal: storedAuthorIsInternal(
                commentClassification.isInternal,
                commentEmail,
              ),
              source_updated_at: trimToNull(comment.updated_at),
              thread_title:
                normalizeContent(message.subject) ?? normalizeContent(message.title),
              thread_body:
                normalizeContent(comment.content) ?? normalizeContent(comment.body),
              thread_excerpt: buildExcerpt(
                normalizeContent(comment.content) ?? normalizeContent(comment.body),
              ),
              thread_url: normalizeBasecampThreadUrl(
                trimToNull(comment.app_url) ?? trimToNull(comment.url),
              ),
              updated_at: nowIso,
            });
          }
        }
      } else {
        const snapshots = await fetchClassicMessageTopics(
          classic!.accountId,
          projectId,
          classic!.headers,
        );
        for (const topic of snapshots) {
          if (new Date(topic.occurred_at).getTime() < fetchCutoffMs) {
            break;
          }
          const topicEmail =
            trimToNull(topic.author_email) ??
            (await resolveClassicPersonEmail(
              admin,
              classic!.accountId,
              classic!.headers,
              topic.author_person_id,
            ));
          const classification = classifyAuthor(
            topic.author_person_id,
            topicEmail,
            internalLookup,
          );
          if (classification.isInternal === true) internalCount += 1;
          else if (classification.isInternal === false) externalCount += 1;
          else unknownCount += 1;
          events.push({
            client_id: project.id,
            basecamp_project_id: projectId,
            basecamp_recording_id: topic.basecamp_recording_id,
            parent_recording_id: null,
            kind: "message",
            occurred_at: topic.occurred_at,
            author_person_id: topic.author_person_id,
            author_email: topicEmail,
            is_internal: storedAuthorIsInternal(classification.isInternal, topicEmail),
            source_updated_at: topic.occurred_at,
            thread_title: topic.thread_title,
            thread_excerpt: topic.thread_excerpt,
            thread_body: topic.thread_body,
            thread_url: topic.thread_url,
            updated_at: nowIso,
          });
        }
      }

      if (events.length > 0) {
        for (const chunk of splitChunks(events, 250)) {
          const { error: upsertError } = await admin
            .from("basecamp_communication_events")
            .upsert(chunk, {
              onConflict: "basecamp_project_id,basecamp_recording_id,kind",
            });
          if (upsertError) {
            throw new Error(`Failed upserting events for project ${projectId}: ${upsertError.message}`);
          }
        }
        eventsUpserted += events.length;
      }

      await updateClientCommsAggregate(
        admin,
        project.id,
        project.reply_acknowledged_for_occurred_at,
        cutoffIso,
      );

      syncedProjects += 1;
    } catch (projectError) {
      // Isolate per-project failures — log and continue so one bad project
      // doesn't abort the entire sync for all remaining clients.
      const message = projectError instanceof Error ? projectError.message : "Unknown error";
      projectErrors.push({ projectId, clientId: project.id, error: message });
      failedProjects += 1;
    }
  }

  const { error: pruneError } = await admin
    .from("basecamp_communication_events")
    .delete()
    .lt("occurred_at", cutoffIso);
  if (pruneError) {
    throw new Error(`Failed pruning old communication events: ${pruneError.message}`);
  }

  const partialErrorSummary =
    projectErrors.length > 0
      ? `${projectErrors.length} project(s) failed: ` +
        projectErrors
          .slice(0, 5)
          .map((e) => `project ${e.projectId} (client ${e.clientId}): ${e.error}`)
          .join("; ")
      : null;

  const { error: stateError } = await admin.from("basecamp_sync_state").upsert({
    id: 1,
    last_synced_at: nowIso,
    last_error: partialErrorSummary,
    updated_at: nowIso,
  });
  if (stateError) {
    throw new Error(`Failed updating sync state: ${stateError.message}`);
  }

  return {
    mode,
    isIncremental,
    fetchSince: fetchCutoffIso,
    syncedProjects,
    skippedProjects,
    failedProjects,
    projectErrors,
    eventsUpserted,
    classifiedInternal: internalCount,
    classifiedExternal: externalCount,
    classifiedUnknown: unknownCount,
    syncedAt: nowIso,
  };
}

export async function markBasecampSyncError(errorMessage: string) {
  const admin = createAdminClient();
  await admin.from("basecamp_sync_state").upsert({
    id: 1,
    last_error: errorMessage,
    updated_at: new Date().toISOString(),
  });
}
