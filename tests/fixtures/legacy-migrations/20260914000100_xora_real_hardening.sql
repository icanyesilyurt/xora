-- Task 01: additive compatibility, server-only wallets and atomic request settlement.
-- Apply after 20260914_xora_real_v1.sql, only to a reviewed test database first.

-- Both the documented legacy schema and the deployed frontend's compact schema survive.
alter table public.analyses add column if not exists analysis_type text;
alter table public.analyses add column if not exists title text;
alter table public.analyses add column if not exists result jsonb;
update public.analyses a set
  analysis_type=coalesce(a.analysis_type,to_jsonb(a)->>'type'),
  title=coalesce(a.title,to_jsonb(a)->>'result_title'),
  result=coalesce(a.result,to_jsonb(a)->'raw_result','{}'::jsonb);
create or replace function public.xora_analysis_compat() returns trigger
language plpgsql set search_path=public as $$
declare j jsonb; r jsonb;
begin
  j=to_jsonb(new);
  r=coalesce(new.result,j->'raw_result','{}'::jsonb);
  new.analysis_type=coalesce(new.analysis_type,j->>'type');
  new.title=coalesce(new.title,j->>'result_title');
  new.result=r;
  if current_user in ('anon','authenticated') and r->'meta'->>'tier'='real' then
    raise exception 'real_save_server_only';
  end if;
  -- jsonb_populate_record ignores keys absent from the actual table.
  new=jsonb_populate_record(new,jsonb_build_object(
    'type',new.analysis_type,'raw_result',r,'result_title',new.title,
    'target_username',coalesce(j->>'target_username',r->>'handle',r->>'a',r->'handles'->>0,'unknown'),
    'target_username_2',case when new.analysis_type='match' then coalesce(j->>'target_username_2',r->>'b',r->'handles'->>1) else null end,
    'language',coalesce(j->>'language',r->'meta'->>'locale','tr'),
    'cache_key',coalesce(j->>'cache_key','analysis:'||gen_random_uuid()::text)));
  return new;
end $$;
drop trigger if exists xora_analysis_compat on public.analyses;
create trigger xora_analysis_compat before insert on public.analyses
for each row execute function public.xora_analysis_compat();

-- Table grants bypass column restrictions, so revoke those before granting profile fields.
-- Match the working package's zero-credit signup without trusting its browser payload.
alter table public.users alter column credit_balance set default 0;
revoke insert,update on public.users from public,anon,authenticated;
revoke insert(credit_balance),update(credit_balance) on public.users from public,anon,authenticated;
grant insert(id,username,display_name,avatar_url,last_login_at) on public.users to authenticated;
-- Language is stored locally by the frontend; compact users has no lang column.
grant update(username,display_name,avatar_url,last_login_at) on public.users to authenticated;
revoke all on public.credit_transactions from public,anon,authenticated;
grant select on public.credit_transactions to authenticated;

create or replace function public.xora_apply_credit_change(
 p_user_id uuid,p_type text,p_amount integer,p_reference text default null,p_metadata jsonb default '{}'::jsonb
) returns integer language plpgsql security definer set search_path=public as $$
declare v_balance integer; v_old public.credit_transactions%rowtype;
begin
  if p_user_id is null or p_amount is null or p_amount=0 or p_reference is null or p_reference='' then raise exception 'invalid_credit_change'; end if;
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  -- Recheck AFTER the wallet lock: concurrent duplicate debits return the same operation.
  select * into v_old from public.credit_transactions where user_id=p_user_id and reference=p_reference;
  if found then
    if v_old.amount<>p_amount or v_old.type<>p_type then raise exception 'request_conflict'; end if;
    return v_balance;
  end if;
  if p_type='refund' then
    select * into v_old from public.credit_transactions where user_id=p_user_id and reference=substring(p_reference from 8);
    if left(p_reference,7)<>'refund:' or not found or v_old.amount<>-p_amount or p_amount<0 then raise exception 'invalid_refund'; end if;
  end if;
  if v_balance+p_amount<0 then raise exception 'insufficient_credits'; end if;
  v_balance=v_balance+p_amount;
  update public.users set credit_balance=v_balance where id=p_user_id;
  insert into public.credit_transactions(user_id,type,amount,balance_after,reference,metadata)
  values(p_user_id,p_type,p_amount,v_balance,p_reference,coalesce(p_metadata,'{}'::jsonb));
  return v_balance;
end $$;

create or replace function public.xora_claim_referral(p_user_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.affiliate_attributions%rowtype;
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select * into v_row from public.affiliate_attributions where user_id=p_user_id;
  if found and v_row.expires_at>now() then
    -- Preserve first touch even if its creator was later deactivated; do not propagate it.
    if exists(select 1 from public.affiliates where code=v_row.referral_code and is_active) then return to_jsonb(v_row); end if;
    return null;
  end if;
  if not exists(select 1 from public.affiliates where code=p_code and is_active) then return null; end if;
  insert into public.affiliate_attributions(user_id,referral_code,first_seen_at,expires_at,metadata)
  values(p_user_id,p_code,now(),now()+interval '30 days','{"source":"real_analysis"}')
  on conflict(user_id) do update set referral_code=excluded.referral_code,first_seen_at=excluded.first_seen_at,expires_at=excluded.expires_at,metadata=excluded.metadata
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

create table if not exists public.real_requests (
 user_id uuid not null references public.users(id) on delete cascade,
 reference text not null,
 mode text not null check(mode in ('mirror','stalk','match')),
 locale text not null check(locale in ('tr','en')),
 handles jsonb not null,
 cost integer not null check(cost in (5,10)),
 status text not null check(status in ('pending','succeeded','failed')),
 result jsonb,
 failure_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,reference)
);
alter table public.real_requests enable row level security;
revoke all on public.real_requests from public,anon,authenticated;

