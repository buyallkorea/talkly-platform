-- Additive storage: existing score evaluations and level decisions are untouched.
create table public.teacher_assessments (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('initial','monthly')),
 source_id bigint not null check (source_id>0),
 period_key text not null,
 status text not null check (status in ('draft','submitted')),
 values jsonb not null check (jsonb_typeof(values)='object' and octet_length(values::text)<=100000),
 revision integer not null check (revision>0),
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint teacher_assessment_period check ((kind='initial' and period_key='initial') or (kind='monthly' and period_key ~ '^(period-[1-9][0-9]{0,2}|final)$')),
 unique(kind,source_id,period_key)
);
create table public.teacher_assessment_versions (
 assessment_id uuid not null references public.teacher_assessments(id),
 revision integer not null,
 actor_id uuid not null references public.profiles(id),
 status text not null check (status in ('draft','submitted')),
 values jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(assessment_id,revision)
);
alter table public.teacher_assessments enable row level security;
alter table public.teacher_assessment_versions enable row level security;
revoke all on public.teacher_assessments, public.teacher_assessment_versions from public,anon,authenticated;
grant select,insert,update on public.teacher_assessments to service_role;
grant select,insert on public.teacher_assessment_versions to service_role;
create index teacher_assessments_updated_idx on public.teacher_assessments(updated_at desc);
-- Server-only operation. Recheck current assignment under a source-row lock, then
-- write the record and its immutable version in one transaction.
create function public.save_teacher_assessment(p_actor uuid,p_kind text,p_source bigint,p_period text,p_revision integer,p_status text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_role text; owner_id uuid; source_started timestamptz; source_status text;
 parent_id bigint; current_interview bigint; parent_status text;
 is_test boolean; saved public.teacher_assessments; existing public.teacher_assessments;
begin
 select role into actor_role from public.profiles where id=p_actor for share;
 if actor_role is null or actor_role not in ('teacher','admin') then raise exception 'ASSESSMENT_FORBIDDEN'; end if;
 if p_kind='initial' then
  select tester_user_id,started_at,status,level_test_id into owner_id,source_started,source_status,parent_id from public.level_test_interviews where id=p_source for update;
 elsif p_kind='monthly' then
  select teacher_user_id,enrollments.is_test into owner_id,is_test from public.enrollments where id=p_source for update;
 else raise exception 'ASSESSMENT_INVALID'; end if;
 if not found or is_test is true or (actor_role<>'admin' and owner_id is distinct from p_actor) then raise exception 'ASSESSMENT_FORBIDDEN'; end if;
 if p_kind='initial' then
  select status into parent_status from public.level_tests where id=parent_id for update;
  if not found then raise exception 'ASSESSMENT_FORBIDDEN'; end if;
  select id into current_interview from public.level_test_interviews where level_test_id=parent_id and status not in ('cancelled','canceled') order by created_at desc,id desc limit 1;
  if actor_role<>'admin' and current_interview is distinct from p_source then raise exception 'ASSESSMENT_FORBIDDEN'; end if;
 end if;
 if p_kind='initial' and p_status='submitted' and (source_started is null or source_status in ('cancelled','no_show')) then raise exception 'ASSESSMENT_FORBIDDEN'; end if;
 if p_revision is null or p_revision<0 or p_status is null or p_status not in ('draft','submitted') or p_values is null then raise exception 'ASSESSMENT_INVALID'; end if;
 select * into existing from public.teacher_assessments where kind=p_kind and source_id=p_source and period_key=p_period for update;
 if found then
  if existing.revision<>p_revision then raise exception 'ASSESSMENT_CONFLICT'; end if;
  if existing.status='submitted' and p_status='draft' then raise exception 'ASSESSMENT_CONFLICT'; end if;
  update public.teacher_assessments set values=p_values,status=p_status,revision=revision+1,updated_by=p_actor,updated_at=clock_timestamp() where id=existing.id returning * into saved;
 else
  if p_revision<>0 then raise exception 'ASSESSMENT_CONFLICT'; end if;
  insert into public.teacher_assessments(kind,source_id,period_key,status,values,revision,created_by,updated_by)
  values(p_kind,p_source,p_period,p_status,p_values,1,p_actor,p_actor) returning * into saved;
 end if;
 -- Completing the new diagnostic form replaces the old numeric completion step.
 -- Update the existing interview workflow atomically; never infer numeric scores
 -- from E/D/I/NYO or change the administrator's final level/course decisions.
 if p_kind='initial' and p_status='submitted' and current_interview=p_source then
  if parent_status='cancelled' then raise exception 'ASSESSMENT_FORBIDDEN'; end if;
  update public.level_test_interviews set status='completed',suggested_level=p_values->>'startingLevel',completed_at=coalesce(completed_at,clock_timestamp()),updated_at=clock_timestamp() where id=p_source;
  update public.level_tests set interview_status='completed',teacher_suggested_level=p_values->>'startingLevel',
   status=case when status='completed' then status else 'admin_review' end,updated_at=clock_timestamp() where id=parent_id;
 end if;
 insert into public.teacher_assessment_versions(assessment_id,revision,actor_id,status,values) values(saved.id,saved.revision,p_actor,saved.status,saved.values);
 return jsonb_build_object('id',saved.id,'revision',saved.revision,'status',saved.status,'updated_at',saved.updated_at);
end $$;
revoke all on function public.save_teacher_assessment(uuid,text,bigint,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_teacher_assessment(uuid,text,bigint,text,integer,text,jsonb) to service_role;
