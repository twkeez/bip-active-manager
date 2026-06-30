import { describe, expect, it } from "vitest";
import { templatesForServices } from "@/lib/clients/onboarding";
import type { ClientActiveServices, ClientOnboardingTemplate } from "@/lib/clients/types";

function tpl(item_key: string, requires_service: ClientOnboardingTemplate["requires_service"]): ClientOnboardingTemplate {
  return {
    id: 1,
    item_key,
    label: item_key,
    category: "connections",
    severity: "required",
    verification: "manual:test",
    sort_order: 10,
    required_for_graduation: true,
    requires_service,
    created_at: "",
    updated_at: "",
  };
}

const TEMPLATES = [
  tpl("shared_a", null),
  tpl("seo_only", "seo"),
  tpl("ppc_only", "ppc"),
  tpl("smm_only", "smm"),
];

const services = (overrides: Partial<ClientActiveServices> = {}): ClientActiveServices => ({
  blog: false,
  smm: false,
  seo: false,
  ppc: false,
  orm: false,
  ...overrides,
});

describe("templatesForServices", () => {
  it("keeps shared items plus only the active services' items", () => {
    const keys = templatesForServices(TEMPLATES, services({ seo: true })).map((t) => t.item_key);
    expect(keys).toContain("shared_a");
    expect(keys).toContain("seo_only");
    expect(keys).not.toContain("ppc_only");
    expect(keys).not.toContain("smm_only");
  });

  it("includes every service-tagged item when all services are active", () => {
    const keys = templatesForServices(TEMPLATES, services({ seo: true, ppc: true, smm: true })).map((t) => t.item_key);
    expect(keys).toEqual(["shared_a", "seo_only", "ppc_only", "smm_only"]);
  });

  it("keeps only shared items when no service is active", () => {
    const keys = templatesForServices(TEMPLATES, services()).map((t) => t.item_key);
    expect(keys).toEqual(["shared_a"]);
  });
});
