// iyzico credit purchases: the real edge function (transpiled into a vm) talking to the real
// migrated schema (PGlite). iyzico is a local mock; it is the only network the function can reach.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const ts=require('typescript');
const {A,B,setup,q,role}=require('./db-setup.cjs');
const {browser}=require('./helpers.cjs');

const SECRET='sandbox-test-secret-key-do-not-log';
const API_KEY='sandbox-test-api-key';
const ENV={IYZICO_API_KEY:API_KEY,IYZICO_SECRET_KEY:SECRET,IYZICO_BASE_URL:'https://sandbox-api.iyzipay.com',
 SUPABASE_URL:'https://staging.test',SUPABASE_ANON_KEY:'anon-key',SUPABASE_SERVICE_ROLE_KEY:'service-key',XORA_SITE_URL:'https://site.test/xora/'};
const INIT='/payment/iyzipos/checkoutform/initialize/auth/ecom';
const DETAIL='/payment/iyzipos/checkoutform/auth/ecom/detail';
const CATALOG={starter:[10,'2.99'],popular:[20,'5.99'],value:[50,'14.99'],professional:[300,'89.99']};

// Supabase client backed by PGlite. The service key acts as service_role; the anon client only
// resolves the user named in its bearer token ("Bearer user:<uuid>").
function supabaseFor(db){
 async function asService(fn){await role(db,'service_role');try{return await fn();}finally{await db.exec('reset role');}}
 return function createClient(_url,key,opts){
  const bearer=(opts&&opts.global&&opts.global.headers&&opts.global.headers.Authorization)||'';
  const userId=bearer.startsWith('Bearer user:')?bearer.slice(12):null;
  return {
   auth:{getUser:async()=>userId?{data:{user:{id:userId,email:userId.slice(-1)+'@example.test'}},error:null}:{data:{user:null},error:{message:'no session'}}},
   async rpc(name,args){
    if(key!=='service-key') return {data:null,error:{message:'permission denied'}};
    const keys=Object.keys(args);
    try{const rows=await asService(()=>q(db,`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as r`,keys.map(k=>args[k])));return {data:rows[0].r,error:null};}
    catch(e){return {data:null,error:{message:e.message}};}
   },
   from(table){
    const filters=[];let cols='*';
    const qb={select(c){cols=c;return qb;},eq(col,val){filters.push([col,val]);return qb;},
     async maybeSingle(){
      const where=filters.map((f,i)=>`${f[0]}=$${i+1}`).join(' and ');
      const rows=await asService(()=>q(db,`select ${cols} from public.${table}${where?' where '+where:''} limit 1`,filters.map(f=>f[1])));
      return {data:rows[0]||null,error:null};
     }};
    return qb;
   }
  };
 };
}

// iyzico mock: initialize issues a token; detail answers from the initialize request unless a
// test overrides the answer. Every request is recorded with its headers.
function iyzicoMock(){
 const calls=[],inits=new Map();let n=0;
 const state={detail:null,fail:false};
 async function fetch(url,init){
  const u=new URL(url);const body=JSON.parse(init.body);
  calls.push({url:String(url),path:u.pathname,host:u.host,headers:init.headers,rawBody:init.body,body});
  if(u.origin!=='https://sandbox-api.iyzipay.com') throw new Error('unexpected host '+u.host);
  if(state.fail) throw new Error('network down');
  if(u.pathname===INIT){
   const token='tok'+(++n)+'abcdef';inits.set(token,body);
   return Response.json({status:'success',conversationId:body.conversationId,token,checkoutFormContent:'<script type="text/javascript">var iyziInit={};/* https://sandbox-static.iyzipay.com/checkoutform */</script>',paymentPageUrl:'https://sandbox-cpp.iyzipay.com?token='+token,tokenExpireTime:1800});
  }
  if(u.pathname===DETAIL){
   const req=inits.get(body.token);
   const ok={status:'success',paymentStatus:'SUCCESS',fraudStatus:1,paymentId:'pay-'+body.token,token:body.token,conversationId:body.conversationId,basketId:req&&req.basketId,
    price:req&&req.price,paidPrice:req&&req.paidPrice,currency:req&&req.currency,itemTransactions:req?[{itemId:req.basketItems[0].id,price:req.basketItems[0].price,paidPrice:req.basketItems[0].price}]:[]};
   return Response.json(state.detail?state.detail(ok):ok);
  }
  throw new Error('unexpected path '+u.pathname);
 }
 return {fetch,calls,state,inits};
}

