import { describe, expect, it } from "vitest";
import { buildPhotoBriefText, buildPlanCsv, buildPlanText, exportFileName } from "@/lib/social/plan-export";
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
    caption_draft: "",
    shot_list: "",
    hashtags: null,
    status: "idea",
    locked: false,
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
  it("includes captions, hashtags and shot lists, in date order", () => {
    const text = buildPlanText({
      clientName: "MarketPlace Veterinary Hospital",
      month: 9,
      year: 2026,
      posts: [
        post({ id: 2, post_date: "2026-09-09", campaign_label: "Second", caption_draft: "Later caption" }),
        post({ id: 1, post_date: "2026-09-02", campaign_label: "First", caption_draft: "Earlier caption", hashtags: "#a #b", shot_list: "Film the lobby" }),
      ],
    });
    expect(text).toContain("MarketPlace Veterinary Hospital — September 2026 social plan");
    expect(text).toContain("2 posts");
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
    expect(text).toContain("Earlier caption");
    expect(text).toContain("#a #b");
    expect(text).toContain("Photo/video to request: Film the lobby");
  });

  it("marks posts with no caption rather than leaving a blank", () => {
    const text = buildPlanText({ clientName: "X", month: 9, year: 2026, posts: [post({})] });
    expect(text).toContain("[no caption yet]");
  });
});

describe("buildPhotoBriefText", () => {
  it("lists only posts that need something shot", () => {
    const text = buildPhotoBriefText({
      clientName: "X",
      month: 9,
      year: 2026,
      posts: [
        post({ id: 1, campaign_label: "Has a shot", shot_list: "Photo of the clinic cat" }),
        post({ id: 2, campaign_label: "No shot needed" }),
      ],
    });
    expect(text).toContain("Photo of the clinic cat");
    expect(text).not.toContain("No shot needed");
  });

  it("says so when there is nothing to capture yet", () => {
    const text = buildPhotoBriefText({ clientName: "X", month: 9, year: 2026, posts: [post({})] });
    expect(text).toContain("Nothing to capture yet");
  });
});

describe("buildPlanCsv", () => {
  it("escapes commas, quotes and newlines so rows stay intact", () => {
    const csv = buildPlanCsv([
      post({ campaign_label: 'Dental, "deep" clean', caption_draft: "Line one\nLine two" }),
    ]);
    const lines = csv.trimEnd().split("\n");
    expect(lines).toHaveLength(2); // header + exactly one row, newline flattened
    expect(lines[1]).toContain('"Dental, ""deep"" clean"');
    expect(lines[1]).toContain("Line one Line two");
  });

  it("starts with the header row", () => {
    expect(buildPlanCsv([]).split("\n")[0]).toBe(
      "Date,Title,Campaign type,Status,Locked,Caption,Shot list,Hashtags",
    );
  });
});

describe("exportFileName", () => {
  it("slugs the client name", () => {
    expect(exportFileName("RPVH - MarketPlace Veterinary Hospital", 9, 2026, "csv"))
      .toBe("rpvh-marketplace-veterinary-hospital-september-2026.csv");
  });
});
