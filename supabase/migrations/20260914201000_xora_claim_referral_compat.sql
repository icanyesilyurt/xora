-- Task: restore the server-side referral RPC expected by analyze-real.
-- Forward-only; preserves active first-touch attributions and does not replay history.

create or replace function public.xora_claim_referral(p_user_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.affiliate_attributions%rowtype;
  v_code text := lower(nullif(trim(coalesce(p_code,'')),''));
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;

  select * into v_row from public.affiliate_attributions where user_id=p_user_id;
  if found and v_row.expires_at > now() then
    if exists(select 1 from public.affiliates where code=v_row.referral_code and is_active) then
      return to_jsonb(v_row);
    end if;
    return null;
  end if;

  if v_code is null or not exists(
    select 1 from public.affiliates where code=v_code and is_active
  ) then return null; end if;

  insert into public.affiliate_attributions(user_id,referral_code,first_seen_at,expires_at,metadata)
  values(p_user_id,v_code,now(),now()+interval '30 days','{"source":"real_analysis"}')
  on conflict(user_id) do update set
    referral_code=excluded.referral_code,
    first_seen_at=excluded.first_seen_at,
    expires_at=excluded.expires_at,
    metadata=excluded.metadata
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

revoke all on function public.xora_claim_referral(uuid,text) from public, anon, authenticated;
grant execute on function public.xora_claim_referral(uuid,text) to service_role;