function loadFunction({db,env=ENV,fetch}){
 let src=fs.readFileSync('supabase/functions/iyzico-checkout/index.ts','utf8');
 src=src.replace(/^import .*\r?\n/,'').replace('Deno.serve(main);','');
 const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const logs=[];
 const ctx={exports:{},console:{warn:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' ')),log:(...a)=>logs.push(a.join(' '))},
  Response,Request,Headers,URL,URLSearchParams,AbortSignal,TextEncoder,btoa,crypto:globalThis.crypto,fetch,
  Deno:{env:{get:k=>env[k]}},createClient:supabaseFor(db)};
 vm.createContext(ctx);vm.runInContext(out,ctx);
 return {fn:ctx.exports,logs};
}

const api=(fn,body,user)=>fn.main(new Request('https://staging.test/functions/v1/iyzico-checkout',{method:'POST',headers:{'content-type':'application/json',...(user?{Authorization:'Bearer user:'+user}:{})},body:JSON.stringify(body)}));
const callback=(fn,token)=>fn.main(new Request('https://staging.test/functions/v1/iyzico-checkout/callback',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'token='+encodeURIComponent(token)}));
const balance=async(db,id)=>Number((await q(db,`select credit_balance from public.users where id='${id}'`))[0].credit_balance);
const purchase=async(db,id)=>(await q(db,`select * from public.credit_purchases where id='${id}'`))[0];
const ledger=async(db,user)=>q(db,`select type,amount,idempotency_key from public.credit_transactions where user_id='${user}' and type='purchase' order by id`);

async function startPurchase(ctx,pkg='popular',extra={}){
 const res=await api(ctx.fn,{action:'create',package_id:pkg,...extra},A);
 const body=await res.json();
 assert.equal(res.status,200,JSON.stringify(body));assert.equal(body.status,'ok');
 const token=[...ctx.mock.inits.keys()].pop();
 return {id:body.purchase_id,token,body};
}

async function withFunction(run,{env,mock}={}){
 const db=await setup();
 try{
  const m=mock||iyzicoMock();
  const {fn,logs}=loadFunction({db,env,fetch:m.fetch});
  await run({db,fn,mock:m,logs});
 }finally{await db.close();}
}

test('credit package catalog is identical in the database, the edge function and the price UI',async()=>{
 await withFunction(async({db,fn})=>{
  await role(db,'service_role');
  for(const [id,[credits,amount]] of Object.entries(CATALOG)){
   const row=(await q(db,`select * from public.xora_credit_package($1)`,[id]))[0];
   assert.deepEqual({credits:Number(row.credits),amount:Number(row.amount).toFixed(2),currency:row.currency},{credits,amount,currency:'USD'},id);
   assert.deepEqual({...fn.CATALOG[id]},{credits,amount:Number(amount),currency:'USD'},id+' edge');
  }
  assert.equal((await q(db,`select * from public.xora_credit_package('pro')`)).length,0,'unknown ids are not packages');
  await db.exec('reset role');
  const c=browser();
  assert.deepEqual([...c.CREDIT_PACKAGES].map(p=>[p.id,p.credits,p.price.toFixed(2)]),Object.entries(CATALOG).map(([id,[cr,am]])=>[id,cr,am]),'UI shows the same packages');
 });
});

test('checkout takes only the package id: tampered amount, credits, price and currency are ignored',async()=>{
 await withFunction(async ctx=>{
  for(const [pkg,[credits,amount]] of Object.entries(CATALOG)){
   const {id}=await startPurchase(ctx,pkg,{amount:0.01,price:'0.01',paidPrice:'0.01',credits:99999,currency:'TRY'});
   const init=ctx.mock.calls.filter(c=>c.path===INIT).pop().body;
   assert.equal(init.price,amount,pkg+' price from catalog');assert.equal(init.paidPrice,amount);assert.equal(init.currency,'USD');
   assert.equal(init.conversationId,id);assert.equal(init.basketId,id);
   assert.deepEqual(init.basketItems.map(i=>({id:i.id,price:i.price,itemType:i.itemType})),[{id:pkg,price:amount,itemType:'VIRTUAL'}]);
   assert.deepEqual(init.enabledInstallments,[1]);
   assert.equal(init.callbackUrl,'https://staging.test/functions/v1/iyzico-checkout/callback');
   const row=await purchase(ctx.db,id);
   assert.deepEqual({credits:row.credits,amount:Number(row.amount).toFixed(2),currency:row.currency,status:row.status,package_id:row.package_id},{credits,amount,currency:'USD',status:'pending',package_id:pkg});
   assert.ok(row.provider_token,'token attached');
  }
  assert.equal(await balance(ctx.db,A),100,'starting a checkout never moves credits');
  const bad=await api(ctx.fn,{action:'create',package_id:'free-credits'},A);
  assert.equal(bad.status,400);assert.equal((await bad.json()).code,'unknown_package');
 });
});

