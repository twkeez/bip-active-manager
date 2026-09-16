/**
 * The shapes of onboarding research as stored on client_onboarding_intake.
 *
 * Moved here from the old checklist's component folder when the checklist was
 * removed (2026-09-16); the client page's Research tab still reads them.
 */

export type Discovery = {
  competitors: Array<{ name: string; note: string }>;
  marketSnapshot: string;
  searchLandscape: string;
};

export type CompetitorOffer = { name: string; offers: string; positioning: string; counter: string };

export type CampaignPlan = {
  adGroups: Array<{ name: string; keywords: string[] }>;
  budgetNotes: string;
  negatives: string[];
};

export type BrandElements = {
  logoUrl: string | null;
  heroImage: string | null;
  themeColor: string | null;
  title: string | null;
};
