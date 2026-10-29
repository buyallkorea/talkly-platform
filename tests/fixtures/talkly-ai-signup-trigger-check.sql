-- ISOLATED QA ONLY. Exercises real signup triggers and then rolls back every fixture.
begin;
set local statement_timeout='10s';
select set_config('qa.student',gen_random_uuid()::text,true),set_config('qa.parent',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data,raw_app_meta_data)
values(current_setting('qa.student')::uuid,'{"role":"admin","name":"Synthetic QA","phone":"010-0000-0000"}','{}'),
(current_setting('qa.parent')::uuid,'{"role":"parent","name":"Synthetic QA Parent"}','{}');
do $$ begin
 assert (select role='student' and phone='01000000000' from public.profiles where id=current_setting('qa.student')::uuid),'browser admin metadata must not escalate role';
 assert exists(select 1 from public.student_profiles where user_id=current_setting('qa.student')::uuid),'student profile created by Auth trigger';
 assert (select role='parent' from public.profiles where id=current_setting('qa.parent')::uuid),'parent role preserved';
 assert exists(select 1 from public.parent_profiles where user_id=current_setting('qa.parent')::uuid),'parent profile created by Auth trigger';
end $$;
select set_config('request.jwt.claim.sub',current_setting('qa.student'),true),set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
 assert not public.is_admin(),'own admin lookup must be false';
 assert (select count(*)=1 from public.profiles),'other profile rows hidden';
 begin update public.profiles set role='admin' where id=current_setting('qa.student')::uuid;
 raise exception 'QA_MISSING_ROLE_GUARD';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
insert into public.ai_members(user_id,consent_version) values(current_setting('qa.student')::uuid,'2026-10-25-v2-adult19'),(current_setting('qa.parent')::uuid,'2026-10-25-v2-adult19');
do $$ declare uid uuid;s jsonb;begin
 foreach uid in array array[current_setting('qa.student')::uuid,current_setting('qa.parent')::uuid] loop
 s:=public.ai_reserve(uid,'calm-female');assert (s->>'reserved_seconds')::int=180,'first trial';
 perform public.ai_finish(uid,(s->>'id')::uuid,true);
 end loop;
end $$;
reset role;
select 'PASS: real Auth insert triggers, safe student/parent role creation, profile RLS/role guard, first trial reservation; NOT an HTTP signup or microphone test' as result;
rollback;