test('requests are IYZWSv2-signed for the sandbox, and secrets never leave the server',async()=>{
 await withFunction(async ctx=>{
  const {body}=await startPurchase(ctx,'value');
  const call=ctx.mock.calls[0];
  assert.equal(call.host,'sandbox-api.iyzipay.com');
  const rnd=call.headers['x-iyzi-rnd'];assert.match(rnd,/^\d+[0-9a-f]+$/);
  const auth=call.headers.Authorization;assert.match(auth,/^IYZWSv2 /);
  const decoded=Buffer.from(auth.slice(8),'base64').toString();
  const sig=crypto.createHmac('sha256',SECRET).update(rnd+INIT+call.rawBody).digest('hex');
  assert.equal(decoded,`apiKey:${API_KEY}&randomKey:${rnd}&signature:${sig}`);
  for(const text of [call.url,call.rawBody,JSON.stringify(body),...ctx.logs]) assert.ok(!text.includes(SECRET),'secret key not exposed');
  assert.equal(body.sandbox,true);assert.ok(!('token' in body),'checkout token stays server-side');
 });
 // The live endpoint needs an explicit opt-in; any other host is refused before a request is made.
 for(const [env,label] of [[{...ENV,IYZICO_BASE_URL:'https://api.iyzipay.com'},'live without IYZICO_LIVE'],[{...ENV,IYZICO_BASE_URL:'https://evil.example'},'foreign host'],[{...ENV,IYZICO_API_KEY:''},'missing api key'],[{...ENV,IYZICO_SECRET_KEY:undefined,IYZICO_BASE_URL:undefined},'missing secrets']]){
  await withFunction(async ctx=>{
   const res=await api(ctx.fn,{action:'create',package_id:'popular'},A);
   const out=await res.json();
   assert.equal(res.status,503,label);assert.deepEqual(out,{status:'error',code:'payment_not_configured'},label+': no configuration details in the response');
   assert.equal(ctx.mock.calls.length,0,label+': no request sent');
   assert.equal((await q(ctx.db,'select * from public.credit_purchases')).length,0,label+': no purchase row');
   assert.ok(ctx.logs.every(l=>!l.includes(SECRET)&&!l.includes(API_KEY)),label+': logs carry names only');
  },{env});
 }
});

test('unauthenticated users cannot start, verify or credit a purchase',async()=>{
 await withFunction(async ctx=>{
  const res=await api(ctx.fn,{action:'create',package_id:'popular'},null);
  assert.equal(res.status,401);assert.equal(ctx.mock.calls.length,0);
  assert.equal((await q(ctx.db,'select * from public.credit_purchases')).length,0);
  const v=await api(ctx.fn,{action:'verify',purchase_id:'00000000-0000-4000-8000-00000000abcd'},null);
  assert.equal(v.status,401);
  // Browser roles cannot reach the purchase RPCs, the table or the balance directly.
  for(const r of ['anon','authenticated']){
   await role(ctx.db,r,A);
   for(const sql of [`select public.xora_begin_credit_purchase('${A}','popular')`,`select public.xora_credit_package('popular')`,
     `select public.xora_complete_credit_purchase('${A}','t','p','popular',5.99,'USD')`,`select public.xora_fail_credit_purchase('${A}','x')`,
     `select public.xora_attach_credit_purchase_token('${A}','tokentoken')`,`select public.xora_reconcile_credit_change('${A}','purchase',20,'x','y')`,
     `insert into public.credit_purchases(user_id,package_id,credits,amount,currency) values('${A}','popular',20,5.99,'USD')`,
     `update public.users set credit_balance=credit_balance+20 where id='${A}'`]){
    await assert.rejects(ctx.db.exec(sql),r+': '+sql.slice(0,60));
   }
  }
  await ctx.db.exec('reset role');
  assert.equal(await balance(ctx.db,A),100);
 });
});

