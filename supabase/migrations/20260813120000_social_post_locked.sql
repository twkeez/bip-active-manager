-- Protect hand-edited social posts from being wiped by a plan regeneration.
-- A locked post is never deleted when its month is rebuilt.

alter table public.social_content_posts
  add column if not exists locked boolean not null default false;

comment on column public.social_content_posts.locked is
  'When true, this post survives plan regeneration (never deleted/replaced).';

-- Regeneration filters on (plan_id, locked, status); this keeps that lookup cheap.
create index if not exists social_content_posts_plan_locked_idx
  on public.social_content_posts (plan_id, locked, status);
