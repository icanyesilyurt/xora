-- Partner sales are decided when the payment starts, not when iyzico calls back.
--
-- Before: the commission trigger looked up the buyer's attribution at completion time, and the
-- attribution only existed if the browser that clicked the partner link had synced it to the
-- account before paying. Purchases made before that sync (or in another browser) earned nothing,
-- and an expired attribution could be replaced by a later link.
--
-- Now:
--   * First touch is permanent: once an account has a partner, no later link replaces it.
--   * A partner can be tied to the partner's own XORA account (owner_user_id); that account can
--     never be attributed to its own link, so self-purchases never earn commission.
--   * xora_begin_credit_purchase takes the partner code the browser still remembers (and the one
--     saved with the account at sign-up), claims it first-touch, and stamps the purchase row with
--     the partner. The iyzico callback never needs a cookie: the trigger reads the purchase row.

alter table public.affiliates add column if not exists owner_user_id uuid references public.users(id) on delete set null;
alter table public.credit_purchases add column if not exists referral_code text;

-- One rule for every way an account gets a partner. Returns the attribution row, or null.
create or replace function public.xora_attribute_first_touch(p_user_id uuid, p_code text, p_source text)
returns public.affiliate_attributions
language plpgsql security definer set search_path = public as $$
declare
  v public.affiliate_attributions%rowtype;
  v_code text := lower(nullif(trim(coalesce(p_code, '')), ''));
begin
  if p_user_id is null then return null; end if;
  select * into v from public.affiliate_attributions where user_id = p_user_id;
  if found then return v; end if;                      -- first touch never changes
  if v_code is null or v_code !~ '^[a-z0-9_-]{2,64}$' then return null; end if;
  if not exists (select 1 from public.affiliates
                  where code = v_code and is_active
                    and owner_user_id is distinct from p_user_id) then return null; end if;
  insert into public.affiliate_attributions(user_id, referral_code, first_seen_at, expires_at, metadata)
    values (p_user_id, v_code, now(), now() + interval '30 days', jsonb_build_object('source', p_source))
    on conflict (user_id) do nothing;
  select * into v from public.affiliate_attributions where user_id = p_user_id;
  return v;
end $$;

