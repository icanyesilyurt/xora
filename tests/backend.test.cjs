const {test}=require('node:test');const assert=require('node:assert/strict');
const {edge,profileAI,matchAI,AI_COPY}=require('./helpers.cjs');
test('strict request validation before billing',()=>{
 const e=edge();const base={mode:'mirror',locale:'tr',handle:'@Alice',request_id:'request-123'};
 assert.equal(e.validateRequest(base).handles[0],'alice');
 for(const locale of ['tr','en','es','pt','ar']) assert.equal(e.validateRequest({...base,locale}).locale,locale);
 // Planned but not yet served locales are rejected before billing until they have REAL language rules.
 for(const patch of [{mode:'fun'},{mode:'oops'},{locale:'fr'},{locale:'it'},{locale:'de'},{locale:'ES'},{locale:'es-ES'},{locale:'PT'},{locale:'pt-BR'},{locale:'AR'},{locale:'ar-SA'},{handle:'abc!'},{handle:'a b'},{handle:'a'.repeat(16)},{handle:32},{request_id:'../id'},{mode:'match',handles:['Alice','@alice']}]) assert.throws(()=>e.validateRequest({...base,...patch}),/bad_request/);
});
test('X upstream diagnostics are phase-specific and sanitized',()=>{
 const e=edge();
 const d=e.xErrorDiagnostic('profile_lookup',403,JSON.stringify({title:'Forbidden',detail:'Bearer secret-token sk-live-abc and raw tweet text',type:'https://api.x.com/problems/auth',errors:[{message:'Invalid token',code:'invalid_token'}]}));
 assert.equal(JSON.stringify(d),JSON.stringify({phase:'profile_lookup',status:403,title:'Forbidden',detail:'[redacted] [redacted] and raw tweet text',type:'https://api.x.com/problems/auth',errors:[{message:'Invalid token',code:'invalid_token'}]}));
 const plain=e.xErrorDiagnostic('tweets_fetch',503,'Authorization: Bearer abcdefghijklmnopqrstuvwxyz\ninternal failure');
 assert.equal(plain.phase,'tweets_fetch');assert.equal(plain.status,503);assert.ok(plain.detail.length<=160);assert.doesNotMatch(plain.detail,/Bearer\s+abcdefghijklmnopqrstuvwxyz/);assert.doesNotMatch(plain.detail,/Authorization/i);
});
test('REAL shape, rarity, nickname evidence and safe deterministic fallback',()=>{
 const e=edge();const sig={question_ratio:.8,own_posts:8};const raw=profileAI('tr');
 const result=e.normalizeAIProfile(raw,'alice','mirror',sig,'tr');
 assert.equal(result.meta.tier,'real');assert.ok(['common','rare','epic','legendary'].includes(result.rarity.name));
 assert.equal(result.meta.alias_source,'ai_generated_validated');assert.equal(result.nickname.tr,'Meraklı Biri');
 for(const v of ['Cosmic Potato Wizard','Kozmik Salatalık','Bipolar Genius','a','<img src=x>','Meraklı Biri https://x.test','One Two Three Four Five']) assert.equal(e.aliasValid(v,'en'),false,v);
 for(const [v,lang] of [['Meraklı Biri','tr'],['Sessiz Gözlemci','tr'],['Thoughtful Conversationalist','en'],['Inquisitive Mind','en']]) assert.equal(e.aliasValid(v,lang),true,v);
 raw.nickname_candidates[0].evidence='invented';assert.equal(e.pickAlias(raw,sig,'tr').source,'fallback');
 raw.nickname_candidates[0].evidence='question_ratio';assert.equal(e.pickAlias(raw,{own_posts:8,question_ratio:0},'tr').source,'fallback');
 const novel={nickname_candidates:[{text:'Meraklı Muhabbetçi',evidence:'question_ratio'}]};assert.equal(e.pickAlias(novel,{own_posts:8,question_ratio:.8},'tr').source,'ai_generated_validated');
});
test('REAL AI output is generated for the request locale only (tr, en, es, pt, ar)',()=>{
 const e=edge();const sig={question_ratio:.8,own_posts:8};
 const otherKeys=/(?:_tr|_en|_es)$/;
 for(const locale of ['tr','en','es','pt','ar']){
  const copy=AI_COPY[locale];
  // The model output carries no per-locale field names and no other language.
  const raw=profileAI(locale);
  assert.equal(Object.keys(raw).some(k=>otherKeys.test(k)),false);
  const result=e.normalizeAIProfile(raw,'alice','mirror',sig,locale);
  assert.equal(result.meta.locale,locale);
  for(const field of [result.nickname,result.tagline,result.profile_summary,result.comment.mirror,result.comment.stalk,result.card.nickname,result.card.desc,result.archetype.comments,...result.top_behaviors.map(m=>m.label)]) assert.deepEqual(Object.keys(field),[locale]);
  assert.equal(result.nickname[locale],copy.nickname);
  assert.equal(result.tagline[locale],copy.tagline);
  assert.equal(result.profile_summary[locale],copy.summary);
  assert.equal(result.comment.mirror[locale],copy.comment);
  assert.equal(result.archetype.comments[locale][0],copy.comment);
  for(const metric of result.top_behaviors) assert.equal(metric.label[locale],copy.label);
  // Locale-independent parts are unchanged by locale.
  assert.equal(JSON.stringify(result.rarity),JSON.stringify(e.normalizeAIProfile(profileAI('en'),'alice','mirror',sig,'en').rarity));
  const match=e.normalizeMatchAI(matchAI(locale),'a','b',{},{},locale);
  assert.equal(match.meta.locale,locale);assert.deepEqual(Object.keys(match.ai_comment),[locale]);assert.equal(match.ai_comment[locale],copy.match);
  // A missing or unsafe field in the request locale is rejected, never filled from another language.
  for(const mutation of [r=>delete r.comment,r=>r.comment='',r=>r.tagline='Se analizaron 25 publicaciones.',r=>r.summary='Foram analisadas 25 publicações.',r=>r.comment='تم تحليل 25 منشورًا.',r=>r.tagline='حللنا ٢٥ تغريدة.',r=>delete r.summary,r=>delete r.metrics[0].label]){
   const bad=profileAI(locale);mutation(bad);assert.throws(()=>e.normalizeAIProfile(bad,'alice','mirror',sig,locale),/ai_bad/);
  }
  const badMatch=matchAI(locale);delete badMatch.comment;assert.throws(()=>e.normalizeMatchAI(badMatch,'a','b',{},{},locale),/ai_bad_copy/);
  // Fallback nickname is native to the request locale only.
  const fallback=e.pickAlias({nickname_candidates:[]},{question_ratio:.8},locale);
  assert.equal(fallback.source,'fallback');assert.equal(fallback.text,copy.nickname);assert.equal(e.aliasValid(fallback.text,locale),true);
 }
});
test('REAL schema asks for one set of user-facing strings, independent of locale count',()=>{
 const e=edge();
 for(const isMatch of [false,true]){
  const schema=JSON.parse(JSON.stringify(e.aiResultSchema(isMatch)));
  const names=[];(function walk(node){if(node&&typeof node==='object'){for(const [k,v] of Object.entries(node)){if(k==='properties')names.push(...Object.keys(v));walk(v);}}})(schema);
  assert.equal(names.some(n=>/^(?:tr|en|es|pt|it|fr|de|ru|ja|ko|zh|ar)$|_(?:tr|en|es)$/.test(n)),false,'no per-locale fields in schema');
  assert.ok(names.includes('comment'));
  if(!isMatch){for(const n of ['tagline','summary','label','text','nickname_candidates'])assert.ok(names.includes(n),n);}
 }
 assert.deepEqual([...e.PLANNED_LOCALES],['tr','en','es','pt','it','fr','de','ru','ja','ko','zh','ar']);
 assert.deepEqual(Object.keys(e.REAL_LOCALES),['tr','en','es','pt','ar']);
});
test('malformed AI metrics/copy rejected, never renamed or silently clamped',()=>{
 const e=edge();
 for(const mutation of [r=>r.metrics[0].key='unknown',r=>r.metrics[0].value=101,r=>r.metrics[0].value='70',r=>r.metrics[0].value=NaN,r=>r.metrics[1].key=r.metrics[0].key,r=>r.metrics=[],r=>r.comment='25 posts analyzed.',r=>r.tagline='20 paylaşım incelendi.',r=>r.summary={},r=>r.observations=[{text:'bad'}]]) {
  const raw=profileAI('en');mutation(raw);assert.throws(()=>e.normalizeAIProfile(raw,'alice','stalk',{own_posts:8},'en'),/ai_bad/);
 }
 const match=matchAI();match.metrics[0].key='unknown';assert.throws(()=>e.normalizeMatchAI(match,'a','b',{}, {},'en'),/ai_bad_metrics/);
});
 function fixture({failure,refundFailures=0,begin='claimed'}={}) {
 const calls=[];let aiCalls=0;let refundAttempts=0;
 const service={from(table){assert.equal(table,'x_cache'); const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){if(failure==='x') throw Error('x_api_error');return {data:{profile:{username:'alice'},posts:Array.from({length:8},(_,i)=>({text:'Question?',type:'original',metrics:{likes:i,replies:0,reposts:0}}))}};}};return q;},async rpc(name,args){calls.push({name,args});if(name==='xora_begin_real') return {data:{status:begin,result:{saved:true},balance:10}};if(name==='xora_claim_referral') return {data:{referral_code:'creator-a',expires_at:'2026-10-01'}};if(name==='xora_complete_real'){if(failure==='save')return {error:{message:'db failed'}};return {data:{result:args.p_result,balance:10}};}if(name==='xora_fail_real'){refundAttempts++;if(refundAttempts<=refundFailures) return {error:{message:'offline'}};return {data:{status:failure==='lost-save'?'succeeded':'failed',result:{saved:true},balance:20}};}throw Error(name);}};
 const e=edge({createClient:(_url,key)=>key==='test-anon'?{auth:{getUser:async()=>({data:{user:{id:'test-user'}}})}}:service,fetch:async(_url,options)=>{
 aiCalls++;if(failure==='ai')throw Error('ai_error');const payload=JSON.parse(JSON.parse(options.body).messages[0].content);
 assert.ok(payload.profile_a?.signals && payload.profile_b?.posts || payload.signals);
 let raw=payload.profile_a?matchAI(payload.locale):profileAI(payload.locale);if(failure==='validation')raw.metrics[0].key='oops';
 return Response.json({content:[{type:'text',text:JSON.stringify(raw)}]});
 }});
 return {e,calls,get aiCalls(){return aiCalls;}};
}
function request(mode='match'){return new Request('http://local.test',{method:'POST',body:JSON.stringify({mode,locale:'en',handle:'alice',handles:['alice','bob'],request_id:'request-123'})});}
test('Match runs one AI call total; Mirror and Stalk run one each',async()=>{
 for(const mode of ['match','mirror','stalk']){const f=fixture();const response=await f.e.main(request(mode));assert.equal(response.status,200);const data=await response.json();assert.equal(f.aiCalls,1);assert.equal(data.result.meta.tier,'real');assert.ok(data.result.rarity);assert.equal(f.calls.filter(x=>x.name==='xora_complete_real').length,1);assert.equal(f.calls.filter(x=>x.name==='xora_fail_real').length,0);}
});
test('X, AI, validation and save failures settle refund; retry same refund on RPC errors',async()=>{
 for(const failure of ['x','ai','validation','save']){const f=fixture({failure});assert.equal((await f.e.main(request())).status,500);assert.equal(f.calls.filter(x=>x.name==='xora_fail_real').length,1);}
 const f=fixture({failure:'ai',refundFailures:2});await f.e.main(request());assert.equal(f.calls.filter(x=>x.name==='xora_fail_real').length,3);
 const pending=fixture({failure:'ai',refundFailures:3});assert.equal((await (await pending.e.main(request())).json()).code,'refund_pending');
});
test('duplicate/completed/failed requests never call X or AI again',async()=>{
 for(const begin of ['pending','succeeded','failed']){const f=fixture({begin});assert.equal((await f.e.main(request())).status,begin==='succeeded'?200:409);assert.equal(f.aiCalls,0);assert.equal(f.calls.length,1);}
});
test('uncached Match fetches two app-only public datasets, caches each, calls AI once',async()=>{
 let xCalls=0,aiCalls=0,cacheWrites=0;
 const service={from(name){assert.equal(name,'x_cache');const q={select(){return q;},eq(){return q;},gt(){return q;},maybeSingle:async()=>({data:null}),upsert:async()=>{cacheWrites++;return {error:null};}};return q;}};
 const e=edge({fetch:async(url,options)=>{
  if(url.startsWith('https://api.x.com/')){
   xCalls++;assert.equal(options.headers.Authorization,'Bearer test-x');assert.ok(options.signal);
   if(url.includes('/by/username/'))return Response.json({data:{id:url.includes('alice')?'1':'2',username:url.includes('alice')?'alice':'bob',protected:false}});
   return Response.json({data:Array.from({length:8},(_,i)=>({id:String(i),text:'Question?',public_metrics:{like_count:1}}))});
  }
  aiCalls++;assert.ok(options.signal);return Response.json({content:[{type:'text',text:JSON.stringify(matchAI())}]});
 }});
 const result=await e.analyzeMatch(service,'alice','bob','en');assert.equal(xCalls,4);assert.equal(cacheWrites,2);assert.equal(aiCalls,1);assert.equal(result.meta.tier,'real');
});