create or replace function public.xora_begin_real(p_user_id uuid,p_reference text,p_mode text,p_locale text,p_handles jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.real_requests%rowtype; v_cost integer; v_balance integer;
begin
  if p_reference is null or p_reference !~ '^[a-zA-Z0-9_-]{8,80}$' or p_mode is null or p_mode not in ('mirror','stalk','match') or p_locale is null or p_locale not in ('tr','en') then raise exception 'bad_request'; end if;
  if p_handles is null or jsonb_typeof(p_handles)<>'array' then raise exception 'bad_request'; end if;
  if jsonb_array_length(p_handles)<>(case when p_mode='match' then 2 else 1 end)
    or exists(select 1 from jsonb_array_elements_text(p_handles) h where h !~ '^[a-z0-9_]{1,15}$' or h is null)
    or (p_mode='match' and p_handles->>0=p_handles->>1) then raise exception 'bad_request'; end if;
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference;
  if found then
    if v.mode<>p_mode or v.locale<>p_locale or v.handles<>p_handles then raise exception 'request_conflict'; end if;
    return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance);
  end if;
  v_cost=case when p_mode='match' then 10 else 5 end;
  v_balance=public.xora_apply_credit_change(p_user_id,p_mode,-v_cost,'real:'||p_reference,'{"tier":"real"}');
  insert into public.real_requests(user_id,reference,mode,locale,handles,cost,status)
  values(p_user_id,p_reference,p_mode,p_locale,p_handles,v_cost,'pending');
  return jsonb_build_object('status','claimed','balance',v_balance);
end $$;

create or replace function public.xora_complete_real(p_user_id uuid,p_reference text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.real_requests%rowtype; v_balance integer;
begin
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if not found then raise exception 'request_not_found'; end if;
  if v.status='succeeded' then return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance); end if;
  if v.status<>'pending' then raise exception 'request_failed'; end if;
  if p_result is null or p_result->'meta'->>'tier' is distinct from 'real' or p_result->'rarity'->>'name' is null then raise exception 'invalid_result'; end if;
  insert into public.analyses(user_id,analysis_type,title,result)
  values(p_user_id,v.mode,case when v.mode='match' then '%'||(p_result->>'overall') else p_result->'nickname'->>v.locale end,p_result);
  update public.real_requests set status='succeeded',result=p_result,updated_at=now() where user_id=p_user_id and reference=p_reference;
  return jsonb_build_object('status','succeeded','result',p_result,'balance',v_balance);
end $$;

create or replace function public.xora_fail_real(p_user_id uuid,p_reference text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.real_requests%rowtype; v_balance integer;
begin
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if not found then raise exception 'request_not_found'; end if;
  if v.status='pending' then
    v_balance=public.xora_apply_credit_change(p_user_id,'refund',v.cost,'refund:real:'||p_reference,jsonb_build_object('reason',p_reason));
    update public.real_requests set status='failed',failure_reason=p_reason,updated_at=now() where user_id=p_user_id and reference=p_reference;
    v.status='failed';
  end if;
  return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance);
end $$;

-- Invoke from trusted operations after outages; never requires a second X/AI call.
create or replace function public.xora_recover_real() returns integer
language plpgsql security definer set search_path=public as $$
declare v record; n integer=0;
begin
  for v in select user_id,reference from public.real_requests where status='pending' and created_at<now()-interval '10 minutes' order by user_id,reference loop
    perform public.xora_fail_real(v.user_id,v.reference,'request_timeout'); n=n+1;
  end loop;
  return n;
end $$;

revoke all on function public.xora_apply_credit_change(uuid,text,integer,text,jsonb), public.xora_claim_referral(uuid,text), public.xora_begin_real(uuid,text,text,text,jsonb), public.xora_complete_real(uuid,text,jsonb), public.xora_fail_real(uuid,text,text), public.xora_recover_real() from public,anon,authenticated;
grant execute on function public.xora_apply_credit_change(uuid,text,integer,text,jsonb), public.xora_claim_referral(uuid,text), public.xora_begin_real(uuid,text,text,text,jsonb), public.xora_complete_real(uuid,text,jsonb), public.xora_fail_real(uuid,text,text), public.xora_recover_real() to service_role;

-- Authenticated landing/login claim: caller cannot select another user's attribution.
create or replace function public.xora_capture_referral(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  return public.xora_claim_referral(auth.uid(),lower(p_code));
end $$;
revoke all on function public.xora_capture_referral(text) from public,anon,authenticated;
grant execute on function public.xora_capture_referral(text) to authenticated;
