# XORA — Supabase Production Schema

Project reference: `jafrxhkppvvchyjbkldd`

Bu dosya XORA'nın mevcut OAuth + profil + analiz geçmişi altyapısı için gereken
üretim şemasını içerir. OpenAI, X API tweet çekme, ödeme ve kredi harcama
mantığı bu aşamada eklenmez.

## SQL Editor'a Yapıştırılacak Final SQL

```sql
create extension if not exists pgcrypto;

do $$
begin
  create type public.xora_lang as enum ('tr', 'en');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.analysis_type as enum ('mirror', 'stalk', 'match');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.credit_reason as enum (
    'signup_bonus',
    'manual_adjustment',
    'mirror',
    'stalk',
    'match',
    'refund'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  x_user_id text unique,
  username text not null,
  display_name text,
  avatar_url text,
  lang public.xora_lang not null default 'tr',
  credit_balance integer not null default 10 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create index if not exists users_username_idx on public.users (username);
create index if not exists users_x_user_id_idx on public.users (x_user_id);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.analysis_type not null,
  target_username text not null,
  target_username_2 text,
  result_title text,
  result_subtitle text,
  result_quote text,
  avatar_emoji text,
  metrics jsonb not null default '{}'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  language public.xora_lang not null default 'tr',
  cache_key text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint analyses_match_target_check check (
    (type = 'match' and target_username_2 is not null)
    or (type in ('mirror', 'stalk') and target_username_2 is null)
  )
);

create index if not exists analyses_user_created_idx
on public.analyses (user_id, created_at desc);

create index if not exists analyses_cache_key_idx
on public.analyses (cache_key);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason public.credit_reason not null,
  related_analysis_id uuid references public.analyses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_created_idx
on public.credit_transactions (user_id, created_at desc);

alter table public.users enable row level security;
alter table public.analyses enable row level security;
alter table public.credit_transactions enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.users to authenticated;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
on public.users for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- If the browser logs `permission denied for table users`, run the GRANT
-- statements above together with these RLS policies. The users payload used by
-- XORA matches this column structure:
-- id uuid primary key
-- x_user_id text
-- username varchar/text
-- display_name varchar/text
-- avatar_url text
-- lang char/enum
-- credit_balance integer
-- created_at timestamptz
-- last_login_at timestamptz

drop policy if exists "Users can read own analyses" on public.analyses;
create policy "Users can read own analyses"
on public.analyses for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own analyses" on public.analyses;
create policy "Users can insert own analyses"
on public.analyses for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
create policy "Users can read own credit transactions"
on public.credit_transactions for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own credit transactions" on public.credit_transactions;
create policy "Users can insert own credit transactions"
on public.credit_transactions for insert
with check (
  auth.uid() = user_id
  and (
    related_analysis_id is null
    or exists (
      select 1
      from public.analyses a
      where a.id = related_analysis_id
        and a.user_id = auth.uid()
    )
  )
);

create or replace function public.xora_seed_demo_analysis(
  p_type public.analysis_type default 'mirror',
  p_target_username text default 'demo'
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  if current_setting('app.xora_allow_seed', true) is distinct from 'on' then
    raise exception 'Seed helper is disabled';
  end if;

  insert into public.analyses (
    user_id,
    type,
    target_username,
    target_username_2,
    result_title,
    result_subtitle,
    result_quote,
    avatar_emoji,
    metrics,
    raw_result,
    language,
    cache_key,
    expires_at
  )
  values (
    auth.uid(),
    p_type,
    lower(regexp_replace(p_target_username, '^@+', '')),
    case when p_type = 'match' then 'demo2' else null end,
    'Demo Analysis',
    'Seed helper result',
    'This row is created only when app.xora_allow_seed is on.',
    '🪞',
    '{"viral": 50, "kaos": 40, "mizah": 60, "gece": 30}'::jsonb,
    '{"source": "seed_helper"}'::jsonb,
    'en',
    'seed:' || auth.uid() || ':' || p_type || ':' || lower(regexp_replace(p_target_username, '^@+', '')) || ':' || extract(epoch from now()),
    now() + interval '7 days'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.xora_seed_demo_analysis(public.analysis_type, text)
from public, anon, authenticated;
```

## RLS Özeti

- `users`: kullanıcı yalnızca kendi satırını okuyabilir, oluşturabilir ve güncelleyebilir.
- `analyses`: kullanıcı yalnızca kendi analiz kayıtlarını okuyabilir ve oluşturabilir.
- `credit_transactions`: kullanıcı yalnızca kendi kredi hareketlerini okuyabilir ve oluşturabilir.
- `credit_transactions.related_analysis_id` doluysa ilgili analiz de aynı kullanıcıya ait olmalıdır.

## Seed Helper

`public.xora_seed_demo_analysis()` otomatik çalışmaz. Varsayılan olarak kapalıdır.
Yalnızca test ortamında ilgili DB session için aşağıdaki ayar açılırsa çalışır:

```sql
select set_config('app.xora_allow_seed', 'on', true);
select public.xora_seed_demo_analysis('mirror', 'demo_user');
```

Production'da bu ayar verilmediği sürece fonksiyon hata verir ve veri üretmez.
Ayrıca `anon` ve `authenticated` rollerinden execute yetkisi geri alınmıştır.
