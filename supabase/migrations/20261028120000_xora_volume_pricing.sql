-- XORA: volume pricing. Bigger packs now cost less per credit (149 / 279 / 599 / 2999 TRY).
-- Existing purchase rows keep their original amount for callback verification.

create or replace function public.xora_credit_package(p_package_id text)
returns table(package_id text, credits integer, amount numeric(10,2), currency text)
language sql immutable set search_path=public as $$
  select c.package_id, c.credits, c.amount, c.currency from (values
    ('starter', 10, 149.00::numeric(10,2), 'TRY'),
    ('popular', 20, 279.00::numeric(10,2), 'TRY'),
    ('value', 50, 599.00::numeric(10,2), 'TRY'),
    ('professional', 300, 2999.00::numeric(10,2), 'TRY')
  ) as c(package_id, credits, amount, currency)
  where c.package_id = p_package_id
$$;

revoke all on function public.xora_credit_package(text) from public, anon, authenticated;
grant execute on function public.xora_credit_package(text) to service_role;
