import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPhotoBriefText,
  buildPlanCsv,
  buildPlanText,
  exportDate,
  exportFileName,
} from "@/lib/social/plan-export";
import type { SocialContentPost } from "@/lib/social/types";

function post(partial: Partial<SocialContentPost>): SocialContentPost {
  return {
    id: 1,
    plan_id: 1,
    client_id: 1,
    post_date: "2026-09-02",
    platform: "both",
    campaign_type: "series",
    campaign_label: "A post",
    content_pillar: "Educational",
    headline: "A headline",
    subheadline: "",
    photo_suggestion: "",
    caption_draft: "",
    shot_list: "",
    hashtags: null,
    status: "idea",
    sort_order: 0,
    idea_id: null,
    series_id: null,
    series_part: null,
    awareness_day_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("buildPlanText", () => {
  it("includes headline, subheadline and photo suggestion, in date order", () => {
    const text = buildPlanText({
      clientName: "MarketPlace Veterinary Hospital",
      month: 9,
      year: 2026,
      posts: [
        post({ id: 2, post_date: "2026-09-09", headline: "Second" }),
        post({
          id: 1,
          post_date: "2026-09-02",
          headline: "First",
          subheadline: "A supporting line",
          photo_suggestion: "Film the lobby",
        }),
      ],
    });
    expect(text).toContain("MarketPlace Veterinary Hospital — September 2026 social plan");
    expect(text).toContain("2 posts");
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
    expect(text).toContain("A supporting line");
    expect(text).toContain("Photo suggestion: Film the lobby");
  });

  it("flags posts with no headline written yet", () => {
    const text = buildPlanText({
      clientName: "Client",
      month: 9,
      year: 2026,
      posts: [post({ headline: "" })],
    });
    expect(text).toContain("[no headline yet]");
  });
});

describe("buildPhotoBriefText", () => {
  it("lists only posts that need something photographed", () => {
    const text = buildPhotoBriefText({
      clientName: "Client",
      month: 9,
      year: 2026,
      posts: [
        post({ id: 1, headline: "Needs a photo", photo_suggestion: "Dog in the lobby" }),
        post({ id: 2, post_date: "2026-09-04", headline: "No photo needed" }),
      ],
    });
    expect(text).toContain("Dog in the lobby");
    expect(text).not.toContain("No photo needed");
  });
});

describe("exportDate", () => {
  it("formats as the agency's sheet does", () => {
    expect(exportDate("2026-09-02")).toBe("September 2");
    expect(exportDate("2026-09-14")).toBe("September 14");
  });

  it("does not drift across timezones", () => {
    // Parsed as UTC — a naive local parse turns this into September 1st
    // for anyone west of Greenwich.
    expect(exportDate("2026-09-01")).toBe("September 1");
  });
});

describe("buildPlanCsv", () => {
  it("uses the SMM team's exact column headers", () => {
    const csv = buildPlanCsv([]);
    expect(csv).toBe("Date,Content Pillar,Headline,Subheadline,Photo Suggestion\r\n");
  });

  it("quotes and escapes fields that would otherwise break the row", () => {
    const csv = buildPlanCsv([
      post({
        post_date: "2026-09-02",
        content_pillar: "Build Trust",
        headline: 'He said "hello", loudly',
        subheadline: "Commas, everywhere, here",
        photo_suggestion: "Line one\nline two",
      }),
    ]);
    const row = csv.trimEnd().split("\r\n")[1];
    expect(row).toContain('"He said ""hello"", loudly"');
    expect(row).toContain('"Commas, everywhere, here"');
    // Newlines are flattened so a cell can never spill into the next row.
    expect(row).toContain("Line one line two");
    expect(csv.trimEnd().split("\r\n")).toHaveLength(2);
  });

  it("sorts by date regardless of input order", () => {
    const csv = buildPlanCsv([
      post({ id: 2, post_date: "2026-09-11", headline: "Later" }),
      post({ id: 1, post_date: "2026-09-02", headline: "Earlier" }),
    ]);
    expect(csv.indexOf("Earlier")).toBeLessThan(csv.indexOf("Later"));
  });

  /**
   * The real sheet the agency hands its SMM team. If this test fails, the
   * export has drifted from what the team actually receives.
   *
   * Every row matches exactly. The one intentional difference: we terminate
   * the final row with CRLF and the sample file does not — RFC 4180 wants the
   * terminator and tools are happier with it.
   */
  it("reproduces every row of the agency's own export", () => {
    const sample = readFileSync(
      join(__dirname, "__fixtures__", "sample-export.csv"),
      "utf8",
    );
    const [headerLine, ...sampleRows] = sample.trimEnd().split("\r\n");

    // Rebuild the sample's posts, then re-export them.
    const posts = sampleRows.map((line, i) => {
      const cells = parseCsvLine(line);
      const day = Number(cells[0].split(" ")[1]);
      return post({
        id: i + 1,
        post_date: `2026-09-${String(day).padStart(2, "0")}`,
        content_pillar: cells[1],
        headline: cells[2],
        subheadline: cells[3],
        photo_suggestion: cells[4],
      });
    });

    expect(buildPlanCsv(posts).trimEnd()).toBe(sample.trimEnd());
    expect(buildPlanCsv(posts).endsWith("\r\n")).toBe(true);
  });
});

/** Minimal RFC-4180 reader, good enough for the fixture. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

describe("exportFileName", () => {
  it("slugifies the client name and names the month", () => {
    expect(exportFileName("RPVH - Bayside Animal Hospital", 9, 2026, "csv")).toBe(
      "rpvh-bayside-animal-hospital-social-september-2026.csv",
    );
  });
});
