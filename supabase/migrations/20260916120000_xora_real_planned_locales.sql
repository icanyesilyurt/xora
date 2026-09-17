-- REAL locale contract: accept every planned locale once, so adding a language later
-- needs no further migration. Only the accepted locale values change; pricing, credits,
-- idempotency and result validation are untouched.
-- Planned: tr, en, es, pt, it, fr, de, ru, ja, ko, zh, ar.
-- The edge function still decides which of these are actually served.

alter table public.real_requests drop constraint if exists real_requests_locale_check;
alter table public.real_requests add constraint real_requests_locale_check
  check (locale in ('tr','en','es','pt','it','fr','de','ru','ja','ko','zh','ar'));

create or replace function public.xora_begin_real(p_user_id uuid,p_reference text,p_mode text,p_locale text,p_handles jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v real_requests%rowtype; v_cost integer; v_balance integer;
begin
  if p_reference is null or p_reference !~ '^[a-zA-Z0-9_-]{8,80}$' or p_mode not in ('mirror','stalk','match')
     or p_locale not in ('tr','en','es','pt','it','fr','de','ru','ja','ko','zh','ar') then raise exception 'bad_request'; end if;
  if p_handles is null or jsonb_typeof(p_handles)<>'array' or jsonb_array_length(p_handles)<>(case when p_mode='match' then 2 else 1 end) then raise exception 'bad_request'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_handles) h where h !~ '^[a-z0-9_]{1,15}$') then raise exception 'bad_request'; end if;
  if p_mode='match' and p_handles->>0=p_handles->>1 then raise exception 'bad_request'; end if;
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if found then
    if v.mode<>p_mode or v.locale<>p_locale or v.handles<>p_handles then raise exception 'request_conflict'; end if;
    return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance);
  end if;
  v_cost=case when p_mode='match' then 10 else 5 end;
  v_balance=public.xora_reconcile_credit_change(p_user_id,p_mode,-v_cost,'real:'||p_reference,'real:'||p_reference,jsonb_build_object('tier','real'));
  insert into public.real_requests(user_id,reference,mode,locale,handles,cost,status)
    values(p_user_id,p_reference,p_mode,p_locale,p_handles,v_cost,'pending');
  return jsonb_build_object('status','claimed','balance',v_balance);
end $$;
