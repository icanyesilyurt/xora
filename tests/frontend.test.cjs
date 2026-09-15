const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {browser}=require('./helpers.cjs');
test('every FUN persona has distinct localized character copy in generated, saved HTML and PNG results',()=>{
 const c=browser();
 const forbidden=/tamamen eğlencesine|çektin|çekti\b|bilimsel değeri yok|XORA['’]nın kanıtı yok|paylaşmalık değeri var|ücretsiz|\bfree\b|X verilerini analiz etmez|purely for fun|you drew|this account drew|no evidence|scientifically useless|socially shareable/i;
 const seen=new Map();
 for(let nonce=0;nonce<1000 && seen.size<c.FUN_CARD_POOL.length;nonce++){
  const result=c.analyzeFunHandle('alice','mirror',nonce);seen.set(result.nickname.tr,result);
 }
 assert.equal(seen.size,c.FUN_CARD_POOL.length);
 for(const lang of ['tr','en']){
  c.getLang=()=>lang;
  const unique=new Set();
  for(const [name,result] of seen){
   const expected=result.comment.mirror[lang];unique.add(expected);
   assert.doesNotMatch(expected,forbidden,name);
   const sentences=expected.match(/[^.!?]+[.!?]/g)||[];
   assert.ok(sentences.length>=2 && sentences.length<=4,name);
   assert.equal(result.archetype.comments[lang][0],expected);
   // Historical cards must resolve their persona rather than redisplay stored boilerplate.
   const saved=structuredClone(result);
   saved.comment.mirror[lang]='Tamamen eğlencesine: bu hesap çekti. XORA’nın kanıtı yok.';
   saved.archetype.comments[lang]=['Scientifically useless, socially shareable.'];
   const html=c.buildIdentityCard(saved);
   const middle=html.match(/<div class="idcard-quote fun-quote">([\s\S]*?)<\/div>/)[1];
   assert.equal(middle,'<p>'+c.esc(expected)+'</p>');
   assert.doesNotMatch(middle,forbidden);assert.doesNotMatch(middle,/XORA FUN|quote-label/);
   assert.ok(html.includes('XORA FUN · FREE'));
   assert.equal(saved.comment.mirror[lang],'Tamamen eğlencesine: bu hesap çekti. XORA’nın kanıtı yok.');
   const text=[];const ctx=new Proxy({measureText:v=>({width:String(v).length*13}),fillText:(v,x,y)=>text.push({v,x,y}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
   let box;const originalRect=c.roundRect;
   c.roundRect=(ctx,x,y,w,h,r)=>{if(x===130)box={y,h};originalRect(ctx,x,y,w,h,r);};
   c.document.createElement=()=>({getContext:()=>ctx});c.renderIdentityPNG(saved);c.roundRect=originalRect;
   assert.ok(text.some(p=>p.v==='XORA FUN · FREE'));assert.ok(!text.some(p=>p.v==='XORA FUN'));
   const copy=text.filter(p=>p.x===500 && p.y>700 && p.y<1090).map(p=>p.v).join(' ');
   assert.ok(copy.includes(expected),name+' PNG contains the full persona comment');
   assert.doesNotMatch(copy,forbidden);
   assert.ok(box.y+box.h<1090,name+' comment box stays above footer');
   assert.ok(text.filter(p=>p.x===500 && p.y>=box.y && p.y<1090).every(p=>p.y<box.y+box.h-15),name+' text fits inside comment box');
  }
  assert.equal(unique.size,c.FUN_CARD_POOL.length,'each nickname has its own '+lang+' comment');
 }
});
test('FUN generators are deterministic, rerollable, free and never access REAL APIs',()=>{
 const c=browser();c.requestRealAnalysis=()=>{throw Error('REAL called from FUN');};c.getSupabaseClient=()=>{throw Error('DB called from FUN');};
 for(const mode of ['mirror','stalk','match'])for(let nonce=0;nonce<12;nonce++) {
  const r=mode==='match'?c.matchFunHandles('alice','bob',nonce):c.analyzeFunHandle('alice',mode,nonce);
  assert.equal(r.meta.tier,'fun');assert.equal(r.rarity,undefined);const html=mode==='match'?c.buildMatchCard(r):c.buildIdentityCard(r);assert.ok(html.includes('XORA FUN · FREE'));assert.doesNotMatch(html,/XORA REAL|COMMON|LEGENDARY/);
 }
 assert.notEqual(c.analyzeFunHandle('alice','mirror',0).hash,c.analyzeFunHandle('alice','mirror',1).hash);
});
test('FUN product button paths execute without auth, credits or REAL network',async()=>{
 for(const name of ['mirror','stalk','match']) {
  const c=browser(),nodes=new Map();
  function node(id){if(!nodes.has(id))nodes.set(id,{value:id==='handleB'?'bob':'alice',hidden:false,textContent:'',innerHTML:'',classList:{toggle(){}},addEventListener(ev,fn){this[ev]=fn;},focus(){}});return nodes.get(id);}
  c.document.getElementById=node;c.initSession=async()=>{};c.isLoggedIn=()=>false;c.getUser=()=>null;c.applyI18n=()=>{};c.playThinking=(_e,_m,done)=>done();
  c.requestRealAnalysis=()=>{throw Error('FUN invoked REAL');};c.saveAnalysisRecord=()=>{throw Error('Anonymous FUN saved');};
  const inline=[...fs.readFileSync(name+'.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim()).pop();vm.runInContext(inline,c);await new Promise(resolve=>setImmediate(resolve));
  await node('goBtn').click();assert.match(node('cardHolder').innerHTML,/XORA FUN/);assert.equal(node('rerollBtn').hidden,false);
 }
});
test('legacy V1/V2/V3 and Match preserve original renderer paths without a fabricated REAL badge',()=>{
 const c=browser();const old=c.analyzeHandle('alice','mirror');
 const v1={handle:'alice',archetype:c.archetypeById('legacy'),ci:0,scores:Object.fromEntries(c.SCORE_KEYS.map(k=>[k,50])),hash:1};
 const v2=structuredClone(old);v2.meta={version:'mirror_v2'};
 for(const [r,expected] of [[v1,c.buildIdentityCardV1(v1)],[v2,c.buildIdentityCardV2(c.cardPresentationCopy(v2))],[old,c.buildIdentityCardV3(c.cardPresentationCopy(old))]]) {assert.equal(c.resultTier(r),'legacy');assert.equal(c.buildIdentityCard(r),expected);assert.doesNotMatch(c.buildIdentityCard(r),/XORA REAL|XORA FUN/);}
 assert.ok(c.buildMatchCard(c.matchHandles('alice','bob')).includes('match-rows'));
});
test('sample-count copy suppressed in HTML, PNG text and share copy; internal meta preserved',()=>{
 const c=browser();const r=c.analyzeFunHandle('alice','mirror',1);r.tagline={tr:'25 posts analyzed. Safe phrase.',en:'20 posts analyzed.'};r.meta.sample_size=25;
 const clean=c.cardPresentationCopy(r);assert.equal(clean.meta.sample_size,25);assert.equal(r.tagline.tr,'25 posts analyzed. Safe phrase.');assert.doesNotMatch(c.buildIdentityCard(r),/25 posts/);
 const text=[];const ctx=new Proxy({measureText:v=>({width:String(v).length*10}),fillText:v=>text.push(v),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});c.document.createElement=()=>({getContext:()=>ctx});
 c.renderIdentityPNG(r);assert.doesNotMatch(text.join(' '),/25 posts/);assert.ok(text.some(v=>String(v).includes('XORA FUN')));
});
test('referral active first-touch propagation and expiry; local credits cannot be minted',()=>{
 const c=browser();c.location.search='?ref=creator-a';c.captureReferral();const first=c.localStorage.getItem(c.LS.referral);c.location.search='?ref=creator-b';c.captureReferral();assert.equal(c.localStorage.getItem(c.LS.referral),first);assert.match(c.getPublicSiteUrl(),/ref=creator-a/);
 c.localStorage.setItem(c.LS.referral,JSON.stringify({code:'creator-a',expires_at:'2000-01-01'}));c.captureReferral();assert.equal(c.getReferralCode(),'creator-b');assert.throws(()=>c.addCredits(100),/server_only/);assert.throws(()=>c.spendCredits(5),/server_only/);
});
test('REAL HTML/PNG and share output include rarity, and REAL has no reroll',()=>{
 const c=browser();const r=c.analyzeHandle('alice','mirror');r.meta={tier:'real'};r.rarity={name:'epic'};
 assert.match(c.buildIdentityCard(r),/XORA REAL/);assert.match(c.buildIdentityCard(r),/EPIC/);assert.match(c.shareIdentityText(r),/XORA REAL/);
 const text=[];const ctx=new Proxy({measureText:v=>({width:String(v).length*10}),fillText:v=>text.push(v),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});c.document.createElement=()=>({getContext:()=>ctx});
 c.renderIdentityPNG(r);assert.ok(text.some(v=>String(v).includes('XORA REAL · EPIC')));
 for(const f of ['mirror','stalk','match'])assert.match(fs.readFileSync(f+'.html','utf8'),/getElementById\("rerollBtn"\)\.hidden = tier !== "fun"/);
 assert.throws(()=>c.normalizeRealResult({meta:{tier:'fun'}},'mirror'),/bad_response/);
});
test('ambiguous REAL failure retains request ID and successful retry uses server referral',async()=>{
 const c=browser();const ids=[];let attempt=0;
 const real=c.analyzeFunHandle('alice','mirror',0);real.meta={tier:'real',referral_code:'server-first',referral_expires_at:'2099-01-01'};real.rarity={name:'rare'};
 c.getSupabaseClient=()=>({auth:{getSession:async()=>({data:{session:{user:{id:'user-a'}}}})},functions:{invoke:async(_name,{body})=>{ids.push(body.request_id);attempt++;return attempt===1?{error:{message:'network_error'}}:{data:{result:real}};}}});
 c.refreshCreditsFromServer=async()=>{};
 await assert.rejects(c.requestRealAnalysis('mirror',{handle:'alice'}),/network_error/);const result=await c.requestRealAnalysis('mirror',{handle:'alice'});assert.equal(ids[0],ids[1]);assert.equal(result.meta.referral_code,'server-first');assert.equal(c.getReferralCode(),'server-first');
 await c.requestRealAnalysis('mirror',{handle:'alice'});assert.notEqual(ids[1],ids[2]);
});