create or replace function public.xora_capture_referral(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.affiliate_attributions%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform 1 from public.users where id = auth.uid() for update;
  if not found then raise exception 'user_not_found'; end if;
  v := public.xora_attribute_first_touch(auth.uid(), p_code, 'authenticated_first_touch');
  if v.user_id is null or v.expires_at <= now() then return null; end if;
  return to_jsonb(v);
end $$;

create or replace function public.xora_claim_referral(p_user_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.affiliate_attributions%rowtype;
begin
  perform 1 from public.users where id = p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  v := public.xora_attribute_first_touch(p_user_id, p_code, 'real_analysis');
  if v.user_id is null or v.expires_at <= now()
     or not exists (select 1 from public.affiliates where code = v.referral_code and is_active) then return null; end if;
  return to_jsonb(v);
end $$;

-- The partner a purchase belongs to: the buyer's active, unexpired attribution to an active
-- partner that is not the buyer's own.
create or replace function public.xora_purchase_partner(p_user_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select a.referral_code
    from public.affiliate_attributions a
    join public.affiliates f on f.code = a.referral_code
   where a.user_id = p_user_id and a.expires_at > now() and f.is_active
     and f.owner_user_id is distinct from p_user_id
$$;

drop function if exists public.xora_begin_credit_purchase(uuid, text);
create function public.xora_begin_credit_purchase(p_user_id uuid, p_package_id text, p_referral_code text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pkg record; v_id uuid; v_recent integer; v_ref text;
begin
  if p_user_id is null then raise exception 'unauthorized'; end if;
  select * into v_pkg from public.xora_credit_package(p_package_id);
  if not found then raise exception 'unknown_package'; end if;
  perform 1 from public.users where id = p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select count(*) into v_recent from public.credit_purchases
    where user_id = p_user_id and status = 'pending' and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then raise exception 'too_many_pending'; end if;
  perform public.xora_attribute_first_touch(p_user_id, p_referral_code, 'checkout');
  v_ref := public.xora_purchase_partner(p_user_id);
  insert into public.credit_purchases(user_id, package_id, credits, amount, currency, referral_code)
    values (p_user_id, v_pkg.package_id, v_pkg.credits, v_pkg.amount, v_pkg.currency, v_ref)
    returning id into v_id;
  return jsonb_build_object('purchase_id', v_id, 'package_id', v_pkg.package_id,
    'credits', v_pkg.credits, 'amount', v_pkg.amount, 'currency', v_pkg.currency);
end $$;

-- Commission from the partner stamped on the purchase row when the payment started.
create or replace function public.xora_record_affiliate_commission()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bps integer;
begin
  if new.status <> 'completed' or old.status = 'completed' or new.referral_code is null then return new; end if;
  select f.commission_bps into v_bps from public.affiliates f
   where f.code = new.referral_code and f.owner_user_id is distinct from new.user_id;
  if v_bps is null then return new; end if;
  insert into public.affiliate_commissions(purchase_id, referral_code, package_id, amount, currency, commission_bps, commission_amount)
    values (new.id, new.referral_code, new.package_id, new.amount, new.currency, v_bps, round(new.amount * v_bps / 10000.0, 2))
    on conflict (purchase_id) do nothing;
  return new;
end $$;

-- Admin: a partner can be tied to the partner's own XORA account by e-mail, so the partner's own
-- purchases never count. Leaving the e-mail empty keeps the current link.
drop function if exists public.xora_admin_save_partner(text, text, integer, boolean);
create function public.xora_admin_save_partner(p_code text, p_display_name text, p_commission_bps integer,
  p_is_active boolean default true, p_owner_email text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.affiliates%rowtype; v_code text := lower(trim(coalesce(p_code, ''))); v_owner uuid;
  v_email text := lower(nullif(trim(coalesce(p_owner_email, '')), ''));
begin
  perform public.xora_require_admin();
  if v_code !~ '^[a-z0-9_-]{2,64}$' then raise exception 'bad_code'; end if;
  if p_commission_bps is null or p_commission_bps < 0 or p_commission_bps > 10000 then raise exception 'bad_commission'; end if;
  if v_email is not null then
    select u.id into v_owner from auth.users u join public.users p on p.id = u.id where lower(u.email) = v_email;
    if v_owner is null then raise exception 'owner_not_found'; end if;
  end if;
  insert into public.affiliates(code, display_name, commission_bps, is_active, owner_user_id)
    values (v_code, nullif(trim(coalesce(p_display_name, '')), ''), p_commission_bps, coalesce(p_is_active, true), v_owner)
    on conflict (code) do update set display_name = excluded.display_name, commission_bps = excluded.commission_bps,
      is_active = excluded.is_active, owner_user_id = coalesce(excluded.owner_user_id, public.affiliates.owner_user_id)
    returning * into v;
  return jsonb_build_object('code', v.code, 'display_name', v.display_name, 'commission_bps', v.commission_bps,
    'is_active', v.is_active, 'panel_key', v.panel_key, 'has_owner', v.owner_user_id is not null);
end $$;

create or replace function public.xora_admin_partners()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.xora_require_admin();
  return coalesce((select jsonb_agg(p order by p.created_at desc) from (
    select f.code, f.display_name, f.commission_bps, f.is_active, f.panel_key, f.created_at,
      f.owner_user_id is not null as has_owner,
      (select count(*) from public.affiliate_attributions a where a.referral_code = f.code) as signups,
      (select count(*) from public.affiliate_commissions c where c.referral_code = f.code) as sales,
      coalesce((select jsonb_agg(t order by t.currency) from (
          select currency, sum(amount) as revenue, sum(commission_amount) as commission,
                 coalesce(sum(commission_amount) filter (where paid_at is null), 0) as unpaid
            from public.affiliate_commissions c where c.referral_code = f.code group by currency) t), '[]'::jsonb) as totals
    from public.affiliates f) p), '[]'::jsonb);
end $$;

revoke all on function public.xora_attribute_first_touch(uuid, text, text), public.xora_purchase_partner(uuid),
  public.xora_begin_credit_purchase(uuid, text, text) from public, anon, authenticated;
grant execute on function public.xora_attribute_first_touch(uuid, text, text), public.xora_purchase_partner(uuid),
  public.xora_begin_credit_purchase(uuid, text, text) to service_role;
revoke all on function public.xora_capture_referral(text) from public, anon;
grant execute on function public.xora_capture_referral(text) to authenticated, service_role;
revoke all on function public.xora_claim_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.xora_claim_referral(uuid, text) to service_role;
revoke all on function public.xora_record_affiliate_commission() from public, anon, authenticated;
revoke all on function public.xora_admin_save_partner(text, text, integer, boolean, text) from public, anon;
grant execute on function public.xora_admin_save_partner(text, text, integer, boolean, text) to authenticated, service_role;
revoke all on function public.xora_admin_partners() from public, anon;
grant execute on function public.xora_admin_partners() to authenticated, service_role;
