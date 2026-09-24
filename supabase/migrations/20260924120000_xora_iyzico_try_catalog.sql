-- XORA: make TRY the authoritative catalog for all new iyzico credit purchases.
-- Existing purchase rows remain unchanged so in-flight and historical payments retain their
-- original amount and currency for callback verification.

create or replace function public.xora_credit_package(p_package_id text)
returns table(package_id text, credits integer, amount numeric(10,2), currency text)
language sql immutable set search_path=public as $$
  select c.package_id, c.credits, c.amount, c.currency from (values
    ('starter', 10, 149.00::numeric(10,2), 'TRY'),
    ('popular', 20, 299.00::numeric(10,2), 'TRY'),
    ('value', 50, 749.00::numeric(10,2), 'TRY'),
    ('professional', 300, 4499.00::numeric(10,2), 'TRY')
  ) as c(package_id, credits, amount, currency)
  where c.package_id = p_package_id
$$;

revoke all on function public.xora_credit_package(text) from public, anon, authenticated;
grant execute on function public.xora_credit_package(text) to service_role;
