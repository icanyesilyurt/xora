const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function edge(options={}) {
  let source=fs.readFileSync('supabase/functions/analyze-real/index.ts','utf8');
  source=source.replace(/^import .*\r?\n/,'').replace('Deno.serve(main);','');
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
 de:{nickname:'Fragt gern nach',tagline:'Kommt mit Fragen voran.',summary:'Stellt offene Fragen.',comment:'Du eröffnest Gespräche mit Fragen.',label:'Kommentar',observation:'Stellt oft Fragen.',match:'Beide Konten stellen Fragen.'}
};
const profileAI=(locale='en')=>{const c=AI_COPY[locale];return {nickname_candidates:[{text:c.nickname,evidence:'question_ratio'}],metrics:['ironi','mizah','kaos','ozgunluk'].map(key=>({key,label:c.label,value:70})),tagline:c.tagline,summary:c.summary,comment:c.comment,observations:[c.observation],emoji:'🪞'};};
const matchAI=(locale='en')=>({overall:73,metrics:['flirt','vibe','humor','chaos','romance','chemistry'].map(key=>({key,value:70})),comment:AI_COPY[locale].match});
module.exports={edge,browser,profileAI,matchAI,AI_COPY};
