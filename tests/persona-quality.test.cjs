const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,edge}=require('./helpers.cjs');

test('canonical FUN personas cover every supported locale with reviewed independent copy',()=>{
 const c=browser(),e=edge();
 const locales=Object.keys(c.I18N).sort();
 assert.deepEqual(locales,['ar','de','en','es','fr','it','ja','pt','tr']);
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
   // Japanese packs more meaning per character, so it gets its own minimum lengths.
   const minTagline=lang==='ja'?12:15, minComment=lang==='ja'?60:100;
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
  ja:['質問マシーン','ドラマ消防士','ムードレーダー','リプライハンター','タイムライン観光客','ベルベット論理','量子スプーン','双極性の天才','自閉症の作家','ムスリムの語り手','ゲイの思想家','クルド系作家','うつ病の詩人','伝説の勇者','Curious Mind','好奇心Mind','知りたがり知りたがり','空気が読める人だと自分でも思う']
 };
 for(const lang of ['tr','en','es','pt','ar','fr','de','it','ja'])for(const text of bad[lang])assert.equal(e.aliasValid(text,lang),false,lang+': '+text);
 for(const [lang,text] of [['tr','Meraklı Muhabbetçi'],['en','Thoughtful Conversationalist'],['tr','Koltuk Filozofu'],['en','Armchair Philosopher'],['en','Social Butterfly'],['en','INQUISITIVE MIND'],['es','Mente Curiosa'],['es','Narrador Detallista'],['es','Casi en Serio'],['es','Filósofo de Sofá'],['pt','Curioso por Natureza'],['pt','Filósofo de Boteco'],['pt','Cara de Paisagem'],['pt','Relê Antes de Mandar'],['pt','Bom de Papo'],['ar','كثير السؤال'],['ar','فيلسوف المقهى'],['ar','روح الجلسة'],['ar','يقرأ رسالته مرتين'],['fr','Toujours une Question'],['fr','Philosophe du Dimanche'],['fr','Second Degré'],['fr',"L'Air de Rien"],['fr','Humour Pince-sans-rire'],['de','Fragt gern nach'],['de','Ganz Ohr'],['de','Staubtrockener Humor'],['de','Gespür für den Moment'],['de','Philosoph am Küchentisch'],['de','Ruhepol der Runde'],['it','Fa Tante Domande'],['it','Filosofo da Bar'],['it','Ironia Sottile'],['it',"Mette Tutti d'Accordo"],['it',"Sempre Tutt'Orecchi"],['ja','質問好き'],['ja','自称哲学者'],['ja','空気が読める人'],['ja','ツッコミ上手'],['ja','オチ担当']]){
  assert.equal(e.aliasValid(text,lang),true,text);
 }
 assert.equal(e.aliasValid('Curious Mind','fr'),false);
 assert.equal(e.aliasValid('Curious Mind','constructor'),false);
});

test('REAL fallback is safe, deterministic and signal based without another AI call',()=>{
 const e=edge({console:{warn(){}}});
 const cases=[{}, {reply_ratio:.5},{avg_text_length:180},{emoji_per_post:2},{question_ratio:.5},{vocabulary_diversity:.8},{original_ratio:.8},{quote_ratio:.2},{repost_ratio:.5},{exclamation_ratio:.3},{own_posts:10}];
 const unnatural={tr:'Soru Makinesi',en:'Question Machine',es:'Máquina de Preguntas',pt:'Máquina de Perguntas',ar:'آلة الأسئلة',fr:'Machine à Questions',de:'Die Fragemaschine',it:'Macchina delle Domande',ja:'質問マシーン'};
 for(const signals of cases)for(const locale of ['tr','en','es','pt','ar','fr','de','it','ja']){
  const a=e.pickAlias({nickname_candidates:[]},signals,locale);
  const b=e.pickAlias({nickname_candidates:[{text:unnatural[locale],evidence:'question_ratio'}]},signals,locale);
  assert.equal(a.source,'fallback');assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.equal(e.aliasValid(a.text,locale),true,a.text);
 }
 const signals={question_ratio:.7};
 // Candidates are judged only by the request locale's quality gate; a wrong-language name is rejected.
 for(const [locale,text] of [['tr','Question Machine'],['tr','Soru Makinesi'],['en','Soru Makinesi'],['en','Question Machine'],['es','Curious Mind'],['es','Máquina de Preguntas'],['es',''],['pt','Curious Mind'],['pt','Máquina de Perguntas'],['pt','Siempre de Charla'],['ar','Curious Mind'],['ar','آلة الأسئلة'],['ar','كثيرُ السؤال'],['fr','Curious Mind'],['fr','Machine à Questions'],['fr','Siempre de Charla'],['de','Curious Mind'],['de','Die Fragemaschine'],['de','Siempre de Charla'],['it','Curious Mind'],['it','Macchina delle Domande'],['it','Siempre de Charla'],['ja','Curious Mind'],['ja','質問マシーン'],['ja','伝説の勇者']]){
  assert.equal(e.pickAlias({nickname_candidates:[{text,evidence:'question_ratio'}]},signals,locale).source,'fallback',locale+': '+text);
 }
 for(const [locale,text] of [['tr','Meraklı Muhabbetçi'],['en','Thoughtful Conversationalist'],['es','Conversador Atento'],['pt','Ouvinte Atento'],['ar','مستمع منتبه'],['fr','Oreille Attentive'],['de','Hört gut zu'],['it','Ascolta con Attenzione'],['ja','聞き役タイプ']]){
  const picked=e.pickAlias({nickname_candidates:[{text,evidence:'question_ratio'}]},signals,locale);
  assert.equal(picked.source,'ai_generated_validated');assert.equal(picked.text,text);
 }
 // A candidate no longer needs names in other locales to be accepted.
 assert.equal(e.pickAlias({nickname_candidates:[{text:'Conversador Atento',evidence:'question_ratio'}]},signals,'es').source,'ai_generated_validated');
});
