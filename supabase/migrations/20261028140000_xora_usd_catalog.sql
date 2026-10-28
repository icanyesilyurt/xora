-- XORA: credits are sold in US dollars outside Turkey (iyzico multi-currency is enabled).
-- TRY packs keep their ids and prices; USD packs are separate ids so every purchase row records
-- exactly one currency and callbacks are verified against it.

create or replace function public.xora_credit_package(p_package_id text)
returns table(package_id text, credits integer, amount numeric(10,2), currency text)
language sql immutable set search_path=public as $$
  select c.package_id, c.credits, c.amount, c.currency from (values
    ('starter', 10, 149.00::numeric(10,2), 'TRY'),
    ('popular', 20, 279.00::numeric(10,2), 'TRY'),
    ('value', 50, 599.00::numeric(10,2), 'TRY'),
    ('professional', 300, 2999.00::numeric(10,2), 'TRY'),
    ('starter_usd', 10, 3.99::numeric(10,2), 'USD'),
    ('popular_usd', 20, 7.49::numeric(10,2), 'USD'),
    ('value_usd', 50, 14.99::numeric(10,2), 'USD'),
    ('professional_usd', 300, 79.99::numeric(10,2), 'USD')
  ) as c(package_id, credits, amount, currency)
  where c.package_id = p_package_id
$$;

revoke all on function public.xora_credit_package(text) from public, anon, authenticated;
grant execute on function public.xora_credit_package(text) to service_role;
