const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {browser}=require('./helpers.cjs');
test('every FUN persona has distinct localized character copy in generated, saved HTML and PNG results',()=>{
 const c=browser();
 const forbidden=/tamamen eğlencesine|çektin|çekti\b|bilimsel değeri yok|XORA['’]nın kanıtı yok|paylaşmalık değeri var|ücretsiz|\bfree\b|X verilerini analiz etmez|purely for fun|you drew|this account drew|no evidence|scientifically useless|socially shareable|solo por diversión|puramente divertid|sin valor científico|no tiene evidencia|sin evidencia|\bgratis\b|para compartir|esta cuenta sacó|no analiza datos de X|só por diversão|apenas por diversão|por pura diversão|não é científic|sem valor científico|sem evidência|sem provas|grátis|gratuito|para compartilhar|compartilhável|esta conta tirou|você tirou|não analisa dados do X|للتسلية فقط|مجرد تسلية|من باب التسلية|للترفيه فقط|ليس علمي|غير علمي|بلا دليل|لا دليل|دون دليل|قابل للمشاركة|يستحق المشاركة|للمشاركة|مجان|هذا الحساب سحب|سحب هذا الحساب|سحبت بطاقة|لا تحلل بيانات|لا يحلل بيانات|juste pour s'amuser|pour le fun|pour rire|pas scientifique|aucune valeur scientifique|sans preuve|aucune preuve|gratuit|à partager|partageable|ce compte a tiré|tu as tiré|vous avez tiré|n'analyse pas les données|nur zum spaß|nur so zum spaß|nicht wissenschaftlich|unwissenschaftlich|ohne beweis|keine beweise|kostenlos|zum teilen|teilenswert|dieses konto hat gezogen|du hast gezogen|analysiert keine x-daten|solo per divertimento|solo per ridere|per gioco|non è scientific|non scientific|senza prove|nessuna prova|gratis|gratuit|da condividere|condivisibile|questo account ha pescato|hai pescato|non analizza i dati/i;
 const seen=new Map();
 for(let nonce=0;nonce<1000 && seen.size<c.FUN_CARD_POOL.length;nonce++){
  const result=c.analyzeFunHandle('alice','mirror',nonce);seen.set(result.nickname.tr,result);
 }
 assert.equal(seen.size,c.FUN_CARD_POOL.length);
 for(const lang of ['tr','en','es','pt','ar','fr','de','it']){
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
 for(const name of ['mirror','stalk','match'])for(const lang of ['tr','en','es','pt','ar','fr','de','it']){
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
 assert.deepEqual(Object.keys(c.I18N).sort(),['ar','de','en','es','fr','it','pt','tr']);
 const keys=Object.keys(c.I18N.tr).sort();
 for(const lang of ['en','es','pt','ar','fr','de','it']) assert.deepEqual(Object.keys(c.I18N[lang]).sort(),keys,lang+' must cover every tr key');
 for(const lang of ['tr','en','es','pt','ar','fr','de','it'])for(const key of keys){
  const value=c.I18N[lang][key];
  assert.ok(typeof value==='string' && value.trim().length>0,lang+'.'+key+' must be a non-empty string');
 }
 // t() must never fall back to another language for a supported locale.
 for(const lang of ['es','pt','ar','fr','de','it']){
  c.localStorage.setItem(c.LS.lang,lang);
  for(const key of keys) assert.equal(c.t(key),c.I18N[lang][key]);
 }
 const itCopy=JSON.stringify(c.I18N.it)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.it));
 for(const ch of ['à','è','é','ì','ò','ù']) assert.ok(itCopy.includes(ch),'Italian copy contains '+ch);
 // Italian elision uses a straight apostrophe glued to the next word; only the apocope "po'" is followed by a space.
 assert.doesNotMatch(itCopy,/’/);
 for(const m of itCopy.matchAll(/(\S*)'\s/g)) assert.match(m[1],/(?:^|[^\p{L}])po$/u,'unexpected space after apostrophe: '+m[0]);
 const deCopy=JSON.stringify(c.I18N.de)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.de));
 for(const ch of ['ä','ö','ü','Ä','Ö','Ü','ß']) assert.ok(deCopy.includes(ch),'German copy contains '+ch);
 const frCopy=JSON.stringify(c.I18N.fr)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.fr));
 for(const ch of ['é','è','ê','ë','à','â','ç','î','ï','ô','ù','û','œ']) assert.ok(frCopy.includes(ch),'French copy contains '+ch);
 // Arabic copy is Arabic script; Latin appears only for product names, X, iyzico, API or Supabase.
 for(const key of keys){
  const latin=(c.I18N.ar[key].replace(/\{\w+\}/g,'').match(/[A-Za-z]+/g)||[]).filter(w=>!/^(?:XORA|X|FUN|FREE|REAL|Fun|Real|Mirror|Stalk|Match|iyzico|Supabase)$/.test(w));
  assert.deepEqual(latin,[],'ar.'+key+' has no stray Latin words');
  assert.match(c.I18N.ar[key],/[\u0600-\u06FF]|^(?:X Mirror|X Stalk|X Match|XORA Fun|XORA Real|XORA REAL|XORA FUN · FREE|FREE|REAL)$/,'ar.'+key+' is Arabic');
 }
 // Special characters render in the dictionary (encoding regression guard).
 assert.match(JSON.stringify(c.I18N.es),/[ñáéíóú¿¡]/);
 const ptCopy=JSON.stringify(c.I18N.pt)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.pt));
 for(const ch of ['ã','õ','ç','á','é','í','ó','ú','â','ê']) assert.ok(ptCopy.includes(ch),'Portuguese copy contains '+ch);
});
test('language selector cycles tr→en→es→pt→ar→fr→de→it→tr, ES/PT/AR/FR/DE/IT persist, unknown stored values fall back to tr',()=>{
 const c=browser();
 assert.equal(c.getLang(),'tr');
 assert.equal(c.nextLang('tr'),'en');assert.equal(c.nextLang('en'),'es');assert.equal(c.nextLang('es'),'pt');assert.equal(c.nextLang('pt'),'ar');assert.equal(c.nextLang('ar'),'fr');assert.equal(c.nextLang('fr'),'de');assert.equal(c.nextLang('de'),'it');assert.equal(c.nextLang('it'),'tr');
 assert.equal(c.LANG_NAMES.pt,'Português');assert.equal(c.LANG_NAMES.ar,'العربية');assert.equal(c.LANG_NAMES.fr,'Français');assert.equal(c.LANG_NAMES.de,'Deutsch');assert.equal(c.LANG_NAMES.it,'Italiano');
 c.localStorage.setItem(c.LS.lang,'es');assert.equal(c.getLang(),'es');
 assert.equal(c.t('nav_profile'),'Perfil');
 assert.equal(c.realComingSoonText(),'El análisis real llegará pronto');
 c.localStorage.setItem(c.LS.lang,'pt');assert.equal(c.getLang(),'pt');
 assert.equal(c.t('nav_login'),'Entrar');
 assert.equal(c.realComingSoonText(),'A análise real chega em breve');
 c.localStorage.setItem(c.LS.lang,'ar');assert.equal(c.getLang(),'ar');
 assert.equal(c.t('nav_login'),'تسجيل الدخول');
 assert.equal(c.realComingSoonText(),'التحليل الحقيقي قادم قريبًا');
 c.localStorage.setItem(c.LS.lang,'fr');assert.equal(c.getLang(),'fr');
 assert.equal(c.t('nav_login'),'Se connecter');
 assert.equal(c.realComingSoonText(),"L'analyse réelle arrive bientôt");
 c.localStorage.setItem(c.LS.lang,'de');assert.equal(c.getLang(),'de');
 assert.equal(c.t('nav_login'),'Anmelden');
 assert.equal(c.realComingSoonText(),'Die echte Analyse kommt bald');
 c.localStorage.setItem(c.LS.lang,'it');assert.equal(c.getLang(),'it');
 assert.equal(c.t('nav_login'),'Accedi');
 assert.equal(c.realComingSoonText(),"L'analisi reale arriva presto");
 c.localStorage.setItem(c.LS.lang,'xx');assert.equal(c.getLang(),'tr');
});
for(const [lang,shareFun,overall,shareMatch] of [['es',/Mi tarjeta XORA FUN/,/Compatibilidad General/,/compatibilidad/],['pt',/Meu cartão XORA FUN/,/Compatibilidade Geral/,/compatibilidade/],['ar',/بطاقتي في XORA FUN/,/التوافق العام/,/توافق/],['fr',/Ma carte XORA FUN/,/Compatibilité globale/,/compatibilité/],['de',/Meine XORA FUN-Karte/,/Gesamtübereinstimmung/,/Übereinstimmung/],['it',/La mia carta XORA FUN/,/Affinità generale/,/affinità/]]) test(lang.toUpperCase()+' FUN cards, PNG, share and match render natively without fallback to other locales',()=>{
 const c=browser();c.localStorage.setItem(c.LS.lang,lang);
 const others=['tr','en','es','pt','ar','fr','de','it'].filter(l=>l!==lang);
 for(let nonce=0;nonce<24;nonce++){
  const r=c.analyzeFunHandle('alice','mirror',nonce);
  const persona=c.FUN_PERSONAS.find(p=>p.id===r.persona_id);
  const copy=persona.locales[lang];
  assert.ok(copy.nickname && copy.tagline && copy.comment);
  const html=c.buildIdentityCard(r);
  assert.ok(html.includes(c.esc(copy.nickname)),r.persona_id+' nickname in '+lang+' card');
  assert.ok(html.includes(c.esc(copy.tagline)),r.persona_id+' tagline in '+lang+' card');
  assert.ok(html.includes(c.esc(copy.comment)),r.persona_id+' comment in '+lang+' card');
  for(const other of others) assert.ok(!html.includes(c.esc(persona.locales[other].comment)),'no '+other+' fallback in '+lang+' card');
  assert.match(c.shareIdentityText(r),shareFun);
  assert.ok(c.shareIdentityText(r).includes(copy.nickname));
 }
 // Distinct identity copy per persona; accents survive HTML escaping.
 assert.equal(new Set(c.FUN_PERSONAS.map(p=>p.locales[lang].nickname)).size,12);
 assert.equal(new Set(c.FUN_PERSONAS.map(p=>p.locales[lang].comment)).size,12);
 const m=c.matchFunHandles('alice','bob',0);
 assert.equal(c.matchComment(m,lang),m.fun_comment[lang]);
 assert.match(c.buildMatchCard(m),overall);
 assert.match(c.shareMatchText(m),shareMatch);
 // Legacy match results without fun_comment still localize.
 assert.match(c.matchComment({a:'alice',b:'bob',ci:0},lang),/@alice/);
 for(const mode of ['mirror','stalk','match']) assert.ok(c.THINKING[mode][lang].length===6);
});
for(const lang of ['pt','ar','fr','de','it']) test('every '+lang.toUpperCase()+' persona renders nickname, tagline and comment intact in HTML and PNG without overflow',()=>{
 const c=browser();c.localStorage.setItem(c.LS.lang,lang);
 const seen=new Map();
 for(let nonce=0;nonce<1000 && seen.size<12;nonce++){const r=c.analyzeFunHandle('alice','mirror',nonce);seen.set(r.persona_id,r);}
 assert.equal(seen.size,12);
 for(const [id,r] of seen){
  const copy=c.FUN_PERSONAS.find(p=>p.id===id).locales[lang];
  const text=[];let box;
  const target={direction:'inherit',measureText:v=>({width:String(v).length*13}),fillText:(v,x,y)=>text.push({v:String(v),x,y,dir:target.direction}),createLinearGradient:()=>({addColorStop(){}})};
  const ctx=new Proxy(target,{get:(o,k)=>k in o?o[k]:()=>{}});
  const originalRect=c.roundRect;c.roundRect=(ctx,x,y,w,h,rr)=>{if(x===130)box={y,h};originalRect(ctx,x,y,w,h,rr);};
  c.document.createElement=()=>({getContext:()=>ctx});c.renderIdentityPNG(r);c.roundRect=originalRect;
  const drawn=text.filter(p=>p.x===500 && p.y>500 && p.y<1090).map(p=>p.v).join(' ');
  for(const field of ['nickname','tagline','comment']) assert.ok(drawn.includes(copy[field]),id+' PNG '+field+' intact: '+copy[field]);
  // Localized copy follows the language direction; handle and footer brand text stay LTR.
  const copyDir=lang==='ar'?'rtl':'ltr';
  for(const p of text.filter(p=>p.x===500 && p.y>560 && p.y<1090)) assert.equal(p.dir,copyDir,id+' copy direction: '+p.v);
  assert.equal(text.find(p=>p.v==='@alice').dir,'ltr','handle stays LTR');
  // Line wrapping only breaks at spaces, so elided words (l', un', dell', all') never split or leave a dangling apostrophe.
  for(const p of text.filter(p=>p.x===500 && p.y>560 && p.y<1090)) assert.doesNotMatch(p.v,/^['’]|(?:^|\s)(?:l|un|dell|all|d|c|s|n|com|tutt)['’]$/i,id+' broken elision: '+p.v);
  for(const v of ['XORA','xora.app','XORA FUN · FREE']) assert.equal(text.find(p=>p.v===v).dir,'ltr',v+' stays LTR');
  assert.ok(box.y+box.h<1090,id+' comment box stays above footer');
  assert.ok(text.filter(p=>p.x===500 && p.y>=box.y && p.y<1090).every(p=>p.y<box.y+box.h-15),id+' text fits inside comment box');
 }
});
for(const [lang,funBtn,funNote] of [['es','Saca tu Tarjeta Gratis','Esta tarjeta es de entretenimiento; no analiza datos de X.'],['pt','Tirar Cartão Grátis','Este cartão é de entretenimento; não analisa dados do X.'],['ar','اسحب بطاقة مجانية','هذه بطاقة ترفيهية؛ ولا تحلل بيانات X.'],['fr','Tirer une carte gratuite',"Cette carte est un divertissement\u00a0; elle n'analyse pas les données X."],['de','Kostenlose Karte ziehen','Diese Karte dient der Unterhaltung; sie analysiert keine X-Daten.'],['it','Pesca una carta gratis','Questa carta è solo intrattenimento; non analizza i dati di X.']]) test('Mirror/Stalk/Match screens are '+lang.toUpperCase()+' from first paint, before any session call',async()=>{
 for(const name of ['mirror','stalk','match']) {
  const c=browser(),nodes=new Map();c.localStorage.setItem(c.LS.lang,lang);
  let sessionResolved=false;
  function node(id){if(!nodes.has(id))nodes.set(id,{value:id==='handleB'?'bob':'alice',hidden:false,textContent:'',innerHTML:'',title:'',attrs:new Map(),classList:{toggle(){}},addEventListener(ev,fn){this[ev]=fn;},setAttribute(k,v){this.attrs.set(k,v);},getAttribute(k){return this.attrs.get(k);},focus(){}});return nodes.get(id);}
  c.document.getElementById=node;c.document.documentElement={};c.isLoggedIn=()=>false;c.getUser=()=>null;c.playThinking=(_e,_m,done)=>done();
  c.initSession=async()=>{
   // The button must already be localized while the session request is still in flight.
   assert.equal(node('goBtn').textContent,c.t('fun_btn'),name+' goBtn localized before session');
   assert.equal(node('tierNote').textContent,c.t('fun_explainer'),name+' tier note localized before session');
   sessionResolved=true;
  };
  const inline=[...fs.readFileSync(name+'.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim()).pop();
  vm.runInContext(inline,c);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sessionResolved,true);
  assert.equal(node('goBtn').textContent,funBtn);
  assert.equal(node('tierNote').textContent,funNote);
  await node('goBtn').click();
  assert.equal(c.document.documentElement.lang,lang);
  assert.equal(c.document.documentElement.dir,lang==='ar'?'rtl':'ltr');
  assert.equal(node('langBtn').textContent,c.nextLang(lang).toUpperCase());
  const card=node('cardHolder').innerHTML;
  assert.match(card,/XORA FUN/);
  assert.doesNotMatch(card,/Ücretsiz|Eğlence|Draw Free Card|Fun Card|Tarjeta Fun|Cartão Fun|بطاقة Fun|Carte Fun|Fun-Karte|Carta Fun/);
  if(name==='match') assert.ok(card.includes(c.esc(c.t('match_overall'))),lang+' match card labels');
 }
});
test('static FUN personas keep TR/EN/ES/PT/AR/FR/DE/IT copy and are untouched by the single-locale REAL view',()=>{
 const c=browser();
 for(const p of c.FUN_PERSONAS) assert.deepEqual(Object.keys(p.locales).sort(),['ar','de','en','es','fr','it','pt','tr']);
 for(const lang of ['tr','en','es','pt','ar','fr','de','it']){
  c.localStorage.setItem(c.LS.lang,lang);
  for(let nonce=0;nonce<12;nonce++){
   const fun=c.analyzeFunHandle('alice',nonce%2?'stalk':'mirror',nonce);
   assert.equal(c.realCopyForActiveLang(fun),fun,'FUN results are passed through unchanged');
   const copy=c.FUN_PERSONAS.find(p=>p.id===fun.persona_id).locales[lang];
   const html=c.buildIdentityCard(fun);
   assert.ok(html.includes(c.esc(copy.nickname)) && html.includes(c.esc(copy.tagline)) && html.includes(c.esc(copy.comment)),lang+' '+fun.persona_id);
   for(const other of ['tr','en','es','pt','ar','fr','de','it'].filter(l=>l!==lang)) assert.ok(!html.includes(c.esc(c.FUN_PERSONAS.find(p=>p.id===fun.persona_id).locales[other].comment)));
  }
  const m=c.matchFunHandles('alice','bob',3);
  assert.equal(c.realCopyForActiveLang(m),m);
  assert.deepEqual(Object.keys(m.fun_comment).sort(),['ar','de','en','es','fr','it','pt','tr']);
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
test('RTL applies only to Arabic: page direction, scoped CSS and LTR technical inputs',()=>{
 const c=browser();c.document.documentElement={};
 for(const [lang,dir] of [['tr','ltr'],['en','ltr'],['es','ltr'],['pt','ltr'],['ar','rtl'],['fr','ltr'],['ar','rtl'],['de','ltr'],['ar','rtl'],['it','ltr'],['ar','rtl'],['tr','ltr']]){
  c.localStorage.setItem(c.LS.lang,lang);c.applyI18n();
  assert.equal(c.document.documentElement.lang,lang);assert.equal(c.document.documentElement.dir,dir,lang);
 }
 const css=fs.readFileSync('style.css','utf8').replace(/\r\n/g,'\n');
 const rtl=css.slice(css.indexOf('/* ============ RTL (Arapça) ============ */'));
 const rules=rtl.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(r=>r.trim()).filter(Boolean);
 assert.ok(rules.length>0);
 // Every RTL rule is scoped to dir=rtl, so TR/EN/ES/PT styling is unaffected.
 for(const rule of rules){const selectors=rule.slice(0,rule.indexOf('{')).split(',');for(const sel of selectors)assert.match(sel.trim(),/^\[dir="rtl"\] /,sel);}
 assert.ok(css.indexOf('[dir="rtl"]')>=css.indexOf('/* ============ RTL (Arapça) ============ */'),'no RTL rules outside the RTL section');
 assert.match(rtl,/\[dir="rtl"\] \.handle-input\{direction:ltr\}/);
 assert.match(rtl,/\.handle-input:placeholder-shown\{direction:rtl\}/);
 assert.match(rtl,/\[dir="rtl"\] \*\{letter-spacing:0!important\}/);
 for(const cls of ['.idcard-handle','.credits-pill','.mini-mode','.history-tier','.card-status span','.balance-big'])assert.ok(rtl.includes('[dir="rtl"] '+cls),cls+' isolated LTR');
 // Handle inputs across pages keep the class that receives the LTR rule.
 for(const [page,ids] of [['mirror.html',['mirrorHandleInput']],['stalk.html',['handleInput']],['match.html',['handleA','handleB']],['auth.html',['xora_auth_email','xora_auth_password','xora_auth_username']]])for(const id of ids)assert.match(fs.readFileSync(page,'utf8'),new RegExp('id="'+id+'"[^>]*class="handle-input"'),page+' '+id);
});
test('Arabic mixed-direction content keeps handles, URL, percentages and brand names in LTR order',()=>{
 const c=browser();const LRI='\u2066',PDI='\u2069';
 const fun=c.analyzeFunHandle('alice','mirror',2),m=c.matchFunHandles('alice','bob',1);
 for(const lang of ['tr','en','es','pt','fr','de','it']){
  c.localStorage.setItem(c.LS.lang,lang);
  for(const text of [c.shareIdentityText(fun),c.shareMatchText(m),c.matchComment({a:'alice',b:'bob',ci:0},lang)])assert.ok(!text.includes(LRI)&&!text.includes(PDI),lang+' output has no bidi controls');
 }
 c.localStorage.setItem(c.LS.lang,'ar');
 const share=c.shareIdentityText(fun);
 assert.match(share,/^بطاقتي في XORA FUN: «.+» 😅 اسحب بطاقتك ← \u2066https:\/\/example\.test\/.*\u2069$/);
 const matchShare=c.shareMatchText(m);
 assert.ok(matchShare.startsWith('توافق '+LRI+'@alice × @bob'+PDI+' في XORA FUN: '+LRI+m.overall+'%'+PDI),matchShare);
 const real={...structuredClone(m),meta:{tier:'real',locale:'ar'},rarity:{name:'rare'}};
 assert.ok(c.shareMatchText(real).includes('XORA REAL: '+LRI+real.overall+'%'+PDI+' · نادرة'));
 // Legacy Arabic match copy isolates every handle; no Arabic letter is glued to a Latin handle.
 for(let ci=0;ci<c.MATCH_COMMENTS.ar.length;ci++){
  const text=c.matchComment({a:'alice',b:'bob',ci},'ar');
  for(const [slot,h] of [['{a}','alice'],['{b}','bob']]) if(c.MATCH_COMMENTS.ar[ci].includes(slot)) assert.ok(text.includes(LRI+'@'+h+PDI),ci+': '+text);
  assert.doesNotMatch(text.replace(/⁦@\w+⁩/g,''),/@/,ci+': no unisolated handle');
  assert.doesNotMatch(c.MATCH_COMMENTS.ar[ci],/[\u0600-\u06FF]\{[ab]\}/,'handle placeholder not attached to an Arabic letter');
 }
 const html=c.buildIdentityCard(fun);
 assert.ok(html.includes('<p class="idcard-handle">@alice</p>'),'handle markup unchanged; isolation is CSS-only');
 assert.match(fs.readFileSync('profile.html','utf8'),/main = "<bdi>" \+ target \+ second \+ "<\/bdi> — "/);
});
test('German copy has no word too long for the card: nickname, tagline and comment fit HTML and PNG widths',()=>{
 const c=browser();
 // Words cannot wrap inside themselves. Budgets use ~0.62em average glyph width at each renderer's font size:
 // HTML nickname 31px in ~388px, PNG nickname 56px in 720px, PNG tagline 28px in 700px, PNG comment 26px in 660px.
 const maxChars={nickname:Math.min(Math.floor(388/(31*0.62)),Math.floor(720/(56*0.62))),tagline:Math.floor(700/(28*0.62)),comment:Math.floor(660/(26*0.62))};
 for(const p of c.FUN_PERSONAS)for(const field of ['nickname','tagline','comment']){
  const longest=p.locales.de[field].split(/\s+/).reduce((a,w)=>w.length>a.length?w:a,'');
  assert.ok(longest.length<=maxChars[field],p.id+' '+field+' word too long: '+longest);
 }
 // Match PNG draws these score labels on one unwrapped 24px line inside an 860px frame. English measures ~685px at
 // 58 characters in the browser, so 64 characters keeps a safe margin.
 const line=lang=>['match_flirt','match_vibe','match_humor'].map(k=>c.I18N[lang][k]+' %73').join('  •  ');
 assert.ok(line('de').length<=64,line('de'));
 assert.ok(['match_chaos','match_romance'].map(k=>c.I18N.de[k]+' %73').join('  •  ').length<=64);
});
test('Match PNG score rows fit the card frame in every Latin-script locale, including ES, FR and IT',()=>{
 const c=browser();
 // renderMatchPNGBase draws both rows unwrapped at 700 24px Nunito inside an 860px frame (850px inside the border).
 // Browser measurements with worst-case %99 values ranged 11.8-12.1px per character; 12.5px is a conservative bound
 // and 830px keeps a margin inside the frame. Arabic uses different glyph widths and is measured separately (603px).
 const pxPerChar=12.5,maxWidth=830;
 const rows=L=>[L.match_flirt+' %99  •  '+L.match_vibe+' %99  •  '+L.match_humor+' %99',L.match_chaos+' %99  •  '+L.match_romance+' %99'];
 for(const lang of ['tr','en','es','pt','fr','de','it'])for(const row of rows(c.I18N[lang])) assert.ok(row.length*pxPerChar<=maxWidth,lang+' score row too wide ('+row.length+' chars): '+row);
 // The previous ES/FR labels measured 901px and 917px in the browser and must stay out.
 assert.notEqual(c.I18N.es.match_vibe,'Conexión de Vibra');assert.notEqual(c.I18N.fr.match_vibe,"Même longueur d'onde");
 assert.equal(c.I18N.es.match_vibe,'Sintonía');assert.equal(c.I18N.fr.match_vibe,'Complicité');
 // Rendering path: the actual PNG draws exactly these rows.
 const text=[];const ctx=new Proxy({measureText:v=>({width:String(v).length*12}),fillText:(v,x,y)=>text.push({v:String(v),y}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 c.document.createElement=()=>({getContext:()=>ctx});
 for(const lang of ['es','fr','it']){
  c.localStorage.setItem(c.LS.lang,lang);text.length=0;
  const m=c.matchFunHandles('alice','bob',1);Object.assign(m,{flirt:99,vibe:99,humor:99,chaos:99,romance:99});
  c.renderMatchPNG(m);
  assert.deepEqual(text.filter(p=>p.y===780||p.y===812).map(p=>p.v),rows(c.I18N[lang]),lang+' PNG score rows');
 }
});
