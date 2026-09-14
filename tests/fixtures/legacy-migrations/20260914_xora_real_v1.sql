-- XORA Real V1 infrastructure. Additive/idempotent: does not rewrite existing analyses schema.

create table if not exists public.x_cache (
  x_user_id text primary key,
  username text not null,
  profile jsonb not null default '{}'::jsonb,
  posts jsonb not null default '[]'::jsonb,
  schema_version integer not null default 1,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists x_cache_username_idx on public.x_cache (lower(username));
alter table public.x_cache enable row level security;
revoke all on public.x_cache from anon, authenticated;

create table if not exists public.credit_transactions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Existing installations may have the documented reason/related_analysis_id ledger.
alter table public.credit_transactions add column if not exists type text;
alter table public.credit_transactions add column if not exists balance_after integer;
alter table public.credit_transactions add column if not exists reference text;
alter table public.credit_transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
update public.credit_transactions c set type=coalesce(c.type,to_jsonb(c)->>'reason');
create or replace function public.xora_ledger_compat() returns trigger
language plpgsql set search_path=public as $$
begin
  new=jsonb_populate_record(new,jsonb_build_object('reason',coalesce(new.type,'manual_adjustment')));
  return new;
end $$;
drop trigger if exists xora_ledger_compat on public.credit_transactions;
create trigger xora_ledger_compat before insert on public.credit_transactions for each row execute function public.xora_ledger_compat();
create index if not exists credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);
create unique index if not exists credit_transactions_user_reference_uidx
on public.credit_transactions (user_id, reference)
where reference is not null;
alter table public.credit_transactions enable row level security;
grant select on public.credit_transactions to authenticated;
drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
create policy "Users can read own credit transactions"
on public.credit_transactions for select
using (auth.uid() = user_id);
revoke insert, update, delete on public.credit_transactions from anon, authenticated;

create table if not exists public.affiliates (
  code text primary key check (code = lower(code) and code ~ '^[a-z0-9_-]{2,64}$'),
  display_name text,
  commission_bps integer not null default 2500 check (commission_bps between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.affiliates enable row level security;
revoke all on public.affiliates from anon, authenticated;

create table if not exists public.affiliate_attributions (
  user_id uuid primary key references public.users(id) on delete cascade,
  referral_code text not null references public.affiliates(code),
  first_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.affiliate_attributions enable row level security;
revoke all on public.affiliate_attributions from anon, authenticated;

create or replace function public.xora_apply_credit_change(
  p_user_id uuid,
  p_type text,
  p_amount integer,
  p_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_existing integer;
begin
  if p_user_id is null or p_amount = 0 then
    raise exception 'invalid_credit_change';
  end if;

  if p_reference is not null then
    select balance_after into v_existing
    from public.credit_transactions
    where user_id = p_user_id and reference = p_reference
    limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  select coalesce(credit_balance, 0) into v_balance
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  if v_balance + p_amount < 0 then
    raise exception 'insufficient_credits';
  end if;

  v_balance := v_balance + p_amount;
  update public.users set credit_balance = v_balance where id = p_user_id;

  insert into public.credit_transactions(user_id, type, amount, balance_after, reference, metadata)
  values (p_user_id, coalesce(nullif(p_type, ''), 'adjustment'), p_amount, v_balance, p_reference, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

revoke all on function public.xora_apply_credit_change(uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.xora_apply_credit_change(uuid, text, integer, text, jsonb) to service_role;
