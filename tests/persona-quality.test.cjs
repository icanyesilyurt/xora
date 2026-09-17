const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,edge}=require('./helpers.cjs');
// Simplified-only forms. Each of these has a distinct Traditional counterpart, so one hit means the
// copy is not Traditional Chinese.
const SIMPLIFIED_ONLY=/[这个们说见会时现样觉认为么过还来对开关点边进问让给东车马书长风话图网爱乐热无与头没当发汉语业产单卖买亲习乡终经级体种]/u;

test('canonical FUN personas cover every supported locale with reviewed independent copy',()=>{
 const c=browser(),e=edge();
 const locales=Object.keys(c.I18N).sort();
 assert.deepEqual(locales,['ar','de','en','es','fr','it','ja','ko','pt','tr','zh']);
 assert.equal(c.FUN_PERSONAS.length,12);
 assert.equal(new Set(c.FUN_PERSONAS.map(p=>p.id)).size,12);
 for(const p of c.FUN_PERSONAS){
  assert.match(p.id,/^[a-z]+(?:_[a-z]+)+$/);
  assert.ok(p.semantic.length>25);
  assert.deepEqual(Object.keys(p.locales).sort(),locales);
  const card=c.FUN_CARD_POOL.find(card=>card.id===p.id);
  for(const lang of locales){
   const copy=p.locales[lang];
   assert.equal(e.aliasValid(copy.nickname,lang),true,lang+': '+copy.nickname);
   // Japanese, Korean and Chinese pack more meaning per character, so they get their own minimum lengths.
   const dense=lang==='ja'||lang==='ko'||lang==='zh';
   const minTagline=dense?12:15, minComment=dense?60:100;
   assert.ok(copy.tagline.length>minTagline && copy.comment.length>minComment,lang+' '+p.id+' copy length');
   assert.equal(c.funModeComment(card,'mirror',lang),copy.comment);
   // The canonical key must win even if display copy is changed or absent.
   const result={meta:{tier:'fun'},mode:'mirror',handle:'alice',persona_id:p.id,nickname:{tr:'unrelated',en:'unrelated'},card:{color:p.color},hash:1};
   c.getLang=()=>lang;
   assert.equal(c.funIdentityComment(result,lang),copy.comment);
   assert.ok(c.buildIdentityCard(result).includes(c.esc(copy.nickname)));
   assert.ok(c.shareIdentityText(result).includes(copy.nickname));
   for(const oldName of p.legacy_names){
    const saved={...result,persona_id:undefined,nickname:oldName};
    assert.equal(c.funIdentityPersona(saved).id,p.id);
    assert.ok(c.buildIdentityCard(saved).includes(c.esc(copy.nickname)));
   }
  }
  // Locale copy stays independently curated: no field reused verbatim across languages.
  const copies=locales.map(lang=>p.locales[lang]);
  for(const field of ['nickname','tagline','comment']) assert.equal(new Set(copies.map(copy=>copy[field])).size,locales.length,p.id+' '+field+' must differ per locale');
  // Spanish, Portuguese, French, German and Italian copy must not be an English word-mix.
  for(const lang of ['es','pt','fr','de','it']) assert.doesNotMatch(p.locales[lang].nickname,/\b(?:the|of|and|you|room|mind|quiet|update)\b/i,lang+' '+p.id);
  // Japanese persona copy stays in Japanese script and the nickname is a short spaceless phrase.
  for(const field of ['nickname','tagline','comment']) assert.doesNotMatch(p.locales.ja[field],/[A-Za-z]/,'ja '+field+' '+p.id);
  assert.doesNotMatch(p.locales.ja.nickname,/\s/,'ja nickname has no spaces '+p.id);
  assert.ok([...p.locales.ja.nickname].length>=3 && [...p.locales.ja.nickname].length<=12,p.id);
  // Traditional Chinese persona copy stays Han: no Latin, no kana, no hangul, no Simplified forms,
  // and the nickname is a short spaceless phrase like the Japanese one.
  for(const field of ['nickname','tagline','comment']){
   assert.doesNotMatch(p.locales.zh[field],/[A-Za-z\u3040-\u30ff\uac00-\ud7af]/,'zh '+field+' '+p.id);
   assert.match(p.locales.zh[field],/[\u4e00-\u9fff]/,'zh '+field+' is Han '+p.id);
   assert.doesNotMatch(p.locales.zh[field],SIMPLIFIED_ONLY,'zh '+field+' must be Traditional '+p.id);
  }
  assert.doesNotMatch(p.locales.zh.nickname,/\s/,'zh nickname has no spaces '+p.id);
  assert.ok([...p.locales.zh.nickname].length>=3 && [...p.locales.zh.nickname].length<=12,p.id);
  // Korean persona copy stays in hangul: no Latin words, no kana and no kanji.
  for(const field of ['nickname','tagline','comment']){
   assert.doesNotMatch(p.locales.ko[field],/[A-Za-z\u3040-\u30ff\u4e00-\u9fff]/,'ko '+field+' '+p.id);
   assert.match(p.locales.ko[field],/[\uac00-\ud7af]/,'ko '+field+' is hangul '+p.id);
  }
  // Arabic persona copy is pure Arabic script: no Latin words and no diacritics in the nickname.
  for(const field of ['nickname','tagline','comment']) assert.doesNotMatch(p.locales.ar[field],/[A-Za-z]/,'ar '+field+' '+p.id);
  assert.doesNotMatch(p.locales.ar.nickname,/[\u064B-\u065F]/,'ar nickname without tashkeel '+p.id);
  assert.ok(p.locales.ar.nickname.split(' ').length<=4,p.id);
 }
 // Locale copy changes cannot alter identity or seeded selection.
 const before=c.analyzeFunHandle('alice','mirror',0);
 c.FUN_CARD_POOL.forEach(p=>{p.nickname.tr='Yeni Görünen İsim';});
 const after=c.analyzeFunHandle('alice','mirror',0);
 assert.equal(before.persona_id,after.persona_id);
 assert.equal(after.card.persona_id,after.persona_id);
});

