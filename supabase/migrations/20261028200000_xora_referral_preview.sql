-- XORA: the site confirms a ?ref=<code> link before keeping it, through xora_referral_preview.
-- That RPC was missing from the database, so every referral link was silently ignored and no
-- partner attribution was ever recorded. This adds it: an active partner code returns
-- {code, handle}; anything else returns null. Callable before sign-in.

create or replace function public.xora_referral_preview(p_code text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('code', f.code, 'handle', f.code)
    from public.affiliates f
   where f.code = lower(trim(coalesce(p_code, ''))) and f.is_active
$$;

revoke all on function public.xora_referral_preview(text) from public;
grant execute on function public.xora_referral_preview(text) to anon, authenticated, service_role;
