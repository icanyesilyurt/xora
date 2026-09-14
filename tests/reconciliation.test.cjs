const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');

const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const MIG=fs.readFileSync('supabase/migrations/20260914193000_xora_remote_reconciliation.sql','utf8');

async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.user_id',true),'')::uuid$$;create table auth.users(id uuid primary key);
 create table public.users(id uuid primary key references auth.users(id),username text,display_name text,avatar_url text,credit_balance integer default 0,created_at timestamptz default now(),last_login_at timestamptz default now());
 create table public.analyses(id bigserial primary key,user_id uuid not null references public.users(id),analysis_type text not null,title text,result jsonb,created_at timestamptz default now());
 create table public.credit_transactions(id bigserial primary key,user_id uuid not null references public.users(id),type text not null check(type in ('signup_bonus','purchase','stalk','match','refund','adjustment')),amount integer not null,balance_after integer not null,reference text,idempotency_key text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz default now());
 create table public.x_cache(id bigserial primary key,x_user_id text not null,username text not null,profile jsonb not null default '{}',posts jsonb not null default '[]',expires_at timestamptz not null,created_at timestamptz default now());
 create function public.xora_begin_paid_attempt(uuid,text,text,integer,text,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.xora_complete_paid_attempt(uuid,text) returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.xora_refund_paid_attempt(uuid,text,text) returns jsonb language sql as $$select '{}'::jsonb$$;
 grant all on public.users,public.analyses,public.credit_transactions,public.x_cache to anon,authenticated,service_role;
 grant usage,select on all sequences in schema public to anon,authenticated,service_role;
 grant execute on function public.xora_begin_paid_attempt(uuid,text,text,integer,text,jsonb),public.xora_complete_paid_attempt(uuid,text),public.xora_refund_paid_attempt(uuid,text,text) to anon,authenticated;
 insert into auth.users values('${A}'),('${B}'),('00000000-0000-4000-8000-000000000003');insert into public.users(id,username,credit_balance) values('${A}','alice',100),('${B}','bob',100);insert into public.analyses(user_id,analysis_type,title,result) values('${B}','mirror','Bob old','{"meta":{"tier":"fun"}}');insert into public.x_cache(x_user_id,username,expires_at) values('x1','alice',now()+interval '1 day');`);
 await db.exec(MIG);await db.exec(fs.readFileSync('supabase/migrations/20260914195000_xora_real_validation_fix.sql','utf8'));return db;
}
const q=(db,sql,args=[])=>db.query(sql,args).then(x=>x.rows);
async function role(db,name,user){await db.exec('reset role');await db.exec(`set role ${name}`);if(user) await db.exec(`select set_config('request.user_id','${user}',false)`);}

test('remote compact reconciliation protects users, analyses, ledger and cache',async()=>{
 const db=await setup();try{
  assert.equal((await q(db,"select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='users'"))[0].relrowsecurity,true);
  assert.equal((await q(db,"select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='analyses'"))[0].relrowsecurity,true);
  assert.equal((await q(db,"select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='credit_transactions'"))[0].relrowsecurity,true);
  assert.equal((await q(db,"select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='x_cache'"))[0].relrowsecurity,true);
  assert.equal((await q(db,"select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='lang'")).length,0);
  await role(db,'authenticated',A);
  assert.equal(Number((await q(db,`select credit_balance from public.users where id='${A}'`))[0].credit_balance),100);
  await role(db,'authenticated','00000000-0000-4000-8000-000000000003');
  await db.exec(`insert into public.users(id,username,display_name,avatar_url) values('00000000-0000-4000-8000-000000000003','new-user','New',null)`);
  assert.equal(Number((await q(db,`select credit_balance from public.users where id='00000000-0000-4000-8000-000000000003'`))[0].credit_balance),0);
  await role(db,'authenticated',A);
  assert.equal((await q(db,'select username from public.users')).length,1);assert.equal((await q(db,'select username from public.users'))[0].username,'alice');
   assert.equal((await q(db,`select * from public.analyses where user_id='${B}'`)).length,0);
  await db.exec(`update public.users set display_name='Alice',avatar_url='https://example.test/a',last_login_at=now() where id='${A}'`);
  await assert.rejects(db.exec(`update public.users set credit_balance=999 where id='${A}'`),e=>e.code==='42501');
  await db.exec(`insert into public.users(id,username,display_name,avatar_url) values('00000000-0000-4000-8000-000000000003','bad','Bad',null)`).catch(e=>assert.match(e.message,/violates foreign key|permission denied|row-level security/));
  await db.exec(`insert into public.analyses(user_id,analysis_type,title,result) values('${A}','match','Fun','{"meta":{"tier":"fun"}}')`);
  await assert.rejects(db.exec(`insert into public.analyses(user_id,analysis_type,title,result) values('${A}','mirror','Fake','{"meta":{"tier":"real"},"rarity":{"name":"rare"}}')`));
  assert.equal((await q(db,'select * from public.credit_transactions')).length,0);
  await assert.rejects(q(db,'select * from public.x_cache'));
  for(const fn of ['xora_begin_paid_attempt','xora_complete_paid_attempt','xora_refund_paid_attempt']) await assert.rejects(db.exec(`select public.${fn}('00000000-0000-4000-8000-000000000001','x','x')`));
  await assert.rejects(db.exec(`select public.xora_begin_real('${A}','ref-12345','mirror','en','["alice"]')`));
  await db.exec('reset role');
 } finally {await db.close();}
});

test('service lifecycle enforces prices, idempotency, refund, result validation and referrals',async()=>{
 const db=await setup();try{
  await role(db,'service_role',A);
  let expected=100;
  for(const [mode,cost] of [['mirror',5],['stalk',5],['match',10]]){
   const handles=mode==='match'?'["alice","bob"]':'["alice"]';const value=(await q(db,`select public.xora_begin_real($1,$2,$3,$4,$5) as v`,[A,`ref-${mode}-123`,mode,'tr',handles]))[0].v;expected-=cost;assert.equal(value.status,'claimed');assert.equal(value.balance,expected);
   const duplicate=(await q(db,`select public.xora_begin_real($1,$2,$3,$4,$5) as v`,[A,`ref-${mode}-123`,mode,'tr',handles]))[0].v;assert.equal(duplicate.status,'pending');
   if(mode==='match') await assert.rejects(q(db,`select public.xora_begin_real($1,$2,$3,$4,$5)`,[A,'same-handle','match','tr','["alice","alice"]']),/bad_request/);
   await assert.rejects(q(db,`select public.xora_complete_real($1,$2,$3)`,[A,`ref-${mode}-123`,JSON.stringify({meta:{tier:'real'},rarity:{name:'bad'}})]),/invalid_result/);
   const good=JSON.stringify({meta:{tier:'real',locale:'tr'},rarity:{name:'rare'},nickname:{tr:'X Profil'}});const done=(await q(db,`select public.xora_complete_real($1,$2,$3) as v`,[A,`ref-${mode}-123`,good]))[0].v;assert.equal(done.status,'succeeded');
   assert.equal((await q(db,`select public.xora_fail_real($1,$2,$3) as v`,[A,`ref-${mode}-123`,'late']))[0].v.status,'succeeded');
  }
  const before=Number((await q(db,`select credit_balance from public.users where id='${A}'`))[0].credit_balance);const ref='ref-fail-123';await q(db,`select public.xora_begin_real($1,$2,$3,$4,$5)`,[A,ref,'mirror','en','["alice"]']);await q(db,`select public.xora_fail_real($1,$2,$3)`,[A,ref,'x']);await q(db,`select public.xora_fail_real($1,$2,$3)`,[A,ref,'x']);assert.equal(Number((await q(db,`select credit_balance from public.users where id='${A}'`))[0].credit_balance),before);
  await db.exec(`insert into public.affiliates(code) values('creator-a'),('creator-b')`);await db.exec(`select set_config('request.user_id','${A}',false)`);await role(db,'authenticated',A);const first=(await q(db,`select public.xora_capture_referral('creator-a') as v`))[0].v;assert.equal(first.referral_code,'creator-a');assert.equal((await q(db,`select public.xora_capture_referral('creator-b') as v`))[0].v.referral_code,'creator-a');await role(db,'service_role',A);await db.exec(`update public.affiliate_attributions set expires_at=now()-interval '1 second'`);await role(db,'authenticated',A);assert.equal((await q(db,`select public.xora_capture_referral('creator-b') as v`))[0].v.referral_code,'creator-b');
  await role(db,'service_role',A);await db.exec(`insert into public.analyses(user_id,analysis_type,title,result) values('${A}','mirror','Server REAL','{"meta":{"tier":"real"},"rarity":{"name":"rare"}}')`);
 } finally {await db.close();}
});

test('Task 04C exact Mirror ledger and strict rarity across all modes',async()=>{
 const db=await setup();try{
  await db.exec('begin');await role(db,'service_role',A);
  for(const mode of ['mirror','stalk','match']){
   const ref='task04c_'+mode;
   const handles=mode==='match'?'["alice","bob"]':'["alice"]';
   const before=Number((await q(db,`select credit_balance from public.users where id=$1`,[A]))[0].credit_balance);
   const begun=(await q(db,'select public.xora_begin_real($1,$2,$3,$4,$5) as v',[A,ref,mode,'tr',handles]))[0].v;
   assert.equal(begun.balance,before-(mode==='match'?10:5));
   assert.equal((await q(db,'select type from public.credit_transactions where user_id=$1 and idempotency_key=$2',[A,'real:'+ref]))[0].type,mode);
   for(const bad of [{meta:{tier:'real'}},{meta:{tier:'real'},rarity:null},{meta:{tier:'real'},rarity:{}},{meta:{tier:'real'},rarity:{name:'unknown'}},{meta:{tier:'real'},rarity:'rare'},{meta:{tier:'real'},rarity:{name:null}}]){
    await db.exec('savepoint rejected_case');
    await db.exec('savepoint denied_case');
   await assert.rejects(q(db,'select public.xora_complete_real($1,$2,$3)',[A,ref,JSON.stringify(bad)]),/invalid_result/);
    await db.exec('rollback to savepoint rejected_case');
   }
   for(const rarity of ['common','rare','epic','legendary']){
    await db.exec('savepoint rarity_case');
    const result=(await q(db,'select public.xora_complete_real($1,$2,$3) as v',[A,ref,JSON.stringify({meta:{tier:'real'},rarity:{name:rarity}})]))[0].v;
    assert.equal(result.status,'succeeded');
    await db.exec('rollback to savepoint rarity_case');
   }
  }
  for(const r of ['anon','authenticated']){
   await role(db,r,A);
   await db.exec('savepoint denied_case');
   await assert.rejects(q(db,'select public.xora_complete_real($1,$2,$3)',[A,'task04c_mirror','{}']),e=>e.code==='42501');
   await db.exec('rollback to savepoint denied_case');
  }
 }finally{await db.close();}
});
