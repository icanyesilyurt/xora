const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let count=0;
for(const file of fs.readdirSync('.')) {
 if(file.endsWith('.js')) {new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});count++;}
 if(file.endsWith('.html')) for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(m[1].trim()){new vm.Script(m[1],{filename:file});count++;}}
}
const file='supabase/functions/analyze-real/index.ts';
const {edgeSource}=require('./helpers.cjs');
const source='declare function createClient(...args:any[]):any;\ndeclare const Deno:any;\n'+edgeSource().replace('if (import.meta.main) Deno.serve(main);','');
const options={strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,lib:['lib.es2022.d.ts','lib.dom.d.ts']};
const host=ts.createCompilerHost(options),read=host.readFile.bind(host);host.readFile=f=>f===file?source:read(f);
const program=ts.createProgram([file],options,host);const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));process.exitCode=1;}else console.log(`Syntax OK: ${count} frontend scripts; strict TypeScript OK (Supabase/Deno ambient test shim).`);
