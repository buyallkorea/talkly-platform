-- Standalone teacher-entered timesheet, intentionally independent of class_sessions,
-- attendance, payroll-rate settings, payments, enrolments and lesson scheduling.
create table public.teacher_manual_timesheets (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.teacher_profiles(user_id),
 month text not null check(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 status text not null check(status in ('draft','submitted')),
 entries jsonb not null default '[]'::jsonb check(jsonb_typeof(entries)='array' and octet_length(entries::text) <= 140000),
 roster_notes text not null default '' check(length(roster_notes) <= 3000),
 teacher_note text not null default '' check(length(teacher_note) <= 2000),
 time_zone text not null default 'Asia/Seoul' check(time_zone in ('Asia/Seoul','Asia/Manila','Asia/Tokyo','UTC')),
 revision integer not null check(revision >= 1),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 submitted_at timestamptz,
 unique(teacher_id,month)
);
create index teacher_manual_timesheets_month_status_idx on public.teacher_manual_timesheets(month,status);
create table public.teacher_manual_timesheet_versions (
 timesheet_id uuid not null references public.teacher_manual_timesheets(id),
 revision integer not null,
 actor_id uuid not null references public.profiles(id),
 status text not null check(status in ('draft','submitted')),
 entries jsonb not null,
 roster_notes text not null,
 teacher_note text not null,
 time_zone text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(timesheet_id,revision)
);
alter table public.teacher_manual_timesheets enable row level security;
alter table public.teacher_manual_timesheet_versions enable row level security;
revoke all on public.teacher_manual_timesheets, public.teacher_manual_timesheet_versions from public,anon,authenticated;
grant select,insert,update on public.teacher_manual_timesheets to service_role;
grant select,insert on public.teacher_manual_timesheet_versions to service_role;

-- Service-only, atomic save with role verification and audit snapshots.
-- No teacher can submit another teacher's sheet; application supplies verified auth UID.
create function public.save_teacher_manual_timesheet(
 p_actor uuid,p_month text,p_revision integer,p_status text,p_entries jsonb,
 p_roster_notes text,p_teacher_note text,p_time_zone text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_role text; active boolean; existing public.teacher_manual_timesheets; saved public.teacher_manual_timesheets;
begin
 select role into actor_role from public.profiles where id=p_actor for share;
 select is_active into active from public.teacher_profiles where user_id=p_actor for share;
 if actor_role is distinct from 'teacher' or active is distinct from true then raise exception 'TIMESHEET_FORBIDDEN'; end if;
 if p_month is null or p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
   or p_revision is null or p_revision < 0 or p_status not in ('draft','submitted')
   or p_entries is null or jsonb_typeof(p_entries) <> 'array'
   or octet_length(p_entries::text) > 140000
   or (p_status='submitted' and jsonb_array_length(p_entries)=0)
   or p_roster_notes is null or length(p_roster_notes) > 3000
   or p_teacher_note is null or length(p_teacher_note) > 2000
   or p_time_zone not in ('Asia/Seoul','Asia/Manila','Asia/Tokyo','UTC')
 then raise exception 'TIMESHEET_INVALID'; end if;
 select * into existing from public.teacher_manual_timesheets where teacher_id=p_actor and month=p_month for update;
 if found then
   if existing.revision <> p_revision then raise exception 'TIMESHEET_CONFLICT'; end if;
   if existing.status='submitted' and p_status='draft' then raise exception 'TIMESHEET_INVALID'; end if;
   update public.teacher_manual_timesheets
     set status=p_status,entries=p_entries,roster_notes=p_roster_notes,teacher_note=p_teacher_note,
         time_zone=p_time_zone,revision=revision+1,updated_at=clock_timestamp(),
         submitted_at=case when p_status='submitted' then clock_timestamp() else null end
     where id=existing.id returning * into saved;
 else
   if p_revision <> 0 then raise exception 'TIMESHEET_CONFLICT'; end if;
   insert into public.teacher_manual_timesheets(teacher_id,month,status,entries,roster_notes,teacher_note,time_zone,revision,submitted_at)
     values(p_actor,p_month,p_status,p_entries,p_roster_notes,p_teacher_note,p_time_zone,1,
       case when p_status='submitted' then clock_timestamp() else null end)
     returning * into saved;
 end if;
 insert into public.teacher_manual_timesheet_versions
   (timesheet_id,revision,actor_id,status,entries,roster_notes,teacher_note,time_zone)
   values(saved.id,saved.revision,p_actor,p_status,p_entries,p_roster_notes,p_teacher_note,p_time_zone);
 return jsonb_build_object('revision',saved.revision,'status',saved.status,'updatedAt',saved.updated_at);
end $$;
revoke all on function public.save_teacher_manual_timesheet(uuid,text,integer,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.save_teacher_manual_timesheet(uuid,text,integer,text,jsonb,text,text,text) to service_role;
