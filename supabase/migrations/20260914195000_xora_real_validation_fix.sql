-- Task 04C: preserve ledger rows and accept Mirror; reject missing REAL rarity.
-- Forward migration. Existing balances and ledger history are not rewritten.
do $$
begin
  if exists(select 1 from public.credit_transactions where type not in ('signup_bonus','purchase','mirror','stalk','match','refund','adjustment')) then
    raise exception 'unexpected_credit_transaction_type: existing ledger rows violate the supported type set';
  end if;
end $$;
alter table public.credit_transactions drop constraint if exists credit_transactions_type_check;
alter table public.credit_transactions add constraint credit_transactions_type_check
  check (type in ('signup_bonus','purchase','mirror','stalk','match','refund','adjustment'));
create or replace function public.xora_complete_real(p_user_id uuid,p_reference text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v real_requests%rowtype; v_balance integer; v_title text;
begin
  select credit_balance into v_balance from public.users where id=p_user_id for update;
  select * into v from public.real_requests where user_id=p_user_id and reference=p_reference for update;
  if not found then raise exception 'request_not_found'; end if;
  if v.status='succeeded' then return jsonb_build_object('status',v.status,'result',v.result,'balance',v_balance); end if;
  if v.status<>'pending' or p_result is null or p_result->'meta'->>'tier' is distinct from 'real' or coalesce(p_result #>> '{rarity,name}', '') not in ('common','rare','epic','legendary') then raise exception 'invalid_result'; end if;
  v_title=case when v.mode='match' then '%'||coalesce(p_result->>'overall','?') else coalesce(p_result->'nickname'->>v.locale,'XORA Real') end;
  insert into public.analyses(user_id,analysis_type,title,result) values(p_user_id,v.mode,v_title,p_result);
  update public.real_requests set status='succeeded',result=p_result,updated_at=now() where user_id=p_user_id and reference=p_reference;
  return jsonb_build_object('status','succeeded','result',p_result,'balance',v_balance);
end $$;
revoke all on function public.xora_complete_real(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.xora_complete_real(uuid,text,jsonb) to service_role;