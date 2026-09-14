-- XORA Task 03: remote compact-schema reconciliation.
-- PREPARE ONLY: do not apply this file from Task 03.
-- Forward-only and additive. It intentionally does not edit/replay prior migrations.

-- Existing compact installations may use a slightly different ledger shape. These
-- nullable compatibility fields are additive and never reset balances or history.
alter table if exists public.credit_transactions add column if not exists type text;
alter table if exists public.credit_transactions add column if not exists balance_after integer;
alter table if exists public.credit_transactions add column if not exists reference text;
alter table if exists public.credit_transactions add column if not exists idempotency_key text;
alter table if exists public.credit_transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists credit_transactions_user_idempotency_uidx
  on public.credit_transactions(user_id,idempotency_key)
  where idempotency_key is not null;

-- users: language remains frontend-local; no lang column is added or referenced.
-- New profiles start with zero credits; existing balances are never rewritten.
alter table if exists public.users alter column credit_balance set default 0;
alter table if exists public.users enable row level security;
revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;
grant insert(id,username,display_name,avatar_url,last_login_at) on table public.users to authenticated;
grant update(username,display_name,avatar_url,last_login_at) on table public.users to authenticated;
drop policy if exists "xora_users_select_own" on public.users;
drop policy if exists "xora_users_insert_own" on public.users;
drop policy if exists "xora_users_update_own_profile" on public.users;
create policy "xora_users_select_own" on public.users for select to authenticated
  using (auth.uid() = id);
create policy "xora_users_insert_own" on public.users for insert to authenticated
  with check (auth.uid() = id);
create policy "xora_users_update_own_profile" on public.users for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- analyses: preserve old history and browser FUN inserts; REAL inserts are trusted-only.
alter table if exists public.analyses enable row level security;
revoke all on table public.analyses from anon, authenticated;
grant select on table public.analyses to authenticated;
grant insert(user_id,analysis_type,title,result) on table public.analyses to authenticated;
drop policy if exists "xora_analyses_select_own" on public.analyses;
drop policy if exists "xora_analyses_insert_own_fun" on public.analyses;
create policy "xora_analyses_select_own" on public.analyses for select to authenticated
  using (auth.uid() = user_id);
create policy "xora_analyses_insert_own_fun" on public.analyses for insert to authenticated
  with check (
    auth.uid() = user_id
    and analysis_type in ('mirror','stalk','match')
    and coalesce(result->'meta'->>'tier','fun') <> 'real'
  );
create or replace function public.xora_block_browser_real_analysis() returns trigger
language plpgsql security invoker as $$
begin
  if current_user in ('anon','authenticated') and new.result->'meta'->>'tier' = 'real' then
    raise exception 'real_save_server_only';
  end if;
  return new;
end $$;
drop trigger if exists xora_block_browser_real_analysis on public.analyses;
create trigger xora_block_browser_real_analysis
  before insert or update on public.analyses
  for each row execute function public.xora_block_browser_real_analysis();

-- Ledger and X cache are server-only, while users may read only their own ledger.
alter table if exists public.credit_transactions enable row level security;
revoke all on table public.credit_transactions from anon, authenticated;
grant select on table public.credit_transactions to authenticated;
drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
drop policy if exists "xora_credit_select_own" on public.credit_transactions;
create policy "xora_credit_select_own" on public.credit_transactions for select to authenticated
  using (auth.uid() = user_id);
alter table if exists public.x_cache enable row level security;
revoke all on table public.x_cache from anon, authenticated;
drop policy if exists "xora_x_cache_no_client_access" on public.x_cache;
grant all on table public.users, public.analyses, public.credit_transactions, public.x_cache to service_role;
do $$
declare s text;
begin
  s=pg_get_serial_sequence('public.analyses','id');
  if s is not null then execute format('grant usage, select on sequence %s to authenticated, service_role',s); end if;
  s=pg_get_serial_sequence('public.credit_transactions','id');
  if s is not null then execute format('grant usage, select on sequence %s to service_role',s); end if;
