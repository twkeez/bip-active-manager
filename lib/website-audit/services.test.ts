import { describe, expect, it } from "vitest";
import { promotedServicesWithoutPage } from "@/lib/website-audit/services";
import type { PageContent } from "@/lib/website-audit/types";

const page = (url: string, servicesNamed: string[], over: Partial<PageContent> = {}): PageContent =>
  ({ url: `https://www.vet.com${url}`, pageType: "other", servicesNamed, currentH1: null, error: null, ...over }) as PageContent;

const MENU = ["Wellness", "Surgery", "Opthalmology", "Dental / CORES", "Laser Therapy", "Cardiology"];
const site = [
  page("/", MENU),
  page("/about/", MENU),
  page("/faqs/", [...MENU, "Mass Removals", "Microchips"]),
  page("/staff/", MENU),
  page("/services/wellness.html", MENU, { pageType: "service", currentH1: "Routine Care for a Healthier Life" }),
  page("/services/surgery.html", [...MENU, "Soft Tissue Surgery"], { pageType: "service" }),
  page("/services/opthalmology.html", [...MENU, "Ophthalmology"], { pageType: "service" }),
  page("/services/pet-dental.html", MENU, { pageType: "service" }),
];

describe("promotedServicesWithoutPage", () => {
  it("lists services named across the site that no service page covers", () => {
    expect(promotedServicesWithoutPage(site)).toEqual(["Cardiology", "Laser Therapy"]);
  });

  it("ignores a procedure mentioned on one page", () => {
    expect(promotedServicesWithoutPage(site)).not.toContain("Mass Removals");
  });

  it("counts a page as covering its service whatever the spelling or headline", () => {
    const missing = promotedServicesWithoutPage(site);
    expect(missing).not.toContain("Opthalmology");
    expect(missing).not.toContain("Dental / CORES");
    expect(missing).not.toContain("Wellness");
  });

  it("treats a brand paired with a covered service in the menu as that service", () => {
    const pages = site.map((p, i) => (i < 3 ? { ...p, servicesNamed: [...p.servicesNamed, "CORES"] } : p));
    expect(promotedServicesWithoutPage(pages)).not.toContain("CORES");
  });

  it("gives the same answer whatever order the pages come in", () => {
    expect(promotedServicesWithoutPage([...site].reverse())).toEqual(promotedServicesWithoutPage(site));
  });

  it("uses the crawl's page title when the address and headline don't name the service", () => {
    const pages = [page("/", ["Boarding"]), page("/a/", ["Boarding"]), page("/b/", ["Boarding"]), page("/services/stay.html", [], { pageType: "service", currentH1: "A Home Away From Home" })];
    expect(promotedServicesWithoutPage(pages)).toEqual(["Boarding"]);
    expect(promotedServicesWithoutPage(pages, new Map([["https://www.vet.com/services/stay.html", "Pet Boarding in Indian Land"]]))).toEqual([]);
  });
});
