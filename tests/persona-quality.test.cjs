const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('./helpers.cjs');
// Simplified-only forms. Each of these has a distinct Traditional counterpart, so one hit means the
// copy is not Traditional Chinese.
const SIMPLIFIED_ONLY=/[这个们说见会时现样觉认为么过还来对开关点边进问让给东车马书长风话图网爱乐热无与头没当发汉语业产单卖买亲习乡终经级体种]/u;

test('canonical FUN personas cover every supported locale with reviewed independent copy',()=>{
 const c=browser();
 const locales=Object.keys(c.I18N).sort();
 assert.deepEqual(locales,['ar','de','en','es','fr','it','ja','ko','pt','ru','tr','zh']);
 assert.equal(c.FUN_PERSONAS.length,12);
 assert.equal(new Set(c.FUN_PERSONAS.map(p=>p.id)).size,12);
 for(const p of c.FUN_PERSONAS){
  assert.match(p.id,/^[a-z]+(?:_[a-z]+)+$/);
  assert.ok(p.semantic.length>25);
  assert.deepEqual(Object.keys(p.locales).sort(),locales);
  const card=c.FUN_CARD_POOL.find(card=>card.id===p.id);
  for(const lang of locales){
   const copy=p.locales[lang];
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
  // Russian persona copy stays Cyrillic: no Latin words and no other scripts.
  for(const field of ['nickname','tagline','comment']){
   assert.doesNotMatch(p.locales.ru[field],/[A-Za-z\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0600-\u06ff]/,'ru '+field+' '+p.id);
   assert.match(p.locales.ru[field],/[\u0400-\u04ff]/,'ru '+field+' is Cyrillic '+p.id);
  }
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

