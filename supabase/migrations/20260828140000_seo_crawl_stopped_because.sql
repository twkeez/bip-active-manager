-- Record why a crawl stopped, so a partial result reads as partial.
--
-- The crawl now stops itself on a wall-clock budget rather than being killed by
-- the function timeout, which means a snapshot can legitimately cover part of a
-- site. Without this, "no schema on any page" is indistinguishable from "no
-- schema on the 250 pages we reached", and the second is not a finding.

alter table public.client_seo_crawl_snapshots
  add column if not exists stopped_because text
  check (stopped_because in ('complete', 'page-limit', 'time-limit'));

comment on column public.client_seo_crawl_snapshots.stopped_because is
  'complete = ran out of pages; page-limit = hit MAX_PAGES; time-limit = hit the crawl budget. Null for crawls run before this existed.';
