-- Append-only refund reconciliation audit; no provider refund or entitlement mutation.
create table public.ai_refund_audit (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.ai_refund_requests(id),
 actor_id uuid not null references auth.users(id),
 event_key uuid not null unique,
 event_type text not null check(event_type in ('provider_checked','entitlement_reviewed','manual_action_required')),
 note text not null check(char_length(note) between 1 and 1000),
 created_at timestamptz not null default clock_timestamp(),
 unique(request_id,event_key)
);
create index ai_refund_audit_request_created on public.ai_refund_audit(request_id,created_at);
alter table public.ai_refund_audit enable row level security;
revoke all on public.ai_refund_audit from public,anon,authenticated;
grant all on public.ai_refund_audit to service_role;
create function public.ai_record_refund_audit(
 p_actor uuid,p_request uuid,p_event_key uuid,p_type text,p_note text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.ai_refund_audit; result uuid;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin')
  then raise exception 'ADMIN_REQUIRED'; end if;
 if p_event_key is null or p_type is null or p_type not in
  ('provider_checked','entitlement_reviewed','manual_action_required')
  or p_note is null or char_length(btrim(p_note)) not between 1 and 1000
  then raise exception 'INVALID_AUDIT'; end if;
 if not exists(select 1 from public.ai_refund_requests where id=p_request)
  then raise exception 'REQUEST_NOT_FOUND'; end if;
 insert into public.ai_refund_audit(request_id,actor_id,event_key,event_type,note)
 values(p_request,p_actor,p_event_key,p_type,btrim(p_note))
 on conflict(event_key) do nothing returning id into result;
 if result is not null then return result; end if;
 select * into existing from public.ai_refund_audit where event_key=p_event_key;
 if not found or existing.request_id is distinct from p_request
  or existing.actor_id is distinct from p_actor
  or existing.event_type is distinct from p_type
  or existing.note is distinct from btrim(p_note)
  then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return existing.id;
end $$;
revoke all on function public.ai_record_refund_audit(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ai_record_refund_audit(uuid,uuid,uuid,text,text) to service_role;
