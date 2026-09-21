-- XORA creator referral pilot: commission on verified credit purchases. Forward-only.
-- Depends on 20260919120000 (credit_purchases) and 20260921120000 (referral pilot).
--
-- A commission is written only inside xora_complete_credit_purchase, i.e. after the edge function
-- retrieved the payment from iyzico and the database matched package, amount and currency.
-- The amount is the verified purchase amount times the creator's rate, computed here, once per
-- purchase (unique purchase_id). Failed purchases never reach it. Refunds and chargebacks are
-- recorded by voiding the commission (xora_void_affiliate_commission); void rows are not owed.

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.credit_purchases(id),
  user_id uuid not null references public.users(id),
  referral_code text not null references public.affiliates(code),
  purchase_amount numeric(10,2) not null check (purchase_amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_amount numeric(10,2) not null check (commission_amount >= 0),
  status text not null default 'owed' check (status in ('owed', 'void')),
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'void') = (voided_at is not null))
);
create index if not exists affiliate_commissions_code_idx on public.affiliate_commissions(referral_code, created_at desc);
alter table public.affiliate_commissions enable row level security;
revoke all on table public.affiliate_commissions from anon, authenticated;
grant all on table public.affiliate_commissions to service_role;

-- Records the commission for one completed purchase, if its buyer is attributed to an active
-- creator and the purchase falls inside the 12-month window. Idempotent.
create or replace function public.xora_record_affiliate_commission(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare p public.credit_purchases%rowtype; v_code text; v_bps integer; v public.affiliate_commissions%rowtype;
begin
  select * into p from public.credit_purchases where id=p_purchase_id;
  if not found or p.status <> 'completed' or p.completed_at is null then return null; end if;

  select a.referral_code, f.commission_bps into v_code, v_bps
  from public.affiliate_attributions a
  join public.affiliates f on f.code = a.referral_code
  where a.user_id = p.user_id
    and f.is_active
    and f.owner_user_id is distinct from p.user_id
    and p.completed_at >= a.first_seen_at
    and p.completed_at < a.first_seen_at + interval '12 months';
  if not found then return null; end if;

  insert into public.affiliate_commissions(purchase_id,user_id,referral_code,purchase_amount,currency,commission_bps,commission_amount)
  values (p.id, p.user_id, v_code, p.amount, p.currency, v_bps, round(p.amount * v_bps / 10000.0, 2))
  on conflict (purchase_id) do nothing;

  select * into v from public.affiliate_commissions where purchase_id = p.id;
  return to_jsonb(v);
end $$;

-- Same as 20260919120000, plus the commission in the same transaction as the credit.
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
  perform public.xora_record_affiliate_commission(v.id);
  return jsonb_build_object('status', 'completed', 'purchase_id', v.id, 'credits', v.credits,
    'balance', v_balance, 'credited', true);
end $$;

-- Refund or chargeback of a referred purchase: the commission stops being owed.
create or replace function public.xora_void_affiliate_commission(p_purchase_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v public.affiliate_commissions%rowtype;
begin
  if coalesce(p_reason,'') !~ '^(refund|chargeback|fraud|admin)' then raise exception 'invalid_void_reason'; end if;
  update public.affiliate_commissions set status='void', void_reason=left(p_reason,120), voided_at=now()
    where purchase_id=p_purchase_id and status='owed';
  select * into v from public.affiliate_commissions where purchase_id=p_purchase_id;
  if not found then return null; end if;
  return to_jsonb(v);
end $$;

revoke all on function public.xora_record_affiliate_commission(uuid),
  public.xora_complete_credit_purchase(uuid, text, text, text, numeric, text),
  public.xora_void_affiliate_commission(uuid, text)
  from public, anon, authenticated;
grant execute on function public.xora_record_affiliate_commission(uuid),
  public.xora_complete_credit_purchase(uuid, text, text, text, numeric, text),
  public.xora_void_affiliate_commission(uuid, text)
  to service_role;

-- Admin report, one row per creator code. Service role only (SQL editor / service key).
-- Page visits are not recorded by XORA; claimed_users counts accounts attributed to the code.
create or replace view public.xora_affiliate_report with (security_invoker = true) as
select
  f.code,
  f.display_name as handle,
  f.is_active,
  f.commission_bps,
  (select count(*) from public.affiliate_attributions a where a.referral_code = f.code) as claimed_users,
  (select count(*) from public.affiliate_attributions a where a.referral_code = f.code
     and coalesce((a.metadata->>'new_signup')::boolean, false)) as referred_signups,
  (select count(*) from public.affiliate_commissions c where c.referral_code = f.code and c.status = 'owed') as successful_purchases,
  (select coalesce(sum(c.purchase_amount), 0) from public.affiliate_commissions c where c.referral_code = f.code and c.status = 'owed') as collected_revenue_usd,
  (select coalesce(sum(c.commission_amount), 0) from public.affiliate_commissions c where c.referral_code = f.code and c.status = 'owed') as commission_owed_usd,
  (select count(*) from public.affiliate_commissions c where c.referral_code = f.code and c.status = 'void') as voided_purchases
from public.affiliates f;
revoke all on public.xora_affiliate_report from public, anon, authenticated;
grant select on public.xora_affiliate_report to service_role;
