const {test}=require('node:test');const assert=require('node:assert/strict');
const {edge}=require('./helpers.cjs');

// 25 posts over five days: 11 original, 8 reply, 2 quote, 4 repost.
const TYPES=['original','original','original','original','reply','original','original','reply','reply','original','reply','original','reply','original','reply','quote','original','reply','reply','quote','original','repost','repost','repost','repost'];
const posts=()=>TYPES.map((type,i)=>({id:String(i),type,text:type==='repost'?`RT @someone: shared song number ${i}`:`Kendi cümlemle yazdığım bir düşünce, sıra ${i}, maç ve ekonomi üzerine uzunca bir not.`,created_at:`2026-09-${String(20+i%5).padStart(2,'0')}T10:00:00Z`,lang:'tr',metrics:{likes:1,replies:0,reposts:0}}));
const ANALYSIS='Hesap, gündeme duygusal tepkiden çok gerekçeli yorumla katılan analitik bir profil çiziyor. Futbol üzerine yazdıkları taktik ve veri odaklı; yanıtlarda karşı görüşe net biçimde itiraz ediyor. Mizahı kuru ve kısa, çoğunlukla ciddi bir tespitin sonuna eklenen tek satırlık bir iğneleme olarak ortaya çıkıyor. Seyrek gece paylaşımlarındaki melankolik ton, genel olarak mesafeli üslupla dikkat çekici bir kontrast oluşturuyor.';
const raw=()=>({
 ontology_version:'real-1.0',
 selected_traits:[
  {id:'football_knowledge',score:84,confidence:.88,evidence:'Taktik ve xG ile yorum.',post_refs:[0,3,7,11]},
  {id:'dry_humor',score:78,confidence:.8,evidence:'Düz cümleyle soğuk espriler.',post_refs:[2,5,9,13]},
  {id:'analytical_thinking',score:76,confidence:.82,evidence:'Gerekçeli, sayılarla karşılaştırma.',post_refs:[3,6,11,16]},
  {id:'argumentativeness',score:64,confidence:.74,evidence:'Yanıtlarda itiraz.',post_refs:[8,12,14,17]},
  {id:'economics_knowledge',score:62,confidence:.7,evidence:'Faiz-kur ilişkisi doğru.',post_refs:[6,16,20]},
  {id:'melancholy',score:52,confidence:.6,evidence:'Gece postlarında özlem.',post_refs:[13,16,20]}
 ],
 persistent_interests:[
  {id:'football',confidence:.93,post_refs:[0,3,7,11,14]},
  {id:'economy',confidence:.74,post_refs:[6,16,20]},
  {id:'music',confidence:.58,post_refs:[21,22,23,24]}
 ],
 character_analysis:ANALYSIS,
 confidence:{overall:.8,data_sufficiency:'high',limitations:[]}
});
const plain=v=>JSON.parse(JSON.stringify(v));
const ids=r=>plain(r.selected_traits.map(t=>t.id));
const reasons=r=>Object.fromEntries(r.dropped.map(d=>[d.id,d.reason]));

