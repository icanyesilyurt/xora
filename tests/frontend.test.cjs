const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {browser}=require('./helpers.cjs');
test('every FUN persona has distinct localized character copy in generated, saved HTML and PNG results',()=>{
 const c=browser();
 const forbidden=/tamamen eğlencesine|çektin|çekti\b|bilimsel değeri yok|XORA['’]nın kanıtı yok|paylaşmalık değeri var|ücretsiz|\bfree\b|X verilerini analiz etmez|purely for fun|you drew|this account drew|no evidence|scientifically useless|socially shareable|solo por diversión|puramente divertid|sin valor científico|no tiene evidencia|sin evidencia|\bgratis\b|para compartir|esta cuenta sacó|no analiza datos de X|só por diversão|apenas por diversão|por pura diversão|não é científic|sem valor científico|sem evidência|sem provas|grátis|gratuito|para compartilhar|compartilhável|esta conta tirou|você tirou|não analisa dados do X|للتسلية فقط|مجرد تسلية|من باب التسلية|للترفيه فقط|ليس علمي|غير علمي|بلا دليل|لا دليل|دون دليل|قابل للمشاركة|يستحق المشاركة|للمشاركة|مجان|هذا الحساب سحب|سحب هذا الحساب|سحبت بطاقة|لا تحلل بيانات|لا يحلل بيانات|juste pour s'amuser|pour le fun|pour rire|pas scientifique|aucune valeur scientifique|sans preuve|aucune preuve|gratuit|à partager|partageable|ce compte a tiré|tu as tiré|vous avez tiré|n'analyse pas les données|nur zum spaß|nur so zum spaß|nicht wissenschaftlich|unwissenschaftlich|ohne beweis|keine beweise|kostenlos|zum teilen|teilenswert|dieses konto hat gezogen|du hast gezogen|analysiert keine x-daten|solo per divertimento|solo per ridere|per gioco|non è scientific|non scientific|senza prove|nessuna prova|gratis|gratuit|da condividere|condivisibile|questo account ha pescato|hai pescato|non analizza i dati|楽しむためだけ|遊びのためだけ|ただの遊び|科学的根拠|科学的じゃない|科学的ではない|根拠なし|根拠はない|証拠はない|証拠なし|シェア用|無料|このアカウントが引いた|あなたが引いた|データは分析しません|재미로만|재미로 보는|그냥 재미|과학적이지 않|과학적 근거|근거가 없|근거는 없|증거가 없|증거는 없|공유용|무료|이 계정이 뽑|당신이 뽑|데이터를 분석하지 않|데이터는 분석하지|純粹好玩|只是好玩|不科學|沒有科學|沒有根據|沒有證據|值得分享|免費|這個帳號抽|你抽到了|不會分析 X 資料|不分析 X 的資料|просто для развлечения|только ради развлечения|ненаучн|не научн|нет доказательств|без доказательств|бесплатн|стоит поделиться|этот аккаунт вытянул|ты вытянул|не анализирует данные/i;
 const seen=new Map();
 for(let nonce=0;nonce<1000 && seen.size<c.FUN_CARD_POOL.length;nonce++){
  const result=c.analyzeFunHandle('alice','mirror',nonce);seen.set(result.nickname.tr,result);
 }
 assert.equal(seen.size,c.FUN_CARD_POOL.length);
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']){
  c.getLang=()=>lang;
  const unique=new Set();
  for(const [name,result] of seen){
   const expected=result.comment.mirror[lang];unique.add(expected);
   assert.doesNotMatch(expected,forbidden,name);
   // Japanese sentences end with 。！？ and carry no trailing space.
   const sentences=expected.match((lang==='ja'||lang==='zh')?/[^。！？]+[。！？]/g:/[^.!?]+[.!?]/g)||[];
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
   const copy=text.filter(p=>p.x===500 && p.y>700 && p.y<1090).map(p=>p.v).join((lang==='ja'||lang==='zh')?'':' ');
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
 for(const name of ['mirror','stalk','match'])for(const lang of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']){
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
 assert.deepEqual(Object.keys(c.I18N).sort(),['ar','de','en','es','fr','it','ja','ko','pt','ru','tr','zh']);
 const keys=Object.keys(c.I18N.tr).sort();
 for(const lang of ['en','es','pt','ar','fr','de','it','ja','ko','zh','ru']) assert.deepEqual(Object.keys(c.I18N[lang]).sort(),keys,lang+' must cover every tr key');
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru'])for(const key of keys){
  const value=c.I18N[lang][key];
  assert.ok(typeof value==='string' && value.trim().length>0,lang+'.'+key+' must be a non-empty string');
 }
 // t() must never fall back to another language for a supported locale.
 for(const lang of ['es','pt','ar','fr','de','it','ja','ko','zh','ru']){
  c.localStorage.setItem(c.LS.lang,lang);
  for(const key of keys) assert.equal(c.t(key),c.I18N[lang][key]);
 }
 // Japanese copy uses kanji, hiragana and katakana; Latin appears only for product names.
 const jaCopy=JSON.stringify(c.I18N.ja)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.ja));
 for(const [script,re] of [['kanji',/[\u4e00-\u9fff]/],['hiragana',/[\u3040-\u309f]/],['katakana',/[\u30a0-\u30ff]/]]) assert.match(jaCopy,re,'Japanese copy contains '+script);
 for(const key of keys){
  const latin=(c.I18N.ja[key].replace(/\{\w+\}/g,'').match(/[A-Za-z]+/g)||[]).filter(w=>!/^(?:XORA|X|FUN|FREE|REAL|Fun|Real|Mirror|Stalk|Match|API|ID|URL|iyzico|Supabase)$/.test(w));
  assert.deepEqual(latin,[],'ja.'+key+' has no stray Latin words');
 }
 // Korean copy is hangul; Latin appears only for product names.
 const koCopy=JSON.stringify(c.I18N.ko)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.ko));
 assert.match(koCopy,/[\uac00-\ud7af]/,'Korean copy contains hangul');
 assert.doesNotMatch(koCopy,/[\u3040-\u30ff\u4e00-\u9fff]/,'Korean copy has no kana or kanji');
 for(const key of keys){
  const latin=(c.I18N.ko[key].replace(/\{\w+\}/g,'').match(/[A-Za-z]+/g)||[]).filter(w=>!/^(?:XORA|X|FUN|FREE|REAL|Fun|Real|Mirror|Stalk|Match|API|ID|URL|iyzico|Supabase)$/.test(w));
  assert.deepEqual(latin,[],'ko.'+key+' has no stray Latin words');
 }
 // Chinese copy is Traditional Han; Latin appears only for product names.
 const zhCopy=JSON.stringify(c.I18N.zh)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.zh));
 assert.match(zhCopy,/[\u4e00-\u9fff]/,'Chinese copy contains Han');
 assert.doesNotMatch(zhCopy,/[\u3040-\u30ff\uac00-\ud7af]/,'Chinese copy has no kana or hangul');
 assert.doesNotMatch(zhCopy,/[这个们说见会时现样觉认为么过还来对开关点边进问让给东车马书长风话图网爱乐热无与头没当发汉语业产单卖买亲习乡终经级体种]/u,'Chinese copy must be Traditional');
 for(const ch of ['個','會','說','時','點','來','沒','們','麼','過','話','無']) assert.ok(zhCopy.includes(ch),'Traditional form '+ch+' appears');
 for(const key of keys){
  const latin=(c.I18N.zh[key].replace(/\{\w+\}/g,'').match(/[A-Za-z]+/g)||[]).filter(w=>!/^(?:XORA|X|FUN|FREE|REAL|Fun|Real|Mirror|Stalk|Match|API|ID|URL|iyzico|Supabase)$/.test(w));
  assert.deepEqual(latin,[],'zh.'+key+' has no stray Latin words');
 }
 // Russian copy is Cyrillic, exercises ё, and keeps Latin only for product names.
 const ruCopy=JSON.stringify(c.I18N.ru)+JSON.stringify(c.FUN_PERSONAS.map(p=>p.locales.ru));
 assert.match(ruCopy,/[\u0400-\u04ff]/,'Russian copy is Cyrillic');
 assert.match(ruCopy,/[ёЁ]/,'Russian copy contains ё');
 assert.doesNotMatch(ruCopy,/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/,'Russian copy has no CJK');
 for(const key of keys){
  const latin=(c.I18N.ru[key].replace(/\{\w+\}/g,'').match(/[A-Za-z]+/g)||[]).filter(w=>!/^(?:XORA|X|FUN|FREE|REAL|Fun|Real|Mirror|Stalk|Match|API|ID|URL|iyzico|Supabase)$/.test(w));
  assert.deepEqual(latin,[],'ru.'+key+' has no stray Latin words');
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
test('every saved locale persists and localizes; unknown stored values fall through to detection and then English',()=>{
 const c=browser();
 // No saved choice and no browser language: English.
 assert.equal(c.getLang(),'en');
 assert.equal(typeof c.nextLang,'undefined','the sequential cycle helper is gone');
 assert.deepEqual([...c.LANGS],['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']);
 assert.equal(c.LANG_NAMES.pt,'Português');assert.equal(c.LANG_NAMES.ar,'العربية');assert.equal(c.LANG_NAMES.fr,'Français');assert.equal(c.LANG_NAMES.de,'Deutsch');assert.equal(c.LANG_NAMES.it,'Italiano');assert.equal(c.LANG_NAMES.ja,'日本語');assert.equal(c.LANG_NAMES.ko,'한국어');assert.equal(c.LANG_NAMES.zh,'繁體中文');assert.equal(c.LANG_NAMES.ru,'Русский');
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
 c.localStorage.setItem(c.LS.lang,'ja');assert.equal(c.getLang(),'ja');
 assert.equal(c.t('nav_login'),'ログイン');
 assert.equal(c.realComingSoonText(),'本格分析はまもなく公開');
 c.localStorage.setItem(c.LS.lang,'ko');assert.equal(c.getLang(),'ko');
 assert.equal(c.t('nav_login'),'로그인');
 assert.equal(c.realComingSoonText(),'정식 분석 곧 공개');
 c.localStorage.setItem(c.LS.lang,'zh');assert.equal(c.getLang(),'zh');
 assert.equal(c.t('nav_login'),'登入');
 assert.equal(c.realComingSoonText(),'正式分析即將推出');
 c.localStorage.setItem(c.LS.lang,'ru');assert.equal(c.getLang(),'ru');
 assert.equal(c.t('nav_login'),'Войти');
 assert.equal(c.realComingSoonText(),'Настоящий разбор скоро');
 c.localStorage.setItem(c.LS.lang,'tr');assert.equal(c.getLang(),'tr');
 assert.equal(c.t('nav_login'),'Giriş Yap');
 c.localStorage.setItem(c.LS.lang,'xx');assert.equal(c.getLang(),'en');
 c.navigator={languages:['de-DE']};assert.equal(c.getLang(),'de','an unknown stored value does not block detection');
});
for(const [lang,shareFun,overall,shareMatch] of [['es',/Mi tarjeta XORA FUN/,/COMPATIBILIDAD XORA FUN/,/compatibilidad/],['pt',/Meu cartão XORA FUN/,/COMPATIBILIDADE XORA FUN/,/compatibilidade/],['ar',/بطاقتي في XORA FUN/,/توافق XORA FUN/,/توافق/],['fr',/Ma carte XORA FUN/,/COMPATIBILITÉ XORA FUN/,/compatibilité/],['de',/Meine XORA FUN-Karte/,/XORA FUN ÜBEREINSTIMMUNG/,/Übereinstimmung/],['it',/La mia carta XORA FUN/,/AFFINITÀ XORA FUN/,/affinità/],['ja',/XORA FUNのカード/,/XORA FUN相性/,/相性/],['ko',/내 XORA FUN 카드/,/XORA FUN 궁합/,/궁합/],['zh',/我的 XORA FUN 卡片/,/XORA FUN 速配/,/速配/],['ru',/Моя карточка XORA FUN/,/СОВМЕСТИМОСТЬ XORA FUN/,/совместимость/]]) test(lang.toUpperCase()+' FUN cards, PNG, share and match render natively without fallback to other locales',()=>{
 const c=browser();c.localStorage.setItem(c.LS.lang,lang);
 const others=['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru'].filter(l=>l!==lang);
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
for(const lang of ['pt','ar','fr','de','it','ja','ko','zh','ru']) test('every '+lang.toUpperCase()+' persona renders nickname, tagline and comment intact in HTML and PNG without overflow',()=>{
 const c=browser();c.localStorage.setItem(c.LS.lang,lang);
 const seen=new Map();
 for(let nonce=0;nonce<1000 && seen.size<12;nonce++){const r=c.analyzeFunHandle('alice','mirror',nonce);seen.set(r.persona_id,r);}
 assert.equal(seen.size,12);
 for(const [id,r] of seen){
  const copy=c.FUN_PERSONAS.find(p=>p.id===id).locales[lang];
  const text=[];let box;
  const cjk=/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
  const target={direction:'inherit',measureText:v=>({width:[...String(v)].reduce((w,ch)=>w+(cjk.test(ch)?26:13),0)}),fillText:(v,x,y)=>text.push({v:String(v),x,y,dir:target.direction}),createLinearGradient:()=>({addColorStop(){}})};
  const ctx=new Proxy(target,{get:(o,k)=>k in o?o[k]:()=>{}});
  const originalRect=c.roundRect;c.roundRect=(ctx,x,y,w,h,rr)=>{if(x===130)box={y,h};originalRect(ctx,x,y,w,h,rr);};
  c.document.createElement=()=>({getContext:()=>ctx});c.renderIdentityPNG(r);c.roundRect=originalRect;
  const drawn=text.filter(p=>p.x===500 && p.y>500 && p.y<1090).map(p=>p.v).join((lang==='ja'||lang==='zh')?'':' ');
  for(const field of ['nickname','tagline','comment']) assert.ok(drawn.includes(copy[field]),id+' PNG '+field+' intact: '+copy[field]);
  // Localized copy follows the language direction; handle and footer brand text stay LTR.
  const copyDir=lang==='ar'?'rtl':'ltr';
  for(const p of text.filter(p=>p.x===500 && p.y>560 && p.y<1090)) assert.equal(p.dir,copyDir,id+' copy direction: '+p.v);
  assert.equal(text.find(p=>p.v==='@alice').dir,'ltr','handle stays LTR');
  // Line wrapping only breaks at spaces, so elided words (l', un', dell', all') never split or leave a dangling apostrophe.
  for(const p of text.filter(p=>p.x===500 && p.y>560 && p.y<1090)) assert.doesNotMatch(p.v,/^['’]|(?:^|\s)(?:l|un|dell|all|d|c|s|n|com|tutt)['’]$/i,id+' broken elision: '+p.v);
  for(const v of ['XORA','xora.app','XORA FUN · FREE']) assert.equal(text.find(p=>p.v===v).dir,'ltr',v+' stays LTR');
  // Japanese wraps between characters, so check the basic kinsoku rules on the drawn lines.
  if(lang==='ja'||lang==='zh') for(const p of text.filter(p=>p.x===500 && p.y>560 && p.y<1090)){
   assert.doesNotMatch(p.v,/^[、。，．・：；？！）」』】〕…]/,id+' line starts with closing punctuation: '+p.v);
   assert.doesNotMatch(p.v,/[（「『【〔]$/,id+' line ends with an opening bracket: '+p.v);
  }
  assert.ok(box.y+box.h<1090,id+' comment box stays above footer');
  assert.ok(text.filter(p=>p.x===500 && p.y>=box.y && p.y<1090).every(p=>p.y<box.y+box.h-15),id+' text fits inside comment box');
 }
});
for(const [lang,funBtn,funNote] of [['es','Saca tu Tarjeta Gratis','Esta tarjeta es de entretenimiento; no analiza datos de X.'],['pt','Tirar Cartão Grátis','Este cartão é de entretenimento; não analisa dados do X.'],['ar','اسحب بطاقة مجانية','هذه بطاقة ترفيهية؛ ولا تحلل بيانات X.'],['fr','Tirer une carte gratuite',"Cette carte est un divertissement\u00a0; elle n'analyse pas les données X."],['de','Kostenlose Karte ziehen','Diese Karte dient der Unterhaltung; sie analysiert keine X-Daten.'],['it','Pesca una carta gratis','Questa carta è solo intrattenimento; non analizza i dati di X.'],['ja','無料カードを引く','このカードはエンタメ用です。Xのデータは分析しません。'],['ko','무료 카드 뽑기','이 카드는 재미로 보는 카드예요. X 데이터는 분석하지 않습니다.'],['zh','抽免費卡片','這張卡片只是好玩用的，不會分析 X 資料。'],['ru','Вытянуть бесплатную карточку','Эта карточка сделана для настроения и не анализирует данные X.']]) test('Mirror/Stalk/Match screens are '+lang.toUpperCase()+' from first paint, before any session call',async()=>{
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
  assert.equal(node('langBtn').textContent,lang.toUpperCase());
  assert.equal(node('langBtn').title,c.LANG_NAMES[lang]);
  const card=node('cardHolder').innerHTML;
  assert.match(card,/XORA FUN/);
  assert.doesNotMatch(card,/Ücretsiz|Eğlence|Draw Free Card|Fun Card|Tarjeta Fun|Cartão Fun|بطاقة Fun|Carte Fun|Fun-Karte|Carta Fun|Funカード/);
  if(name==='match'){assert.ok(card.includes(c.esc(c.t('fun_match_label'))),lang+' FUN match label');assert.ok(!card.includes(c.esc(c.t('match_overall'))),lang+' no analysis-style overall label on FUN');}
 }
});
test('static FUN personas keep TR/EN/ES/PT/AR/FR/DE/IT/JA copy and are untouched by the single-locale REAL view',()=>{
 const c=browser();
 for(const p of c.FUN_PERSONAS) assert.deepEqual(Object.keys(p.locales).sort(),['ar','de','en','es','fr','it','ja','ko','pt','ru','tr','zh']);
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']){
  c.localStorage.setItem(c.LS.lang,lang);
  for(let nonce=0;nonce<12;nonce++){
   const fun=c.analyzeFunHandle('alice',nonce%2?'stalk':'mirror',nonce);
   assert.equal(c.realCopyForActiveLang(fun),fun,'FUN results are passed through unchanged');
   const copy=c.FUN_PERSONAS.find(p=>p.id===fun.persona_id).locales[lang];
   const html=c.buildIdentityCard(fun);
   assert.ok(html.includes(c.esc(copy.nickname)) && html.includes(c.esc(copy.tagline)) && html.includes(c.esc(copy.comment)),lang+' '+fun.persona_id);
   for(const other of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru'].filter(l=>l!==lang)) assert.ok(!html.includes(c.esc(c.FUN_PERSONAS.find(p=>p.id===fun.persona_id).locales[other].comment)));
  }
  const m=c.matchFunHandles('alice','bob',3);
  assert.equal(c.realCopyForActiveLang(m),m);
  assert.deepEqual(Object.keys(m.fun_comment).sort(),['ar','de','en','es','fr','it','ja','ko','pt','ru','tr','zh']);
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
 for(const [lang,dir] of [['tr','ltr'],['en','ltr'],['es','ltr'],['pt','ltr'],['ar','rtl'],['fr','ltr'],['ar','rtl'],['de','ltr'],['ar','rtl'],['it','ltr'],['ar','rtl'],['ja','ltr'],['ar','rtl'],['ko','ltr'],['ar','rtl'],['zh','ltr'],['ar','rtl'],['ru','ltr'],['ar','rtl'],['tr','ltr']]){
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
 for(const lang of ['tr','en','es','pt','fr','de','it','ja','ko','zh','ru']){
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
test('Match PNG score rows fit the card frame in every locale, including ES, FR, IT, JA, KO, ZH and RU',()=>{
 const c=browser();
 // renderMatchPNGBase draws both rows unwrapped at 700 24px Nunito inside an 860px frame (850px inside the border).
 // Browser measurements with worst-case %99 values ranged 11.8-12.1px per character; 12.5px is a conservative bound
 // and 830px keeps a margin inside the frame. Arabic uses different glyph widths and is measured separately (603px).
 const pxPerChar=12.5,maxWidth=830;
 // Full-width Japanese and Korean glyphs are about one em wide at 24px.
 const width=row=>[...row].reduce((w,ch)=>w+(/[\u3000-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch)?24:pxPerChar),0);
 const rows=L=>[L.match_flirt+' %99  •  '+L.match_vibe+' %99  •  '+L.match_humor+' %99',L.match_chaos+' %99  •  '+L.match_romance+' %99'];
 for(const lang of ['tr','en','es','pt','fr','de','it','ja','ko','zh','ru'])for(const row of rows(c.I18N[lang])) assert.ok(width(row)<=maxWidth,lang+' score row too wide ('+Math.round(width(row))+'px): '+row);
 // The previous ES/FR labels measured 901px and 917px in the browser and must stay out.
 assert.notEqual(c.I18N.es.match_vibe,'Conexión de Vibra');assert.notEqual(c.I18N.fr.match_vibe,"Même longueur d'onde");
 assert.equal(c.I18N.es.match_vibe,'Sintonía');assert.equal(c.I18N.fr.match_vibe,'Complicité');
 // Rendering path: the actual PNG draws exactly these rows.
 const text=[];const ctx=new Proxy({measureText:v=>({width:String(v).length*12}),fillText:(v,x,y)=>text.push({v:String(v),y}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 c.document.createElement=()=>({getContext:()=>ctx});
 for(const lang of ['es','fr','it','ja','ko','zh','ru']){
  c.localStorage.setItem(c.LS.lang,lang);text.length=0;
  const m=c.matchFunHandles('alice','bob',1);Object.assign(m,{flirt:99,vibe:99,humor:99,chaos:99,romance:99});
  // REAL Match draws the AI-scored rows; the same object as FUN draws none of them.
  const real={...m,meta:{...m.meta,tier:'real',locale:lang},fun_comment:undefined,ai_comment:{[lang]:'x'},rarity:{name:'rare'}};
  c.renderMatchPNG(real);
  assert.deepEqual(text.filter(p=>p.y===780||p.y===812).map(p=>p.v),rows(c.I18N[lang]),lang+' REAL PNG score rows');
  text.length=0;c.renderMatchPNG(m);
  assert.deepEqual(text.filter(p=>p.y===780||p.y===812),[],lang+' FUN PNG has no score rows');
 }
});
test('wrapText keeps space wrapping for other scripts, including Korean, and wraps Japanese and Chinese on character boundaries',()=>{
 const c=browser();
 const cjk=/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
 const ctx={measureText:v=>({width:[...String(v)].reduce((w,ch)=>w+(cjk.test(ch)?26:13),0)}),fillText(){}};
 const drawnLines=text=>{const out=[];const rec={measureText:ctx.measureText,fillText:v=>out.push(v)};c.wrapText(rec,text,500,0,660,34);return out;};
 // Reference copy of the original space-only algorithm: non-CJK output must stay byte-identical.
 const reference=(text,maxW)=>{const out=[];const words=text.split(' ');let line='';for(let n=0;n<words.length;n++){const test=line+words[n]+' ';if(ctx.measureText(test).width>maxW&&n>0){out.push(line.trim());line=words[n]+' ';}else line=test;}out.push(line.trim());return out;};
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ko','ru'])for(const p of c.FUN_PERSONAS)for(const field of ['nickname','tagline','comment']){
  const text=p.locales[lang][field];
  assert.deepEqual(drawnLines(text),reference(text,660),lang+' '+p.id+' '+field+' wrapping unchanged');
 }
 // Japanese and Chinese have no spaces: they must still wrap, keep every character and respect basic kinsoku.
 for(const lang of ['ja','zh'])for(const p of c.FUN_PERSONAS){
  const text=p.locales[lang].comment;
  const lines=c.wrapCjkLines(ctx,text,660);
  assert.ok(lines.length>1,p.id+' Japanese comment wraps');
  assert.equal(lines.join(''),text,p.id+' no character lost');
  for(const line of lines){
   assert.ok(ctx.measureText(line).width<=660,p.id+' line fits: '+line);
   assert.doesNotMatch(line,/^[、。，．・：；？！）」』】〕…]/,p.id+' line starts with closing punctuation: '+line);
   assert.doesNotMatch(line,/[（「『【〔]$/,p.id+' line ends with an opening bracket: '+line);
  }
 }
 // Traditional Chinese punctuation is already covered by the existing kinsoku sets; no new characters were added.
 const zhStress='他說：「這件事很有趣。」然後呢？（真的）就這樣了…'.repeat(4);
 for(const line of c.wrapCjkLines(ctx,zhStress,200)){
  assert.doesNotMatch(line,/^[，。！？：；」』）…]/,'zh kinsoku start: '+line);
  assert.doesNotMatch(line,/[「『（]$/,'zh kinsoku end: '+line);
 }
 assert.equal(c.wrapCjkLines(ctx,zhStress,200).join(''),zhStress);
 // Punctuation stress: 。 and 、 never begin a line and 「 never ends one.
 const stress='最初の文です。次は「引用」から始まります、そして続きます。'.repeat(4);
 for(const line of c.wrapCjkLines(ctx,stress,200)){
  assert.doesNotMatch(line,/^[、。」]/,'kinsoku start: '+line);
  assert.doesNotMatch(line,/「$/,'kinsoku end: '+line);
 }
 assert.equal(c.wrapCjkLines(ctx,stress,200).join(''),stress);
 // Korean words are space separated, so the CJK path must not claim them: every line breaks on a space,
 // keeps its words whole and never starts with closing punctuation.
 for(const lang of ['ko','ru'])for(const p of c.FUN_PERSONAS){
  const text=p.locales[lang].comment;
  assert.equal(c.CJK_TEXT.test(text),false,p.id+' '+lang+' stays on the space path');
  const lines=drawnLines(text);
  assert.ok(lines.length>1,p.id+' '+lang+' comment wraps');
  assert.equal(lines.join(' '),text,p.id+' no word lost');
  for(const line of lines) assert.doesNotMatch(line,/^[.,!?…)\]}’”]/,p.id+' line starts with closing punctuation: '+line);
 }
});
test('canvas names Japanese, Korean and Traditional Chinese system fonts only for ja, ko and zh, leaving other locales byte-identical',()=>{
 const c=browser();
 class FakeCtx { set font(v){ this._font=v; } get font(){ return this._font; } }
 const ja=new FakeCtx();c.applyLocaleFont(ja,'ja');
 ja.font='900 56px Nunito, Arial, sans-serif';
 assert.match(ja.font,/^900 56px Nunito, Arial,/);
 assert.match(ja.font,/"Hiragino Sans".*"Yu Gothic".*Meiryo/);
 assert.match(ja.font,/sans-serif$/);
 // Stacks without a generic family (barcode) and other locales are untouched.
 ja.font='26px monospace';assert.equal(ja.font,'26px monospace');
 const ko=new FakeCtx();c.applyLocaleFont(ko,'ko');
 ko.font='900 56px Nunito, Arial, sans-serif';
 assert.match(ko.font,/^900 56px Nunito, Arial,/);
 assert.match(ko.font,/"Apple SD Gothic Neo".*"Malgun Gothic".*"Noto Sans KR"/);
 assert.match(ko.font,/sans-serif$/);
 assert.doesNotMatch(ko.font,/Hiragino|Meiryo/);
 ko.font='26px monospace';assert.equal(ko.font,'26px monospace');
 const zh=new FakeCtx();c.applyLocaleFont(zh,'zh');
 zh.font='900 56px Nunito, Arial, sans-serif';
 assert.match(zh.font,/^900 56px Nunito, Arial,/);
 assert.match(zh.font,/"PingFang TC".*"Microsoft JhengHei".*"Noto Sans TC"/);
 assert.match(zh.font,/sans-serif$/);
 assert.doesNotMatch(zh.font,/Hiragino|Meiryo|Malgun/);
 zh.font='26px monospace';assert.equal(zh.font,'26px monospace');
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ru']){
  const other=new FakeCtx();c.applyLocaleFont(other,lang);
  other.font='900 56px Nunito, Arial, sans-serif';
  assert.equal(other.font,'900 56px Nunito, Arial, sans-serif',lang+' font stack unchanged');
 }
});
test('browser language detection maps every supported base language, including regional variants',()=>{
 const cases=[['tr-TR','tr'],['tr','tr'],['en-US','en'],['en-GB','en'],['en','en'],['es-MX','es'],['es-ES','es'],['es-AR','es'],['pt-BR','pt'],['pt-PT','pt'],
  ['ar-SA','ar'],['ar-AE','ar'],['ar-QA','ar'],['ar-EG','ar'],['fr-FR','fr'],['fr-CA','fr'],['fr-BE','fr'],['de-DE','de'],['de-AT','de'],['de-CH','de'],
  ['it-IT','it'],['ja-JP','ja'],['ko-KR','ko'],['zh-TW','zh'],['zh-HK','zh'],['zh-MO','zh'],['zh-CN','zh'],['zh-Hant-TW','zh'],['ru-RU','ru'],['ru-KZ','ru'],['EN_us','en']];
 for(const [tag,expected] of cases){
  const c=browser();c.navigator={languages:[tag]};
  assert.equal(c.detectBrowserLang([tag]),expected,tag);
  assert.equal(c.getLang(),expected,tag+' via navigator.languages');
  assert.equal(c.langDir(c.getLang()),expected==='ar'?'rtl':'ltr',tag+' direction');
 }
});
test('detection follows navigator.languages order, skips unsupported entries and falls back to navigator.language, then English',()=>{
 let c=browser();c.navigator={languages:['nl-NL','de-DE','en-US']};assert.equal(c.getLang(),'de','second entry wins when the first is unsupported');
 c=browser();c.navigator={languages:['sv-SE','fi-FI','ko-KR']};assert.equal(c.getLang(),'ko','third entry is found');
 c=browser();c.navigator={languages:['en-US','ja-JP']};assert.equal(c.getLang(),'en','the first supported entry wins, not the last');
 c=browser();c.navigator={languages:[],language:'pt-BR'};assert.equal(c.getLang(),'pt','navigator.language is the fallback');
 c=browser();c.navigator={language:'ja-JP'};assert.equal(c.getLang(),'ja','navigator.language alone');
 for(const unsupported of [['nl-NL'],['sv','fi','pl-PL'],['xx'],[''],[]]){
  c=browser();c.navigator={languages:unsupported};assert.equal(c.getLang(),'en',JSON.stringify(unsupported)+' falls back to en');
 }
 c=browser();assert.equal(c.getLang(),'en','no navigator at all');
 assert.equal(c.detectBrowserLang(null),null);
});
test('a saved language always wins over browser detection, and detection is never persisted',()=>{
 const c=browser();c.navigator={languages:['ja-JP']};
 assert.equal(c.getLang(),'ja');
 assert.equal(c.localStorage.getItem(c.LS.lang),null,'detection does not write a preference');
 c.localStorage.setItem(c.LS.lang,'es');
 assert.equal(c.getLang(),'es','saved es beats browser ja');
 c.navigator={languages:['ar-SA']};assert.equal(c.getLang(),'es','still es when the browser language changes');
 for(const lang of c.LANGS){c.localStorage.setItem(c.LS.lang,lang);assert.equal(c.getLang(),lang,lang+' saved choice wins');}
 // Only the existing key is used; no parallel preference store appears.
 assert.equal(c.LS.lang,'xora_lang');
});
test('language selector lists all 12 languages, applies and persists the pick, closes, and flips RTL/LTR',()=>{
 const c=browser();c.navigator={languages:['ar-SA']};
 c.CustomEvent=class{constructor(type){this.type=type;}};
 const registry=[];const docListeners={};
 const makeEl=()=>{const el={id:'',className:'',hidden:false,innerHTML:'',textContent:'',title:'',attrs:new Map(),children:[],parentNode:null,listeners:{},
  setAttribute(k,v){this.attrs.set(k,String(v));},getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;},
  addEventListener(t,fn){(this.listeners[t]=this.listeners[t]||[]).push(fn);},
  appendChild(ch){if(ch.parentNode)ch.parentNode.children=ch.parentNode.children.filter(x=>x!==ch);ch.parentNode=this;this.children.push(ch);return ch;},
  insertBefore(ch,ref){if(ch.parentNode)ch.parentNode.children=ch.parentNode.children.filter(x=>x!==ch);ch.parentNode=this;const i=this.children.indexOf(ref);this.children.splice(i<0?this.children.length:i,0,ch);return ch;},
  contains(n){for(let x=n;x;x=x.parentNode)if(x===this)return true;return false;},
  focus(){c.document.activeElement=this;},querySelector(){return null;},querySelectorAll(){return [];},
  fire(t,e){(this.listeners[t]||[]).forEach(fn=>fn(Object.assign({stopPropagation(){},preventDefault(){}},e||{})));}};registry.push(el);return el;};
 const nav=makeEl();const btn=makeEl();btn.id='langBtn';nav.appendChild(btn);
 c.document.createElement=()=>makeEl();
 c.document.getElementById=id=>registry.find(el=>el.id===id)||null;
 c.document.documentElement={};
 c.document.addEventListener=(t,fn)=>{(docListeners[t]=docListeners[t]||[]).push(fn);};
 c.document.dispatchEvent=()=>true;
 const fireDoc=(t,e)=>(docListeners[t]||[]).forEach(fn=>fn(Object.assign({stopPropagation(){},preventDefault(){}},e||{})));

 c.initLangPicker();c.applyI18n();
 const menu=c.document.getElementById('langMenu');
 assert.ok(menu,'menu created');
 assert.equal(btn.parentNode.className,'lang-picker','button is wrapped in place');
 assert.equal(btn.parentNode.parentNode,nav,'wrapper stays in the header');
 assert.equal(btn.getAttribute('aria-haspopup'),'listbox');
 assert.equal(menu.hidden,true,'closed until clicked');
 // Auto-detected Arabic is applied on first render.
 assert.equal(c.document.documentElement.lang,'ar');assert.equal(c.document.documentElement.dir,'rtl');
 assert.equal(btn.textContent,'AR');

 btn.fire('click');
 assert.equal(menu.hidden,false,'opens on click');assert.equal(btn.getAttribute('aria-expanded'),'true');
 const options=[...menu.innerHTML.matchAll(/data-lang="(\w+)" lang="\w+" dir="(\w+)" aria-selected="(\w+)">([^<]+)<\/button>/g)].map(m=>({code:m[1],dir:m[2],selected:m[3]==='true',label:m[4]}));
 assert.deepEqual(options.map(o=>o.code),['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru']);
 assert.deepEqual(options.map(o=>o.label),['Türkçe','English','Español','Português','العربية','Français','Deutsch','Italiano','日本語','한국어','繁體中文','Русский']);
 assert.deepEqual(options.filter(o=>o.selected).map(o=>o.code),['ar'],'current language is marked');
 assert.equal(options.find(o=>o.code==='ar').dir,'rtl');assert.ok(options.filter(o=>o.code!=='ar').every(o=>o.dir==='ltr'));

 const pick=code=>menu.fire('click',{target:{closest:()=>({getAttribute:()=>code})}});
 // Arabic -> English flips the page to LTR.
 pick('en');
 assert.equal(menu.hidden,true,'closes after a pick');assert.equal(btn.getAttribute('aria-expanded'),'false');
 assert.equal(c.localStorage.getItem(c.LS.lang),'en','manual pick is persisted');
 assert.equal(c.getLang(),'en','saved pick now beats the Arabic browser');
 assert.equal(c.document.documentElement.dir,'ltr');assert.equal(c.document.documentElement.lang,'en');
 assert.equal(btn.textContent,'EN');

 // Every option selects its own locale and sets the right direction.
 for(const code of c.LANGS){
  btn.fire('click');assert.equal(menu.hidden,false);
  pick(code);
  assert.equal(c.localStorage.getItem(c.LS.lang),code);assert.equal(c.getLang(),code);
  assert.equal(c.document.documentElement.lang,code);
  assert.equal(c.document.documentElement.dir,code==='ar'?'rtl':'ltr',code+' direction');
  assert.equal(btn.textContent,code.toUpperCase());assert.equal(menu.hidden,true);
  assert.equal(c.t('fun_btn'),c.I18N[code].fun_btn,code+' copy applied');
 }

 // Outside click and Escape close the menu; clicks inside it do not.
 btn.fire('click');assert.equal(menu.hidden,false);
 fireDoc('click',{target:menu});assert.equal(menu.hidden,false,'click inside keeps it open');
 fireDoc('click',{target:makeEl()});assert.equal(menu.hidden,true,'outside click closes');
 btn.fire('click');fireDoc('keydown',{key:'Escape'});assert.equal(menu.hidden,true,'Escape closes');
 // An unsupported value never reaches storage.
 c.setLang('xx');assert.equal(c.localStorage.getItem(c.LS.lang),'ru');
});

const LOCALES12=['tr','en','es','pt','ar','fr','de','it','ja','ko','zh','ru'];
const recorder=(c)=>{
 const cjk=/[\u3000-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/;
 const text=[],rects=[];
 const target={direction:'ltr',font:'',measureText:v=>({width:[...String(v)].reduce((w,ch)=>w+(cjk.test(ch)?24:12),0)}),fillText:(v,x,y)=>text.push({v:String(v),x,y}),createLinearGradient:()=>({addColorStop(){}})};
 const ctx=new Proxy(target,{get:(o,k)=>k in o?o[k]:()=>{}});
 c.document.createElement=()=>({getContext:()=>ctx,toDataURL:()=>'data:,'});
 const originalRect=c.roundRect;c.roundRect=(cx,x,y,w,h,r)=>{rects.push({x,y,w,h});originalRect(cx,x,y,w,h,r);};
 return {text,rects};
};
test('FUN identity cards show persona style chips and no numeric metrics, in all 12 locales',()=>{
 for(const lang of LOCALES12){
  const c=browser();c.localStorage.setItem(c.LS.lang,lang);
  const seen=new Map();for(let n=0;n<1000&&seen.size<12;n++){const r=c.analyzeFunHandle('alice','mirror',n);seen.set(r.persona_id,r);}
  for(const [id,r] of seen){
   const persona=c.FUN_PERSONAS.find(p=>p.id===id);
   const html=c.buildIdentityCard(r);
   assert.doesNotMatch(html,/score-bar|score-val|score-chip|idcard-scores|real-metrics/,lang+' '+id+' FUN has no metric rows');
   const chips=[...html.matchAll(/<span class="trait-chip" data-trait="(\w+)"><b>([^<]+)<\/b> ([^<]+)<\/span>/g)].map(m=>({d:m[1],label:m[2],value:m[3]}));
   assert.deepEqual(chips.map(x=>x.d),['humor','reply','timeline'],lang+' '+id+' three chips');
   for(const ch of chips){
    assert.equal(ch.label,c.esc(c.I18N[lang]['trait_'+ch.d]));
    assert.equal(ch.value,c.esc(c.I18N[lang]['trait_'+ch.d+'_'+persona.traits[ch.d]]),lang+' '+id+' '+ch.d);
    assert.doesNotMatch(ch.value+ch.label,/\d|%/,'chips are words, not numbers');
   }
   // PNG: chips drawn, no percentages, no bars, nothing below the footer line except the footer.
   const {text,rects}=recorder(c);c.renderIdentityPNG(r);
   for(const ch of chips) assert.ok(text.some(p=>p.v===c.I18N[lang]['trait_'+ch.d+'_'+persona.traits[ch.d]]),lang+' '+id+' chip value in PNG');
   assert.ok(!text.some(p=>/\d\s?%|%\s?\d/.test(p.v)),lang+' '+id+' no percentages in FUN PNG');
   const box=rects.find(b=>b.x===130&&b.h>=200);assert.ok(box.y+box.h<1090,lang+' '+id+' comment box above footer');
   const chipRects=rects.filter(b=>b.h<60&&b.y>500&&b.y<box.y);
   assert.equal(chipRects.length,6,lang+' '+id+' three chip pills (fill + stroke)');
   for(const b of chipRects){assert.ok(b.x>=130&&b.x+b.w<=870,lang+' '+id+' chip inside 740px row');assert.ok(b.y+b.h<box.y,'chips sit above the comment box');}
  }
  // Every trait value is distinct within its dimension in every locale.
  for(const d of ['humor','reply','timeline']){
   const vals=Object.keys(c.I18N[lang]).filter(k=>k.startsWith('trait_'+d+'_')).map(k=>c.I18N[lang][k]);
   assert.equal(new Set(vals).size,vals.length,lang+' '+d+' values distinct');
  }
 }
});
test('FUN Match shows the entertainment percentage only: no sub-scores in HTML or PNG',()=>{
 for(const lang of LOCALES12){
  const c=browser();c.localStorage.setItem(c.LS.lang,lang);
  const m=c.matchFunHandles('alice','bob',3);
  const html=c.buildMatchCard(m);
  assert.doesNotMatch(html,/score-bar|score-val|match-rows/,lang);
  for(const k of ['match_flirt','match_vibe','match_humor','match_chaos','match_romance']) assert.ok(!html.includes(c.esc(c.I18N[lang][k])),lang+' '+k+' not in FUN HTML');
  const {text}=recorder(c);c.renderMatchPNG(m);
  for(const k of ['match_flirt','match_vibe','match_humor','match_chaos','match_romance']) assert.ok(!text.some(p=>p.v.includes(c.I18N[lang][k])),lang+' '+k+' not in FUN PNG');
 }
});
test('REAL identity card draws its metric rows from behavior_signals, deterministically, in all 12 locales',()=>{
 const signals={reply_ratio:0.32,original_ratio:0.5,repost_ratio:0.1,quote_ratio:0.08,question_ratio:0.25,emoji_per_post:1.4,avg_text_length:142};
 const expectKeys=['reply_ratio','original_ratio','repost_ratio','question_ratio','emoji_per_post','avg_text_length'];
 const longComment='You open threads with a question and come back to answer the replies yourself. Most of your posts are your own words rather than reposts, and you keep them compact. When you quote someone, it is usually to add a short counterpoint.';
 for(const lang of LOCALES12){
  const c=browser();c.localStorage.setItem(c.LS.lang,lang);
  const res={meta:{tier:'real',locale:lang,version:'xora_real_v1'},handle:'alice',hash:7,rarity:{name:'epic',score:80},
   nickname:{[lang]:'Curious Mind'},tagline:{[lang]:'Questions lead the way.'},profile_summary:{[lang]:'Asks open questions in public threads.'},
   comment:{mirror:{[lang]:longComment},stalk:{[lang]:longComment}},behavior_signals:signals,
   card:{color:'#8B5CF6',emoji:'🪞',top_behaviors:[{key:'duygusal_yogunluk',label:{[lang]:'AI_ONLY_LABEL'},value:88}]}};
  const html=c.buildIdentityCard(res);
  assert.match(html,/XORA REAL/);assert.ok(html.includes(c.esc(c.t('rarity_epic'))),lang+' rarity');
  assert.match(html,/data-source="behavior_signals"/);assert.ok(!html.includes('AI_ONLY_LABEL'),'AI-judged metric not drawn');
  const rows=[...html.matchAll(/data-metric="(\w+)"><span class="score-name">([^<]+)<\/span><span class="score-bar"><i style="width:(\d+)%"><\/i><\/span><span class="score-val">([^<]+)<\/span>/g)].map(m=>({key:m[1],label:m[2],bar:+m[3],value:m[4]}));
  assert.deepEqual(rows.map(r=>r.key),expectKeys,lang+' rows');
  assert.deepEqual(rows.map(r=>r.bar),[32,50,10,25,47,51],lang+' bars derive from the measured values');
  assert.equal(rows[0].value,c.esc(c.formatPercent(0.32,lang)));assert.equal(rows[4].value,c.esc(c.formatDecimal(1.4,lang)));
  assert.equal(rows[5].value,c.esc(c.I18N[lang].real_m_chars.replace('{n}','142')));
  assert.equal(c.buildIdentityCard(res),html,'no randomness: same input, same card');
  const moved=c.buildIdentityCard({...res,behavior_signals:{...signals,reply_ratio:0.6}});
  assert.match(moved,/data-metric="reply_ratio"><span class="score-name">[^<]+<\/span><span class="score-bar"><i style="width:60%">/);
  // PNG: rows + values drawn, comment fits above the footer.
  const {text,rects}=recorder(c);c.renderIdentityPNG(res);
  for(const r of rows) assert.ok(text.some(p=>p.v===c.I18N[lang][{reply_ratio:'real_m_reply',original_ratio:'real_m_original',repost_ratio:'real_m_repost',question_ratio:'real_m_question',emoji_per_post:'real_m_emoji',avg_text_length:'real_m_length'}[r.key]]),lang+' PNG label '+r.key);
  assert.ok(text.some(p=>p.v===c.formatPercent(0.32,lang)),lang+' PNG value');
  const box=rects.filter(b=>b.x===130).pop();assert.ok(box.y+box.h<=1072,lang+' REAL comment box above footer: '+(box.y+box.h));
  const body=text.filter(p=>p.y>100&&p.y<1090&&!/^XORA|xora\.app/.test(p.v));
  assert.ok(body.every(p=>p.y<box.y+box.h),lang+' no copy below the comment box');
  assert.ok(text.some(p=>p.v.includes(c.t('rarity_epic'))),lang+' rarity stamped on PNG');
 }
 // Older REAL results without behavior_signals keep their AI metrics rather than inventing numbers.
 const c=browser();c.localStorage.setItem(c.LS.lang,'en');
 const legacy={meta:{tier:'real',locale:'en'},handle:'bob',nickname:{en:'X'},tagline:{en:'Y'},comment:{mirror:{en:'Z.'}},card:{color:'#111',emoji:'🪞',top_behaviors:[{key:'mizah',label:{en:'Humor'},value:70},{key:'merak',label:{en:'Curiosity'},value:64},{key:'kaos',label:{en:'Chaos'},value:40}]}};
 const html=c.buildIdentityCard(legacy);
 assert.match(html,/data-source="ai_metrics"/);assert.ok(html.includes('>Humor<')&&html.includes('width:70%'));
});
test('credit packages: 10/20/50/300 at launch prices with struck regular prices and correct capacity, in all 12 locales',()=>{
 const c=browser();
 assert.deepEqual({...c.COSTS},{mirror:5,stalk:5,match:10},'per-analysis prices unchanged');
 const pk=[...c.CREDIT_PACKAGES].map(p=>({id:p.id,credits:p.credits,list:p.list,price:p.price,featured:!!p.featured,label:p.label,note:p.note||null}));
 assert.deepEqual(pk,[
  {id:'starter',credits:10,list:4.99,price:2.99,featured:false,label:'pkg_starter',note:null},
  {id:'popular',credits:20,list:9.99,price:5.99,featured:true,label:'pkg_popular',note:null},
  {id:'value',credits:50,list:24.99,price:14.99,featured:false,label:'pkg_value',note:null},
  {id:'pro',credits:300,list:149.99,price:89.99,featured:false,label:'pkg_pro',note:'pkg_pro_note'}]);
 assert.deepEqual([...c.CREDIT_PACKAGES].map(p=>({...c.packageCapacity(p)})),[{mirrorStalk:2,match:1},{mirrorStalk:4,match:2},{mirrorStalk:10,match:5},{mirrorStalk:60,match:30}]);
 for(const p of c.CREDIT_PACKAGES) assert.ok(Math.abs(1-p.price/p.list-c.LAUNCH_DISCOUNT)<0.005,p.id+' is 40% off');
 for(const lang of LOCALES12){
  c.localStorage.setItem(c.LS.lang,lang);
  const box={innerHTML:''},banner={textContent:''};
  c.renderCreditPackages(box,banner);
  assert.equal(banner.textContent,c.I18N[lang].pricing_launch.replace('{pct}',c.formatPercent(0.4,lang)),lang+' banner');
  const packs=[...box.innerHTML.matchAll(/<div class="pack pack-(\w+)( hot)?" data-package="\w+"><p class="pack-badge">([^<]+)<\/p><p class="pack-amount">(\d+) <small>⚡<\/small><\/p><p class="pack-name">([^<]+)<\/p>(?:<p class="pack-note">([^<]+)<\/p>)?<p class="pack-price"><s class="pack-old" aria-label="[^"]+">([^<]+)<\/s> <span class="pack-now">([^<]+)<\/span><\/p><button type="button" class="btn btn-sm( btn-orange)?" data-amount="(\d+)"/g)];
  assert.equal(packs.length,4,lang+' four packages');
  const fill=(s,v)=>s.replace('{ms}',v.ms).replace('{mt}',v.mt);
  const caps=[[2,1],[4,2],[10,5],[60,30]];
  packs.forEach((m,i)=>{
   const p=c.CREDIT_PACKAGES[i];
   assert.equal(m[1],p.id);assert.equal(!!m[2],p.id==='popular',lang+' only 20 is highlighted');
   assert.equal(m[3],c.esc(c.I18N[lang][p.label]),lang+' '+p.id+' badge');
   assert.equal(+m[4],p.credits);assert.equal(+m[10],p.credits,'buy button amount');
   assert.equal(m[5],c.esc(fill(c.I18N[lang].pkg_capacity,{ms:caps[i][0],mt:caps[i][1]})),lang+' capacity');
   assert.equal(m[6]||null,p.id==='pro'?c.esc(c.I18N[lang].pkg_pro_note):null,lang+' pro note');
   assert.equal(m[7],c.esc(c.formatPrice(p.list,lang)),lang+' struck regular price');assert.equal(m[8],c.esc(c.formatPrice(p.price,lang)),lang+' launch price');
   assert.equal(!!m[9],p.id==='popular');
  });
  assert.doesNotMatch(box.innerHTML,/Real Analiz|Real Analysis|pkg[123]_n/,'no generic "N Real Analysis" labels');
 }
 c.localStorage.setItem(c.LS.lang,'en');const box={innerHTML:''};c.renderCreditPackages(box,null);
 for(const [old,now] of [['$4.99','$2.99'],['$9.99','$5.99'],['$24.99','$14.99'],['$149.99','$89.99']]) assert.ok(box.innerHTML.includes('>'+old+'</s> <span class="pack-now">'+now+'<'),old+' -> '+now);
 assert.match(box.innerHTML,/pack-popular hot"[^]*?>MOST POPULAR</);assert.match(box.innerHTML,/pack-pro"[^]*?>PROFESSIONAL<[^]*?>Creators &amp; Agencies</);
 // The credits page renders from this config and keeps the payment-coming-soon click.
 const page=fs.readFileSync('credits.html','utf8');
 assert.match(page,/id="creditPacks"/);assert.match(page,/renderCreditPackages\(packs, banner\)/);assert.match(page,/toast\(t\("payment_soon"\)/);
 assert.doesNotMatch(page,/data-i18n="pkg[123]_n"|\$11\.99|\$4\.99<\/p>/);
});

// ---------------------------------------------------------------------------------------------
// FUN persona copy is X-native: online behavior only, no offline scenes, no claim of analysis.
const FUN_WORD=s=>new RegExp('(?<!\\p{L})(?:'+s+')(?!\\p{L})','iu');
const FUN_OFFLINE={
 tr:FUN_WORD('kahve\\p{L}*|kafe\\p{L}*|masa(?:da|ya|dan|nın|daki|sı)?|buluşma\\p{L}*|oda(?:da|ya|dan|nın|daki|sı)?|göz göze|yüz ifade\\p{L}*|ses ton\\p{L}*|yüz yüze|yüzünden tek|parti\\p{L}*|toplantı\\p{L}*|kalabalık\\p{L}*'),
 en:FUN_WORD('coffee|caf[eé]|tables?|meetings?|meetups?|rooms?|eye contact|faces?|facial|straight face|voices?|tone of voice|in person|face to face|party|parties|dinner|lunch|gatherings?|hang ?outs?'),
 es:FUN_WORD('caf[eé]|mesas?|reuni[oó]n\\p{L}*|quedadas?|salas?|habitaci[oó]n\\p{L}*|caras?|rostros?|miradas?|voz|tono de voz|en persona|cara a cara|fiestas?|cenas?'),
 pt:FUN_WORD('caf[eé]|mesas?|encontros?|reuni[aã]o|reuni[oõ]es|salas?|quartos?|rostos?|olho no olho|voz|tom de voz|pessoalmente|cara a cara|festas?|botecos?|bar|bares|rodas?'),
 ar:FUN_WORD('[وفبل]?(?:ال)?(?:قهوة|مقهى|طاولة|لقاء|اجتماع|غرفة|وجه|بوجه|نبرة|صوت|حفلة|جلسة|مجلس)'),
 fr:FUN_WORD('caf[eé]|tables?|réunions?|rendez-vous|pièces?|salles?|visages?|regards?|voix|ton de voix|en personne|face à face|soirées?|fêtes?|bar'),
 de:FUN_WORD('Kaffee|Café|Tisch\\p{L}*|\\p{L}*tisch|Treffen|Raum|Zimmer|Blickkontakt|Gesicht\\p{L}*|Miene|Stimme|Tonfall|von Angesicht|Party|Kneipe|Runde'),
 it:FUN_WORD('caff[eè]|tavol[oai]|incontr[oi]|stanz[ae]|sal[ae]|facci[ae]|viso|volto|sguardo|voce|tono di voce|di persona|fest[ae]|bar'),
 ja:/コーヒー|カフェ|テーブル|部屋|目が合|顔|表情|声|口調|対面|会って|飲み会|集まり|会議/u,
 ko:/커피|카페|테이블|방에서|방 안|모임|만나서|직접 만나|눈을 마주|얼굴|표정|목소리|말투|회의|자리에 앉/u,
 zh:/咖啡|桌上|餐桌|桌子|一桌|坐在|聚會|見面|房間|對上眼|臉|聲音|語調|語氣|面對面|派對/u,
 ru:FUN_WORD('коф\\p{L}*|кафе|стол|стола|столом|столе|встреч\\p{L}*|комнат\\p{L}*|вечеринк\\p{L}*|лицо|лица|лицом|лице|взгляд\\p{L}*|в глаза|голос\\p{L}*|интонац\\p{L}*|вживую|тусовк\\p{L}*')
};
const FUN_CLAIM={
 tr:/analiz ett|hesabına baktık|hesabını inceled|son tweet|son postların|verilerin|verilerine göre|ölçtük|hesapladık|postlarına baktık/iu,
 en:/we analy[sz]ed|we looked at your|your (?:recent )?(?:posts|tweets|data) show|according to your|we measured|we calculated|your last tweets|we checked your/iu,
 es:/analizamos|revisamos tu cuenta|tus últimos (?:tuits|posts|tweets)|tus datos muestran|según tus datos|medimos|calculamos/iu,
 pt:/analisamos|olhamos sua conta|seus últimos (?:posts|tweets)|seus dados mostram|de acordo com seus dados|medimos|calculamos/iu,
 ar:/حللنا|تحليل حسابك|نظرنا في حسابك|آخر تغريداتك|بياناتك تظهر|وفقًا لبياناتك|قسنا|حسبنا/u,
 fr:/nous avons analysé|on a analysé|tes derniers (?:posts|tweets)|tes données montrent|selon tes données|nous avons mesuré|nous avons calculé/iu,
 de:/wir haben (?:analysiert|gemessen|berechnet)|deine letzten (?:Posts|Tweets)|deine Daten zeigen|laut deinen Daten|analysiert/iu,
 it:/abbiamo analizzato|i tuoi ultimi (?:post|tweet)|i tuoi dati mostrano|secondo i tuoi dati|abbiamo misurato|abbiamo calcolato/iu,
 ja:/分析しました|分析した結果|あなたのデータ|最近のポストから|測定|計算しました/u,
 ko:/분석했|분석 결과|당신의 데이터|최근 게시물을 보니|측정했|계산했/u,
 zh:/我們分析|分析了你的|你的資料顯示|根據你的資料|最近的貼文看來|測量|計算了/u,
 ru:/мы проанализировали|проанализировали|твои данные показывают|по твоим данным|твои последние посты|мы измерили|мы посчитали/iu
};
test('FUN persona copy is X-native in all 12 locales: no offline scenes and no claim that X data was analyzed',()=>{
 const c=browser();
 // The patterns are live: the pre-rewrite copy tripped them 53 times.
 assert.ok(FUN_OFFLINE.en.test('a whole table talking')&&FUN_OFFLINE.tr.test('kısa bir kahvenin')&&FUN_OFFLINE.ja.test('コーヒー'));
 assert.ok(FUN_CLAIM.en.test('we analyzed your posts')&&FUN_CLAIM.tr.test('postlarını analiz ettik'));
 for(const p of c.FUN_PERSONAS)for(const lang of LOCALES12){
  const copy=p.locales[lang],text=copy.tagline+' '+copy.comment;
  const off=text.match(FUN_OFFLINE[lang]);assert.equal(off,null,lang+' '+p.id+' offline context: '+(off&&off[0]));
  assert.doesNotMatch(copy.nickname+' '+text,FUN_CLAIM[lang],lang+' '+p.id+' claims an analysis');
 }
 // Nicknames that named a venue, room, table or gathering were renamed; old names still resolve.
 const renamed={conversation_mediator:{tr:'Masadaki Hakem',ar:'حكيم المجلس',de:'Ruhepol der Runde'},armchair_thinker:{pt:'Filósofo de Boteco',ar:'فيلسوف المقهى',de:'Philosoph am Küchentisch',it:'Filosofo da Bar'},socially_attuned:{en:'Reads the Room'},social_catalyst:{en:'Life of the Party',es:'Alma de la Fiesta',pt:'Anima Qualquer Roda',ar:'روح الجلسة'}};
 for(const [id,old] of Object.entries(renamed)){
  const p=c.FUN_PERSONAS.find(x=>x.id===id);
  for(const [lang,name] of Object.entries(old)){
   assert.notEqual(p.locales[lang].nickname,name);assert.ok(p.legacy_names.includes(name),id+' keeps '+name+' as a legacy name');
   c.localStorage.setItem(c.LS.lang,lang);
   const saved={meta:{tier:'fun'},mode:'mirror',handle:'alice',nickname:{[lang]:name},card:{color:'#000'},hash:1};
   assert.ok(c.buildIdentityCard(saved).includes(c.esc(p.locales[lang].nickname)),lang+' old saved card shows the new nickname');
  }
 }
 // FUN Match comments (current and legacy) follow the same rules.
 for(const lang of LOCALES12)for(const text of [...c.FUN_MATCH_COMMENTS[lang],...c.MATCH_COMMENTS[lang]]){
  const off=text.match(FUN_OFFLINE[lang]);assert.equal(off,null,lang+' FUN match comment offline context: '+(off&&off[0])+' | '+text);
  assert.doesNotMatch(text,FUN_CLAIM[lang],lang+' FUN match comment claims an analysis');
 }
 // French keeps a non-breaking space before : ; ? ! in persona copy.
 for(const p of c.FUN_PERSONAS){const fr=p.locales.fr.tagline+' '+p.locales.fr.comment;assert.doesNotMatch(fr,/ [:;?!]/,p.id+' French spacing');}
});
test('FUN Match shows one big FUN percentage labelled as a XORA FUN score; REAL Match keeps its label',()=>{
 for(const lang of LOCALES12){
  const c=browser();c.localStorage.setItem(c.LS.lang,lang);
  const m=c.matchFunHandles('alice','bob',5);
  const html=c.buildMatchCard(m);
  assert.equal((html.match(/%\d+|\d+\s?%/g)||[]).length,1,lang+' exactly one percentage on the FUN Match card');
  assert.ok(html.includes('>%'+m.overall+'</h2><p class="idcard-desc">'+c.esc(c.I18N[lang].fun_match_label)+'</p>'),lang+' big % with the FUN label');
  assert.match(c.I18N[lang].fun_match_label,/XORA FUN/);
  assert.ok(!html.includes(c.esc(c.I18N[lang].match_overall)),lang+' no analysis-style overall label');
  const {text}=recorder(c);c.renderMatchPNG(m);
  assert.deepEqual(text.filter(p=>/%\s?\d+|\d+\s?%/.test(p.v)).map(p=>p.v),['%'+m.overall],lang+' PNG: one percentage');
  assert.ok(text.some(p=>p.v===c.I18N[lang].fun_match_label)&&!text.some(p=>p.v===c.I18N[lang].match_overall),lang+' PNG FUN label');
  assert.deepEqual(text.filter(p=>p.y===780||p.y===812),[],lang+' no sub-score rows');
  // REAL Match is untouched: analysis label and AI-scored rows.
  const real={...m,meta:{...m.meta,tier:'real',locale:lang},fun_comment:undefined,ai_comment:{[lang]:'x'},rarity:{name:'rare'}};
  assert.ok(c.buildMatchCard(real).includes(c.esc(c.I18N[lang].match_overall)),lang+' REAL Match keeps match_overall');
  const png=recorder(c);c.renderMatchPNG(real);
  assert.ok(png.text.some(p=>p.v===c.I18N[lang].match_overall),lang+' REAL PNG keeps match_overall');assert.equal(png.text.filter(p=>p.y===780||p.y===812).length,2);
 }
});
