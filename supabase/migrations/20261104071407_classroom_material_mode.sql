-- Additive only: existing lessons retain their selected textbook and progress.
alter table public.class_sessions
  add column material_mode text not null default 'textbook'
  constraint class_sessions_material_mode_check check (material_mode in ('textbook', 'screen'));
comment on column public.class_sessions.material_mode is
  'Teacher-selected material presentation. Screen media stays in Zoom; no external URLs or credentials are stored.';
