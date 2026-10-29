-- ISOLATED QA ONLY. Never place this in production migrations.
-- Minimal AI database prerequisite, not a complete TALKLY signup/classroom baseline.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'student' check(role in ('student','parent','teacher','admin')),
 name text,phone text,birth_date date,gender text,profile_image_url text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy qa_profile_owner_read on public.profiles for select to authenticated using ((select auth.uid())=id);
create extension if not exists pg_cron;
