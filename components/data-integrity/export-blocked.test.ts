import { describe, expect, it } from "vitest";
import { exportBlockedMessage } from "@/components/data-integrity/export-blocked";

describe("exportBlockedMessage", () => {
  it("says a capped read was recorded and emailed", () => {
    expect(
      exportBlockedMessage("report", [{ table: "client_gsc_page_metrics", problemKey: "k", detail: "d", rows: 1000 }]),
    ).toBe(
      "Can't export this report: some of the data behind it was cut short by the database (client_gsc_page_metrics). This has been recorded on Data health and emailed to Tom. Its numbers may be incomplete.",
    );
  });

  it("says a failed read can be retried, without claiming it was emailed", () => {
    const message = exportBlockedMessage("report", [
      { kind: "read_failed", table: "Client report", problemKey: "a", detail: "a", rows: 0 },
      { kind: "read_failed", table: "Client report", problemKey: "b", detail: "b", rows: 0 },
    ]);
    expect(message).toContain("2 parts of its data could not be read in full");
    expect(message).not.toContain("emailed");
  });
});
