const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const uid='00000000-0000-4000-8000-000000000001';
for(const schema of ['legacy','compact/no-lang']) test(`PostgreSQL migration and transaction contract: ${schema}`,async t=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;`);
 if(schema==='legacy') {
  const sql=fs.readFileSync('database-schema.md','utf8').match(/```sql\s*([\s\S]*?)```/)[1].replace('create extension if not exists pgcrypto;','');await db.exec(sql);
 } else await db.exec(`create table public.users(id uuid primary key references auth.users(id),username text,display_name text,avatar_url text,credit_balance integer default 10,last_login_at timestamptz);alter table public.users enable row level security;create policy own on public.users for all to authenticated using(auth.uid()=id) with check(auth.uid()=id);grant select,insert,update on public.users to authenticated;create table public.analyses(id bigserial primary key,user_id uuid references public.users(id),analysis_type text,title text,result jsonb,created_at timestamptz default now());`);
 await db.exec(`insert into auth.users values('${uid}');insert into public.users(id,username,credit_balance) values('${uid}','alice',100);`);
 if(schema==='legacy') await db.exec(`insert into public.analyses(user_id,type,target_username,raw_result,cache_key) values('${uid}','mirror','alice','{"handle":"alice","meta":{"version":"mirror_v3"}}','old-1'); insert into public.credit_transactions(user_id,amount,reason) values('${uid}',10,'signup_bonus');`);
 else await db.exec(`insert into public.analyses(user_id,analysis_type,result) values('${uid}','mirror','{"handle":"alice","meta":{"version":"mirror_v3"}}');`);
 for(let i=0;i<2;i++) for(const file of ['20260914_xora_real_v1.sql','20260914000100_xora_real_hardening.sql']) await db.exec(fs.readFileSync('tests/fixtures/legacy-migrations/'+file,'utf8'));
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const rpc=async(name,args)=>{const vals=Object.values(args);return (await q(`select public.${name}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) as value`,vals))[0].value;};
 const balance=async()=>Number((await q('select credit_balance from users'))[0].credit_balance);
 const begin=reference=>rpc('xora_begin_real',{u:uid,r:reference,m:'mirror',l:'en',h:'["alice"]'});
 await t.test('repeated migrations preserve the original presence or absence of users.lang',async()=>{
  const columns=await q("select column_name from information_schema.columns where table_schema='public' and table_name='users' and column_name='lang'");
  assert.equal(columns.length,schema==='legacy'?1:0);
 });
 await t.test('additive schema retains archived analyses and ledger rows',async()=>{assert.equal((await q('select result from analyses'))[0].result.meta.version,'mirror_v3');if(schema==='legacy')assert.equal((await q('select type from credit_transactions'))[0].type,'signup_bonus');});
 await t.test('wallet permissions deny browser mint, debit and service RPC execution',async()=>{
  assert.equal((await q("select column_default from information_schema.columns where table_schema='public' and table_name='users' and column_name='credit_balance'"))[0].column_default,'0');
  await db.exec('set role authenticated');
  try{await assert.rejects(db.exec('update users set credit_balance=999'));await assert.rejects(db.exec(`insert into users(id,username,credit_balance) values(gen_random_uuid(),'bad',999)`));await assert.rejects(db.exec(`select xora_apply_credit_change('${uid}','refund',99,'forged','{}')`));await assert.rejects(db.exec(`insert into credit_transactions(user_id,type,amount,balance_after) values('${uid}','mirror',5,999)`));await assert.rejects(db.exec(`select xora_claim_referral('${uid}','creator-a')`));await db.exec(`update users set display_name='Alice' where id='${uid}'`);}finally{await db.exec('reset role');}
 });
 await t.test('authenticated frontend profile update succeeds while credit_balance update is denied',async()=>{
  const before=await balance();
  await db.exec('set role authenticated');
  try {
   const rows=await q(`update public.users set username='alice_updated',display_name='Alice Updated',avatar_url='https://example.test/avatar.png',last_login_at='2026-09-14T12:00:00Z' where id=$1 returning username,display_name,avatar_url,last_login_at='2026-09-14T12:00:00Z'::timestamptz as login_updated`,[uid]);
   assert.deepEqual(rows,[{username:'alice_updated',display_name:'Alice Updated',avatar_url:'https://example.test/avatar.png',login_updated:true}]);
   await assert.rejects(db.exec(`update public.users set credit_balance=999 where id='${uid}'`),error=>error.code==='42501');
   assert.equal(await balance(),before);
  } finally {await db.exec('reset role');}
 });
 await t.test('initial referral, active first touch, expiry replacement and unapproved code',async()=>{
  await db.exec(`insert into affiliates(code) values('creator-a'),('creator-b');insert into affiliates(code,is_active) values('inactive',false);`);
  const claim=code=>rpc('xora_claim_referral',{u:uid,c:code});assert.equal(await claim('unapproved'),null);assert.equal(await claim('inactive'),null);
  const first=await claim('creator-a');assert.equal(first.referral_code,'creator-a');assert.equal(Date.parse(first.expires_at)-Date.parse(first.first_seen_at),30*86400000);
  const second=await claim('creator-b');assert.equal(second.referral_code,'creator-a');assert.equal(second.expires_at,first.expires_at);
  await db.exec(`update affiliate_attributions set expires_at=now()-interval '1 second'`);assert.equal(await claim('invalid'),null);assert.equal((await claim('creator-b')).referral_code,'creator-b');
 });
 await t.test('duplicate debits return once, references bind payload, insufficient balance atomic',async()=>{
  const initial=await balance();const results=await Promise.all([begin('duplicate-123'),begin('duplicate-123')]);assert.deepEqual(results.map(x=>x.status),['claimed','pending']);assert.equal(await balance(),initial-5);
  await assert.rejects(rpc('xora_begin_real',{u:uid,r:'duplicate-123',m:'match',l:'en',h:'["alice","bob"]'}),/request_conflict/);
  await assert.rejects(rpc('xora_apply_credit_change',{u:uid,t:'mirror',a:-500,r:'too-much',m:'{}'}),/insufficient_credits/);assert.equal(await balance(),initial-5);
  await assert.rejects(rpc('xora_apply_credit_change',{u:uid,t:'refund',a:500,r:'refund:real:duplicate-123',m:'{}'}),/invalid_refund/);
  const fail=()=>rpc('xora_fail_real',{u:uid,r:'duplicate-123',e:'test_failure'});await Promise.all([fail(),fail()]);assert.equal(await balance(),initial);
  assert.equal((await begin('duplicate-123')).status,'failed');assert.equal((await q(`select count(*)::int as n from credit_transactions where reference='refund:real:duplicate-123'`))[0].n,1);
 });
 await t.test('atomic save, duplicate success and late failure cannot refund a saved card',async()=>{
  await begin('success-123');const before=await balance();const result=JSON.stringify({handle:'alice',handles:['alice'],nickname:{en:'X Contributor'},rarity:{name:'common'},meta:{tier:'real',locale:'en'}});
  const complete=()=>rpc('xora_complete_real',{u:uid,r:'success-123',v:result});await complete();await complete();assert.equal((await begin('success-123')).status,'succeeded');
  assert.equal((await rpc('xora_fail_real',{u:uid,r:'success-123',e:'lost_http_response'})).status,'succeeded');assert.equal(await balance(),before);assert.equal((await q(`select count(*)::int n from analyses where result->'meta'->>'tier'='real'`))[0].n,1);
  if(schema==='legacy'){const row=(await q(`select type,target_username,raw_result from analyses where result->'meta'->>'tier'='real'`))[0];assert.equal(row.type,'mirror');assert.equal(row.target_username,'alice');assert.equal(row.raw_result.meta.tier,'real');}
 });
 await t.test('save failure rolls back completion; refund and crash recovery occur exactly once',async()=>{
  await begin('failedsave-123');await db.exec(`create function reject_test_save() returns trigger language plpgsql as $$begin raise exception 'simulated_save_failure'; end$$;create trigger test_save before insert on analyses for each row execute function reject_test_save();`);
  await assert.rejects(rpc('xora_complete_real',{u:uid,r:'failedsave-123',v:'{"meta":{"tier":"real"},"rarity":{"name":"common"}}'}),/simulated_save_failure/);
  await db.exec('drop trigger test_save on analyses');assert.equal((await begin('failedsave-123')).status,'pending');const before=await balance();await rpc('xora_fail_real',{u:uid,r:'failedsave-123',e:'save_failure'});assert.equal(await balance(),before+5);
  await begin('timeout-123');await db.exec(`update real_requests set created_at=now()-interval '11 minutes' where reference='timeout-123'`);assert.equal(await rpc('xora_recover_real',{}),1);assert.equal(await rpc('xora_recover_real',{}),0);
 });
 } finally {await db.close();}
});