end $$;

-- Lock every existing paid RPC by name without assuming a historical signature.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('xora_begin_paid_attempt','xora_complete_paid_attempt','xora_refund_paid_attempt')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

create table if not exists public.affiliates (
  code text primary key check (code = lower(code) and code ~ '^[a-z0-9_-]{2,64}$'),
  display_name text,
  commission_bps integer not null default 2500 check (commission_bps between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.affiliate_attributions (
  user_id uuid primary key references public.users(id) on delete cascade,
  referral_code text not null references public.affiliates(code),
  first_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.affiliates enable row level security;
alter table public.affiliate_attributions enable row level security;
revoke all on table public.affiliates, public.affiliate_attributions from anon, authenticated;
grant all on table public.affiliates, public.affiliate_attributions to service_role;

create or replace function public.xora_capture_referral(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v public.affiliate_attributions%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform 1 from public.users where id=auth.uid() for update;
  if not found then raise exception 'user_not_found'; end if;
  select * into v from public.affiliate_attributions where user_id=auth.uid();
  if found and v.expires_at > now() then return to_jsonb(v); end if;
  if not exists (select 1 from public.affiliates where code=lower(coalesce(p_code,'')) and is_active) then return null; end if;
  insert into public.affiliate_attributions(user_id,referral_code,first_seen_at,expires_at,metadata)
  values(auth.uid(),lower(p_code),now(),now()+interval '30 days','{"source":"authenticated_first_touch"}')
  on conflict(user_id) do update set referral_code=excluded.referral_code,first_seen_at=excluded.first_seen_at,
    expires_at=excluded.expires_at,metadata=excluded.metadata
  returning * into v;
  return to_jsonb(v);
end $$;

create table if not exists public.real_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  reference text not null,
  mode text not null check (mode in ('mirror','stalk','match')),
  locale text not null check (locale in ('tr','en')),
  handles jsonb not null,
  cost integer not null check (cost in (5,10)),
  status text not null check (status in ('pending','succeeded','failed')),
  result jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,reference)
);
alter table public.real_requests enable row level security;
revoke all on table public.real_requests from anon, authenticated;
grant all on table public.real_requests to service_role;

-- A dedicated ledger helper avoids depending on old paid-attempt signatures.
create or replace function public.xora_reconcile_credit_change(
  p_user_id uuid,p_type text,p_amount integer,p_reference text,p_idempotency_key text,p_metadata jsonb default '{}'::jsonb
) returns integer language plpgsql security definer set search_path=public as $$
declare v_balance integer; v_amount integer; v_type text;
begin
  if p_user_id is null or p_amount=0 or p_idempotency_key is null or p_idempotency_key='' then raise exception 'invalid_credit_change'; end if;
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select amount,type into v_amount,v_type from public.credit_transactions
    where user_id=p_user_id and idempotency_key=p_idempotency_key limit 1;
  if found then
    if v_amount<>p_amount or v_type<>p_type then raise exception 'request_conflict'; end if;
    return v_balance;
  end if;
  if v_balance+p_amount<0 then raise exception 'insufficient_credits'; end if;
  v_balance=v_balance+p_amount;
  update public.users set credit_balance=v_balance where id=p_user_id;
  insert into public.credit_transactions(user_id,type,amount,balance_after,reference,idempotency_key,metadata)
    values(p_user_id,p_type,p_amount,v_balance,p_reference,p_idempotency_key,coalesce(p_metadata,'{}'::jsonb));
  return v_balance;
end $$;

create or replace function public.xora_begin_real(p_user_id uuid,p_reference text,p_mode text,p_locale text,p_handles jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v real_requests%rowtype; v_cost integer; v_balance integer;
begin
  if p_reference is null or p_reference !~ '^[a-zA-Z0-9_-]{8,80}$' or p_mode not in ('mirror','stalk','match') or p_locale not in ('tr','en') then raise exception 'bad_request'; end if;
  if p_handles is null or jsonb_typeof(p_handles)<>'array' or jsonb_array_length(p_handles)<>(case when p_mode='match' then 2 else 1 end) then raise exception 'bad_request'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_handles) h where h !~ '^[a-z0-9_]{1,15}$') then raise exception 'bad_request'; end if;
  if p_mode='match' and p_handles->>0=p_handles->>1 then raise exception 'bad_request'; end if;
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if found then
    if v.mode<>p_mode or v.locale<>p_locale or v.handles<>p_handles then raise exception 'request_conflict'; end if;
    return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance);
  end if;
  v_cost=case when p_mode='match' then 10 else 5 end;
  v_balance=public.xora_reconcile_credit_change(p_user_id,p_mode,-v_cost,'real:'||p_reference,'real:'||p_reference,jsonb_build_object('tier','real'));
  insert into public.real_requests(user_id,reference,mode,locale,handles,cost,status)
    values(p_user_id,p_reference,p_mode,p_locale,p_handles,v_cost,'pending');
  return jsonb_build_object('status','claimed','balance',v_balance);
