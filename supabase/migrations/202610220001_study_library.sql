-- Execute this migration once in the SQL Editor of your Supabase project.
-- Each user owns one document containing subjects > topics > cards and review history.
-- Revision checks make the whole hierarchy atomic and prevent silent overwrites.
begin;

create table if not exists public.study_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint valid_library check (coalesce(
    jsonb_typeof(content) = 'object'
    and content->>'version' = '1'
    and jsonb_typeof(content->'subjects') = 'array'
    and jsonb_typeof(content->'topics') = 'array'
    and jsonb_typeof(content->'cards') = 'array'
    and jsonb_typeof(content->'history') = 'array'
    and octet_length(content::text) <= 10485760,
    false
  ))
);

alter table public.study_libraries enable row level security;
drop policy if exists "Read own library" on public.study_libraries;
create policy "Read own library" on public.study_libraries
  for select to authenticated using ((select auth.uid()) = user_id);

-- Writes go through the function so clients cannot bypass the revision check.
revoke all on public.study_libraries from anon, authenticated;
grant select on public.study_libraries to authenticated;

create or replace function public.save_study_library(library_content jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  new_revision bigint;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  insert into public.study_libraries(user_id, content, revision)
  values (owner_id, library_content, 0)
  on conflict (user_id) do nothing;

  update public.study_libraries
  set content = library_content,
      revision = public.study_libraries.revision + 1,
      updated_at = now()
  where user_id = owner_id and revision = expected_revision
  returning revision into new_revision;

  if new_revision is null then
    raise exception 'Library changed on another device' using errcode = '40001';
  end if;
  return new_revision;
end;
$$;

revoke all on function public.save_study_library(jsonb, bigint) from public, anon;
grant execute on function public.save_study_library(jsonb, bigint) to authenticated;
comment on table public.study_libraries is 'Private Studard libraries. All writes require save_study_library with an expected revision.';

commit;
