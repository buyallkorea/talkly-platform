-- Isolated QA only; all fixtures rolled back. No live payment/refund/message/API calls.
begin;
set local statement_timeout='15s';
select set_config('qa.owner',gen_random_uuid()::text,true),
 set_config('qa.other',gen_random_uuid()::text,true),
 set_config('qa.admin',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('qa.owner')::uuid),
 (current_setting('qa.other')::uuid),(current_setting('qa.admin')::uuid);
insert into public.profiles(id,role) values(current_setting('qa.owner')::uuid,'student'),
 (current_setting('qa.other')::uuid,'student'),(current_setting('qa.admin')::uuid,'admin');
insert into public.ai_members(user_id,consent_version,learning_summary_consent_at)
 select id,'2026-10-25-v2-adult19',now()-interval '2 months' from public.profiles where id in (current_setting('qa.owner')::uuid,current_setting('qa.other')::uuid,current_setting('qa.admin')::uuid);
set local role service_role;
do $$
declare owner_id uuid:=current_setting('qa.owner')::uuid; other_id uuid:=current_setting('qa.other')::uuid;
 admin_id uuid:=current_setting('qa.admin')::uuid; refund_id uuid; audit_id uuid; audit_key uuid:=gen_random_uuid();
 pass_until timestamptz; lesson_id uuid; consent_at timestamptz; month_start date;
begin
 insert into public.ai_payments(user_id,order_id,amount,status,payment_key,activated_until)
 values(owner_id,'qa_'||owner_id::text,13900,'paid','qa_synthetic',now()+interval '30 days');
 update public.ai_members set valid_until=now()+interval '30 days' where user_id=owner_id returning valid_until into pass_until;
 refund_id:=public.ai_request_refund(owner_id,'qa_'||owner_id::text,'technical');
 assert public.ai_request_refund(owner_id,'qa_'||owner_id::text,'technical')=refund_id,'refund intake replay';
 begin perform public.ai_request_refund(other_id,'qa_'||owner_id::text,'technical');raise exception 'QA_MISSING_OWNER';
 exception when others then if sqlerrm<>'order unavailable' then raise;end if;end;
 begin perform public.ai_review_refund(other_id,refund_id,0,'reviewing');raise exception 'QA_MISSING_ADMIN';
 exception when others then if sqlerrm<>'admin required' then raise;end if;end;
 assert public.ai_review_refund(admin_id,refund_id,0,'reviewing')=1,'admin review revision';
 begin perform public.ai_review_refund(admin_id,refund_id,0,'awaiting_action');raise exception 'QA_MISSING_REVISION';
 exception when others then if sqlerrm<>'stale review' then raise;end if;end;
 assert public.ai_review_refund(admin_id,refund_id,1,'awaiting_action')=2,'admin review transition';
 audit_id:=public.ai_record_refund_audit(admin_id,refund_id,audit_key,'manual_action_required','Synthetic QA only');
 assert public.ai_record_refund_audit(admin_id,refund_id,audit_key,'manual_action_required','Synthetic QA only')=audit_id,'audit replay';
 begin perform public.ai_record_refund_audit(admin_id,refund_id,audit_key,'manual_action_required','Changed note');raise exception 'QA_MISSING_AUDIT_CONFLICT';
 exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 assert (select count(*)=2 from public.ai_refund_reviews where request_id=refund_id),'two review records';
 assert (select valid_until=pass_until from public.ai_members where user_id=owner_id),'review preserves pass';
 assert (select status='paid' from public.ai_payments where user_id=owner_id),'review never executes refund';
 month_start:=(date_trunc('month',now() at time zone 'Asia/Seoul')-interval '1 month')::date;
 insert into public.ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline,state,charged_seconds,started_at)
 values(owner_id,'calm-female',month_start+1,180,now(),'closed',60,now()-interval '1 hour'),
 (owner_id,'calm-female',month_start+1,180,now(),'closed',40,now()-interval '1 hour'),
 (owner_id,'calm-female',month_start+2,180,now(),'closed',30,now()-interval '1 hour');
 assert public.ai_publish_monthly_reports(now())=1,'closed-month publication';
 assert public.ai_publish_monthly_reports(now())=0,'monthly retry does not duplicate';
 assert (select connected_seconds=130 and learning_days=2 and segments=3 from public.ai_monthly_publications where user_id=owner_id and month=month_start),'report uses settled totals';
 insert into public.ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline,state,charged_seconds,started_at)
 values(owner_id,'calm-female',current_date,180,now(),'closed',30,now()-interval '10 minutes') returning id into lesson_id;
 insert into public.ai_learning_summaries(session_id,user_id,day) values(lesson_id,owner_id,current_date);
 select learning_summary_consent_at into consent_at from public.ai_members where user_id=owner_id;
 assert not public.ai_store_learning_summary(other_id,lesson_id,consent_at,'{}'::jsonb),'summary owner binding';
 assert public.ai_store_learning_summary(owner_id,lesson_id,consent_at,'{"topics":["Synthetic QA"],"expressions":[],"corrections":[],"nextPractice":"Practice"}'::jsonb),'summary storage';
 assert public.ai_delete_learning_summary(owner_id,lesson_id),'owner summary deletion';
 assert not public.ai_store_learning_summary(owner_id,lesson_id,consent_at,'{"topics":["must not return"]}'::jsonb),'late result cannot restore deleted summary';
 assert (select summary is null and deleted_at is not null from public.ai_learning_summaries where session_id=lesson_id),'summary content erased';
 update public.ai_members set learning_summary_consent_at=null where user_id=owner_id;
 assert not public.ai_store_learning_summary(owner_id,lesson_id,consent_at,'{}'::jsonb),'withdrawn consent blocks result';
end $$;
reset role;
select 'PASS: real Supabase refund ownership/admin/revision/audit idempotence with unchanged pass/payment, closed-month totals/retry, summary ownership/deletion/withdrawal; all fixtures rolled back' as result;
rollback;
