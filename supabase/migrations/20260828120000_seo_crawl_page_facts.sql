-- Keep what each crawled page actually says, not only the issues derived from it.
--
-- client_seo_crawl_issues already records "missing meta description", but never
-- the description itself, so there was no way to show a client's current title
-- tags and metas without re-crawling. The crawler reads all of this anyway to
-- decide which issues to raise — this just stops it being thrown away.
--
-- Stored as jsonb on the snapshot rather than a pages table: it is read as a
-- whole for one client's latest crawl and never queried across clients, so rows
-- would buy nothing and cost an RLS policy. A 50-page crawl is roughly 25 KB.

alter table public.client_seo_crawl_snapshots
  add column if not exists pages jsonb not null default '[]'::jsonb;

alter table public.client_seo_crawl_snapshots
  add column if not exists schema_gaps jsonb not null default '[]'::jsonb;

comment on column public.client_seo_crawl_snapshots.pages is
  'Per-page facts from the crawl: url, status, title, metaDescription, canonical, noindex, schemaTypes.';

comment on column public.client_seo_crawl_snapshots.schema_gaps is
  'Site-wide schema.org expectations this site does not meet, from findSchemaGaps().';
