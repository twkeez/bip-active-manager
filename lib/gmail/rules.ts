import type { SupabaseClient } from "@supabase/supabase-js";

type SenderRule = {
  sender: string;
  rule_type: "blacklist" | "always_high_priority";
  is_active: boolean;
};

function normalizeSenderKey(value: string) {
  return value.trim().toLowerCase();
}

export async function loadSenderRules(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("user_email_sender_rules")
    .select("sender,rule_type,is_active")
    .eq("owner_user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(`Failed to load sender rules: ${error.message}`);
  return (data ?? []) as SenderRule[];
}

export function evaluateSenderRules(params: {
  fromEmail: string | null;
  rules: SenderRule[];
}) {
  const fromEmail = normalizeSenderKey(params.fromEmail ?? "");
  const domain = fromEmail.includes("@") ? fromEmail.split("@")[1] ?? "" : "";
  const senderKeys = new Set<string>([fromEmail, domain].filter(Boolean));
  const activeRules = params.rules.filter((rule) => senderKeys.has(normalizeSenderKey(rule.sender)));
  const isBlacklisted = activeRules.some((rule) => rule.rule_type === "blacklist");
  const isAlwaysHighPriority = activeRules.some(
    (rule) => rule.rule_type === "always_high_priority",
  );
  return { isBlacklisted, isAlwaysHighPriority };
}

/**
 * Retroactively reconciles the per-message `is_high_priority` flag for emails
 * already in the inbox when an `always_high_priority` rule is toggled. Without
 * this, a new "important sender/domain" rule only affects mail fetched on the
 * next sync, so the High Priority view stays empty for existing threads.
 *
 * `sender` may be a full address (matches that address) or a bare domain
 * (matches everyone @domain). Matching is case-insensitive.
 *  - active:  flags every matching message.
 *  - !active: clears the flag, but leaves messages that are still high priority
 *             for another reason (starred, or AI-scored "high") untouched.
 */
export async function backfillHighPriorityForSender(
  admin: SupabaseClient,
  params: { userId: string; sender: string; active: boolean },
) {
  const sender = normalizeSenderKey(params.sender);
  if (!sender) return;
  const pattern = sender.includes("@") ? sender : `%@${sender}`;
  const now = new Date().toISOString();

  let query = admin
    .from("user_email_messages")
    .update({ is_high_priority: params.active, updated_at: now })
    .eq("owner_user_id", params.userId)
    .ilike("from_email", pattern);

  if (!params.active) {
    // Don't strip the flag from mail that's high priority for another reason.
    // (NULL ai_priority must still be cleared, so match it explicitly — a bare
    // `.neq` would drop NULL rows since `NULL != 'high'` is unknown in SQL.)
    query = query
      .eq("is_starred", false)
      .or("ai_priority.is.null,ai_priority.neq.high");
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to backfill high-priority messages: ${error.message}`);
  }
}

export async function upsertSenderRule(
  admin: SupabaseClient,
  params: {
    userId: string;
    sender: string;
    ruleType: "blacklist" | "always_high_priority";
    isActive: boolean;
  },
) {
  const sender = normalizeSenderKey(params.sender);
  if (!sender) throw new Error("Sender is required for rule");
  const now = new Date().toISOString();
  const { error } = await admin.from("user_email_sender_rules").upsert(
    {
      owner_user_id: params.userId,
      sender,
      rule_type: params.ruleType,
      is_active: params.isActive,
      updated_at: now,
      created_at: now,
    },
    { onConflict: "owner_user_id,sender,rule_type" },
  );
  if (error) throw new Error(`Failed to save sender rule: ${error.message}`);
}
