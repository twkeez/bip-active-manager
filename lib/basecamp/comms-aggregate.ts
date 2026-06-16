export type LatestCommsEvent = {
  occurred_at: string;
  is_internal: boolean;
};

function normalizeAuthorEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function storedAuthorIsInternal(
  isInternal: boolean | null,
  authorEmail: string | null = null,
) {
  if (isInternal === true) return true;
  if (isInternal === false) return false;
  // Unknown author with an email outside explicit internal rules is treated as client/external.
  if (normalizeAuthorEmail(authorEmail)) return false;
  // No email to classify — stay conservative and do not create Awaiting.
  return true;
}

export function computeClientCommsAggregate(
  latest: LatestCommsEvent | null,
  acknowledgedForOccurredAt: string | null,
  nowMs = Date.now(),
) {
  const isAcknowledgedForLatest =
    latest != null &&
    acknowledgedForOccurredAt != null &&
    new Date(latest.occurred_at).getTime() <=
      new Date(acknowledgedForOccurredAt).getTime();
  const baseNeedsReply = Boolean(latest && latest.is_internal === false);
  const daysStale = latest
    ? Math.floor(
        (nowMs - new Date(latest.occurred_at).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return {
    last_communication_at: latest?.occurred_at ?? null,
    last_event_is_internal: latest?.is_internal ?? null,
    needs_reply: baseNeedsReply && !isAcknowledgedForLatest,
    days_stale: daysStale,
  };
}
