export type PageSnapshot = {
  url: string;
  title: string;
  description: string;
  text: string;
  fetchError?: string;
};

export type CuratedLink = {
  title: string;
  url: string;
  description: string;
  optional: boolean;
};

export type CuratedSection = {
  name: string;
  links: CuratedLink[];
};

export type LlmsTxtCuration = {
  h1Title: string;
  blockquoteSummary: string;
  guidanceNotes: string;
  sections: CuratedSection[];
};

export type LlmsTxtGenerateStats = {
  urlsDiscovered: number;
  urlsIndexed: number;
  urlsInFull: number;
  truncated: boolean;
  llmsFullBytes: number;
};

export type LlmsTxtGenerateResult = {
  clientId: number;
  clientName: string;
  domain: string;
  llmsTxt: string;
  llmsFullTxt: string;
  stats: LlmsTxtGenerateStats;
};

export type LlmsTxtClientOption = {
  id: number;
  account_name: string;
  website: string;
};
