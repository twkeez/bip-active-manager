import { NextResponse } from "next/server";
import { countUnassessedEmails, scoreBacklog } from "@/lib/gmail/ai-priority";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Each batch is one Claude call over 25 messages. Six batches keeps a request
// comfortably inside the serverless timeout; the client loops until the backlog
// is drained rather than trying to do it all in one request.
export const maxDuration = 300;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const progress = await countUnassessedEmails(createAdminClient(), user.id);
  return NextResponse.json(progress);
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  try {
    const result = await scoreBacklog(admin, user.id, { batches: 6 });
    const progress = await countUnassessedEmails(admin, user.id);
    return NextResponse.json({ success: true, ...result, ...progress });
  } catch (error) {
    console.error("Scoring backlog failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scoring failed." },
      { status: 500 },
    );
  }
}
