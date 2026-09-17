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
const metrics=['ironi','mizah','kaos','ozgunluk'].map(key=>({key,label_tr:'Yorum',label_en:'Comment',label_es:'Comentario',value:70}));
const profileAI=()=>({nickname_candidates:[{tr:'Meraklı Biri',en:'Curious Mind',es:'Mente Curiosa',evidence:'question_ratio'}],metrics:structuredClone(metrics),tagline_tr:'Sorularla ilerliyor.',tagline_en:'Questions lead the way.',tagline_es:'Avanza a base de preguntas.',summary_tr:'Açık sorular soruyor.',summary_en:'Asks open questions.',summary_es:'Hace preguntas abiertas.',comment_tr:'Sorularla konuşmayı açıyorsun.',comment_en:'You open conversations with questions.',comment_es:'Abres las conversaciones con preguntas.',observations:['Uses questions.'],emoji:'🪞'});
const matchAI=()=>({overall:73,metrics:['flirt','vibe','humor','chaos','romance','chemistry'].map(key=>({key,value:70})),comment_tr:'İki hesap da soru soruyor.',comment_en:'Both accounts ask questions.',comment_es:'Las dos cuentas hacen preguntas.'});
module.exports={edge,browser,profileAI,matchAI};
