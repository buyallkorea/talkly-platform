-- Intake/review only. Never changes payments, balances, or provider state.
create table public.ai_refund_requests (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null unique references public.ai_payments(id),
 user_id uuid not null references public.ai_members(user_id),
 reason text not null check(reason in ('unused','quality','technical','other')),
 state text not null default 'requested' check(state in ('requested','reviewing','awaiting_action')),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index ai_refund_requests_user on public.ai_refund_requests(user_id,created_at desc);
create index ai_refund_requests_queue on public.ai_refund_requests(state,created_at);
create table public.ai_refund_reviews (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.ai_refund_requests(id),
 actor_id uuid references auth.users(id) on delete set null,
 from_state text not null, to_state text not null,
 revision integer not null, created_at timestamptz not null default now(),
 unique(request_id,revision)
);
create index ai_refund_reviews_actor on public.ai_refund_reviews(actor_id);
alter table public.ai_refund_requests enable row level security;
alter table public.ai_refund_reviews enable row level security;
revoke all on public.ai_refund_requests,public.ai_refund_reviews from public,anon,authenticated;
grant all on public.ai_refund_requests,public.ai_refund_reviews to service_role;
create function public.ai_request_refund(p_user uuid,p_order text,p_reason text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.ai_payments; rid uuid;
begin
 if p_reason is null or p_reason not in ('unused','quality','technical','other') then raise exception 'invalid reason'; end if;
 select * into p from public.ai_payments where user_id=p_user and order_id=p_order for update;
 if not found then raise exception 'order unavailable'; end if;
 select id into rid from public.ai_refund_requests where payment_id=p.id;
 if found then return rid; end if;
 if p.status <> 'paid' then raise exception 'payment not paid'; end if;
 insert into public.ai_refund_requests(payment_id,user_id,reason) values(p.id,p_user,p_reason) returning id into rid;
 return rid;
end $$;
create function public.ai_review_refund(p_actor uuid,p_request uuid,p_revision integer,p_state text) returns integer
language plpgsql security invoker set search_path='' as $$
declare r public.ai_refund_requests;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'admin required'; end if;
 select * into r from public.ai_refund_requests where id=p_request for update;
 if not found or p_revision is distinct from r.revision then raise exception 'stale review'; end if;
 if p_state is null or not ((r.state='requested' and p_state='reviewing') or (r.state='reviewing' and p_state='awaiting_action') or (r.state='awaiting_action' and p_state='reviewing')) then raise exception 'invalid transition'; end if;
 insert into public.ai_refund_reviews(request_id,actor_id,from_state,to_state,revision) values(r.id,p_actor,r.state,p_state,r.revision+1);
 update public.ai_refund_requests set state=p_state,revision=revision+1,updated_at=now() where id=r.id;
 return r.revision+1;
end $$;
revoke all on function public.ai_request_refund(uuid,text,text),public.ai_review_refund(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.ai_request_refund(uuid,text,text),public.ai_review_refund(uuid,uuid,integer,text) to service_role;
