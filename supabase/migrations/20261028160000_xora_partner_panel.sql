-- XORA partner panel: revenue share for partners who bring buyers.
--
-- A partner is a row in affiliates (code + commission). Buyers who arrive through ?ref=<code> are
-- already attributed for 30 days (affiliate_attributions). This migration:
--   1. records a commission row for every completed purchase by an attributed buyer,
--   2. gives each partner a secret panel key, so they can see their own numbers without an account,
--   3. adds a service-only helper to create partners and a payout marker.
-- Partners never see who bought: only dates, packs, amounts and their commission.

alter table public.affiliates add column if not exists panel_key text;
update public.affiliates set panel_key = replace(gen_random_uuid()::text, '-', '') where panel_key is null;
alter table public.affiliates alter column panel_key set default replace(gen_random_uuid()::text, '-', '');
alter table public.affiliates alter column panel_key set not null;
create unique index if not exists affiliates_panel_key_idx on public.affiliates(panel_key);

create table if not exists public.affiliate_commissions (
  purchase_id uuid primary key references public.credit_purchases(id),
  referral_code text not null references public.affiliates(code),
  package_id text not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_amount numeric(10,2) not null check (commission_amount >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists affiliate_commissions_code_idx on public.affiliate_commissions(referral_code, created_at desc);
alter table public.affiliate_commissions enable row level security;
revoke all on table public.affiliate_commissions from anon, authenticated;
grant all on table public.affiliate_commissions to service_role;

-- When a purchase becomes completed, the buyer's live attribution (if any) earns the partner its
-- commission at the partner's current rate. Runs once per purchase (primary key).
create or replace function public.xora_record_affiliate_commission() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_code text; v_bps integer;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  select a.referral_code, f.commission_bps into v_code, v_bps
    from public.affiliate_attributions a join public.affiliates f on f.code = a.referral_code
    where a.user_id = new.user_id and a.expires_at > coalesce(new.completed_at, now()) and f.is_active;
  if v_code is null then return new; end if;
  insert into public.affiliate_commissions(purchase_id, referral_code, package_id, amount, currency, commission_bps, commission_amount)
    values (new.id, v_code, new.package_id, new.amount, new.currency, v_bps, round(new.amount * v_bps / 10000.0, 2))
    on conflict (purchase_id) do nothing;
  return new;
end $$;

drop trigger if exists xora_affiliate_commission on public.credit_purchases;
create trigger xora_affiliate_commission after update of status on public.credit_purchases
  for each row execute function public.xora_record_affiliate_commission();

-- Partner panel data, looked up by the secret panel key. Callable without signing in; returns
-- null for an unknown or inactive key. No buyer identities leave the database.
create or replace function public.xora_partner_panel(p_key text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v public.affiliates%rowtype;
begin
  if p_key is null or length(p_key) < 20 then return null; end if;
  select * into v from public.affiliates where panel_key = p_key and is_active;
  if not found then return null; end if;
  return jsonb_build_object(
    'code', v.code,
    'display_name', v.display_name,
    'commission_bps', v.commission_bps,
    'signups', (select count(*) from public.affiliate_attributions where referral_code = v.code),
    'buyers', (select count(distinct p.user_id) from public.affiliate_commissions c join public.credit_purchases p on p.id = c.purchase_id where c.referral_code = v.code),
    'totals', coalesce((select jsonb_agg(t order by t.currency) from (
        select currency, count(*) as sales, sum(amount) as revenue, sum(commission_amount) as commission,
               sum(commission_amount) filter (where paid_at is not null) as paid,
               sum(commission_amount) filter (where paid_at is null) as unpaid
          from public.affiliate_commissions where referral_code = v.code group by currency) t), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(r) from (
        select created_at, package_id, amount, currency, commission_amount, paid_at is not null as paid
          from public.affiliate_commissions where referral_code = v.code order by created_at desc limit 30) r), '[]'::jsonb)
  );
end $$;

-- Service-only: create (or update) a partner and return its referral code and panel key.
create or replace function public.xora_admin_upsert_affiliate(p_code text, p_display_name text, p_commission_bps integer default 2500)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.affiliates%rowtype;
begin
  insert into public.affiliates(code, display_name, commission_bps)
    values (lower(p_code), p_display_name, p_commission_bps)
    on conflict (code) do update set display_name = excluded.display_name, commission_bps = excluded.commission_bps, is_active = true
    returning * into v;
  return jsonb_build_object('code', v.code, 'commission_bps', v.commission_bps, 'panel_key', v.panel_key);
end $$;

-- Service-only: mark a partner's unpaid commissions in one currency as paid (after paying them).
create or replace function public.xora_admin_mark_commissions_paid(p_code text, p_currency text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_count integer; v_total numeric;
begin
  with u as (
    update public.affiliate_commissions set paid_at = now()
      where referral_code = lower(p_code) and currency = upper(p_currency) and paid_at is null
      returning commission_amount)
  select count(*), coalesce(sum(commission_amount), 0) into v_count, v_total from u;
  return jsonb_build_object('code', lower(p_code), 'currency', upper(p_currency), 'marked', v_count, 'total', v_total);
end $$;

revoke all on function public.xora_record_affiliate_commission() from public, anon, authenticated;
revoke all on function public.xora_partner_panel(text) from public;
grant execute on function public.xora_partner_panel(text) to anon, authenticated, service_role;
revoke all on function public.xora_admin_upsert_affiliate(text, text, integer) from public, anon, authenticated;
grant execute on function public.xora_admin_upsert_affiliate(text, text, integer) to service_role;
revoke all on function public.xora_admin_mark_commissions_paid(text, text) from public, anon, authenticated;
grant execute on function public.xora_admin_mark_commissions_paid(text, text) to service_role;
