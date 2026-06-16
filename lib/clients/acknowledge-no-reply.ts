import type { ClientRow } from "@/lib/types/client";

type AcknowledgeResponse = {
  error?: string;
  ok?: boolean;
  client?: ClientRow;
};

export async function acknowledgeNoReply(clientId: number): Promise<ClientRow> {
  const response = await fetch("/api/basecamp/acknowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId }),
  });
  const payload = (await response.json()) as AcknowledgeResponse;
  if (!response.ok || !payload.client) {
    throw new Error(payload.error ?? "Failed to mark as no reply needed");
  }
  return payload.client;
}

export function shouldShowReplyAlert(client: Pick<ClientRow, "needs_reply">): boolean {
  return Boolean(client.needs_reply);
}
