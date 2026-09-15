import { describe, expect, it } from "vitest";
import { assertReadOnlyQuery, isReadOnlyQuery, UnsafeQueryError } from "./query-guard";

describe("assertReadOnlyQuery", () => {
  it("accepts an ordinary select", () => {
    expect(assertReadOnlyQuery("select id, account_name from clients where seo = 'N'")).toBe(
      "select id, account_name from clients where seo = 'N'",
    );
  });

  it("accepts a CTE", () => {
    const sql = "with recent as (select client_id from client_ads_snapshots) select * from recent";
    expect(assertReadOnlyQuery(sql)).toBe(sql);
  });

  it("strips a trailing semicolon rather than refusing it", () => {
    expect(assertReadOnlyQuery("select 1 from clients;  ")).toBe("select 1 from clients");
  });

  // The attack this guard exists for: a statement that begins with WITH, looks
  // like a SELECT, and empties a table.
  it("refuses a data-modifying CTE", () => {
    expect(() =>
      assertReadOnlyQuery("with gone as (delete from clients returning *) select * from gone"),
    ).toThrow(UnsafeQueryError);
  });

  it("refuses a second statement", () => {
    expect(() => assertReadOnlyQuery("select 1; drop table clients")).toThrow(
      /single statement/i,
    );
  });

  it("refuses comments, which can hide one", () => {
    expect(() => assertReadOnlyQuery("select 1 -- drop table clients")).toThrow(/comments/i);
    expect(() => assertReadOnlyQuery("select 1 /* sneaky */ from clients")).toThrow(/comments/i);
  });

  it("refuses anything that does not start as a query", () => {
    expect(() => assertReadOnlyQuery("update clients set seo = 'N'")).toThrow(/SELECT or WITH/i);
    expect(() => assertReadOnlyQuery("")).toThrow(/empty/i);
  });

  // The blocklist is matched on whole words, so ordinary column names survive.
  it("does not trip over column names that contain a keyword", () => {
    expect(
      isReadOnlyQuery(
        "select updated_at, calls, created_at from client_ads_snapshots offset 10",
      ),
    ).toBe(true);
    expect(isReadOnlyQuery("select last_message_at from basecamp_projects limit 5")).toBe(true);
  });

  it("refuses functions that reach outside the query", () => {
    expect(() => assertReadOnlyQuery("select pg_sleep(10)")).toThrow(/PG_SLEEP/i);
    expect(() => assertReadOnlyQuery("select pg_read_file('/etc/passwd')")).toThrow(
      /PG_READ_FILE/i,
    );
  });

  it("refuses a query long enough to be hiding something", () => {
    expect(() => assertReadOnlyQuery(`select ${"a".repeat(5000)} from clients`)).toThrow(
      /limit is 4000/,
    );
  });
});
