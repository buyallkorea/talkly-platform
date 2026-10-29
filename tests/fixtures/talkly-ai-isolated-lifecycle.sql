-- Run ONLY against a verified isolated Supabase QA project, never production.
-- Synthetic users and all changes are rolled back. No provider/payment calls.
begin;
set local statement_timeout = '15s';
select set_config('qa.owner', gen_random_uuid()::text, true),
       set_config('qa.other', gen_random_uuid()::text, true),
       set_config('qa.admin', gen_random_uuid()::text, true);
insert into auth.users(id) values(current_setting('qa.owner')::uuid),
 (current_setting('qa.other')::uuid),(current_setting('qa.admin')::uuid);
insert into public.profiles(id,role) values(current_setting('qa.owner')::uuid,'student'),
 (current_setting('qa.other')::uuid,'student'),(current_setting('qa.admin')::uuid,'admin');
insert into public.ai_members(user_id,consent_version) select id,'2026-10-25-v2-adult19' from public.profiles where id in (current_setting('qa.owner')::uuid,current_setting('qa.other')::uuid,current_setting('qa.admin')::uuid);
set local role service_role;
do $$
declare owner_id uuid:=current_setting('qa.owner')::uuid; other_id uuid:=current_setting('qa.other')::uuid;
 s jsonb; finished jsonb; replay jsonb; remaining integer; charged integer; until_at timestamptz;
begin
 s:=public.ai_reserve(owner_id,'calm-female');
 assert (s->>'reserved_seconds')::integer=180 and s->>'entitlement'='trial','first lifetime trial';
 begin perform public.ai_reserve(owner_id,'lively-male'); raise exception 'QA_MISSING_SESSION_ACTIVE';
 exception when others then if sqlerrm<>'SESSION_ACTIVE' then raise; end if; end;
 begin perform public.ai_finish(other_id,(s->>'id')::uuid,true); raise exception 'QA_MISSING_OWNER_CHECK';
 exception when others then if sqlerrm<>'SESSION_NOT_FOUND' then raise; end if; end;
 finished:=public.ai_finish(owner_id,(s->>'id')::uuid,true);
 assert (finished->>'charged_seconds')::integer=0,'unattached failure restores trial';
 assert (select trial_used_seconds=0 from public.ai_members where user_id=owner_id),'restored exactly once';
 replay:=public.ai_finish(owner_id,(s->>'id')::uuid,true);
 assert replay=finished,'settlement replay';
 s:=public.ai_reserve(owner_id,'intellectual-female');
 update public.ai_sessions set started_at=clock_timestamp()-interval '20 seconds',call_id='rtc_qa_synthetic',state='active' where id=(s->>'id')::uuid;
 perform public.ai_begin_close(owner_id,(s->>'id')::uuid);
 -- Provider hangup is mocked by this DB-only scenario, never claimed as real voice QA.
 finished:=public.ai_finish(owner_id,(s->>'id')::uuid,false);
 charged:=(finished->>'charged_seconds')::integer;
 assert charged between 20 and 22,'settles elapsed seconds';
 assert (select trial_used_seconds=charged from public.ai_members where user_id=owner_id),'trial keeps actual charge';
 s:=public.ai_reserve(owner_id,'lively-female');
 remaining:=(s->>'reserved_seconds')::integer;
 assert remaining=180-charged,'reconnect receives remaining lifetime trial';
 update public.ai_sessions set started_at=clock_timestamp()-interval '181 seconds',state='active',call_id='rtc_qa_synthetic' where id=(s->>'id')::uuid;
 perform public.ai_begin_close(owner_id,(s->>'id')::uuid);
 finished:=public.ai_finish(owner_id,(s->>'id')::uuid,false);
 assert (finished->>'charged_seconds')::integer=remaining,'cannot exceed reservation';
 begin perform public.ai_reserve(owner_id,'calm-male'); raise exception 'QA_MISSING_TRIAL_EXHAUSTION';
 exception when others then if sqlerrm<>'TRIAL_EXHAUSTED' then raise; end if; end;
 -- Synthetic verified-payment state tests activation accounting, not Toss approval.
 insert into public.ai_payments(user_id,order_id,amount,status,payment_key)
 values(owner_id,'qa_'||owner_id::text,13900,'confirming','qa_synthetic_key');
 until_at:=public.ai_activate(owner_id,'qa_'||owner_id::text,'qa_synthetic_key',clock_timestamp());
 assert until_at>clock_timestamp()+interval '29 days','30-day entitlement';
 assert public.ai_activate(owner_id,'qa_'||owner_id::text,'qa_synthetic_key',clock_timestamp())=until_at,'activation replay';
 s:=public.ai_reserve(owner_id,'calm-male');
 assert (s->>'reserved_seconds')::integer=240 and s->>'entitlement'='paid','paid lease';
 finished:=public.ai_finish(owner_id,(s->>'id')::uuid,true);
 assert (select used_seconds=0 from public.ai_daily_usage where user_id=owner_id and day=(s->>'day')::date),'paid failure restores daily allowance';
 update public.ai_daily_usage set used_seconds=599 where user_id=owner_id;
 s:=public.ai_reserve(owner_id,'calm-male');
 assert (s->>'reserved_seconds')::integer=1,'last daily second only';
 update public.ai_sessions set started_at=clock_timestamp()-interval '2 seconds',call_id='rtc_qa_synthetic',state='active' where id=(s->>'id')::uuid;
 finished:=public.ai_finish(owner_id,(s->>'id')::uuid,false);
 begin perform public.ai_reserve(owner_id,'calm-male'); raise exception 'QA_MISSING_DAILY_EXHAUSTION';
 exception when others then if sqlerrm<>'NO_TIME_REMAINING' then raise; end if; end;
 assert (select used_seconds=600 from public.ai_daily_usage where user_id=owner_id),'daily hard limit';
end $$;
reset role;
-- Real authenticated RLS: only the caller's member row is visible.
select set_config('request.jwt.claim.sub',current_setting('qa.owner'),true);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 from public.ai_members),'member RLS ownership';
 assert (select bool_and(user_id=current_setting('qa.owner')::uuid) from public.ai_members),'foreign rows hidden';
 assert not has_function_privilege(current_user,'public.ai_checkpoint_ordered(uuid,uuid,bigint,jsonb,uuid)','EXECUTE'),'no browser checkpoint RPC';
 assert not has_table_privilege(current_user,'public.ai_payments','INSERT'),'no browser payment writes';
end $$;
reset role;
select 'PASS: real Supabase trial reservation/failure/refund/settlement/reconnect/exhaustion, paid activation replay/daily limit and authenticated RLS; DB-only, all fixtures rolled back' as result;
rollback;
