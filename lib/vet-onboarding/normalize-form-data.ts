import { normalizeUrl, splitUrlLines, joinUrlLines } from "@/lib/vet-onboarding/url-helpers";
import type { ClientFormData } from "@/types/onboarding";

export const CLIENT_FORM_STRING_FIELDS: (keyof ClientFormData)[] = [
  "practiceName",
  "contactName",
  "location",
  "practiceType",
  "numVets",
  "mainGoal",
  "challenge",
  "budget",
  "timeline",
  "presence",
  "notes",
  "websiteUrl",
  "googleBusinessProfileUrls",
  "facebookUrl",
  "instagramUrl",
  "otherSocialUrls",
  "practicePhone",
  "onlineBookingUrl",
  "serviceAreaNotes",
  "marketingManagedBy",
  "previousAgencyName",
  "intakeSummary",
];

export function getUndefinedClientFormFields(
  raw: Partial<ClientFormData>,
): (keyof ClientFormData)[] {
  const undefinedFields = CLIENT_FORM_STRING_FIELDS.filter(
    (key) => raw[key] === undefined,
  );
  if (raw.services === undefined) undefinedFields.push("services");
  if (raw.intakeGoals === undefined) undefinedFields.push("intakeGoals");
  return undefinedFields;
}

function normalizeUrlField(value: unknown): string {
  return normalizeUrl(String(value ?? ""));
}

function normalizeUrlLinesField(value: unknown): string {
  return joinUrlLines(splitUrlLines(String(value ?? "")));
}

export function normalizeClientFormData(raw: Partial<ClientFormData>): ClientFormData {
  return {
    practiceName: String(raw.practiceName ?? "").trim(),
    contactName: String(raw.contactName ?? "").trim(),
    location: String(raw.location ?? "").trim(),
    practiceType: String(raw.practiceType ?? "").trim(),
    numVets: String(raw.numVets ?? "").trim(),
    services: Array.isArray(raw.services)
      ? raw.services.map((s) => String(s).trim()).filter(Boolean)
      : [],
    mainGoal: String(raw.mainGoal ?? "").trim(),
    challenge: String(raw.challenge ?? "").trim(),
    budget: String(raw.budget ?? "").trim(),
    timeline: String(raw.timeline ?? "").trim(),
    presence: String(raw.presence ?? "").trim(),
    notes: String(raw.notes ?? "").trim(),
    websiteUrl: normalizeUrlField(raw.websiteUrl),
    googleBusinessProfileUrls: normalizeUrlLinesField(raw.googleBusinessProfileUrls),
    facebookUrl: normalizeUrlField(raw.facebookUrl),
    instagramUrl: normalizeUrlField(raw.instagramUrl),
    otherSocialUrls: normalizeUrlLinesField(raw.otherSocialUrls),
    practicePhone: String(raw.practicePhone ?? "").trim(),
    onlineBookingUrl: normalizeUrlField(raw.onlineBookingUrl),
    serviceAreaNotes: String(raw.serviceAreaNotes ?? "").trim(),
    marketingManagedBy: String(raw.marketingManagedBy ?? "").trim(),
    previousAgencyName: String(raw.previousAgencyName ?? "").trim(),
    intakeGoals: Array.isArray(raw.intakeGoals)
      ? raw.intakeGoals.map((g) => String(g).trim()).filter(Boolean)
      : [],
    intakeSummary: String(raw.intakeSummary ?? "").trim(),
  };
}

export function hasIntakeGoals(data: ClientFormData): boolean {
  return data.intakeGoals.length > 0 || Boolean(data.intakeSummary.trim());
}
