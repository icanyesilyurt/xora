-- XORA: credit purchases through iyzico Checkout Form.
-- PREPARE ONLY: forward-only and additive; not applied to any project by the task that added it.
--
-- Money flow: the browser sends only a package id. Price, currency and credits come from the
-- catalog below. A purchase is credited only after the edge function has retrieved the payment
-- from iyzico and this database has re-checked package, amount and currency, inside one
-- transaction, through the existing idempotent ledger helper.

-- Server-side package catalog: the single source of truth for what each package costs and grants.
create or replace function public.xora_credit_package(p_package_id text)
returns table(package_id text, credits integer, amount numeric(10,2), currency text)
language sql immutable set search_path=public as $$
  select c.package_id, c.credits, c.amount, c.currency from (values
    ('starter', 10, 2.99::numeric(10,2), 'USD'),
    ('popular', 20, 5.99::numeric(10,2), 'USD'),
    ('value', 50, 14.99::numeric(10,2), 'USD'),
    ('professional', 300, 89.99::numeric(10,2), 'USD')
  ) as c(package_id, credits, amount, currency)
  where c.package_id = p_package_id
$$;

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  package_id text not null,
  credits integer not null check (credits > 0),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_token text unique,
  provider_payment_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed') = (provider_payment_id is not null and completed_at is not null))
);
create index if not exists credit_purchases_user_created_idx on public.credit_purchases(user_id, created_at desc);

-- Users can read their own purchases (to show the result); nobody but the service writes them.
alter table public.credit_purchases enable row level security;
revoke all on table public.credit_purchases from anon, authenticated;
grant select on table public.credit_purchases to authenticated;
drop policy if exists "xora_credit_purchases_select_own" on public.credit_purchases;
create policy "xora_credit_purchases_select_own" on public.credit_purchases
  for select to authenticated using (user_id = auth.uid());
grant all on table public.credit_purchases to service_role;

-- Opens a pending purchase for one catalog package. Nothing about price comes from the caller.
create or replace function public.xora_begin_credit_purchase(p_user_id uuid, p_package_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_pkg record; v_id uuid; v_recent integer;
begin
  if p_user_id is null then raise exception 'unauthorized'; end if;
  select * into v_pkg from public.xora_credit_package(p_package_id);
  if not found then raise exception 'unknown_package'; end if;
  perform 1 from public.users where id = p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select count(*) into v_recent from public.credit_purchases
    where user_id = p_user_id and status = 'pending' and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then raise exception 'too_many_pending'; end if;
  insert into public.credit_purchases(user_id, package_id, credits, amount, currency)
    values (p_user_id, v_pkg.package_id, v_pkg.credits, v_pkg.amount, v_pkg.currency)
    returning id into v_id;
  return jsonb_build_object('purchase_id', v_id, 'package_id', v_pkg.package_id,
    'credits', v_pkg.credits, 'amount', v_pkg.amount, 'currency', v_pkg.currency);
end $$;

-- Binds the iyzico checkout token to its purchase, once.
create or replace function public.xora_attach_credit_purchase_token(p_purchase_id uuid, p_token text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_token is null or length(p_token) < 8 then raise exception 'invalid_token'; end if;
  update public.credit_purchases set provider_token = p_token
    where id = p_purchase_id and status = 'pending' and provider_token is null;
  if not found then raise exception 'purchase_not_pending'; end if;
end $$;

-- Credits a verified payment exactly once. The values passed in are what iyzico reported; they
-- must match the purchase row, otherwise the purchase fails and no credits are added.
create or replace function public.xora_complete_credit_purchase(
  p_purchase_id uuid, p_token text, p_provider_payment_id text,
  p_package_id text, p_amount numeric, p_currency text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.credit_purchases%rowtype; v_balance integer;
begin
  select * into v from public.credit_purchases where id = p_purchase_id for update;
  if not found then raise exception 'purchase_not_found'; end if;
  if v.provider_token is null or p_token is distinct from v.provider_token then raise exception 'token_mismatch'; end if;
  if v.status = 'completed' then
    return jsonb_build_object('status', 'completed', 'purchase_id', v.id, 'credits', v.credits, 'credited', false);
  end if;
  if v.status <> 'pending' then raise exception 'purchase_not_pending'; end if;
  if p_provider_payment_id is null or p_provider_payment_id = '' then raise exception 'invalid_payment_id'; end if;
  if p_package_id is distinct from v.package_id
     or p_amount is null or round(p_amount, 2) <> v.amount
     or upper(coalesce(p_currency, '')) <> v.currency then
    update public.credit_purchases set status = 'failed', failure_reason = 'payment_mismatch' where id = v.id;
    return jsonb_build_object('status', 'failed', 'reason', 'payment_mismatch', 'purchase_id', v.id, 'credited', false);
  end if;
  -- provider_payment_id is unique: one iyzico payment can never complete two purchases.
  update public.credit_purchases
    set status = 'completed', provider_payment_id = p_provider_payment_id, completed_at = now()
    where id = v.id;
  v_balance := public.xora_reconcile_credit_change(
    v.user_id, 'purchase', v.credits, 'iyzico:' || p_provider_payment_id, 'iyzico:' || v.id::text,
    jsonb_build_object('provider', 'iyzico', 'purchase_id', v.id, 'package_id', v.package_id,
      'amount', v.amount, 'currency', v.currency));
  return jsonb_build_object('status', 'completed', 'purchase_id', v.id, 'credits', v.credits,
    'balance', v_balance, 'credited', true);
end $$;

-- Marks a still-pending purchase as failed. Completed purchases are never touched.
create or replace function public.xora_fail_credit_purchase(p_purchase_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  update public.credit_purchases
    set status = 'failed', failure_reason = left(coalesce(nullif(p_reason, ''), 'failed'), 80)
    where id = p_purchase_id and status = 'pending'
    returning status into v_status;
  if v_status is null then
    select status into v_status from public.credit_purchases where id = p_purchase_id;
  end if;
  return jsonb_build_object('status', coalesce(v_status, 'not_found'), 'purchase_id', p_purchase_id);
end $$;

revoke all on function public.xora_credit_package(text),
  public.xora_begin_credit_purchase(uuid, text),
  public.xora_attach_credit_purchase_token(uuid, text),
  public.xora_complete_credit_purchase(uuid, text, text, text, numeric, text),
  public.xora_fail_credit_purchase(uuid, text)
  from public, anon, authenticated;
grant execute on function public.xora_credit_package(text),
  public.xora_begin_credit_purchase(uuid, text),
  public.xora_attach_credit_purchase_token(uuid, text),
  public.xora_complete_credit_purchase(uuid, text, text, text, numeric, text),
  public.xora_fail_credit_purchase(uuid, text)
  to service_role;
