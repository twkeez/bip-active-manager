import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { draftCanary, DraftTruncatedError } from "@/lib/coal-mines/draft-canary";
import { assertReadOnlyQuery, UnsafeQueryError } from "@/lib/coal-mines/query-guard";
import { PREVIEW_ROW_LIMIT, runCanaryQuery } from "@/lib/coal-mines/readonly-query";
import { loadSchemaCatalogue } from "@/lib/coal-mines/schema-catalogue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Drafting a canary from a sentence, and running it once so you can see what it
 * found before you decide whether it asked the right question.
 *
 * The preview is the point. A generated query that runs cleanly and answers
 * something subtly different is the failure mode here, and no amount of reading
 * the SQL catches that as reliably as looking at the rows it returns.
 */

// Adaptive thinking over a hundred-table catalogue is not quick.
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  // Writing a check means asking Claude, which costs money per press, and a
  // check everyone can see. Same bar as the rest of Coal Mines.
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { instruction?: string } | null;
  const instruction = body?.instruction?.trim();
  if (!instruction) {
    return NextResponse.json({ error: "Describe what you want watched." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const catalogue = await loadSchemaCatalogue(admin);
    const draft = await draftCanary(instruction, catalogue);

    let sql: string;
    try {
      sql = assertReadOnlyQuery(draft.sql);
    } catch (error) {
      // Claude wrote something the guard refuses. Report it as a failed draft
      // rather than an error: trying again with a clearer instruction usually
      // works, and the user can see exactly what was wrong.
      return NextResponse.json(
        {
          error:
            error instanceof UnsafeQueryError
              ? `The check it wrote is not allowed: ${error.message}`
              : "The check it wrote could not be checked.",
          draft,
        },
        { status: 422 },
      );
    }

    // A preview is capped tighter than a real run — you are eyeballing it.
    const startedAt = Date.now();
    let rows: Record<string, unknown>[] = [];
    let queryError: string | null = null;
    try {
      rows = await runCanaryQuery(admin, sql, PREVIEW_ROW_LIMIT);
    } catch (error) {
      queryError = error instanceof Error ? error.message : "The query failed.";
    }

    return NextResponse.json({
      draft: { ...draft, sql },
      preview: {
        rows,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        error: queryError,
        ms: Date.now() - startedAt,
        limit: PREVIEW_ROW_LIMIT,
      },
    });
  } catch (error) {
    // A draft that ran out of room is the user's to fix, not a server fault.
    if (error instanceof DraftTruncatedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not draft this check." },
      { status: 500 },
    );
  }
}
