// The BIP Control team guide: one entry per sidebar link, grouped as the
// sidebar groups them. The in-app guide (/guide), the branded print/PDF
// version (/guide-print) and the Word download are all built from the same
// content (lib/guide/content.ts), so they never disagree; a test fails when a
// sidebar link has no entry (lib/guide/content.test.ts).

export type GuideItem = {
  /** The sidebar link this entry explains. Must match the sidebar exactly. */
  href: string;
  label: string;
  /** Only admins see it in the sidebar. */
  adminOnly?: boolean;
  /** What it's for, in one or two sentences. */
  purpose: string;
  /** What you can do there. */
  youCan: string[];
  /** Good to know: where the data comes from, how fresh it is, what it doesn't do. */
  notes?: string[];
};

export type GuideSection = {
  /** As the sidebar labels the group. */
  title: string;
  intro?: string;
  items: GuideItem[];
};

export type Guide = {
  /** Shown on the guide and printed on the document. Bump it with each change. */
  updated: string;
  intro: string[];
  basics: { heading: string; body: string }[];
  sections: GuideSection[];
};
