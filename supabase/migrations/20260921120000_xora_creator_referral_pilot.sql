-- XORA creator referral pilot: reuses affiliates / affiliate_attributions and the two existing
-- claim RPCs. Forward-only and additive.
--
-- Rules:
--   * The browser only ever sends a code. Ownership is decided here, against active affiliates.
--   * First claim wins for good: a later referral never replaces an existing attribution.
--   * An attribution earns commission for 12 months after it was claimed (expires_at).
--   * A creator cannot attribute their own account (owner_user_id).
--   * Pilot commission is 30% (3000 bps); each creator row carries its own rate.

alter table public.affiliates add column if not exists owner_user_id uuid references public.users(id) on delete set null;
alter table public.affiliates alter column commission_bps set default 3000;
comment on column public.affiliates.display_name is 'Public X handle shown as "via @handle" on landing pages (without @).';
comment on column public.affiliates.owner_user_id is 'The creator''s own XORA account, if any; it can never be attributed to its own code.';
comment on column public.affiliate_attributions.expires_at is 'End of the 12-month commission window. The attribution itself is never replaced.';

-- One claim rule for both entry points (browser login and the REAL edge function).
create or replace function public.xora_attribute_referral(p_user_id uuid, p_code text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.affiliate_attributions%rowtype;
  v_code text := lower(nullif(trim(coalesce(p_code,'')),''));
  v_created timestamptz;
begin
  select created_at into v_created from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;

  select * into v_row from public.affiliate_attributions where user_id=p_user_id;
  if found then
    return to_jsonb(v_row) || jsonb_build_object('handle',
      (select coalesce(nullif(ltrim(display_name,'@'),''),code) from public.affiliates where code=v_row.referral_code));
  end if;

  if v_code is null or v_code !~ '^[a-z0-9_-]{2,64}$' then return null; end if;
  if not exists(select 1 from public.affiliates where code=v_code and is_active
                and owner_user_id is distinct from p_user_id) then return null; end if;

  insert into public.affiliate_attributions(user_id,referral_code,first_seen_at,expires_at,metadata)
  values(p_user_id,v_code,now(),now()+interval '12 months',
    jsonb_build_object('source',left(coalesce(p_source,'unknown'),40),
      'new_signup',coalesce(v_created > now()-interval '24 hours',false)))
  on conflict(user_id) do nothing;

  select * into v_row from public.affiliate_attributions where user_id=p_user_id;
  return to_jsonb(v_row) || jsonb_build_object('handle',
    (select coalesce(nullif(ltrim(display_name,'@'),''),code) from public.affiliates where code=v_row.referral_code));
end $$;

-- Browser path: the signed-in user can only attribute themselves.
create or replace function public.xora_capture_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  return public.xora_attribute_referral(auth.uid(), p_code, 'authenticated_first_touch');
end $$;

-- Server path used by analyze-real (service role only).
create or replace function public.xora_claim_referral(p_user_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  return public.xora_attribute_referral(p_user_id, p_code, 'real_analysis');
end $$;

-- Landing pages: is this an active creator code, and which handle should "via @..." show?
-- Returns nothing else about the affiliate (no rate, owner or statistics).
create or replace function public.xora_referral_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object('code',code,'handle',coalesce(nullif(ltrim(display_name,'@'),''),code))
  from public.affiliates
  where code=lower(trim(coalesce(p_code,''))) and lower(trim(coalesce(p_code,''))) ~ '^[a-z0-9_-]{2,64}$' and is_active
$$;

revoke all on function public.xora_attribute_referral(uuid,text,text) from public, anon, authenticated;
grant execute on function public.xora_attribute_referral(uuid,text,text) to service_role;
revoke all on function public.xora_capture_referral(text) from public, anon;
grant execute on function public.xora_capture_referral(text) to authenticated, service_role;
revoke all on function public.xora_claim_referral(uuid,text) from public, anon, authenticated;
grant execute on function public.xora_claim_referral(uuid,text) to service_role;
revoke all on function public.xora_referral_preview(text) from public;
grant execute on function public.xora_referral_preview(text) to anon, authenticated, service_role;
