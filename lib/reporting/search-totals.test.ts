import { describe, expect, it } from "vitest";
import { blogPostTitle, mergePagesByAddress, pageWithoutQuery, sumSearchRows } from "./search-totals";

describe("pageWithoutQuery", () => {
  it("drops the query string and fragment", () => {
    expect(pageWithoutQuery("https://x.com/forms/appointment.html?rwg_token=abc%3D%3D")).toBe(
      "https://x.com/forms/appointment.html",
    );
    expect(pageWithoutQuery("https://x.com/a/#top")).toBe("https://x.com/a/");
    expect(pageWithoutQuery("https://x.com/a/")).toBe("https://x.com/a/");
  });
});

describe("mergePagesByAddress", () => {
  it("counts a tracking-link visit as the page itself, weighting position by impressions", () => {
    const merged = mergePagesByAddress([
      { page_url: "https://x.com/forms/appointment.html", clicks: 3, impressions: 100, position: 4, ctr: 0.03 },
      { page_url: "https://x.com/forms/appointment.html?rwg_token=abc", clicks: 1, impressions: 300, position: 8, ctr: 0.003 },
      { page_url: "https://x.com/", clicks: 25, impressions: 1000, position: 2, ctr: 0.025 },
    ]);
    expect(merged).toHaveLength(2);
    const form = merged.find((r) => r.page_url === "https://x.com/forms/appointment.html")!;
    expect(form.clicks).toBe(4);
    expect(form.impressions).toBe(400);
    expect(form.position).toBeCloseTo((4 * 100 + 8 * 300) / 400);
    expect(form.ctr).toBeCloseTo(4 / 400);
  });
});

describe("sumSearchRows", () => {
  it("adds clicks and impressions and weights position by impressions", () => {
    const totals = sumSearchRows([
      { clicks: 10, impressions: 1000, position: 2 },
      { clicks: 0, impressions: 10, position: 50 },
    ]);
    expect(totals.clicks).toBe(10);
    expect(totals.impressions).toBe(1010);
    expect(totals.ctrPercent).toBeCloseTo((10 / 1010) * 100);
    // An unweighted mean would say 26; a page seen 10 times barely moves it.
    expect(totals.position).toBeCloseTo((2 * 1000 + 50 * 10) / 1010);
  });

  it("has no rate or position without impressions", () => {
    expect(sumSearchRows([])).toEqual({ clicks: 0, impressions: 0, ctrPercent: null, position: null });
  });
});

describe("blogPostTitle", () => {
  it("names a post from its address", () => {
    expect(blogPostTitle("https://x.com/blog/why-is-my-pet-drinking-more-water/")).toBe(
      "Why Is My Pet Drinking More Water",
    );
    expect(blogPostTitle("https://x.com/blog/post-name.html?utm_source=x")).toBe("Post Name");
  });

  it("names the blog's home page instead of leaving a blank", () => {
    expect(blogPostTitle("https://x.com/blog/")).toBe("Blog home page");
    expect(blogPostTitle("https://x.com/blog")).toBe("Blog home page");
  });
});