test('a verified payment adds exactly the package credits once; duplicate callbacks do not double-credit',async()=>{
 await withFunction(async ctx=>{
  const {id,token}=await startPurchase(ctx,'popular');
  const res=await callback(ctx.fn,token);
  assert.equal(res.status,303);
  assert.equal(res.headers.get('location'),'https://site.test/xora/credits.html?payment=completed&purchase='+id);
  assert.equal(await balance(ctx.db,A),120,'+20 credits');
  const row=await purchase(ctx.db,id);
  assert.equal(row.status,'completed');assert.equal(row.provider_payment_id,'pay-'+token);assert.ok(row.completed_at);
  assert.deepEqual((await ledger(ctx.db,A)).map(l=>({...l})),[{type:'purchase',amount:20,idempotency_key:'iyzico:'+id}]);
  const detailCalls=ctx.mock.calls.filter(c=>c.path===DETAIL).length;
  // The same callback again, then the page's own verify: no second credit, no second lookup.
  assert.equal((await callback(ctx.fn,token)).headers.get('location'),'https://site.test/xora/credits.html?payment=completed&purchase='+id);
  const v=await(await api(ctx.fn,{action:'verify',purchase_id:id},A)).json();
  assert.deepEqual({s:v.payment_status,c:v.credits},{s:'completed',c:20});
  assert.equal(ctx.mock.calls.filter(c=>c.path===DETAIL).length,detailCalls,'settled purchases are not re-queried');
  // Even calling the crediting RPC directly again cannot add credits.
  await role(ctx.db,'service_role');
  const again=(await q(ctx.db,`select public.xora_complete_credit_purchase($1,$2,$3,'popular',5.99,'USD') as r`,[id,token,'pay-'+token]))[0].r;
  assert.equal(again.credited,false);
  await ctx.db.exec('reset role');
  assert.equal(await balance(ctx.db,A),120);assert.equal((await ledger(ctx.db,A)).length,1);
 });
});

test('failed, mismatched or foreign payments add zero credits',async()=>{
 const cases={
  'payment failed':ok=>({...ok,paymentStatus:'FAILURE'}),
  'amount mismatch':ok=>({...ok,price:'0.99',paidPrice:'0.99',itemTransactions:[{...ok.itemTransactions[0],price:'0.99'}]}),
  'paid price mismatch':ok=>({...ok,paidPrice:'1.00'}),
  'currency mismatch':ok=>({...ok,currency:'TRY'}),
  'wrong package':ok=>({...ok,itemTransactions:[{...ok.itemTransactions[0],itemId:'professional'}]}),
  'extra item':ok=>({...ok,itemTransactions:[...ok.itemTransactions,{itemId:'starter',price:'2.99'}]}),
  'other conversation':ok=>({...ok,conversationId:'00000000-0000-4000-8000-00000000beef'}),
  'other basket':ok=>({...ok,basketId:'00000000-0000-4000-8000-00000000beef'}),
  'other token':ok=>({...ok,token:'someone-elses-token'}),
  'no payment id':ok=>({...ok,paymentId:''}),
  'fraud rejected':ok=>({...ok,fraudStatus:-1})
 };
 for(const [label,mutate] of Object.entries(cases)){
  await withFunction(async ctx=>{
   const {id,token}=await startPurchase(ctx,'popular');
   ctx.mock.state.detail=mutate;
   const res=await callback(ctx.fn,token);
   assert.equal(res.headers.get('location'),'https://site.test/xora/credits.html?payment=failed&purchase='+id,label);
   assert.equal(await balance(ctx.db,A),100,label+': balance unchanged');
   assert.equal((await ledger(ctx.db,A)).length,0,label+': no ledger entry');
   assert.equal((await purchase(ctx.db,id)).status,'failed',label);
   // A later genuine-looking answer cannot revive a failed purchase.
   ctx.mock.state.detail=null;await callback(ctx.fn,token);
   assert.equal(await balance(ctx.db,A),100,label+': failed stays failed');
  });
 }
});

