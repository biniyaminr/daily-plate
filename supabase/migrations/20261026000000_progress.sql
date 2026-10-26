-- Benji's Daily Plate: private progress records.
--
-- One row per (user, kind). "fitness" holds the profile, daily logs and
-- weigh-ins; "nutrition" holds macro targets and weighed food rows. The
-- payload shapes match the original Daily Plate JSON backup format.
--
-- Writes go through save_progress(), which does a compare-and-swap on
-- `revision` so a stale tab can never silently overwrite newer data.

create table if not exists public.progress (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('fitness', 'nutrition')),
  payload    jsonb       not null check (jsonb_typeof(payload) = 'object'),
  revision   integer     not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind),
  -- Matches the 2 MB request limit in the API, with room for JSON re-encoding.
  constraint progress_payload_size check (octet_length(payload::text) <= 3000000)
);

-- Previous versions, written automatically on every update. A safety net for
-- recovering from a mistaken import; never shown on a public page.
create table if not exists public.progress_history (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  kind        text        not null,
  payload     jsonb       not null,
  revision    integer     not null,
  replaced_at timestamptz not null default now()
);

create index if not exists progress_history_user_kind_idx
  on public.progress_history (user_id, kind, replaced_at desc);

alter table public.progress enable row level security;
alter table public.progress_history enable row level security;

-- Supabase grants table privileges to anon/authenticated by default.
-- Start from nothing and grant only what the app needs.
revoke all on public.progress, public.progress_history from anon, authenticated;
grant select, insert, update on public.progress to authenticated;
grant select on public.progress_history to authenticated;

drop policy if exists progress_select_own on public.progress;
create policy progress_select_own on public.progress
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists progress_insert_own on public.progress;
create policy progress_insert_own on public.progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists progress_update_own on public.progress;
create policy progress_update_own on public.progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No delete policy: records are never removed through the API.

drop policy if exists progress_history_select_own on public.progress_history;
create policy progress_history_select_own on public.progress_history
  for select to authenticated
  using (user_id = (select auth.uid()));

-- History is written by a trigger running as the table owner, so users never
-- need (or get) insert rights on it.
create or replace function public.progress_keep_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.progress_history (user_id, kind, payload, revision)
  values (old.user_id, old.kind, old.payload, old.revision);

  -- Keep the 50 most recent versions per record.
  delete from public.progress_history
  where user_id = old.user_id
    and kind = old.kind
    and id not in (
      select id from public.progress_history
      where user_id = old.user_id and kind = old.kind
      order by id desc
      limit 50
    );
  return new;
end;
$$;

revoke all on function public.progress_keep_history() from public, anon, authenticated;

drop trigger if exists progress_keep_history on public.progress;
create trigger progress_keep_history
  after update on public.progress
  for each row
  when (old.payload is distinct from new.payload)
  execute function public.progress_keep_history();

-- Compare-and-swap save for the signed-in user.
--   expected_revision = 0  -> create the record (fails if it already exists)
--   expected_revision > 0  -> update only if the stored revision still matches
-- Returns the new revision, or null when the caller's copy is stale.
-- SECURITY INVOKER: row-level security above still applies.
create or replace function public.save_progress(
  p_kind text,
  p_expected_revision integer,
  p_payload jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_revision integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid_revision' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.progress (user_id, kind, payload, revision)
    values (v_user, p_kind, p_payload, 1)
    on conflict (user_id, kind) do nothing
    returning revision into v_revision;
  else
    update public.progress
    set payload = p_payload,
        revision = revision + 1,
        updated_at = now()
    where user_id = v_user
      and kind = p_kind
      and revision = p_expected_revision
    returning revision into v_revision;
  end if;

  return v_revision;
end;
$$;

revoke all on function public.save_progress(text, integer, jsonb) from public, anon;
grant execute on function public.save_progress(text, integer, jsonb) to authenticated;
