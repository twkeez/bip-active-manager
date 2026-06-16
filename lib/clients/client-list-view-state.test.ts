import { describe, expect, it } from "vitest";
import {
  buildClientListHref,
  buildClientListQuery,
  defaultClientListViewState,
  parseClientListViewState,
  resolveInitialClientListViewState,
} from "@/lib/clients/client-list-view-state";

describe("client list view state", () => {
  it("returns defaults when query is empty", () => {
    const state = parseClientListViewState(new URLSearchParams());
    expect(state).toEqual(defaultClientListViewState());
    expect(buildClientListHref(state)).toBe("/dashboard/clients");
  });

  it("parses stale and multi-service filters", () => {
    const params = new URLSearchParams("stale=1&services=seo,ads&status=Awaiting");
    const state = parseClientListViewState(params);
    expect(state.showStaleOnly).toBe(true);
    expect(state.serviceFilters).toEqual(["seo", "ads"]);
    expect(state.statusFilter).toBe("Awaiting");
    expect(buildClientListQuery(state).toString()).toBe(
      "status=Awaiting&services=seo%2Cads&stale=1",
    );
  });

  it("omits prioritizeUrgent when true and writes urgent=0 when false", () => {
    const defaults = defaultClientListViewState();
    expect(buildClientListQuery(defaults).has("urgent")).toBe(false);

    const off = { ...defaults, prioritizeUrgent: false };
    expect(buildClientListQuery(off).get("urgent")).toBe("0");
  });

  it("round-trips advanced filters through href", () => {
    const state = {
      ...defaultClientListViewState(),
      search: "valley",
      onboardingFilter: "active" as const,
      strategistFilter: "Alex",
      tierFilter: "Enterprise",
      showMineOnly: true,
      technicalFilter: "critical" as const,
    };
    const href = buildClientListHref(state);
    const query = href.split("?")[1] ?? "";
    const parsed = parseClientListViewState(new URLSearchParams(query));
    expect(parsed).toEqual(state);
  });

  it("ignores invalid enum values", () => {
    const params = new URLSearchParams("status=Invalid&onboarding=maybe&tech=unknown");
    const state = parseClientListViewState(params);
    expect(state.statusFilter).toBe("");
    expect(state.onboardingFilter).toBe("");
    expect(state.technicalFilter).toBe("");
  });

  it("resolveInitialClientListViewState prefers URL over storage", () => {
    const fromUrl = resolveInitialClientListViewState(new URLSearchParams("stale=1"));
    expect(fromUrl.showStaleOnly).toBe(true);
  });
});
