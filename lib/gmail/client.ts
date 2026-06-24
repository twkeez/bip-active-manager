import type { GmailMessageDetail, GmailMessageListResponse } from "@/lib/gmail/types";

const BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(
      (data as { error?: { message?: string } } | null)?.error?.message ??
        `Gmail API failed (${response.status})`,
    );
  }
  return data as T;
}

export async function listInboxMessageIds(accessToken: string, pageToken?: string) {
  // Path is relative to BASE_URL (which gmailFetch prepends) — do NOT include
  // the base path here or the request URL gets doubled (→ 404).
  const params = new URLSearchParams({ maxResults: "50", q: "in:inbox" });
  if (pageToken) params.set("pageToken", pageToken);
  return gmailFetch<GmailMessageListResponse>(accessToken, `/messages?${params.toString()}`);
}

export async function getMessageDetail(accessToken: string, messageId: string) {
  const url = `/messages/${encodeURIComponent(messageId)}?format=full`;
  return gmailFetch<GmailMessageDetail>(accessToken, url);
}

export async function modifyMessageLabels(
  accessToken: string,
  messageId: string,
  params: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  return gmailFetch<{ id?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/modify`,
    {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: params.addLabelIds ?? [],
        removeLabelIds: params.removeLabelIds ?? [],
      }),
    },
  );
}

export async function trashMessage(accessToken: string, messageId: string) {
  return gmailFetch<{ id?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: "POST",
    },
  );
}

export async function untrashMessage(accessToken: string, messageId: string) {
  return gmailFetch<{ id?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/untrash`,
    {
      method: "POST",
    },
  );
}