test('unverifiable results stay pending and never credit until iyzico confirms',async()=>{
 await withFunction(async ctx=>{
  const {id,token}=await startPurchase(ctx,'starter');
  for(const [label,setState] of [
   ['network error',()=>{ctx.mock.state.fail=true;}],
   ['api error without payment status',()=>{ctx.mock.state.fail=false;ctx.mock.state.detail=()=>({status:'failure',errorCode:'1001',errorMessage:'api'});}],
   ['3-D Secure still running',()=>{ctx.mock.state.detail=ok=>({...ok,paymentStatus:'INIT_THREEDS'});}],
   ['fraud review',()=>{ctx.mock.state.detail=ok=>({...ok,fraudStatus:0});}]]){
   setState();
   const res=await callback(ctx.fn,token);
   assert.equal(res.headers.get('location'),'https://site.test/xora/credits.html?payment=pending&purchase='+id,label);
   assert.equal((await purchase(ctx.db,id)).status,'pending',label);assert.equal(await balance(ctx.db,A),100,label);
  }
  ctx.mock.state.detail=null;
  const v=await(await api(ctx.fn,{action:'verify',purchase_id:id},A)).json();
  assert.equal(v.payment_status,'completed');assert.equal(await balance(ctx.db,A),110,'+10 once confirmed');
 });
});

test('forged callbacks and other users cannot settle a purchase',async()=>{
 await withFunction(async ctx=>{
  const {id,token}=await startPurchase(ctx,'professional');
  const before=ctx.mock.calls.length;
  for(const forged of ['unknown-token-123','<script>','']){
   const res=await callback(ctx.fn,forged);
   assert.equal(res.headers.get('location'),'https://site.test/xora/credits.html?payment=failed');
  }
  const get=await ctx.fn.main(new Request('https://staging.test/functions/v1/iyzico-checkout/callback?token=unknown-token-456'));
  assert.equal(get.status,303);
  assert.equal(ctx.mock.calls.length,before,'forged tokens never reach iyzico');
  const other=await api(ctx.fn,{action:'verify',purchase_id:id},B);
  assert.equal(other.status,404,'another user cannot see or settle this purchase');
  assert.equal((await purchase(ctx.db,id)).status,'pending');assert.equal(await balance(ctx.db,A),100);assert.equal(await balance(ctx.db,B),100);
  // The owner reads only their own purchases through RLS.
  await role(ctx.db,'authenticated',B);assert.equal((await q(ctx.db,'select * from public.credit_purchases')).length,0);
  await role(ctx.db,'authenticated',A);assert.equal((await q(ctx.db,'select * from public.credit_purchases')).length,1);
  await ctx.db.exec('reset role');
  await callback(ctx.fn,token);assert.equal(await balance(ctx.db,A),400,'the real callback still works: +300');
 });
});

test('purchase RPCs re-check the payment in the database and cap open checkouts',async()=>{
 const db=await setup();
 try{
  await role(db,'service_role');
  const p1=(await q(db,`select public.xora_begin_credit_purchase($1,'popular') as r`,[A]))[0].r;
  await db.exec(`select public.xora_attach_credit_purchase_token('${p1.purchase_id}','token-one-1')`);
  const mis=(await q(db,`select public.xora_complete_credit_purchase($1,'token-one-1','pay-1','popular',5.98,'USD') as r`,[p1.purchase_id]))[0].r;
  assert.equal(mis.status,'failed');assert.equal(mis.credited,false);
  await assert.rejects(db.exec(`select public.xora_complete_credit_purchase('${p1.purchase_id}','token-one-1','pay-1','popular',5.99,'USD')`),/purchase_not_pending/,'a failed purchase cannot be completed');
  const p2=(await q(db,`select public.xora_begin_credit_purchase($1,'value') as r`,[A]))[0].r;
  await db.exec(`select public.xora_attach_credit_purchase_token('${p2.purchase_id}','token-two-2')`);
  await assert.rejects(db.exec(`select public.xora_complete_credit_purchase('${p2.purchase_id}','wrong-token','pay-2','value',14.99,'USD')`),/token_mismatch/);
  const ok=(await q(db,`select public.xora_complete_credit_purchase($1,'token-two-2','pay-2','value',14.99,'usd') as r`,[p2.purchase_id]))[0].r;
  assert.equal(ok.credited,true);assert.equal(Number(ok.balance),150);
  // One iyzico payment id can complete only one purchase.
  const p3=(await q(db,`select public.xora_begin_credit_purchase($1,'value') as r`,[A]))[0].r;
  await db.exec(`select public.xora_attach_credit_purchase_token('${p3.purchase_id}','token-three')`);
  await assert.rejects(db.exec(`select public.xora_complete_credit_purchase('${p3.purchase_id}','token-three','pay-2','value',14.99,'USD')`),/duplicate key|unique/);
  await assert.rejects(db.exec(`select public.xora_begin_credit_purchase('${A}','free')`),/unknown_package/);
  await assert.rejects(db.exec(`select public.xora_begin_credit_purchase(null,'popular')`),/unauthorized/);
  for(let i=0;i<3;i++) await db.exec(`select public.xora_begin_credit_purchase('${B}','starter')`);
  await db.exec(`select public.xora_begin_credit_purchase('${B}','starter')`);await db.exec(`select public.xora_begin_credit_purchase('${B}','starter')`);
  await assert.rejects(db.exec(`select public.xora_begin_credit_purchase('${B}','starter')`),/too_many_pending/);
  await db.exec('reset role');
  assert.equal(await balance(db,A),150);assert.equal(await balance(db,B),100);
 } finally {await db.close();}
});

