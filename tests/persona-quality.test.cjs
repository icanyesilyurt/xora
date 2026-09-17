const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,edge}=require('./helpers.cjs');

test('canonical FUN personas cover every supported locale with reviewed independent copy',()=>{
 const c=browser(),e=edge();
 const locales=Object.keys(c.I18N).sort();
 assert.deepEqual(locales,['en','es','tr']);
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
   assert.ok(copy.tagline.length>15 && copy.comment.length>100);
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
  // Spanish copy must not be an English word-mix.
  assert.doesNotMatch(p.locales.es.nickname,/\b(?:the|of|and|you|room|mind|quiet|update)\b/i,p.id);
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
  es:['Máquina de Preguntas','Bombero del Drama','Radar de Vibras','Cazador de Respuestas','Turista del Timeline','Lógica de Terciopelo','Cuchara Cuántica','Genio Bipolar','Escritor Autista','Narrador Musulmán','Pensador Gay','Escritora Kurda','Poeta Depresivo','Curious Mind','Mente Quiet','Curiosa Curiosa']
 };
 for(const lang of ['tr','en','es'])for(const text of bad[lang])assert.equal(e.aliasValid(text,lang),false,lang+': '+text);
 for(const [lang,text] of [['tr','Meraklı Muhabbetçi'],['en','Thoughtful Conversationalist'],['tr','Koltuk Filozofu'],['en','Armchair Philosopher'],['en','Social Butterfly'],['en','INQUISITIVE MIND'],['es','Mente Curiosa'],['es','Narrador Detallista'],['es','Casi en Serio'],['es','Filósofo de Sofá']]){
  assert.equal(e.aliasValid(text,lang),true,text);
 }
 assert.equal(e.aliasValid('Curious Mind','fr'),false);
 assert.equal(e.aliasValid('Curious Mind','constructor'),false);
});

test('REAL fallback is safe, deterministic and signal based without another AI call',()=>{
 const e=edge({console:{warn(){}}});
 const cases=[{}, {reply_ratio:.5},{avg_text_length:180},{emoji_per_post:2},{question_ratio:.5},{vocabulary_diversity:.8},{original_ratio:.8},{quote_ratio:.2},{repost_ratio:.5},{exclamation_ratio:.3},{own_posts:10}];
 for(const signals of cases){
  const a=e.pickAliasPair({nickname_candidates:[]},signals);
  const b=e.pickAliasPair({nickname_candidates:[{tr:'Soru Makinesi',en:'Question Machine',es:'Máquina de Preguntas',evidence:'question_ratio'}]},signals);
  assert.equal(a.source,'fallback');assert.equal(JSON.stringify(a),JSON.stringify(b));
  for(const lang of ['tr','en','es'])assert.equal(e.aliasValid(a[lang],lang),true,a[lang]);
 }
 const signals={question_ratio:.7};
 // One unnatural or missing locale sinks the whole candidate, Spanish included.
 for(const candidate of [{tr:'Meraklı Biri',en:'Question Machine',es:'Mente Curiosa'},{tr:'Soru Makinesi',en:'Curious Mind',es:'Mente Curiosa'},{tr:'Meraklı Biri',en:'Curious Mind',es:'Máquina de Preguntas'},{tr:'Meraklı Biri',en:'Curious Mind'}]){
  assert.equal(e.pickAliasPair({nickname_candidates:[{...candidate,evidence:'question_ratio'}]},signals).source,'fallback');
 }
 assert.equal(e.pickAliasPair({nickname_candidates:[{tr:'Meraklı Muhabbetçi',en:'Thoughtful Conversationalist',es:'Conversador Atento',evidence:'question_ratio'}]},signals).source,'ai_generated_validated');
});
