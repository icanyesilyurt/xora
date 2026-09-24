const {test}=require('node:test');const assert=require('node:assert/strict');
const {edge,profileAI,matchAI,AI_COPY}=require('./helpers.cjs');
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
test('REAL AI output is generated for the request locale only (tr, en, es, pt, ar, fr, de, it, ja)',()=>{
 const e=edge();const sig={question_ratio:.8,own_posts:8};
 const otherKeys=/(?:_tr|_en|_es)$/;
 for(const locale of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']){
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
  for(const mutation of [r=>delete r.comment,r=>r.comment='',r=>r.tagline='Se analizaron 25 publicaciones.',r=>r.summary='Foram analisadas 25 publicações.',r=>r.comment='تم تحليل 25 منشورًا.',r=>r.tagline='حللنا ٢٥ تغريدة.',r=>r.summary='Après 25 publications, ce compte pose beaucoup de questions.',r=>r.comment='Publications analysées : 25 au total.',r=>r.tagline='25 Beiträge ausgewertet.',r=>r.summary='Nach 25 analysierten Beiträgen wirkt das Konto neugierig.',r=>r.tagline='Dopo 25 pubblicazioni sembra un account curioso.',r=>r.comment='Analizzati tutti i post recenti, emerge molta curiosità.',r=>r.tagline='25件の投稿を分析しました。',r=>r.summary='投稿を分析したところ、好奇心が強いようです。',r=>delete r.summary,r=>delete r.metrics[0].label]){
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
 assert.deepEqual(Object.keys(e.REAL_LOCALES),['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']);
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
 assert.ok(payload.profile_a?.signals && payload.profile_b?.own_voice || payload.signals);
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
  const payloads=[],systems=[];
  const service={from(){const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){return {data:{profile:{username:'alice'},posts:mixedPosts()}};}};return q;},
   async rpc(name,args){if(name==='xora_begin_real')return {data:{status:'claimed'}};if(name==='xora_claim_referral')return {data:null};if(name==='xora_complete_real')return {data:{result:args.p_result,balance:1}};throw Error(name);}};
  const e=edge({createClient:(_u,key)=>key==='test-anon'?{auth:{getUser:async()=>({data:{user:{id:'u'}}})}}:service,fetch:async(_url,options)=>{
   const body=JSON.parse(options.body);systems.push(body.system);const payload=JSON.parse(body.messages[0].content);payloads.push(payload);
   return Response.json({content:[{type:'text',text:JSON.stringify(payload.profile_a?matchAI(payload.locale):profileAI(payload.locale))}]});}});
  const res=await e.main(new Request('http://local.test',{method:'POST',body:JSON.stringify({mode,locale:'tr',handle:'alice',handles:['alice','bob'],request_id:'split-test-'+mode})}));
  assert.equal(res.status,200,mode);const {result}=await res.json();
  assert.ok(systems[0].includes(e.REPOST_RULE),mode+' system prompt carries the repost rule');
  const sections=mode==='match'?[payloads[0].profile_a,payloads[0].profile_b]:[payloads[0]];
  for(const s of sections){assert.equal(s.posts,undefined,'no mixed post list');assert.equal(s.own_voice.length,6);assert.equal(s.interest_sharing.length,10);assert.equal(s.sample.repost,19);}
  assert.ok(payloads[0].rules.includes(e.REPOST_RULE),mode+' rules carry the repost rule');
  assert.ok(payloads[0].rules.some(r=>/own_voice_evidence is "thin"/.test(r)),mode+' thin-evidence rule');
  if(mode==='match'){for(const side of ['resA','resB'])assert.deepEqual({...result[side].sample},{analyzed:25,original:3,reply:2,quote:1,repost:19},side);}
  else {
   assert.deepEqual({...result.meta.sample},{analyzed:25,original:3,reply:2,quote:1,repost:19});assert.equal(result.meta.sample_size,25);
   assert.ok(payloads[0].rules.some(r=>/exactly 6 original nickname candidates/.test(r)));assert.deepEqual([...payloads[0].nickname_style_examples],[...e.NICKNAME_STYLE_EXAMPLES.tr]);
  }
 }
});
test('nicknames: the most distinctive valid candidate wins over generic labels',()=>{
 const e=edge({console:{warn(){}}});const sig={own_posts:8,repost_ratio:.8,question_ratio:.5};
 for(const name of ['Tribün Yankısı','Gündem Takipçisi','Sessiz Gözlemci','Sosyal Gözlemci','Dijital Gezgin','Meraklı Biri','Paylaşmayı Seven','Sohbeti Seven']) assert.equal(e.aliasGeneric(name,'tr'),true,name);
 for(const name of ['Kartal Gündemcisi','Tek Cümlelik Taraftar','Thread’li Kod Filozofu']) assert.equal(e.aliasGeneric(name,'tr'),false,name);
 const pick=list=>e.pickAlias({nickname_candidates:list.map(text=>({text,evidence:'repost_ratio'}))},sig,'tr');
 assert.equal(pick(['Tribün Yankısı','Gündem Takipçisi','Kartal Gündemcisi']).text,'Kartal Gündemcisi','generic labels are skipped while a distinctive one exists');
 assert.equal(pick(['Kartal Gündemcisi','Tek Cümlelik Taraftar']).text,'Kartal Gündemcisi','otherwise the AI order (most distinctive first) is kept');
 const onlyGeneric=pick(['Gündem Takipçisi']);assert.equal(onlyGeneric.text,'Gündem Takipçisi');assert.equal(onlyGeneric.source,'ai_generated_validated','a valid generic AI name still beats the fallback');
 // Style examples are topic + behaviour, pass each locale's own quality gate and are not generic.
 for(const [locale,examples] of Object.entries(e.NICKNAME_STYLE_EXAMPLES)) for(const x of examples){assert.equal(e.aliasValid(x,locale),true,locale+' '+x);assert.equal(e.aliasGeneric(x,locale),false,locale+' '+x);}
 for(const locale of Object.keys(e.NICKNAME_STYLE_EXAMPLES)) assert.ok(!e.NICKNAME_STYLE_EXAMPLES[locale].some(x=>['Sessiz Gözlemci','Meraklı Biri','Curious Mind','Quiet Observer','Mente Curiosa'].includes(x)),locale);
});

