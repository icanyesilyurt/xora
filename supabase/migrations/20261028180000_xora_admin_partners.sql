-- XORA admin page for partners. The site owner signs in to XORA as usual; admin.html then lets
-- them create partners, copy each partner's share link and secret panel link, see every partner's
-- numbers, mark commissions paid, pause a partner and replace a leaked panel link.
-- Every admin function checks the caller against xora_admins (or runs as service_role).

create table if not exists public.xora_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.xora_admins enable row level security;
revoke all on table public.xora_admins from anon, authenticated;
grant all on table public.xora_admins to service_role;

-- The site owner's account becomes the first admin (when the auth schema has emails).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email') then
    execute $q$insert into public.xora_admins(user_id)
      select id from auth.users where lower(email) = 'yesilyurtizzetcan@gmail.com'
      on conflict do nothing$q$;
  end if;
end $$;

create or replace function public.xora_is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(current_setting('role', true) = 'service_role', false)
      or exists (select 1 from public.xora_admins where user_id = auth.uid())
$$;

create or replace function public.xora_require_admin() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.xora_is_admin() then raise exception 'not_admin'; end if;
end $$;

-- Every partner with its links' keys and numbers, newest first.
create or replace function public.xora_admin_partners() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.xora_require_admin();
  return coalesce((select jsonb_agg(p order by p.created_at desc) from (
    select f.code, f.display_name, f.commission_bps, f.is_active, f.panel_key, f.created_at,
      (select count(*) from public.affiliate_attributions a where a.referral_code = f.code) as signups,
      (select count(*) from public.affiliate_commissions c where c.referral_code = f.code) as sales,
      coalesce((select jsonb_agg(t order by t.currency) from (
          select currency, sum(amount) as revenue, sum(commission_amount) as commission,
                 coalesce(sum(commission_amount) filter (where paid_at is null), 0) as unpaid
            from public.affiliate_commissions c where c.referral_code = f.code group by currency) t), '[]'::jsonb) as totals
    from public.affiliates f) p), '[]'::jsonb);
end $$;

-- Create a partner, or update name / rate / active state of an existing one.
create or replace function public.xora_admin_save_partner(p_code text, p_display_name text, p_commission_bps integer, p_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.affiliates%rowtype; v_code text := lower(trim(coalesce(p_code, '')));
begin
  perform public.xora_require_admin();
  if v_code !~ '^[a-z0-9_-]{2,64}$' then raise exception 'bad_code'; end if;
  if p_commission_bps is null or p_commission_bps < 0 or p_commission_bps > 10000 then raise exception 'bad_commission'; end if;
  insert into public.affiliates(code, display_name, commission_bps, is_active)
    values (v_code, nullif(trim(coalesce(p_display_name, '')), ''), p_commission_bps, coalesce(p_is_active, true))
    on conflict (code) do update set display_name = excluded.display_name, commission_bps = excluded.commission_bps, is_active = excluded.is_active
    returning * into v;
  return jsonb_build_object('code', v.code, 'display_name', v.display_name, 'commission_bps', v.commission_bps, 'is_active', v.is_active, 'panel_key', v.panel_key);
end $$;

-- Replace a partner's secret panel key (the old panel link stops working).
create or replace function public.xora_admin_rotate_panel_key(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_key text;
begin
  perform public.xora_require_admin();
  update public.affiliates set panel_key = replace(gen_random_uuid()::text, '-', '') where code = lower(p_code) returning panel_key into v_key;
  if v_key is null then raise exception 'partner_not_found'; end if;
  return jsonb_build_object('code', lower(p_code), 'panel_key', v_key);
end $$;

-- The service-only helpers from the partner panel migration now also accept a signed-in admin.
create or replace function public.xora_admin_mark_commissions_paid(p_code text, p_currency text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_count integer; v_total numeric;
begin
  perform public.xora_require_admin();
  with u as (
    update public.affiliate_commissions set paid_at = now()
      where referral_code = lower(p_code) and currency = upper(p_currency) and paid_at is null
      returning commission_amount)
  select count(*), coalesce(sum(commission_amount), 0) into v_count, v_total from u;
  return jsonb_build_object('code', lower(p_code), 'currency', upper(p_currency), 'marked', v_count, 'total', v_total);
end $$;

revoke all on function public.xora_is_admin() from public, anon;
grant execute on function public.xora_is_admin() to authenticated, service_role;
revoke all on function public.xora_require_admin() from public, anon, authenticated;
grant execute on function public.xora_require_admin() to service_role;
revoke all on function public.xora_admin_partners() from public, anon;
grant execute on function public.xora_admin_partners() to authenticated, service_role;
revoke all on function public.xora_admin_save_partner(text, text, integer, boolean) from public, anon;
grant execute on function public.xora_admin_save_partner(text, text, integer, boolean) to authenticated, service_role;
revoke all on function public.xora_admin_rotate_panel_key(text) from public, anon;
grant execute on function public.xora_admin_rotate_panel_key(text) to authenticated, service_role;
revoke all on function public.xora_admin_mark_commissions_paid(text, text) from public, anon;
grant execute on function public.xora_admin_mark_commissions_paid(text, text) to authenticated, service_role;