test('ontology v1 is frozen at 150 traits and 48 topics with unique ids and valid links',()=>{
 const e=edge();
 assert.equal(e.ONTOLOGY_VERSION,'real-1.0');
 assert.equal(e.TRAITS.length,150);assert.equal(new Set(e.TRAITS.map(t=>t.id)).size,150);
 assert.equal(e.INTEREST_TOPICS.length,48);assert.equal(new Set(e.INTEREST_TOPICS.map(t=>t.id)).size,48);
 assert.equal(new Set(e.TRAITS.map(t=>t.label)).size,150,'labels are unique');
 assert.equal(e.TRAITS.filter(t=>t.group==='character').length,89);
 for(const t of e.INTEREST_TOPICS) for(const id of t.traits) assert.equal(e.TRAIT_BY_ID.get(id)?.group,'interest',`${t.id} -> ${id}`);
 // Every interest trait can be unlocked by at least one topic.
 const unlockable=new Set(e.INTEREST_TOPICS.flatMap(t=>t.traits));
 for(const t of e.TRAITS.filter(t=>t.group==='interest')) assert.ok(unlockable.has(t.id),t.id);
 for(const [a,b] of [...e.CONTRADICTORY_PAIRS,...e.NEAR_DUPLICATE_PAIRS]) {assert.ok(e.TRAIT_BY_ID.has(a),a);assert.ok(e.TRAIT_BY_ID.has(b),b);}
 assert.equal(e.TRAIT_BY_ID.get('reply_danger').label,'Yanıt Sertliği');
 assert.equal(e.TRAIT_BY_ID.get('silent_observer').label,'Gözlem Ağırlığı');
 assert.equal(e.TRAIT_BY_ID.get('visibility_seeking').label,'Etkileşim Odaklılık');
 for(const t of e.TRAITS) {assert.match(t.definition,/\S{3}/);assert.doesNotMatch(t.label,/Enerjisi|Tehlikesi|Sessiz|\//,t.label);}
});

test('schema and prompt expose only ontology ids and never ask for labels',()=>{
 const e=edge();const s=e.analysisSchema();
 const trait=s.properties.selected_traits;
 assert.equal(trait.minItems,4);assert.equal(trait.maxItems,6);
 assert.deepEqual(plain(trait.items.properties.id.enum),plain(e.TRAITS.map(t=>t.id)));
 assert.deepEqual(plain(s.properties.persistent_interests.items.properties.id.enum),plain(e.INTEREST_TOPICS.map(t=>t.id)));
 assert.equal('label' in trait.items.properties,false);
 const prompt=e.analysisSystemPrompt('Turkish');
 for(const t of e.TRAITS) assert.ok(prompt.includes(`${t.id} | ${t.category}`),t.id);
 for(const t of e.TRAITS) assert.equal(prompt.includes(t.label)&&!/[a-z]/.test(t.label),false);
 assert.match(prompt,/not percentiles/);assert.match(prompt,/Do not force 6/);
 const input=e.analysisUserInput({username:'x',description:'bio'},posts());
 assert.equal(input.posts.length,25);assert.equal(input.posts[21].text.startsWith('RT @'),false);assert.equal(input.posts[21].type,'repost');
});

test('valid analysis normalizes with ontology labels, refs and stats',()=>{
 const e=edge();const r=e.normalizeAnalysis(raw(),posts(),{username:'demo'});
 assert.deepEqual(ids(r),['football_knowledge','dry_humor','analytical_thinking','argumentativeness','economics_knowledge','melancholy']);
 assert.equal(r.selected_traits[0].label,'Futbol Bilgisi');assert.equal(r.selected_traits[0].category,'sports');
 assert.deepEqual(plain(r.persistent_interests.map(i=>[i.id,i.label])),[['football','Futbol'],['economy','Ekonomi'],['music','Müzik']]);
 assert.deepEqual(plain(r.input_stats),{analyzed:25,original:11,reply:8,quote:2,repost:4});
 assert.equal(r.confidence.data_sufficiency,'high');assert.deepEqual(plain(r.confidence.limitations),[]);assert.deepEqual(plain(r.dropped),[]);
 assert.equal(r.character_analysis,ANALYSIS);
});

test('4 or 5 traits are accepted; fewer than 4 or fewer than 3 character traits fail',()=>{
 const e=edge();
 const four=raw();four.selected_traits=four.selected_traits.filter(t=>!['economics_knowledge','melancholy'].includes(t.id));
 assert.equal(e.normalizeAnalysis(four,posts()).selected_traits.length,4);
 const three=raw();three.selected_traits=three.selected_traits.slice(0,3);
 assert.throws(()=>e.normalizeAnalysis(three,posts()),/ai_bad_traits/);
 const lopsided=raw();lopsided.selected_traits=[raw().selected_traits[0],raw().selected_traits[4],raw().selected_traits[1],raw().selected_traits[2]];
 lopsided.selected_traits[3]={...lopsided.selected_traits[3],id:'football_fandom'};
 assert.throws(()=>e.normalizeAnalysis(lopsided,posts()),/ai_bad_traits/);
});

test('rule enforcement drops invented ids, repost-only voice traits, ungated and excess interest traits',()=>{
 const e=edge();
 const r1=raw();r1.selected_traits.push({id:'sahne_bilgisi',score:90,confidence:.9,evidence:'x',post_refs:[0,1]});
 assert.equal(reasons(e.normalizeAnalysis(r1,posts())).sahne_bilgisi,'unknown_trait');
 // melancholy (V) supported only by reposts is rejected.
 const r2=raw();r2.selected_traits[5].post_refs=[21,22,23];
 assert.equal(reasons(e.normalizeAnalysis(r2,posts())).melancholy,'insufficient_own_voice_evidence');
 // music is below the 0.6 gate, so music_interest cannot become a bar.
 const r3=raw();r3.selected_traits[5]={id:'music_interest',score:70,confidence:.7,evidence:'x',post_refs:[1,21,22]};
 assert.equal(reasons(e.normalizeAnalysis(r3,posts())).music_interest,'interest_not_persistent');
 // A third interest trait is dropped (lowest score first).
 const r4=raw();r4.selected_traits[5]={id:'football_fandom',score:60,confidence:.7,evidence:'x',post_refs:[1,2,4]};
 const n4=e.normalizeAnalysis(r4,posts());assert.equal(n4.selected_traits.filter(t=>t.group==='interest').length,2);assert.ok(n4.dropped.some(d=>d.id==='football_fandom'));
 // Unknown topic and one-day burst topics are dropped.
 const r5=raw();r5.persistent_interests.push({id:'mac_gundemi',confidence:.9,post_refs:[0,1,2]},{id:'travel',confidence:.7,post_refs:[0,5,10]});
 const d5=reasons(e.normalizeAnalysis(r5,posts()));assert.equal(d5.mac_gundemi,'unknown_topic');assert.equal(d5.travel,'single_day_burst');
});

test('contradictory and near-duplicate pairs, category limit and score caps',()=>{
 const e=edge();
 const r1=raw();r1.selected_traits[5]={id:'emotional_restraint',score:55,confidence:.6,evidence:'x',post_refs:[1,2]};r1.selected_traits.splice(4,1,{id:'emotionality',score:50,confidence:.6,evidence:'x',post_refs:[4,5]});
 assert.match(reasons(e.normalizeAnalysis(r1,posts())).emotionality,/^contradicts_/);
 const r2=raw();r2.selected_traits[5]={id:'humor',score:60,confidence:.6,evidence:'x',post_refs:[1,2]};r2.selected_traits[3]={id:'observational_humor',score:72,confidence:.7,evidence:'x',post_refs:[4,5]};
 assert.match(reasons(e.normalizeAnalysis(r2,posts())).humor,/^near_duplicate_of_/);
 const r3=raw();r3.selected_traits[5]={id:'irony',score:60,confidence:.6,evidence:'x',post_refs:[1,2]};r3.selected_traits[4]={id:'sarcasm',score:58,confidence:.6,evidence:'x',post_refs:[3,4]};
 // dry_humor + irony + sarcasm share the humor category; near-duplicate rule drops one, category limit holds.
 const n3=e.normalizeAnalysis(r3,posts());assert.ok(n3.selected_traits.filter(t=>t.category==='humor').length<=2);
 // Few own-voice posts cap scores at 80 and sufficiency at medium.
 const few=posts().map((p,i)=>i<6?p:{...p,type:'repost'});
 const r4=raw();r4.selected_traits=[{id:'dry_humor',score:92,confidence:.8,evidence:'x',post_refs:[2,5]},{id:'analytical_thinking',score:76,confidence:.8,evidence:'x',post_refs:[3,4]},{id:'directness',score:70,confidence:.8,evidence:'x',post_refs:[0,1]},{id:'curation',score:88,confidence:.8,evidence:'x',post_refs:[21,22]}];
 r4.persistent_interests=[];
 const n4=e.normalizeAnalysis(r4,few);
 assert.equal(Math.max(...n4.selected_traits.map(t=>t.score)),80);assert.equal(n4.confidence.data_sufficiency,'medium');
 assert.deepEqual(plain(n4.confidence.limitations).sort(),['few_own_posts','mostly_reposts']);
});

test('character analysis must be 3-6 sentences, without counts, links or markup',()=>{
 const e=edge();
 for(const bad of ['Tek cümle.','Bir. İki.',ANALYSIS+' Beş. Altı. Yedi.','x'.repeat(1101)+'. İki. Üç.','Hesap 25 paylaşımda analitik. İki. Üç.','Hesap analitik. Detay için https://x.com bakın. Üç.','Hesap <b>analitik</b>. İki. Üç.','Paylaşımların %80 kadarı yanıt. İki. Üç.']) {
  const r=raw();r.character_analysis=bad;assert.throws(()=>e.normalizeAnalysis(r,posts()),/ai_bad_analysis/,bad);
 }
 assert.equal(e.sentenceCount(ANALYSIS),4);
 // 3 and 6 sentences are both valid; CJK and Arabic punctuation count as sentence ends.
 for(const ok of [ANALYSIS.split('. ').slice(0,3).join('. ')+'.',ANALYSIS+' Beş. Altı.','このアカウントは質問から始める。返信は短い。自分の言葉で話す。','يفتح الحساب أفكاره بالأسئلة؟ ردوده قصيرة. يشارك بكلماته.']){const r=raw();r.character_analysis=ok;assert.ok(e.normalizeAnalysis(r,posts()).character_analysis,ok);}
});

test('analyzeSerious performs one strict provider call and returns the normalized record',async()=>{
 const calls=[];
 const e=edge({fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({content:[{type:'text',text:JSON.stringify(raw())}],stop_reason:'end_turn'});}});
 const r=await e.analyzeSerious({username:'demo',description:'bio'},posts(),'tr');
 assert.equal(calls.length,1);assert.equal(r.version,'real_analysis_v1');assert.equal(r.locale,'tr');assert.equal(r.selected_traits.length,6);
 assert.match(calls[0].body.system,/FIXED ONTOLOGY/);assert.match(calls[0].body.system,/JSON schema/);
 const user=JSON.parse(calls[0].body.messages[0].content);assert.equal(user.posts.length,25);assert.equal(user.stats.own_voice,21);
 const openai=edge({Deno:{env:{get:k=>({AI_PROVIDER:'openai',OPENAI_API_KEY:'k',AI_MODEL:'m'})[k]}},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(raw())}]}]});}});
 await openai.analyzeSerious({username:'demo'},posts(),'tr');
 const body=calls.at(-1).body;assert.equal(body.text.format.name,'xora_real_analysis');assert.equal(body.text.format.strict,true);
});
