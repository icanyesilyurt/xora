const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {browser}=require('./helpers.cjs');
test('every FUN persona has distinct localized character copy in generated, saved HTML and PNG results',()=>{
 const c=browser();
 const forbidden=/tamamen eğlencesine|çektin|çekti\b|bilimsel değeri yok|XORA['’]nın kanıtı yok|paylaşmalık değeri var|ücretsiz|\bfree\b|X verilerini analiz etmez|purely for fun|you drew|this account drew|no evidence|scientifically useless|socially shareable|solo por diversión|puramente divertid|sin valor científico|no tiene evidencia|sin evidencia|\bgratis\b|para compartir|esta cuenta sacó|no analiza datos de X/i;
 const seen=new Map();
 for(let nonce=0;nonce<1000 && seen.size<c.FUN_CARD_POOL.length;nonce++){
  const result=c.analyzeFunHandle('alice','mirror',nonce);seen.set(result.nickname.tr,result);
 }
 assert.equal(seen.size,c.FUN_CARD_POOL.length);
 for(const lang of ['tr','en','es']){
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
  const c=browser(),nodes=new Map();c.location.hostname='icanyesilyurt.github.io';
  function node(id){if(!nodes.has(id))nodes.set(id,{value:id==='handleB'?'bob':'alice',hidden:false,textContent:'',innerHTML:'',classList:{toggle(){}},addEventListener(ev,fn){this[ev]=fn;},focus(){}});return nodes.get(id);}
  c.document.getElementById=node;c.initSession=async()=>{};c.isLoggedIn=()=>false;c.getUser=()=>null;c.applyI18n=()=>{};c.playThinking=(_e,_m,done)=>done();
  c.requestRealAnalysis=()=>{throw Error('FUN invoked REAL');};c.saveAnalysisRecord=()=>{throw Error('Anonymous FUN saved');};
  const inline=[...fs.readFileSync(name+'.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim()).pop();vm.runInContext(inline,c);await new Promise(resolve=>setImmediate(resolve));
  await node('goBtn').click();assert.match(node('cardHolder').innerHTML,/XORA FUN/);assert.equal(node('rerollBtn').hidden,false);
 }
});
test('production direct REAL URLs stay on a disabled input view without auth or API errors',async()=>{
 for(const name of ['mirror','stalk','match'])for(const lang of ['tr','en','es']){
  const c=browser(),nodes=new Map();c.location.hostname='icanyesilyurt.github.io';c.location.search='?tier=real';c.getLang=()=>lang;
  function node(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,textContent:'',innerHTML:'',classList:{toggle(){}},addEventListener(ev,fn){this[ev]=fn;},focus(){}});return nodes.get(id);}
  c.document.getElementById=node;
  c.initSession=async()=>{throw Error('Paused REAL initiated auth');};c.requestRealAnalysis=async()=>{throw Error('Paused REAL invoked API');};c.toast=()=>{throw Error('Paused REAL showed an error');};
  const originalUrl=c.location.href;
  const inline=[...fs.readFileSync(name+'.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim()).pop();
  vm.runInContext(inline,c);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(node('goBtn').disabled,true);assert.equal(node('goBtn').textContent,c.realComingSoonText());assert.equal(node('tierNote').textContent,c.realComingSoonText());
  await node('goBtn').click();
  const input=node(name==='match'?'handleB':name==='mirror'?'mirrorHandleInput':'handleInput');
  await input.keydown({key:'Enter'});
  assert.equal(c.location.href,originalUrl);
  assert.equal(node(name==='mirror'?'inputView':'step-input').hidden,false);
 }
 const c=browser();c.location.hostname='icanyesilyurt.github.io';
 c.getSupabaseClient=()=>{throw Error('Network client initialized');};
 await assert.rejects(c.requestRealAnalysis('mirror',{handle:'alice'}),/real_temporarily_unavailable/);
 c.location.hostname='localhost';assert.equal(c.showProductionRealPause('real'),false);
});
test('disabled production REAL links cannot redirect to auth and status updates without duplication',()=>{
 const c=browser();c.location.hostname='icanyesilyurt.github.io';
 const attrs=new Map([['href','mirror.html?tier=real']]);const handlers=[];let child;
 const link={classList:{add(){}},setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),removeAttribute:k=>attrs.delete(k),querySelector:()=>child,appendChild:n=>{child=n;},addEventListener:(_ev,fn)=>handlers.push(fn)};
 c.document.querySelectorAll=()=>[link];c.document.createElement=()=>({});
 c.initAuthGuards();c.disableProductionRealCtas();const status=child;
 assert.equal(attrs.has('href'),false);assert.equal(attrs.get('aria-disabled'),'true');
 const url=c.location.href;handlers.forEach(fn=>fn.call(link,{preventDefault(){}}));assert.equal(c.location.href,url);
 c.getLang=()=> 'en';c.disableProductionRealCtas();assert.equal(child,status);assert.equal(child.textContent,'Real analysis coming soon');
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
test('every I18N locale exposes the complete key set with non-empty strings; missing keys fail',()=>{
 const c=browser();
 assert.deepEqual(Object.keys(c.I18N).sort(),['en','es','tr']);
 const keys=Object.keys(c.I18N.tr).sort();
 for(const lang of ['en','es']) assert.deepEqual(Object.keys(c.I18N[lang]).sort(),keys,lang+' must cover every tr key');
 for(const lang of ['tr','en','es'])for(const key of keys){
  const value=c.I18N[lang][key];
  assert.ok(typeof value==='string' && value.trim().length>0,lang+'.'+key+' must be a non-empty string');
 }
 // t() must never fall back to another language for a supported locale.
 c.localStorage.setItem(c.LS.lang,'es');
 for(const key of keys) assert.equal(c.t(key),c.I18N.es[key]);
 // Spanish special characters render in the dictionary (encoding regression guard).
 assert.match(JSON.stringify(c.I18N.es),/[ñáéíóú¿¡]/);
});
test('language selector cycles tr→en→es→tr, ES persists, unknown stored values fall back to tr',()=>{
 const c=browser();
 assert.equal(c.getLang(),'tr');
 assert.equal(c.nextLang('tr'),'en');assert.equal(c.nextLang('en'),'es');assert.equal(c.nextLang('es'),'tr');
 c.localStorage.setItem(c.LS.lang,'es');assert.equal(c.getLang(),'es');
 assert.equal(c.t('nav_profile'),'Perfil');
 assert.equal(c.realComingSoonText(),'El análisis real llegará pronto');
 c.localStorage.setItem(c.LS.lang,'de');assert.equal(c.getLang(),'tr');
});
test('ES FUN cards, PNG, share and match render natural Spanish without EN/TR fallback',()=>{
 const c=browser();c.localStorage.setItem(c.LS.lang,'es');
 for(let nonce=0;nonce<24;nonce++){
  const r=c.analyzeFunHandle('alice','mirror',nonce);
  const persona=c.FUN_PERSONAS.find(p=>p.id===r.persona_id);
  assert.ok(persona.locales.es.nickname && persona.locales.es.tagline && persona.locales.es.comment);
  const html=c.buildIdentityCard(r);
  assert.ok(html.includes(c.esc(persona.locales.es.nickname)),r.persona_id+' nickname in ES card');
  assert.ok(html.includes(c.esc(persona.locales.es.comment)),r.persona_id+' comment in ES card');
  assert.ok(!html.includes(c.esc(persona.locales.en.comment)) && !html.includes(c.esc(persona.locales.tr.comment)),'no EN/TR fallback in ES card');
  assert.match(c.shareIdentityText(r),/Mi tarjeta XORA FUN/);
 }
 // Distinct Spanish identity copy per persona; accents survive HTML escaping.
 assert.equal(new Set(c.FUN_PERSONAS.map(p=>p.locales.es.nickname)).size,12);
 assert.equal(new Set(c.FUN_PERSONAS.map(p=>p.locales.es.comment)).size,12);
 const m=c.matchFunHandles('alice','bob',0);
 assert.equal(c.matchComment(m,'es'),m.fun_comment.es);
 assert.match(c.buildMatchCard(m),/Compatibilidad General/);
 assert.match(c.shareMatchText(m),/compatibilidad/);
 // Legacy match results without fun_comment still localize in ES.
 assert.match(c.matchComment({a:'alice',b:'bob',ci:0},'es'),/@alice/);
});
test('Mirror/Stalk/Match screens are Spanish from first paint, before any session call',async()=>{
 for(const name of ['mirror','stalk','match']) {
  const c=browser(),nodes=new Map();c.localStorage.setItem(c.LS.lang,'es');
  let sessionResolved=false;
  function node(id){if(!nodes.has(id))nodes.set(id,{value:id==='handleB'?'bob':'alice',hidden:false,textContent:'',innerHTML:'',title:'',attrs:new Map(),classList:{toggle(){}},addEventListener(ev,fn){this[ev]=fn;},setAttribute(k,v){this.attrs.set(k,v);},getAttribute(k){return this.attrs.get(k);},focus(){}});return nodes.get(id);}
  c.document.getElementById=node;c.document.documentElement={};c.isLoggedIn=()=>false;c.getUser=()=>null;c.playThinking=(_e,_m,done)=>done();
  c.initSession=async()=>{
   // The button must already be Spanish while the session request is still in flight.
   assert.equal(node('goBtn').textContent,c.t('fun_btn'),name+' goBtn localized before session');
   assert.equal(node('tierNote').textContent,c.t('fun_explainer'),name+' tier note localized before session');
   sessionResolved=true;
  };
  const inline=[...fs.readFileSync(name+'.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim()).pop();
  vm.runInContext(inline,c);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sessionResolved,true);
  assert.equal(node('goBtn').textContent,'Saca tu Tarjeta Gratis');
  assert.equal(node('tierNote').textContent,'Esta tarjeta es de entretenimiento; no analiza datos de X.');
  await node('goBtn').click();
  const card=node('cardHolder').innerHTML;
  assert.match(card,/XORA FUN/);
  assert.doesNotMatch(card,/Ücretsiz|Eğlence|Draw Free Card|Fun Card/);
  if(name==='match') assert.ok(card.includes(c.esc(c.t('match_overall'))),'ES match card labels');
 }
});
test('static FUN personas keep TR/EN/ES copy and are untouched by the single-locale REAL view',()=>{
 const c=browser();
 for(const p of c.FUN_PERSONAS) assert.deepEqual(Object.keys(p.locales).sort(),['en','es','tr']);
 for(const lang of ['tr','en','es']){
  c.localStorage.setItem(c.LS.lang,lang);
  for(let nonce=0;nonce<12;nonce++){
   const fun=c.analyzeFunHandle('alice',nonce%2?'stalk':'mirror',nonce);
   assert.equal(c.realCopyForActiveLang(fun),fun,'FUN results are passed through unchanged');
   const copy=c.FUN_PERSONAS.find(p=>p.id===fun.persona_id).locales[lang];
   const html=c.buildIdentityCard(fun);
   assert.ok(html.includes(c.esc(copy.nickname)) && html.includes(c.esc(copy.tagline)) && html.includes(c.esc(copy.comment)),lang+' '+fun.persona_id);
   for(const other of ['tr','en','es'].filter(l=>l!==lang)) assert.ok(!html.includes(c.esc(c.FUN_PERSONAS.find(p=>p.id===fun.persona_id).locales[other].comment)));
  }
  const m=c.matchFunHandles('alice','bob',3);
  assert.equal(c.realCopyForActiveLang(m),m);
  assert.deepEqual(Object.keys(m.fun_comment).sort(),['en','es','tr']);
  assert.ok(c.buildMatchCard(m).includes(c.esc(m.fun_comment[lang])));
 }
});
test('legacy multi-locale REAL results render unchanged; the view only fills a missing active locale',()=>{
 const c=browser();
 const legacy={meta:{tier:'real',locale:'tr'},rarity:{name:'rare'},handle:'alice',hash:1,nickname:{tr:'Meraklı Biri',en:'Curious Mind'},tagline:{tr:'Sorularla ilerliyor.',en:'Questions lead the way.'},comment:{mirror:{tr:'Sorularla konuşmayı açıyorsun.',en:'You open conversations with questions.'}},card:{nickname:{tr:'Meraklı Biri',en:'Curious Mind'},desc:{tr:'Sorularla ilerliyor.',en:'Questions lead the way.'},emoji:'🪞',color:'#0FAFAF',top_behaviors:[{key:'merak',label:{tr:'Merak',en:'Curiosity'},value:80}]}};
 for(const [lang,nick,label] of [['tr','Meraklı Biri','Merak'],['en','Curious Mind','Curiosity']]){
  c.localStorage.setItem(c.LS.lang,lang);
  const view=c.realCopyForActiveLang(legacy);
  assert.equal(JSON.stringify(view),JSON.stringify(legacy),lang+' view is identical when the locale exists');
  const html=c.buildIdentityCard(legacy);assert.ok(html.includes(c.esc(nick)) && html.includes(c.esc(label)));
 }
 c.localStorage.setItem(c.LS.lang,'es');
 const es=c.realCopyForActiveLang(legacy);
 assert.equal(es.nickname.es,'Meraklı Biri','falls back to the generated locale, not an invented translation');
 assert.deepEqual(Object.keys(legacy.nickname),['tr','en'],'stored result is not mutated');
});