test('credits page sends only a package id and shows the result the server confirms, in 12 locales',async()=>{
 const c=browser();
 const sent=[];let answer;let refreshed=0;
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:A}}}})},functions:{invoke:async(name,opts)=>{sent.push({name,body:opts.body});return {data:answer(opts.body),error:null};}}};
 c.getSupabaseClient=()=>sb;c.refreshCreditsFromServer=async()=>{refreshed++;return 120;};
 const toasts=[];c.toast=m=>toasts.push(m);
 c.document.body={appendChild(){}};c.document.getElementById=()=>null;c.document.createElement=()=>({});
 answer=()=>({status:'ok',purchase_id:'00000000-0000-4000-8000-00000000c0de',checkout_form_content:null,payment_page_url:'https://sandbox-cpp.iyzipay.com?token=abc',sandbox:true});
 c.location.href='https://example.test/xora/credits.html';
 await c.startCreditPurchase('popular');
 assert.equal(sent[0].name,'iyzico-checkout');
 assert.deepEqual(Object.keys(sent[0].body).sort(),['action','locale','package_id'],'no amount, price or credits leave the page');
 assert.equal(sent[0].body.package_id,'popular');
 assert.equal(c.location.href,'https://sandbox-cpp.iyzipay.com?token=abc','hosted checkout fallback');
 assert.equal(await c.startCreditPurchase('unlimited'),'unknown_package');assert.equal(sent.length,1);
 // The query string says "completed", but only the server's verified answer counts.
 for(const lang of c.LANGS){
  c.localStorage.setItem(c.LS.lang,lang);
  for(const [server,expect] of [['failed','pay_failed'],['pending','pay_pending'],['completed','pay_success']]){
   toasts.length=0;refreshed=0;
   c.location.search='?payment=completed&purchase=00000000-0000-4000-8000-00000000c0de';c.window.history={replaceState(){}};c.location.pathname='/xora/credits.html';
   answer=()=>({status:'ok',payment_status:server,credits:20});
   const r=await c.handlePaymentReturn();
   assert.equal(r.status,server);
   const msg=c.I18N[lang][expect];assert.ok(msg&&msg.trim(),lang+' '+expect);
   assert.equal(toasts.pop(),expect==='pay_success'?msg.replace('{n}','20'):msg,lang+' '+server);
   assert.equal(refreshed,server==='completed'?1:0,lang+' balance reloads only after a confirmed payment');
  }
  for(const k of ['pay_opening','pay_success','pay_failed','pay_pending','pay_login_required','pay_unavailable','pay_sandbox']) assert.ok(c.I18N[lang][k],lang+'.'+k);
  assert.match(c.I18N[lang].pay_success,/\{n\}/,lang+' success message names the credits');
  assert.doesNotMatch(c.I18N[lang].credits_note,/pasif|disabled|desactivad|désactiv|deaktiviert|disattivat|無効|꺼져|還沒開放|не работает|معطلة|desativad/i,lang+' note no longer says buying is disabled');
 }
 // Signed-out users are sent to sign in and nothing is requested.
 const before=sent.length;sb.auth.getSession=async()=>({data:{session:null}});
 assert.equal(await c.startCreditPurchase('popular'),'unauthorized');assert.equal(sent.length,before);
});

