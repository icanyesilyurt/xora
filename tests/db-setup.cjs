// Supabase-shaped PGlite database: the live compact schema plus every forward migration, in order.
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
 await db.exec(MIG);await db.exec(fs.readFileSync('supabase/migrations/20260914195000_xora_real_validation_fix.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20260914201000_xora_claim_referral_compat.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20260916120000_xora_real_planned_locales.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20260919120000_xora_iyzico_credit_purchases.sql','utf8'));return db;
}
const q=(db,sql,args=[])=>db.query(sql,args).then(x=>x.rows);
async function role(db,name,user){await db.exec('reset role');await db.exec(`set role ${name}`);if(user) await db.exec(`select set_config('request.user_id','${user}',false)`);}
module.exports={A,B,MIG,setup,q,role};
