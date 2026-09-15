const {test}=require('node:test');const assert=require('node:assert/strict');
const {edge,profileAI,matchAI}=require('./helpers.cjs');
test('strict request validation before billing',()=>{
 const e=edge();const base={mode:'mirror',locale:'tr',handle:'@Alice',request_id:'request-123'};
 assert.equal(e.validateRequest(base).handles[0],'alice');
 for(const patch of [{mode:'fun'},{mode:'oops'},{locale:'fr'},{handle:'abc!'},{handle:'a b'},{handle:'a'.repeat(16)},{handle:32},{request_id:'../id'},{mode:'match',handles:['Alice','@alice']}]) assert.throws(()=>e.validateRequest({...base,...patch}),/bad_request/);
});
test('X upstream diagnostics are phase-specific and sanitized',()=>{
 const e=edge();
 const d=e.xErrorDiagnostic('profile_lookup',403,JSON.stringify({title:'Forbidden',detail:'Bearer secret-token sk-live-abc and raw tweet text',type:'https://api.x.com/problems/auth',errors:[{message:'Invalid token',code:'invalid_token'}]}));
 assert.equal(JSON.stringify(d),JSON.stringify({phase:'profile_lookup',status:403,title:'Forbidden',detail:'[redacted] [redacted] and raw tweet text',type:'https://api.x.com/problems/auth',errors:[{message:'Invalid token',code:'invalid_token'}]}));
 const plain=e.xErrorDiagnostic('tweets_fetch',503,'Authorization: Bearer abcdefghijklmnopqrstuvwxyz\ninternal failure');
 assert.equal(plain.phase,'tweets_fetch');assert.equal(plain.status,503);assert.ok(plain.detail.length<=160);assert.doesNotMatch(plain.detail,/Bearer\s+abcdefghijklmnopqrstuvwxyz/);assert.doesNotMatch(plain.detail,/Authorization/i);
});
test('REAL shape, rarity, nickname evidence and safe deterministic fallback',()=>{
 const e=edge();const sig={question_ratio:.8,own_posts:8};const raw=profileAI();
 const result=e.normalizeAIProfile(raw,'alice','mirror',sig,'tr');
 assert.equal(result.meta.tier,'real');assert.ok(['common','rare','epic','legendary'].includes(result.rarity.name));
 assert.equal(result.meta.alias_source,'ai_generated_validated');
 for(const v of ['Cosmic Potato Wizard','Kozmik Salatalık','Bipolar Genius','a','<img src=x>','Meraklı Biri https://x.test','One Two Three Four Five']) assert.equal(e.aliasValid(v,'en'),false,v);
 for(const [v,lang] of [['Meraklı Biri','tr'],['Sessiz Gözlemci','tr'],['Thoughtful Conversationalist','en'],['Inquisitive Mind','en']]) assert.equal(e.aliasValid(v,lang),true,v);
 raw.nickname_candidates[0].evidence='invented';assert.equal(e.pickAliasPair(raw,sig).source,'fallback');
 raw.nickname_candidates[0].evidence='question_ratio';assert.equal(e.pickAliasPair(raw,{own_posts:8,question_ratio:0}).source,'fallback');
 const novel={nickname_candidates:[{tr:'Meraklı Muhabbetçi',en:'Thoughtful Conversationalist',evidence:'question_ratio'}]};assert.equal(e.pickAliasPair(novel,{own_posts:8,question_ratio:.8}).source,'ai_generated_validated');
});
test('malformed AI metrics/copy rejected, never renamed or silently clamped',()=>{
 const e=edge();
 for(const mutation of [r=>r.metrics[0].key='unknown',r=>r.metrics[0].value=101,r=>r.metrics[0].value='70',r=>r.metrics[0].value=NaN,r=>r.metrics[1].key=r.metrics[0].key,r=>r.metrics=[],r=>r.comment_en='25 posts analyzed.',r=>r.tagline_tr='20 paylaşım incelendi.',r=>r.summary_en={},r=>r.observations=[{text:'bad'}]]) {
  const raw=profileAI();mutation(raw);assert.throws(()=>e.normalizeAIProfile(raw,'alice','stalk',{own_posts:8},'en'),/ai_bad/);
 }
 const match=matchAI();match.metrics[0].key='unknown';assert.throws(()=>e.normalizeMatchAI(match,'a','b',{}, {},'en'),/ai_bad_metrics/);
});
 function fixture({failure,refundFailures=0,begin='claimed'}={}) {
 const calls=[];let aiCalls=0;let refundAttempts=0;
 const service={from(table){assert.equal(table,'x_cache'); const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){if(failure==='x') throw Error('x_api_error');return {data:{profile:{username:'alice'},posts:Array.from({length:8},(_,i)=>({text:'Question?',type:'original',metrics:{likes:i,replies:0,reposts:0}}))}};}};return q;},async rpc(name,args){calls.push({name,args});if(name==='xora_begin_real') return {data:{status:begin,result:{saved:true},balance:10}};if(name==='xora_claim_referral') return {data:{referral_code:'creator-a',expires_at:'2026-10-01'}};if(name==='xora_complete_real'){if(failure==='save')return {error:{message:'db failed'}};return {data:{result:args.p_result,balance:10}};}if(name==='xora_fail_real'){refundAttempts++;if(refundAttempts<=refundFailures) return {error:{message:'offline'}};return {data:{status:failure==='lost-save'?'succeeded':'failed',result:{saved:true},balance:20}};}throw Error(name);}};
 const e=edge({createClient:(_url,key)=>key==='test-anon'?{auth:{getUser:async()=>({data:{user:{id:'test-user'}}})}}:service,fetch:async(_url,options)=>{
 aiCalls++;if(failure==='ai')throw Error('ai_error');const payload=JSON.parse(JSON.parse(options.body).messages[0].content);
 assert.ok(payload.profile_a?.signals && payload.profile_b?.posts || payload.signals);
 let raw=payload.profile_a?matchAI():profileAI();if(failure==='validation')raw.metrics[0].key='oops';
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
