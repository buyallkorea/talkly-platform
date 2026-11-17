-- Keep monetary legacy hourly_rate unchanged while allowing free-form negotiation notes.
-- Sensitive contract terms are accessible only through verified administrator server routes.
create table if not exists public.teacher_compensation_notes (
  teacher_user_id uuid primary key references public.teacher_profiles(user_id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now()
);
alter table public.teacher_compensation_notes enable row level security;
revoke all on public.teacher_compensation_notes from anon, authenticated;
grant all on public.teacher_compensation_notes to service_role;
comment on table public.teacher_compensation_notes is 'Admin-only teacher pay negotiation notes; never exposed to teachers, parents, or students.';
