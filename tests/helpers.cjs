const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
// The edge function and its local modules are bundled into one script: local ES imports are
// dropped and the module bodies are prepended, so their exports share the function's scope.
const EDGE_DIR='supabase/functions/analyze-real/';
const EDGE_MODULES=['ontology.ts','real-analysis.ts','index.ts'];
const stripImports=src=>src.replace(/^import\s[\s\S]*?\sfrom\s+"[^"]+";[ \t]*\r?\n/gm,'');
function edgeSource() {
  return EDGE_MODULES.map(f=>stripImports(fs.readFileSync(EDGE_DIR+f,'utf8'))).join('\n');
}
function edge(options={}) {
  const source=edgeSource().replace('Deno.serve(main);','');
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports:{},console,Error,Response,Request,Headers,AbortSignal,crypto,fetch:async()=>{throw Error('Unexpected live fetch');},Deno:{env:{get:k=>({SUPABASE_URL:'http://local.test',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',X_BEARER_TOKEN:'test-x',AI_PROVIDER:'anthropic',AI_API_KEY:'test-ai',AI_MODEL:'mock-model'})[k]}},...options};
  vm.createContext(context); vm.runInContext(output,context);
  return context.exports;
}
function browser() {
 const values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const context={console,Math,Date,JSON,URL,URLSearchParams,crypto,setInterval,clearInterval,setTimeout,clearTimeout,localStorage:storage,sessionStorage:storage,location:{search:'',origin:'https://example.test',href:'https://example.test/xora/index.html'},document:{addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;},getElementById(){return null;},createElement(){return {getContext(){return {};}}}},fetch:()=>{throw Error('Unexpected network');}};
 context.window=context;vm.createContext(context);
 for(const f of ['app.js','xora.js','card.js']) vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
 context.esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 return context;
}
// AI fixtures return user-facing copy in exactly one locale, like the real provider contract.
const AI_COPY={
 tr:{nickname:'Meraklı Biri',tagline:'Sorularla ilerliyor.',summary:'Açık sorular soruyor.',comment:'Sorularla konuşmayı açıyorsun.',label:'Yorum',observation:'Soru soruyor.',match:'İki hesap da soru soruyor.'},
 en:{nickname:'Curious Mind',tagline:'Questions lead the way.',summary:'Asks open questions.',comment:'You open conversations with questions.',label:'Comment',observation:'Uses questions.',match:'Both accounts ask questions.'},
 es:{nickname:'Mente Curiosa',tagline:'Avanza a base de preguntas.',summary:'Hace preguntas abiertas.',comment:'Abres las conversaciones con preguntas.',label:'Comentario',observation:'Hace preguntas.',match:'Las dos cuentas hacen preguntas.'},
 pt:{nickname:'Curioso por Natureza',tagline:'Segue em frente puxando perguntas.',summary:'Faz perguntas abertas.',comment:'Você abre as conversas com perguntas.',label:'Comentário',observation:'Costuma perguntar.',match:'As duas contas fazem perguntas.'},
 ar:{nickname:'كثير السؤال',tagline:'يمضي في الحديث بالأسئلة.',summary:'يطرح أسئلة مفتوحة.',comment:'تفتح الأحاديث بالأسئلة.',label:'تعليق',observation:'يكثر من الأسئلة.',match:'الحسابان يطرحان الأسئلة.'},
 fr:{nickname:'Toujours une Question',tagline:'Avance à coups de questions.',summary:'Pose des questions ouvertes.',comment:'Tu ouvres les conversations avec des questions.',label:'Commentaire',observation:'Pose souvent des questions.',match:'Les deux comptes posent des questions.'},
 de:{nickname:'Fragt gern nach',tagline:'Kommt mit Fragen voran.',summary:'Stellt offene Fragen.',comment:'Du eröffnest Gespräche mit Fragen.',label:'Kommentar',observation:'Stellt oft Fragen.',match:'Beide Konten stellen Fragen.'},
 it:{nickname:'Fa Tante Domande',tagline:'Va avanti a colpi di domande.',summary:'Fa domande aperte.',comment:'Apri ogni conversazione con una domanda.',label:'Commento',observation:'Fa spesso domande.',match:'Entrambi gli account fanno domande.'},
 ja:{nickname:'質問好き',tagline:'質問しながら話を進めるタイプ。',summary:'オープンな質問をよくする。',comment:'質問から会話を始めるのが得意。',label:'コメント',observation:'よく質問している。',match:'どちらのアカウントもよく質問する。'},
 ko:{nickname:'질문이 많은 사람',tagline:'질문으로 대화를 이어가요.',summary:'열린 질문을 자주 합니다.',comment:'질문으로 대화를 여는 편이에요.',label:'코멘트',observation:'질문을 자주 합니다.',match:'두 계정 모두 질문이 많아요.'},
 zh:{nickname:'問題很多',tagline:'靠問題把話題帶下去。',summary:'常常問開放式的問題。',comment:'你習慣用問題打開一段對話。',label:'評語',observation:'很常提問。',match:'兩個帳號都很愛問問題。'},
 ru:{nickname:'Много спрашивает',tagline:'Идёт вперёд через вопросы.',summary:'Задаёт открытые вопросы.',comment:'Ты открываешь разговор вопросом.',label:'Комментарий',observation:'Часто задаёт вопросы.',match:'Оба аккаунта много спрашивают.'}
};
// Serious-analysis copy: three sentences per locale, no sample counts.
const ANALYSIS_COPY={
 tr:'Hesap düşüncelerini sorularla açıyor. Yanıtlarında kısa ve net kalıyor. Gündeme kendi cümleleriyle katılıyor.',
 en:'The account opens its thoughts with questions. Its replies stay short and clear. It joins the conversation in its own words.',
 es:'La cuenta abre sus ideas con preguntas. Sus respuestas son breves y claras. Participa en la conversación con sus propias palabras.',
 pt:'A conta abre suas ideias com perguntas. As respostas são curtas e claras. Participa da conversa com as próprias palavras.',
 ar:'يفتح الحساب أفكاره بالأسئلة. ردوده قصيرة وواضحة. يشارك في النقاش بكلماته الخاصة.',
 fr:'Le compte ouvre ses idées par des questions. Ses réponses restent courtes et claires. Il participe à la conversation avec ses propres mots.',
 de:'Das Konto beginnt seine Gedanken mit Fragen. Die Antworten bleiben kurz und klar. Es beteiligt sich mit eigenen Worten am Gespräch.',
 it:'L’account apre i suoi pensieri con domande. Le risposte restano brevi e chiare. Partecipa alla conversazione con parole proprie.',
 ja:'このアカウントは質問から考えを始める。返信は短く明確だ。自分の言葉で会話に参加している。',
 ko:'이 계정은 질문으로 생각을 엽니다. 답글은 짧고 분명합니다. 자신의 말로 대화에 참여합니다.',
 zh:'這個帳號習慣用問題開啟想法。回覆簡短而清楚。會用自己的話參與討論。',
 ru:'Аккаунт начинает свои мысли с вопросов. Ответы остаются короткими и ясными. Он участвует в разговоре своими словами.'
};
// A valid serious-analysis result for fixtures whose posts are own-voice originals (indexes 0-7).
const seriousAI=(locale='en')=>({ontology_version:'real-1.0',
 selected_traits:[{id:'questioning',score:82,confidence:.8,evidence:'Soru ile açılan paylaşımlar.',post_refs:[0,1,2]},{id:'curiosity',score:74,confidence:.75,evidence:'Merak eden sorular.',post_refs:[3,4]},{id:'brevity',score:66,confidence:.7,evidence:'Kısa cümleler.',post_refs:[5,6]},{id:'confidence',score:55,confidence:.6,evidence:'Kendinden emin sorular.',post_refs:[0,2]}],
 persistent_interests:[],character_analysis:ANALYSIS_COPY[locale],confidence:{overall:.7,data_sufficiency:'high',limitations:[]}});
// Serious-analysis requests are recognised by their schema name (OpenAI) or ontology prompt (Anthropic).
const isSeriousRequest=body=>body?.text?.format?.name==='xora_real_analysis'||String(body?.system||'').includes('FIXED ONTOLOGY');
// The serious prompt names the output language; map it back to the locale for fixtures.
function seriousLocale(body,e){
 const system=String(body.instructions||body.system||'');
 const m=system.match(/Write 3-5 complete sentences in (.*?), in the third person/s);
 return Object.keys(e.REAL_LOCALES).find(l=>m&&e.REAL_LOCALES[l].language===m[1])||'en';
}
const profileAI=(locale='en')=>{const c=AI_COPY[locale];return {nickname_candidates:[{text:c.nickname,evidence:'question_ratio'}],metrics:['ironi','mizah','kaos','ozgunluk'].map(key=>({key,label:c.label,value:70})),tagline:c.tagline,summary:c.summary,comment:c.comment,observations:[c.observation],emoji:'🪞'};};
const matchAI=(locale='en')=>({overall:73,metrics:['flirt','vibe','humor','chaos','romance','chemistry'].map(key=>({key,value:70})),comment:AI_COPY[locale].match});
module.exports={edge,edgeSource,seriousAI,isSeriousRequest,seriousLocale,ANALYSIS_COPY,browser,profileAI,matchAI,AI_COPY};
