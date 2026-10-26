-- Minimal stand-in for the parts of Supabase the migration relies on, so the
-- real migration and row-level security can be tested on plain PostgreSQL.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);

-- Same contract as Supabase: the user id from the request's JWT claims.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Supabase grants new public tables to these roles by default; mimic that so
-- the migration's explicit REVOKEs are actually exercised.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