test('nickname guard rejects forced compounds and sensitive labels in every locale',()=>{
 const e=edge();
 const bad={
  tr:['Drama İtfaiyesi','Soru Makinesi','İroni Müdürü','Vibe Radarı','Konu Mıknatısı','Gündem Turisti','Ortam Güncellemesi','Kadife Mantık','Cümle Tostçusu','Bipolar Dahi','Otistik Yazar','Müslüman Anlatıcı','Gay Anlatıcı','Kürt Yazar','Depresif Şair','Soru Question','Meraklı Meraklı'],
  en:['Drama Firefighter','Question Machine','Vibe Radar','Reply Hunter','Dry Wit Operator','Room Update','Velvet Logic','Quantum Spoon','Bipolar Genius','Autistic Writer','Muslim Storyteller','Gay Thinker','Kurdish Writer','Depressed Poet','Soru Sorucu','Curious Curious'],
  es:['Máquina de Preguntas','Bombero del Drama','Radar de Vibras','Cazador de Respuestas','Turista del Timeline','Lógica de Terciopelo','Cuchara Cuántica','Genio Bipolar','Escritor Autista','Narrador Musulmán','Pensador Gay','Escritora Kurda','Poeta Depresivo','Curious Mind','Mente Quiet','Curiosa Curiosa'],
  pt:['Máquina de Perguntas','Bombeiro do Drama','Radar de Vibes','Caçador de Respostas','Turista da Timeline','Lógica de Veludo','Colher Quântica','Gênio Bipolar','Escritor Autista','Narrador Muçulmano','Pensador Gay','Escritor Curdo','Poeta Deprimido','Curious Mind','Mente Quiet','Curioso Curioso','Siempre de Charla'],
  ar:['آلة الأسئلة','رادار المزاج','صياد الردود','مدير السخرية','منطق مخملي','سائح الخط الزمني','ملعقة كمومية','عبقري ثنائي القطب','كاتب مكتئب','الراوي المسلم','مفكر مثلي','الكاتب الكردي','Curious Mind','عقل Curious','فضولي فضولي','كثيرُ السؤال'],
  fr:['Machine à Questions','Pompier du Drame','Radar à Vibes','Chasseur de Réponses','Touriste de la Timeline','Logique de Velours','Cuillère Quantique','Génie Bipolaire','Écrivain Autiste','Conteur Musulman','Penseur Gay','Écrivain Kurde','Poète Dépressif','Curious Mind','Esprit Quiet','Curieux Curieux','Siempre de Charla'],
  de:['Die Fragemaschine','Drama Feuerwehr','Stimmungsradar Deluxe','Antwortjäger Deluxe','Kosmische Kartoffel','Lila Gedanke','Bipolares Genie','Autistischer Autor','Muslimischer Erzähler','Schwuler Denker','Kurdische Autorin','Depressiver Dichter','Curious Mind','Stiller Quiet','Neugierig Neugierig','Siempre de Charla'],
  it:['Macchina delle Domande','Pompiere del Dramma','Radar delle Vibes','Cacciatore di Risposte','Turista della Timeline','Logica di Velluto','Cucchiaio Quantico','Genio Bipolare','Scrittore Autistico','Narratore Musulmano','Pensatore Gay','Scrittrice Curda','Poeta Depresso','Curious Mind','Mente Quiet','Curioso Curioso','Siempre de Charla'],
  ja:['質問マシーン','ドラマ消防士','ムードレーダー','リプライハンター','タイムライン観光客','ベルベット論理','量子スプーン','双極性の天才','自閉症の作家','ムスリムの語り手','ゲイの思想家','クルド系作家','うつ病の詩人','伝説の勇者','Curious Mind','好奇心Mind','知りたがり知りたがり','空気が読める人だと自分でも思う'],
  zh:['問題機器','戲劇消防員','氣氛雷達','回覆獵人','時間軸觀光客','絲絨邏輯','量子湯匙','雙極性天才','自閉作家','穆斯林說書人','同性戀思想家','庫德作家','憂鬱症詩人','傳說中的勇者','Curious Mind','好奇 Mind','好奇好奇','一直很想成為安靜觀察者的那種人'],
  ko:['질문 기계','드라마 소방관','무드 레이더','답글 사냥꾼','타임라인 관광객','벨벳 논리','양자 숟가락','양극성 천재','자폐 작가','무슬림 이야기꾼','게이 사상가','쿠르드 작가','우울증 시인','전설의 용사','Curious Mind','호기심 Mind','궁금해 궁금해','조용한 관찰자가 되고 싶다고 늘 생각하는 사람']
 };
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh'])for(const text of bad[lang])assert.equal(e.aliasValid(text,lang),false,lang+': '+text);
 for(const [lang,text] of [['tr','Meraklı Muhabbetçi'],['en','Thoughtful Conversationalist'],['tr','Koltuk Filozofu'],['en','Armchair Philosopher'],['en','Social Butterfly'],['en','INQUISITIVE MIND'],['es','Mente Curiosa'],['es','Narrador Detallista'],['es','Casi en Serio'],['es','Filósofo de Sofá'],['pt','Curioso por Natureza'],['pt','Filósofo de Boteco'],['pt','Cara de Paisagem'],['pt','Relê Antes de Mandar'],['pt','Bom de Papo'],['ar','كثير السؤال'],['ar','فيلسوف المقهى'],['ar','روح الجلسة'],['ar','يقرأ رسالته مرتين'],['fr','Toujours une Question'],['fr','Philosophe du Dimanche'],['fr','Second Degré'],['fr',"L'Air de Rien"],['fr','Humour Pince-sans-rire'],['de','Fragt gern nach'],['de','Ganz Ohr'],['de','Staubtrockener Humor'],['de','Gespür für den Moment'],['de','Philosoph am Küchentisch'],['de','Ruhepol der Runde'],['it','Fa Tante Domande'],['it','Filosofo da Bar'],['it','Ironia Sottile'],['it',"Mette Tutti d'Accordo"],['it',"Sempre Tutt'Orecchi"],['ja','質問好き'],['ja','自称哲学者'],['ja','空気が読める人'],['ja','ツッコミ上手'],['ja','オチ担当'],['ko','질문이 많은 사람'],['ko','자칭 철학자'],['ko','눈치 백단'],['ko','촌철살인'],['ko','이야기꾼'],['ko','조용한 관찰자'],['zh','問題很多'],['zh','自封哲學家'],['zh','很會看氣氛'],['zh','一句話收尾'],['zh','很會說故事'],['zh','安靜的觀察者']]){
  assert.equal(e.aliasValid(text,lang),true,text);
 }
 assert.equal(e.aliasValid('Curious Mind','fr'),false);
 assert.equal(e.aliasValid('Curious Mind','constructor'),false);
});

