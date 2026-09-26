const {test}=require('node:test');const assert=require('node:assert/strict');
const {edge,profileAI,matchAI,AI_COPY,seriousAI,isSeriousRequest,seriousLocale,nicknameAI,isNicknameRequest,nicknameLocale,NICK_COPY,ANALYSIS_COPY}=require('./helpers.cjs');
test('strict request validation before billing',()=>{
 const e=edge();const base={mode:'mirror',locale:'tr',handle:'@Alice',request_id:'request-123'};
 assert.equal(e.validateRequest(base).handles[0],'alice');
 for(const locale of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']) assert.equal(e.validateRequest({...base,locale}).locale,locale);
 // Planned but not yet served locales are rejected before billing until they have REAL language rules.
 for(const patch of [{mode:'fun'},{mode:'oops'},{locale:'RU'},{locale:'ru-RU'},{locale:'ZH'},{locale:'zh-TW'},{locale:'KO'},{locale:'ko-KR'},{locale:'JA'},{locale:'ja-JP'},{locale:'IT'},{locale:'it-IT'},{locale:'FR'},{locale:'fr-FR'},{locale:'DE'},{locale:'de-DE'},{locale:'ES'},{locale:'es-ES'},{locale:'PT'},{locale:'pt-BR'},{locale:'AR'},{locale:'ar-SA'},{handle:'abc!'},{handle:'a b'},{handle:'a'.repeat(16)},{handle:32},{request_id:'../id'},{mode:'match',handles:['Alice','@alice']}]) assert.throws(()=>e.validateRequest({...base,...patch}),/bad_request/);
});
test('X upstream diagnostics are phase-specific and sanitized',()=>{
 const e=edge();
 const d=e.xErrorDiagnostic('profile_lookup',403,JSON.stringify({title:'Forbidden',detail:'Bearer secret-token sk-live-abc and raw tweet text',type:'https://api.x.com/problems/auth',errors:[{message:'Invalid token',code:'invalid_token'}]}));
 assert.equal(JSON.stringify(d),JSON.stringify({phase:'profile_lookup',status:403,title:'Forbidden',detail:'[redacted] [redacted] and raw tweet text',type:'https://api.x.com/problems/auth',errors:[{message:'Invalid token',code:'invalid_token'}]}));
 const plain=e.xErrorDiagnostic('tweets_fetch',503,'Authorization: Bearer abcdefghijklmnopqrstuvwxyz\ninternal failure');
 assert.equal(plain.phase,'tweets_fetch');assert.equal(plain.status,503);assert.ok(plain.detail.length<=160);assert.doesNotMatch(plain.detail,/Bearer\s+abcdefghijklmnopqrstuvwxyz/);assert.doesNotMatch(plain.detail,/Authorization/i);
});
// A serious-analysis result as analyzeSerious returns it, for the nickname and result builders.
const seriousFor=(locale='tr')=>{const e=edge();const posts=Array.from({length:8},(_,i)=>({text:'Soru?',type:'original',metrics:{likes:i,replies:0,reposts:0}}));return {...e.normalizeAnalysis(seriousAI(locale),posts,{username:'alice'}),locale,ts:'2026-09-26T00:00:00Z'};};
test('nickname rule: exactly two words, letters only',()=>{
 const e=edge();
 for(const ok of ['Sessiz Gözlemci','Kaos Elçisi','Gece Kuşu','  Tatlı   Bela ','Laf-Cambazı Usta','質問の 達人','سيد الأسئلة','Главный почемучка']) assert.ok(e.nicknameValid(ok),ok);
 assert.equal(e.nicknameValid('  Tatlı   Bela '),'Tatlı Bela');
 for(const bad of ['Gözlemci','Sessiz Gece Kuşu','Transfer Dönemi Yorumcusu','Gece Kuşu!','Gece 2Kuşu','Gece Kuşu 🦉','#Gece Kuşu','質問好き','',null,42,'a'.repeat(30)+' '+'b'.repeat(20)]) assert.equal(e.nicknameValid(bad),null,String(bad));
 // Every fallback is two words, in every locale.
 for(const [category,v] of Object.entries(e.NICKNAME_FALLBACKS)) for(const [locale,name] of Object.entries(v.names)) assert.ok(e.nicknameValid(name),category+' '+locale+' '+name);
});
test('nickname input is the character profile only: never raw posts',()=>{
 const e=edge();const serious=seriousFor('tr');
 const input=JSON.parse(JSON.stringify(e.nicknameInput(serious,'alice')));
 assert.deepEqual(Object.keys(input),['handle','traits','character_analysis','persistent_interests']);
 assert.deepEqual(input.traits.map(t=>Object.keys(t)),input.traits.map(()=>['id','label','score']));
 assert.equal(input.character_analysis,ANALYSIS_COPY.tr);
 assert.doesNotMatch(JSON.stringify(input),/Soru\?|post_refs|evidence|"posts"/);
 const system=e.nicknameSystemPrompt('Turkish');
 assert.match(system,/EXACTLY TWO WORDS/);assert.match(system,/never see the account's posts/);assert.match(system,/never build the name from a recent topic/);
});
test('nickname generation: one retry on a non two-word name, then a trait-based fallback',async()=>{
 const run=async(replies)=>{const bodies=[];let i=0;
  const e=edge({console:{warn(){}},fetch:async(_u,o)=>{bodies.push(JSON.parse(o.body));const r=replies[Math.min(i++,replies.length-1)];if(r instanceof Error)throw r;return Response.json({content:[{type:'text',text:JSON.stringify(r)}]});}});
  return {nick:await e.generateNickname(seriousFor('tr'),'alice','tr'),bodies};};
 let r=await run([{nickname:'Soru Ustası',tagline:'Her konuya bir soruyla girer.',emoji:'🦉'}]);
 assert.deepEqual({...r.nick},{text:'Soru Ustası',tagline:'Her konuya bir soruyla girer.',icon:'🦉',source:'ai',attempts:1});assert.equal(r.bodies.length,1);
 r=await run([{nickname:'Soru',tagline:'x',emoji:'🦉'},{nickname:'Meraklı Kedi',tagline:'Sorar durur.',emoji:'🐈'}]);
 assert.equal(r.nick.text,'Meraklı Kedi');assert.equal(r.nick.attempts,2);assert.equal(r.bodies.length,2);
 assert.equal(r.bodies[0].messages[0].content,r.bodies[1].messages[0].content,'the retry uses the same character profile');
 r=await run([{nickname:'Gece Yarısı Soru Makinesi',tagline:'x',emoji:'🦉'},{nickname:'Sorucu',tagline:'x',emoji:'🦉'}]);
 // Strongest character trait is questioning (communication) -> its fallback.
 assert.deepEqual({...r.nick},{text:'Laf Cambazı',tagline:'',icon:'🎤',source:'fallback',attempts:2});assert.equal(r.bodies.length,2);
 r=await run([new Error('network'),new Error('network')]);assert.equal(r.nick.source,'fallback');assert.equal(r.nick.text,'Laf Cambazı');
 // Unsafe emoji and sample-count taglines are dropped, not fatal.
 r=await run([{nickname:'Soru Ustası',tagline:'25 paylaşım incelendi.',emoji:'🇹🇷'}]);
 assert.equal(r.nick.source,'ai');assert.equal(r.nick.tagline,'');assert.equal(r.nick.icon,'🎤');
});
test('REAL result: ontology bars, serious analysis as the main text, locale-only copy',()=>{
 const e=edge();
 for(const locale of ['tr','en','ja']){
  const serious=seriousFor(locale);
  const r=e.buildRealResult('alice','mirror',{sample_size:8,question_ratio:1,own_posts:8},locale,serious,{text:NICK_COPY[locale],tagline:AI_COPY[locale].tagline,icon:'🦉',source:'ai',attempts:1});
  assert.equal(r.meta.tier,'real');assert.equal(r.meta.analysis_version,'real_analysis_v1');assert.ok(['common','rare','epic','legendary'].includes(r.rarity.name));
  assert.deepEqual(JSON.parse(JSON.stringify(r.top_behaviors)),[{key:'questioning',label:{tr:'Soru Odaklı Üslup'},value:82},{key:'curiosity',label:{tr:'Merak'},value:74},{key:'brevity',label:{tr:'Özlü Anlatım'},value:66},{key:'confidence',label:{tr:'Özgüven'},value:55}]);
  for(const field of [r.nickname,r.tagline,r.comment.mirror,r.comment.stalk,r.card.nickname,r.card.desc,r.archetype.comments]) assert.deepEqual(Object.keys(field),[locale]);
  assert.equal(r.nickname[locale],NICK_COPY[locale]);assert.equal(r.comment.mirror[locale],ANALYSIS_COPY[locale]);
  assert.deepEqual([r.card.emoji,r.profile_emoji,r.archetype.emoji],['🦉','🦉','🦉']);
  assert.equal(r.analysis.ontology_version,'real-1.0');assert.ok(r.analysis.selected_traits.every(t=>t.evidence&&t.post_refs.length));
 }
 const serious=seriousFor('en');serious.character_analysis='25 posts analyzed. Two. Three.';
 assert.throws(()=>e.buildRealResult('alice','mirror',{},'en',serious,{text:'A B',tagline:'',icon:'🦉'}),/ai_bad_copy/);
});
test('malformed Match AI metrics/copy rejected, never renamed or silently clamped',()=>{
 const e=edge();
 for(const mutate of [m=>m.metrics[0].key='unknown',m=>m.metrics[0].value=101,m=>m.metrics[1].key=m.metrics[0].key,m=>m.comment='25 posts analyzed.',m=>delete m.comment,m=>m.overall=150]){
  const match=matchAI();mutate(match);assert.throws(()=>e.normalizeMatchAI(match,'a','b',{},{},'en'),/ai_bad/);
 }
});
 function fixture({failure,refundFailures=0,begin='claimed'}={}) {
 const calls=[];let aiCalls=0;let refundAttempts=0;
 const service={from(table){assert.equal(table,'x_cache'); const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){if(failure==='x') throw Error('x_api_error');return {data:{profile:{username:'alice'},posts:Array.from({length:8},(_,i)=>({text:'Question?',type:'original',metrics:{likes:i,replies:0,reposts:0}}))}};}};return q;},async rpc(name,args){calls.push({name,args});if(name==='xora_begin_real') return {data:{status:begin,result:{saved:true},balance:10}};if(name==='xora_claim_referral') return {data:{referral_code:'creator-a',expires_at:'2026-10-01'}};if(name==='xora_complete_real'){if(failure==='save')return {error:{message:'db failed'}};return {data:{result:args.p_result,balance:10}};}if(name==='xora_fail_real'){refundAttempts++;if(refundAttempts<=refundFailures) return {error:{message:'offline'}};return {data:{status:failure==='lost-save'?'succeeded':'failed',result:{saved:true},balance:20}};}throw Error(name);}};
 const e=edge({createClient:(_url,key)=>key==='test-anon'?{auth:{getUser:async()=>({data:{user:{id:'test-user'}}})}}:service,fetch:async(_url,options)=>{
 aiCalls++;if(failure==='ai')throw Error('ai_error');const body=JSON.parse(options.body);
 if(isSeriousRequest(body)) return Response.json({content:[{type:'text',text:JSON.stringify(seriousAI(seriousLocale(body,e)))}]});
 if(isNicknameRequest(body)) return Response.json({content:[{type:'text',text:JSON.stringify(nicknameAI(nicknameLocale(body,e)))}]});
 const payload=JSON.parse(body.messages[0].content);
 assert.ok(payload.profile_a?.signals && payload.profile_b?.own_voice || payload.signals);
 let raw=payload.profile_a?matchAI(payload.locale):profileAI(payload.locale);if(failure==='validation')raw.metrics[0].key='oops';
 return Response.json({content:[{type:'text',text:JSON.stringify(raw)}]});
 }});
 return {e,calls,get aiCalls(){return aiCalls;}};
}
function request(mode='match'){return new Request('http://local.test',{method:'POST',body:JSON.stringify({mode,locale:'en',handle:'alice',handles:['alice','bob'],request_id:'request-123'})});}
test('Match runs one AI call total; Mirror and Stalk run two (serious analysis, then nickname)',async()=>{
 for(const mode of ['match','mirror','stalk']){const f=fixture();const response=await f.e.main(request(mode));assert.equal(response.status,200);const data=await response.json();assert.equal(f.aiCalls,mode==='match'?1:2);assert.equal(data.result.meta.tier,'real');assert.ok(data.result.rarity);assert.equal(f.calls.filter(x=>x.name==='xora_complete_real').length,1);assert.equal(f.calls.filter(x=>x.name==='xora_fail_real').length,0);}
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

// ---------------------------------------------------------------------------------------------
// OWN VOICE / INTEREST-SHARING: reposts are someone else's words and reach the AI only as interests.
const mixedPosts=()=>[
 ...Array.from({length:3},(_,i)=>({id:'o'+i,text:'Kendi cümlem '+i,type:'original',metrics:{likes:i,replies:0,reposts:0}})),
 ...Array.from({length:2},(_,i)=>({id:'r'+i,text:'@x yanıtım '+i,type:'reply',metrics:{likes:0,replies:1,reposts:0}})),
 {id:'q0',text:'Alıntı yorumum',type:'quote',metrics:{likes:2,replies:0,reposts:1}},
 ...Array.from({length:19},(_,i)=>({id:'p'+i,text:'RT @kulup_hesabi: Başkasının cümlesi '+i+' '+'uzun '.repeat(40),type:'repost',metrics:{likes:99,replies:9,reposts:9}}))
];
test('AI input separates own voice from reposts, strips repost authors and counts the real sample',()=>{
 const e=edge();
 const input=e.aiPostInput(mixedPosts(),true);
 assert.deepEqual({...input.sample},{analyzed:25,original:3,reply:2,quote:1,repost:19});
 assert.equal(input.own_voice_evidence,'normal');
 assert.deepEqual([...input.own_voice].map(p=>p.type),['original','original','original','reply','reply','quote'],'own voice = originals, replies, quote commentary');
 assert.ok(input.own_voice.every(p=>!/Başkasının/.test(p.text)),'no repost wording in own voice');
 assert.equal(input.interest_sharing.length,10,'at most 10 reposts');
 for(const r of input.interest_sharing){assert.deepEqual(Object.keys(r),['text'],'reposts carry no engagement numbers or type');assert.doesNotMatch(r.text,/^RT @/,'author prefix stripped');assert.ok(r.text.length<=120);}
 const thin=e.aiPostInput([...mixedPosts().filter(p=>p.type==='repost'),{text:'tek',type:'original',metrics:{}},{text:'iki',type:'reply',metrics:{}}],false);
 assert.equal(thin.own_voice_evidence,'thin','fewer than 3 own-voice posts');assert.deepEqual(Object.keys(thin.own_voice[0]),['type','text']);
 assert.match(e.REPOST_RULE,/^Reposted text is written by someone else\. Never use repost wording to infer the user's writing tone, humour, vocabulary, personality, or archetype\. Use reposts only to understand repeated interests\/topics and sharing behaviour\.$/);
});
test('Mirror/Stalk/Match send the split input and the repost rule, and store the real sample counts',async()=>{
 for(const mode of ['mirror','stalk','match']){
  const payloads=[],systems=[],seriousInputs=[],nicknameInputs=[];
  const service={from(){const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){return {data:{profile:{username:'alice'},posts:mixedPosts()}};}};return q;},
   async rpc(name,args){if(name==='xora_begin_real')return {data:{status:'claimed'}};if(name==='xora_claim_referral')return {data:null};if(name==='xora_complete_real')return {data:{result:args.p_result,balance:1}};throw Error(name);}};
  const e=edge({createClient:(_u,key)=>key==='test-anon'?{auth:{getUser:async()=>({data:{user:{id:'u'}}})}}:service,fetch:async(_url,options)=>{
   const body=JSON.parse(options.body);if(isSeriousRequest(body)){seriousInputs.push(JSON.parse(body.messages[0].content));return Response.json({content:[{type:'text',text:JSON.stringify(seriousAI('tr'))}]});}
   if(isNicknameRequest(body)){nicknameInputs.push(JSON.parse(body.messages[0].content));return Response.json({content:[{type:'text',text:JSON.stringify(nicknameAI('tr'))}]});}
   systems.push(body.system);const payload=JSON.parse(body.messages[0].content);payloads.push(payload);
   return Response.json({content:[{type:'text',text:JSON.stringify(payload.profile_a?matchAI(payload.locale):profileAI(payload.locale))}]});}});
  const res=await e.main(new Request('http://local.test',{method:'POST',body:JSON.stringify({mode,locale:'tr',handle:'alice',handles:['alice','bob'],request_id:'split-test-'+mode})}));
  assert.equal(res.status,200,mode);const {result}=await res.json();
  if(mode==='match'){
   assert.ok(systems[0].includes(e.REPOST_RULE),'match system prompt carries the repost rule');
   for(const s of [payloads[0].profile_a,payloads[0].profile_b]){assert.equal(s.posts,undefined,'no mixed post list');assert.equal(s.own_voice.length,6);assert.equal(s.interest_sharing.length,10);assert.equal(s.sample.repost,19);}
   assert.ok(payloads[0].rules.includes(e.REPOST_RULE),'match rules carry the repost rule');
   assert.ok(payloads[0].rules.some(r=>/own_voice_evidence is "thin"/.test(r)),'thin-evidence rule');
   for(const side of ['resA','resB'])assert.deepEqual({...result[side].sample},{analyzed:25,original:3,reply:2,quote:1,repost:19},side);
  } else {
   assert.equal(payloads.length,0,'no raw-post nickname/card-copy call');
   assert.deepEqual({...result.meta.sample},{analyzed:25,original:3,reply:2,quote:1,repost:19});assert.equal(result.meta.sample_size,25);
   // The serious analysis gets the fetched posts as one indexed list, reposts marked and de-attributed.
   assert.equal(seriousInputs.length,1);const sp=seriousInputs[0].posts;assert.equal(sp.length,25);
   assert.deepEqual(sp.slice(0,6).map(p=>p.type),['original','original','original','reply','reply','quote']);
   assert.ok(sp.slice(6).every(p=>p.type==='repost'&&!/^RT @/.test(p.text)));
   // The nickname sees the character profile only.
   assert.equal(nicknameInputs.length,1);assert.deepEqual(Object.keys(nicknameInputs[0]),['handle','traits','character_analysis','persistent_interests']);
   assert.doesNotMatch(JSON.stringify(nicknameInputs[0]),/Kendi cümlem|yanıtım|Başkasının|Alıntı yorumum/);
   assert.equal(result.nickname.tr,'Soru Ustası');assert.equal(result.comment.mirror.tr,ANALYSIS_COPY.tr);
  }
 }
});
test('card icons: unsafe icons are refused; Match icons fall back deterministically',async()=>{
 const e=edge();
 for(const ok of ['🦅','🛋️','💥','📣','⚽']) assert.ok(e.iconValid(ok),ok);
 for(const bad of ['🇹🇷','👍🏽','👨‍💻','1️⃣','✝️','☪️','🔫','🖕','🍆','🏴','🦅🦅','ab','',null,42]) assert.equal(e.iconValid(bad),null,String(bad));
 // Match: one icon per account from the AI, 👤 when missing or unsafe.
 const service={from(){const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){return {data:{profile:{username:'alice'},posts:Array.from({length:8},()=>({text:'Soru?',type:'original',metrics:{likes:0,replies:0,reposts:0}}))}};}};return q;}};
 for(const [a,b,want] of [['⚽','💻',['⚽','💻']],['🇹🇷',undefined,['👤','👤']]]){
  const m=edge({fetch:async()=>Response.json({content:[{type:'text',text:JSON.stringify({...matchAI('tr'),icon_a:a,icon_b:b})}]})});
  const res=await m.analyzeMatch(service,'alice','bob','tr');assert.deepEqual([res.resA.archetype.emoji,res.resB.archetype.emoji],want);
 }
});