test('card icons: the chosen archetype brings its own validated emoji; unsafe or missing icons fall back deterministically',async()=>{
 const e=edge({console:{warn(){}}});const sig={own_posts:8,repost_ratio:.8,question_ratio:.5};
 for(const ok of ['🦅','🛋️','💥','📣','⚽']) assert.ok(e.iconValid(ok),ok);
 for(const bad of ['🇹🇷','👍🏽','👨‍💻','1️⃣','✝️','☪️','🔫','🖕','🍆','🏴','🦅🦅','ab','',null,42]) assert.equal(e.iconValid(bad),null,String(bad));
 const pick=list=>e.pickAlias({nickname_candidates:list},sig,'tr');
 assert.equal(pick([{text:'Kartal Gündemcisi',evidence:'repost_ratio',emoji:'🦅'}]).icon,'🦅','icon of the chosen name');
 assert.equal(pick([{text:'Gündem Takipçisi',evidence:'repost_ratio',emoji:'📰'},{text:'Kartal Gündemcisi',evidence:'repost_ratio',emoji:'🦅'}]).icon,'🦅','the icon follows the name that wins, not the first candidate');
 assert.equal(pick([{text:'Kartal Gündemcisi',evidence:'repost_ratio',emoji:'🇹🇷'}]).icon,'📣','unsafe icon falls back to its evidence');
 assert.equal(e.pickAlias({nickname_candidates:[{text:'Kartal Gündemcisi',evidence:'repost_ratio'}],emoji:'🦅'},sig,'tr').icon,'🦅','result emoji as second choice');
 const fb=e.pickAlias({nickname_candidates:[]},{question_ratio:.5},'tr');assert.equal(fb.source,'fallback');assert.equal(fb.icon,'❓','fallback name keeps a matching icon');
 assert.equal(e.pickAlias({nickname_candidates:[]},{},'tr').icon,'✨');
 // Saved results carry the icon in card.emoji, profile_emoji and archetype.emoji; never the old fixed 🪞/👀.
 for(const mode of ['mirror','stalk']){
  const raw=profileAI('tr');raw.nickname_candidates=[{text:'Kartal Gündemcisi',evidence:'question_ratio',emoji:'🦅'}];
  const r=e.normalizeAIProfile(raw,'alice',mode,{own_posts:8,question_ratio:.5},'tr');
  assert.deepEqual([r.card.emoji,r.profile_emoji,r.archetype.emoji],['🦅','🦅','🦅'],mode);
 }
 const raw=profileAI('tr');raw.nickname_candidates=[];raw.emoji='👀';
 assert.equal(e.normalizeAIProfile(raw,'alice','stalk',{own_posts:8,question_ratio:.5},'tr').card.emoji,'❓','no candidate: evidence icon, not the AI result emoji');
 // Match: one icon per account from the AI, 👤 when missing or unsafe.
 const service={from(){const q={select(){return q;},eq(){return q;},gt(){return q;},async maybeSingle(){return {data:{profile:{username:'alice'},posts:Array.from({length:8},()=>({text:'Soru?',type:'original',metrics:{likes:0,replies:0,reposts:0}}))}};}};return q;}};
 for(const [a,b,want] of [['⚽','💻',['⚽','💻']],['🇹🇷',undefined,['👤','👤']]]){
  const m=edge({fetch:async()=>Response.json({content:[{type:'text',text:JSON.stringify({...matchAI('tr'),icon_a:a,icon_b:b})}]})});
  const res=await m.analyzeMatch(service,'alice','bob','tr');assert.deepEqual([res.resA.archetype.emoji,res.resB.archetype.emoji],want);
 }
});
