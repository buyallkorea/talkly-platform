-- New isolated feature. No existing lesson, notification or profile policies change.
create table public.teacher_message_threads (
 id uuid primary key default gen_random_uuid(),
 teacher_user_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
 created_by uuid not null references public.profiles(id) on delete restrict,
 subject text not null check (length(btrim(subject)) between 1 and 120),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.teacher_direct_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.teacher_message_threads(id) on delete cascade,
 sender_user_id uuid not null references public.profiles(id) on delete restrict,
 sender_role text not null check (sender_role in ('admin','teacher')),
 body text not null check (length(btrim(body)) between 1 and 5000),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index teacher_threads_recipient_updated on public.teacher_message_threads(teacher_user_id,updated_at desc);
create index teacher_messages_thread_created on public.teacher_direct_messages(thread_id,created_at,id);
create index teacher_messages_sender on public.teacher_direct_messages(sender_user_id);
create index teacher_threads_creator on public.teacher_message_threads(created_by);
create index teacher_messages_unread on public.teacher_direct_messages(sender_role,thread_id) where read_at is null;
alter table public.teacher_message_threads enable row level security;
alter table public.teacher_direct_messages enable row level security;
revoke all on public.teacher_message_threads,public.teacher_direct_messages from anon,authenticated;
grant select on public.teacher_message_threads,public.teacher_direct_messages to authenticated;
grant all on public.teacher_message_threads,public.teacher_direct_messages to service_role;
create policy teacher_threads_read on public.teacher_message_threads for select to authenticated using (
 public.is_admin() or (teacher_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='teacher'))
);
create policy teacher_direct_messages_read on public.teacher_direct_messages for select to authenticated using (
 public.is_admin() or exists(
   select 1 from public.teacher_message_threads t
   join public.profiles p on p.id=t.teacher_user_id
   where t.id=thread_id and t.teacher_user_id=(select auth.uid()) and p.id=(select auth.uid()) and p.role='teacher'
 )
);
-- Only the authenticated server route can invoke this transaction. Actor is derived
-- from auth.getUser(), never accepted from the request body.
create function public.send_teacher_direct_message(p_actor uuid,p_thread uuid,p_teacher uuid,p_subject text,p_body text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_role text; v_thread uuid; v_teacher uuid;
begin
 select role into v_role from public.profiles where id=p_actor;
 if v_role is null or v_role not in ('admin','teacher') then raise exception 'Forbidden'; end if;
 if length(btrim(p_body)) not between 1 and 5000 or p_body is null then raise exception 'Invalid message'; end if;
 if p_thread is null then
  if v_role<>'admin' then raise exception 'Only administrators can start conversations'; end if;
  if p_subject is null or length(btrim(p_subject)) not between 1 and 120 then raise exception 'Invalid subject'; end if;
  v_teacher:=p_teacher;
  insert into public.teacher_message_threads(teacher_user_id,created_by,subject) values(v_teacher,p_actor,btrim(p_subject)) returning id into v_thread;
 else
  select id,teacher_user_id into v_thread,v_teacher from public.teacher_message_threads where id=p_thread for update;
  if v_thread is null or (v_role='teacher' and v_teacher<>p_actor) then raise exception 'Forbidden'; end if;
 end if;
 if not exists(select 1 from public.teacher_profiles t join public.profiles p on p.id=t.user_id where t.user_id=v_teacher and t.is_active and p.role='teacher') then raise exception 'Teacher unavailable'; end if;
 insert into public.teacher_direct_messages(thread_id,sender_user_id,sender_role,body) values(v_thread,p_actor,v_role,btrim(p_body));
 update public.teacher_message_threads set updated_at=clock_timestamp() where id=v_thread;
 return v_thread;
end; $$;
revoke all on function public.send_teacher_direct_message(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.send_teacher_direct_message(uuid,uuid,uuid,text,text) to service_role;