// ---------------------------------------------------------------------------------------------
// Creator referral pilot: 30% commission on verified, referred credit purchases.
const commissions=async db=>(await q(db,'select * from public.affiliate_commissions order by created_at')).map(r=>({...r}));
async function asService(db,sql,args=[]){await role(db,'service_role');try{return await q(db,sql,args);}finally{await db.exec('reset role');}}
async function referred(db,user,code='creator-x'){
 await asService(db,`insert into public.affiliates(code,display_name) values($1,'CreatorX') on conflict do nothing`,[code]);
 await role(db,'authenticated',user);
 try{return (await q(db,`select public.xora_capture_referral($1) as v`,[code]))[0].v;}finally{await db.exec('reset role');}
}
async function buyAs(ctx,user,pkg){
 const res=await api(ctx.fn,{action:'create',package_id:pkg},user);const body=await res.json();
 assert.equal(res.status,200,JSON.stringify(body));
 return {id:body.purchase_id,token:[...ctx.mock.inits.keys()].pop()};
}

test('a verified referred purchase creates exactly one 30% commission; duplicate callbacks, verify and RPC replays add none',async()=>{
 await withFunction(async ctx=>{
  const claim=await referred(ctx.db,A);
  assert.equal(claim.referral_code,'creator-x');assert.equal(claim.handle,'CreatorX');
  assert.ok(Math.abs(Date.parse(claim.expires_at)-Date.parse(claim.first_seen_at)-365*86400000)<=86400000,'12-month commission window');
  assert.equal(Number((await asService(ctx.db,`select commission_bps from public.affiliates where code='creator-x'`))[0].commission_bps),3000,'pilot rate is 30%');
  const {id,token}=await startPurchase(ctx,'popular');
  assert.equal((await commissions(ctx.db)).length,0,'no commission before payment');
  assert.equal((await callback(ctx.fn,token)).status,303);
  let rows=await commissions(ctx.db);
  assert.equal(rows.length,1);
  assert.deepEqual({purchase:rows[0].purchase_id,user:rows[0].user_id,code:rows[0].referral_code,amount:Number(rows[0].purchase_amount).toFixed(2),cur:rows[0].currency,bps:rows[0].commission_bps,commission:Number(rows[0].commission_amount).toFixed(2),status:rows[0].status},
   {purchase:id,user:A,code:'creator-x',amount:'5.99',cur:'USD',bps:3000,commission:'1.80',status:'owed'});
  await callback(ctx.fn,token);await api(ctx.fn,{action:'verify',purchase_id:id},A);
  await asService(ctx.db,`select public.xora_complete_credit_purchase($1,$2,$3,'popular',5.99,'USD')`,[id,token,'pay-'+token]);
  await asService(ctx.db,`select public.xora_record_affiliate_commission($1)`,[id]);
  rows=await commissions(ctx.db);assert.equal(rows.length,1,'still one commission');
  assert.equal(await balance(ctx.db,A),120,'and still one credit');
  // The rate is applied to the verified purchase amount on the server, for every package.
  for(const [pkg,want] of [['value','4.50'],['professional','27.00'],['starter','0.90']]){
   const p=await buyAs(ctx,A,pkg);await callback(ctx.fn,p.token);
   const row=(await commissions(ctx.db)).find(r=>r.purchase_id===p.id);
   assert.equal(Number(row.commission_amount).toFixed(2),want,pkg);
  }
 });
});

