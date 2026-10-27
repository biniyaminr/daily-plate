-- Daily limit on AI photo analyses per account. Each analysis is a paid API
-- call, so the server asks this function for a slot before calling the model.
-- Run once in the Supabase SQL Editor (safe to re-run).

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- No policies and no grants: only use_ai_quota() below reads or writes it.
revoke all on table public.ai_usage from anon, authenticated;

-- Takes one analysis from today's allowance (days follow Africa/Addis_Ababa).
-- Returns false, without counting, once the limit is reached.
create or replace function public.use_ai_quota(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Africa/Addis_Ababa')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.ai_usage as u (user_id, day, count)
  values (v_user, v_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into v_count;
  return v_count is not null;
end;
$$;

revoke all on function public.use_ai_quota(integer) from public, anon, authenticated;
grant execute on function public.use_ai_quota(integer) to authenticated;