end $$;

create or replace function public.xora_complete_real(p_user_id uuid,p_reference text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v real_requests%rowtype; v_balance integer; v_title text;
begin
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if not found then raise exception 'request_not_found'; end if;
  if v.status='succeeded' then return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance); end if;
  if v.status<>'pending' or p_result is null or p_result->'meta'->>'tier' is distinct from 'real' or p_result->'rarity'->>'name' not in ('common','rare','epic','legendary') then raise exception 'invalid_result'; end if;
  v_title=case when v.mode='match' then '%'||coalesce(p_result->>'overall','?') else coalesce(p_result->'nickname'->>v.locale,'XORA Real') end;
  insert into public.analyses(user_id,analysis_type,title,result) values(p_user_id,v.mode,v_title,p_result);
  update public.real_requests set status='succeeded',result=p_result,updated_at=now() where user_id=p_user_id and reference=p_reference;
  return jsonb_build_object('status','succeeded','result',p_result,'balance',v_balance);
end $$;

create or replace function public.xora_fail_real(p_user_id uuid,p_reference text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v real_requests%rowtype; v_balance integer;
begin
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if not found then raise exception 'request_not_found'; end if;
  if v.status='pending' then
    v_balance=public.xora_reconcile_credit_change(p_user_id,'refund',v.cost,'refund:real:'||p_reference,'refund:real:'||p_reference,jsonb_build_object('reason',p_reason));
    update public.real_requests set status='failed',failure_reason=p_reason,updated_at=now() where user_id=p_user_id and reference=p_reference;
    v.status='failed';
  end if;
  return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance);
end $$;

create or replace function public.xora_recover_real() returns integer
language plpgsql security definer set search_path=public as $$
declare v record; n integer=0;
begin
  for v in select user_id,reference from public.real_requests where status='pending' and created_at<now()-interval '10 minutes' order by user_id,reference loop
    perform public.xora_fail_real(v.user_id,v.reference,'request_timeout'); n=n+1;
  end loop;
  return n;
end $$;

-- All lifecycle and ledger helpers are service-role only. No cron is installed here.
revoke all on function public.xora_reconcile_credit_change(uuid,text,integer,text,text,jsonb), public.xora_begin_real(uuid,text,text,text,jsonb), public.xora_complete_real(uuid,text,jsonb), public.xora_fail_real(uuid,text,text), public.xora_recover_real() from public, anon, authenticated;
grant execute on function public.xora_reconcile_credit_change(uuid,text,integer,text,text,jsonb), public.xora_begin_real(uuid,text,text,text,jsonb), public.xora_complete_real(uuid,text,jsonb), public.xora_fail_real(uuid,text,text), public.xora_recover_real() to service_role;
revoke all on function public.xora_block_browser_real_analysis() from public, anon, authenticated;
grant execute on function public.xora_block_browser_real_analysis() to service_role;
revoke all on function public.xora_capture_referral(text) from public, anon;
grant execute on function public.xora_capture_referral(text) to authenticated, service_role;
