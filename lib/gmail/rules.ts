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
