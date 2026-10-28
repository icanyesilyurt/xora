-- XORA owner dashboard. The site counts anonymous page visits and free Fun cards in
-- xora_site_events (a random per-browser id, no personal data), and xora_admin_stats() returns
-- every headline number for admin.html: visitors, sign-ups, cards, sales, credits and partners.

create table if not exists public.xora_site_events (
  id bigserial primary key,
  day date not null default (now() at time zone 'Europe/Istanbul')::date,
  created_at timestamptz not null default now(),
  visitor text not null check (visitor ~ '^[a-z0-9]{12,40}$'),
  kind text not null check (kind in ('visit', 'fun_card')),
  path text not null check (path ~ '^[a-z]{2,20}$'),
  lang text check (lang is null or lang ~ '^[a-z]{2}$'),
  ref text check (ref is null or ref ~ '^[a-z0-9_-]{2,64}$')
);
-- A page counts once per browser per day; reloads do not inflate visits.
create unique index if not exists xora_site_events_visit_once
  on public.xora_site_events(day, visitor, path) where kind = 'visit';
create index if not exists xora_site_events_day on public.xora_site_events(day, kind);
alter table public.xora_site_events enable row level security;
revoke all on table public.xora_site_events from anon, authenticated;
grant all on table public.xora_site_events to service_role;

create or replace function public.xora_track(p_visitor text, p_kind text, p_path text, p_lang text default null, p_ref text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_day date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if p_visitor is null or p_visitor !~ '^[a-z0-9]{12,40}$' then return; end if;
  if p_kind not in ('visit', 'fun_card') then return; end if;
  if p_path is null or p_path not in ('home', 'mirror', 'stalk', 'match', 'credits', 'profile', 'auth', 'legal', 'card') then return; end if;
  -- A runaway or scripted browser cannot flood the table.
  if (select count(*) from public.xora_site_events where day = v_day and visitor = p_visitor) >= 300 then return; end if;
  insert into public.xora_site_events(day, visitor, kind, path, lang, ref)
  values (v_day, p_visitor, p_kind, p_path,
          case when p_lang ~ '^[a-z]{2}$' then p_lang end,
          case when lower(p_ref) ~ '^[a-z0-9_-]{2,64}$' then lower(p_ref) end)
  on conflict do nothing;
end $$;
revoke all on function public.xora_track(text, text, text, text, text) from public;
grant execute on function public.xora_track(text, text, text, text, text) to anon, authenticated;

-- Headline numbers for the last p_days days (0 = all time), plus a 14-day daily table.
create or replace function public.xora_admin_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_from timestamptz;
  v_day_from date;
  v_shared bigint := null;
  v jsonb;
begin
  perform public.xora_require_admin();
  if p_days is null or p_days <= 0 then
    v_from := '-infinity'; v_day_from := '-infinity';
  else
    v_day_from := (now() at time zone 'Europe/Istanbul')::date - (p_days - 1);
    v_from := v_day_from::timestamp at time zone 'Europe/Istanbul';
  end if;

  -- Shared card images live in Storage, which only exists on the hosted project.
  if to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects where bucket_id = ''cards'' and name like ''%.jpg'' and created_at >= $1'
      into v_shared using v_from;
  end if;

  select jsonb_build_object(
    'days', coalesce(p_days, 0),
    'visitors', (select count(distinct visitor) from public.xora_site_events where kind = 'visit' and day >= v_day_from),
    'page_views', (select count(*) from public.xora_site_events where kind = 'visit' and day >= v_day_from),
    'ref_visitors', (select count(distinct visitor) from public.xora_site_events where kind = 'visit' and ref is not null and day >= v_day_from),
    'signups', (select count(*) from public.users where created_at >= v_from),
    'users_total', (select count(*) from public.users),
    'fun_cards', (select count(*) from public.xora_site_events where kind = 'fun_card' and day >= v_day_from),
    'real_cards', (select count(*) from public.real_requests where status = 'succeeded' and created_at >= v_from),
    'real_failed', (select count(*) from public.real_requests where status = 'failed' and created_at >= v_from),
    'real_by_mode', coalesce((select jsonb_object_agg(mode, n) from (
        select mode, count(*) n from public.real_requests where status = 'succeeded' and created_at >= v_from group by mode) m), '{}'::jsonb),
    'shared_cards', v_shared,
    'sales', (select count(*) from public.credit_purchases where status = 'completed' and completed_at >= v_from),
    'buyers', (select count(distinct user_id) from public.credit_purchases where status = 'completed' and completed_at >= v_from),
    'revenue', coalesce((select jsonb_object_agg(currency, total) from (
        select currency, sum(amount) total from public.credit_purchases where status = 'completed' and completed_at >= v_from group by currency) r), '{}'::jsonb),
    'credits_sold', (select coalesce(sum(credits), 0) from public.credit_purchases where status = 'completed' and completed_at >= v_from),
    'checkouts_open', (select count(*) from public.credit_purchases where status = 'pending' and created_at >= v_from),
    'checkouts_failed', (select count(*) from public.credit_purchases where status = 'failed' and created_at >= v_from),
    'credits_spent', (select coalesce(-sum(amount), 0) from public.credit_transactions where amount < 0 and created_at >= v_from),
    'credits_refunded', (select coalesce(sum(amount), 0) from public.credit_transactions where type = 'refund' and created_at >= v_from),
    'credits_outstanding', (select coalesce(sum(credit_balance), 0) from public.users),
    'commission_unpaid', coalesce((select jsonb_object_agg(currency, total) from (
        select currency, sum(commission_amount) total from public.affiliate_commissions where paid_at is null group by currency) c), '{}'::jsonb),
    'partners_active', (select count(*) from public.affiliates where is_active),
    'daily', coalesce((select jsonb_agg(d order by d.day desc) from (
        select g.day::date as day,
          (select count(distinct visitor) from public.xora_site_events e where e.kind = 'visit' and e.day = g.day::date) as visitors,
          (select count(*) from public.users u where (u.created_at at time zone 'Europe/Istanbul')::date = g.day::date) as signups,
          (select count(*) from public.xora_site_events e where e.kind = 'fun_card' and e.day = g.day::date) as fun_cards,
          (select count(*) from public.real_requests r where r.status = 'succeeded' and (r.created_at at time zone 'Europe/Istanbul')::date = g.day::date) as real_cards,
          (select count(*) from public.credit_purchases p where p.status = 'completed' and (p.completed_at at time zone 'Europe/Istanbul')::date = g.day::date) as sales
        from generate_series((now() at time zone 'Europe/Istanbul')::date - 13, (now() at time zone 'Europe/Istanbul')::date, interval '1 day') g(day)) d), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.xora_admin_stats(integer) from public;
grant execute on function public.xora_admin_stats(integer) to authenticated, service_role;
