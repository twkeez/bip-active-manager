import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  backfillHighPriorityForSender,
  loadSenderRules,
  upsertSenderRule,
} from "@/lib/gmail/rules";

type RuleBody = {
  sender?: string;
  ruleType?: "blacklist" | "always_high_priority";
  isActive?: boolean;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rules = await loadSenderRules(createAdminClient(), user.id);
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load rules" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RuleBody;
  try {
    body = (await request.json()) as RuleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.sender || !body.ruleType) {
    return NextResponse.json({ error: "sender and ruleType are required" }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const isActive = body.isActive !== false;
    await upsertSenderRule(admin, {
      userId: user.id,
      sender: body.sender,
      ruleType: body.ruleType,
      isActive,
    });
    // Apply the rule to mail already in the inbox so the High Priority view
    // reflects it immediately, not just on the next sync.
    if (body.ruleType === "always_high_priority") {
      await backfillHighPriorityForSender(admin, {
        userId: user.id,
        sender: body.sender,
        active: isActive,
      });
    }
    const rules = await loadSenderRules(admin, user.id);
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save rule" },
      { status: 500 },
    );
  }
}
