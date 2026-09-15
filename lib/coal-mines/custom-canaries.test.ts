import { describe, expect, it } from "vitest";
import {
  buildCustomCanaryItems,
  MAX_ITEMS_SHOWN,
  renderBrokenCanary,
  renderCustomCanary,
  type CustomCanaryRow,
} from "./custom-canaries";

const canary: CustomCanaryRow = {
  id: 1,
  key: "blog-overdue",
  name: "Blog posts overdue",
  watches: "Clients paying for Blog with no post in 45 days.",
  instruction: "tell me when a blog client hasn't had a post in 45 days",
  query_sql: "select 1",
  headline_none: "Every Blog client has had a post in the last 45 days.",
  headline_some: "{count} Blog clients have had no post in 45 days.",
  item_label_column: "account_name",
  item_meta_columns: ["days_since", "blog"],
  href_template: "/dashboard/clients/{client_id}",
  severity: "overdue",
  enabled: true,
  last_run_at: null,
  last_status: null,
  last_finding_count: null,
  last_error: null,
};

const row = { account_name: "Adobe Animal Hospital", days_since: 61, blog: "2", client_id: 7 };

describe("renderCustomCanary", () => {
  it("reports finding nothing as the all-clear", () => {
    const result = renderCustomCanary(canary, []);
    expect(result.status).toBe("ok");
    expect(result.headline).toBe("Every Blog client has had a post in the last 45 days.");
    expect(result.items).toBeUndefined();
  });

  it("puts the count into the alarm headline and uses the canary's severity", () => {
    const result = renderCustomCanary(canary, [row, { ...row, account_name: "Coal Creek" }]);
    expect(result.headline).toBe("2 Blog clients have had no post in 45 days.");
    expect(result.status).toBe("overdue");
  });

  it("keeps the board's key namespaced, so a custom canary cannot shadow a built-in", () => {
    expect(renderCustomCanary(canary, []).key).toBe("custom-blog-overdue");
  });

  it("says so when it is only showing part of the result", () => {
    const rows = Array.from({ length: MAX_ITEMS_SHOWN + 5 }, (_, i) => ({
      ...row,
      account_name: `Client ${i}`,
    }));
    const result = renderCustomCanary(canary, rows);
    expect(result.items).toHaveLength(MAX_ITEMS_SHOWN);
    expect(result.detail[0]).toContain(`first ${MAX_ITEMS_SHOWN}`);
  });

  it("warns that the count is a floor once the row limit is hit", () => {
    const rows = Array.from({ length: 200 }, () => row);
    expect(renderCustomCanary(canary, rows).detail.join(" ")).toContain("Stopped counting");
  });
});

describe("buildCustomCanaryItems", () => {
  it("names the row and qualifies it with the meta columns", () => {
    const [item] = buildCustomCanaryItems(canary, [row]);
    expect(item.label).toBe("Adobe Animal Hospital");
    expect(item.meta).toBe("days since 61 · blog 2");
    expect(item.href).toBe("/dashboard/clients/7");
  });

  it("never repeats the label column in the meta line", () => {
    const [item] = buildCustomCanaryItems(
      { ...canary, item_meta_columns: ["account_name", "days_since"] },
      [row],
    );
    expect(item.meta).toBe("days since 61");
  });

  // A link with an unfilled placeholder goes somewhere wrong, which is worse
  // than a row you have to look up yourself.
  it("drops a link it could not fully fill", () => {
    const [item] = buildCustomCanaryItems(canary, [{ account_name: "No id here" }]);
    expect(item.href).toBeNull();
  });

  it("shortens timestamps and rounds awkward numbers", () => {
    const [item] = buildCustomCanaryItems(
      { ...canary, item_meta_columns: ["last_seen", "spend"] },
      [{ account_name: "X", last_seen: "2026-07-17T04:31:09.221Z", spend: 4577.4193 }],
    );
    expect(item.meta).toBe("last seen 2026-07-17 · spend 4577.4");
  });

  it("shows a missing value as a dash rather than 'null'", () => {
    const [item] = buildCustomCanaryItems({ ...canary, item_meta_columns: ["days_since"] }, [
      { account_name: "X", days_since: null },
    ]);
    expect(item.meta).toBe("days since —");
  });
});

describe("renderBrokenCanary", () => {
  // The failure that matters: a check that cannot run must not look calm.
  it("does not read as all clear", () => {
    const result = renderBrokenCanary(canary, 'column "blog_posts" does not exist');
    expect(result.status).not.toBe("ok");
    expect(result.headline).toContain("not watching anything");
    expect(result.detail[0]).toContain("blog_posts");
  });
});