test('REAL fallback is safe, deterministic and signal based without another AI call',()=>{
 const e=edge({console:{warn(){}}});
 const cases=[{}, {reply_ratio:.5},{avg_text_length:180},{emoji_per_post:2},{question_ratio:.5},{vocabulary_diversity:.8},{original_ratio:.8},{quote_ratio:.2},{repost_ratio:.5},{exclamation_ratio:.3},{own_posts:10}];
 const unnatural={tr:'Soru Makinesi',en:'Question Machine',es:'Máquina de Preguntas',pt:'Máquina de Perguntas',ar:'آلة الأسئلة',fr:'Machine à Questions',de:'Die Fragemaschine',it:'Macchina delle Domande',ja:'質問マシーン',ko:'질문 기계',zh:'問題機器'};
 for(const signals of cases)for(const locale of ['tr','en','es','pt','ar','fr','de','it','ja','ko','zh']){
  const a=e.pickAlias({nickname_candidates:[]},signals,locale);
  const b=e.pickAlias({nickname_candidates:[{text:unnatural[locale],evidence:'question_ratio'}]},signals,locale);
  assert.equal(a.source,'fallback');assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.equal(e.aliasValid(a.text,locale),true,a.text);
 }
 const signals={question_ratio:.7};
 // Candidates are judged only by the request locale's quality gate; a wrong-language name is rejected.
 for(const [locale,text] of [['tr','Question Machine'],['tr','Soru Makinesi'],['en','Soru Makinesi'],['en','Question Machine'],['es','Curious Mind'],['es','Máquina de Preguntas'],['es',''],['pt','Curious Mind'],['pt','Máquina de Perguntas'],['pt','Siempre de Charla'],['ar','Curious Mind'],['ar','آلة الأسئلة'],['ar','كثيرُ السؤال'],['fr','Curious Mind'],['fr','Machine à Questions'],['fr','Siempre de Charla'],['de','Curious Mind'],['de','Die Fragemaschine'],['de','Siempre de Charla'],['it','Curious Mind'],['it','Macchina delle Domande'],['it','Siempre de Charla'],['ja','Curious Mind'],['ja','質問マシーン'],['ja','伝説の勇者'],['ko','Curious Mind'],['ko','질문 기계'],['ko','전설의 용사'],['zh','Curious Mind'],['zh','問題機器'],['zh','傳說中的勇者']]){
  assert.equal(e.pickAlias({nickname_candidates:[{text,evidence:'question_ratio'}]},signals,locale).source,'fallback',locale+': '+text);
 }
 for(const [locale,text] of [['tr','Meraklı Muhabbetçi'],['en','Thoughtful Conversationalist'],['es','Conversador Atento'],['pt','Ouvinte Atento'],['ar','مستمع منتبه'],['fr','Oreille Attentive'],['de','Hört gut zu'],['it','Ascolta con Attenzione'],['ja','聞き役タイプ'],['ko','잘 듣는 편'],['zh','很會聽人講']]){
  const picked=e.pickAlias({nickname_candidates:[{text,evidence:'question_ratio'}]},signals,locale);
  assert.equal(picked.source,'ai_generated_validated');assert.equal(picked.text,text);
 }
 // A candidate no longer needs names in other locales to be accepted.
 assert.equal(e.pickAlias({nickname_candidates:[{text:'Conversador Atento',evidence:'question_ratio'}]},signals,'es').source,'ai_generated_validated');
});