test('failed, mismatched, unattributed, expired, inactive and self-referred purchases earn no commission',async()=>{
 await withFunction(async ctx=>{
  await referred(ctx.db,A);
  ctx.mock.state.detail=ok=>({...ok,paymentStatus:'FAILURE',status:'success'});
  const failed=await startPurchase(ctx,'popular');await callback(ctx.fn,failed.token);
  assert.equal((await purchase(ctx.db,failed.id)).status,'failed');
  ctx.mock.state.detail=ok=>({...ok,paidPrice:'0.01',price:'0.01'});
  const mismatch=await startPurchase(ctx,'popular');await callback(ctx.fn,mismatch.token);
  assert.equal((await purchase(ctx.db,mismatch.id)).status,'failed');
  ctx.mock.state.detail=null;
  assert.equal((await commissions(ctx.db)).length,0,'failed payments earn nothing');
  // B arrived without a referral: a direct purchase.
  const direct=await buyAs(ctx,B,'value');await callback(ctx.fn,direct.token);
  assert.equal((await purchase(ctx.db,direct.id)).status,'completed');
  assert.equal((await commissions(ctx.db)).length,0,'direct purchases earn nothing');
  // Outside the 12-month window.
  await asService(ctx.db,`update public.affiliate_attributions set first_seen_at=now()-interval '13 months' where user_id=$1`,[A]);
  const late=await startPurchase(ctx,'popular');await callback(ctx.fn,late.token);
  assert.equal((await commissions(ctx.db)).length,0,'no commission after 12 months');
  // Paused creator.
  await asService(ctx.db,`update public.affiliate_attributions set first_seen_at=now() where user_id=$1`,[A]);
  await asService(ctx.db,`update public.affiliates set is_active=false where code='creator-x'`);
  const paused=await startPurchase(ctx,'popular');await callback(ctx.fn,paused.token);
  assert.equal((await commissions(ctx.db)).length,0,'no commission for an inactive creator');
  // A creator's own account can neither claim nor earn from its own code.
  await asService(ctx.db,`insert into public.affiliates(code,owner_user_id) values('own-code',$1)`,[B]);
  await role(ctx.db,'authenticated',B);
  assert.equal((await q(ctx.db,`select public.xora_capture_referral('own-code') as v`))[0].v,null,'self-referral refused');
  await ctx.db.exec('reset role');
 });
});

test('refunds and chargebacks void the commission, and the admin report adds up referred revenue and 30% owed',async()=>{
 await withFunction(async ctx=>{
  await referred(ctx.db,A);
  const a=await startPurchase(ctx,'popular');await callback(ctx.fn,a.token);
  const b=await startPurchase(ctx,'value');await callback(ctx.fn,b.token);
  const direct=await buyAs(ctx,B,'value');await callback(ctx.fn,direct.token);
  await asService(ctx.db,`select public.xora_void_affiliate_commission($1,'chargeback: bank dispute')`,[b.id]);
  await assert.rejects(asService(ctx.db,`select public.xora_void_affiliate_commission($1,'because')`,[a.id]),/invalid_void_reason/);
  const report=(await asService(ctx.db,`select * from public.xora_affiliate_report where code='creator-x'`))[0];
  assert.deepEqual({claimed:Number(report.claimed_users),signups:Number(report.referred_signups),purchases:Number(report.successful_purchases),revenue:Number(report.collected_revenue_usd).toFixed(2),owed:Number(report.commission_owed_usd).toFixed(2),voided:Number(report.voided_purchases),handle:report.handle,bps:report.commission_bps},
   {claimed:1,signups:1,purchases:1,revenue:'5.99',owed:'1.80',voided:1,handle:'CreatorX',bps:3000});
  // Browser roles see none of it; they can only ask whether a code is an active creator.
  for(const r of ['anon','authenticated']){
   await role(ctx.db,r,A);
   for(const sql of ['select * from public.affiliate_commissions','select * from public.xora_affiliate_report','select * from public.affiliates','select * from public.affiliate_attributions',
     `select public.xora_record_affiliate_commission('${a.id}')`,`select public.xora_void_affiliate_commission('${a.id}','refund')`,`select public.xora_attribute_referral('${A}','creator-x','x')`,
     `select public.xora_claim_referral('${A}','creator-x')`,`insert into public.affiliate_attributions(user_id,referral_code) values('${B}','creator-x')`,
     `update public.affiliates set commission_bps=10000`]){
    await assert.rejects(ctx.db.exec(sql),r+': '+sql.slice(0,70));
   }
   assert.deepEqual((await q(ctx.db,`select public.xora_referral_preview('CREATOR-X') as v`))[0].v,{code:'creator-x',handle:'CreatorX'},r+' preview shows only code and handle');
   assert.equal((await q(ctx.db,`select public.xora_referral_preview('nobody') as v`))[0].v,null);
   await ctx.db.exec('reset role');
  }
 });
});
