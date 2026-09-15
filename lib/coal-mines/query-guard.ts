/**
 * What a generated query is allowed to be.
 *
 * A canary's query is written by a language model from a sentence somebody
 * typed, so it is never trusted. This is the first of three overlapping guards:
 * this check, the same SELECT-or-WITH check inside coal_mine_readonly_query,
 * and the read-only transaction the function runs it in. The third is the one
 * that actually holds — Postgres refusing writes does not depend on anyone
 * having thought of the right keyword — but a query rejected here fails with an
 * explanation instead of a database error, which is the difference between
 * "that check can't be written that way" and "something went wrong".
 *
 * The blocklist targets data-modifying CTEs specifically. A single statement
 * beginning with SELECT cannot carry DDL, but it can carry
 * `WITH x AS (DELETE FROM clients RETURNING *) SELECT * FROM x`, which is a
 * perfectly ordinary-looking SELECT that empties a table.
 */

export const MAX_QUERY_LENGTH = 4000;

/**
 * Matched as whole words, so `updated_at`, `offset` and `calls` are all fine —
 * a word character on either side means no match.
 */
const FORBIDDEN_WORDS = [
  // Data-modifying CTEs, the one real way into a SELECT.
  "insert",
  "update",
  "delete",
  "merge",
  "truncate",
  // DDL and permissions, unreachable from a single SELECT but free to refuse.
  "drop",
  "alter",
  "create",
  "grant",
  "revoke",
  "copy",
  "refresh",
  "cluster",
  "reindex",
  // Statement and transaction control.
  "call",
  "do",
  "execute",
  "prepare",
  "deallocate",
  "set",
  "reset",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "lock",
  "listen",
  "notify",
  "vacuum",
  // Functions with reach outside the query.
  "pg_sleep",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "dblink",
  "lo_import",
  "lo_export",
  "nextval",
  "setval",
];

export class UnsafeQueryError extends Error {}

/**
 * Returns the query ready to run, or throws with a reason a person can act on.
 * Trailing semicolons are stripped rather than rejected — the model adds them
 * out of habit and it is not worth a failed draft.
 */
export function assertReadOnlyQuery(raw: string): string {
  const sql = (raw ?? "").trim().replace(/;+\s*$/, "").trim();

  if (!sql) {
    throw new UnsafeQueryError("The query is empty.");
  }
  if (sql.length > MAX_QUERY_LENGTH) {
    throw new UnsafeQueryError(
      `The query is ${sql.length} characters; the limit is ${MAX_QUERY_LENGTH}.`,
    );
  }
  // A comment can hide a second statement from a reader while the database
  // still runs it, and no generated query here needs one.
  if (sql.includes("--") || sql.includes("/*")) {
    throw new UnsafeQueryError("Comments are not allowed in a canary query.");
  }
  if (sql.includes(";")) {
    throw new UnsafeQueryError("A canary query must be a single statement.");
  }
  if (!/^\s*(select|with)\s/i.test(sql)) {
    throw new UnsafeQueryError("A canary query must start with SELECT or WITH.");
  }

  for (const word of FORBIDDEN_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(sql)) {
      throw new UnsafeQueryError(`A canary query may not use "${word.toUpperCase()}".`);
    }
  }

  return sql;
}

/** True when the query is safe to run. For preflighting without a try/catch. */
export function isReadOnlyQuery(raw: string): boolean {
  try {
    assertReadOnlyQuery(raw);
    return true;
  } catch {
    return false;
  }
}
