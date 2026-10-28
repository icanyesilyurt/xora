// Card share links: the share-card edge function's validation, and the /k/<id> preview page.
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');

function shareFn(){
 const src=fs.readFileSync('supabase/functions/share-card/index.ts','utf8').replace(/^import\s[\s\S]*?\sfrom\s+"[^"]+";\s*\n/gm,'');
 const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const ctx={exports:{},crypto,atob,TextEncoder,Response,console};vm.createContext(ctx);vm.runInContext(out,ctx);return ctx.exports;
}
// A minimal JPEG header: SOI, APP0, SOF0 with the given size.
function jpeg(w,h,pad=0){
 const b=[0xff,0xd8, 0xff,0xe0,0x00,0x10, 0x4a,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,
  0xff,0xc0,0x00,0x11,0x08,h>>8,h&255,w>>8,w&255,0x03,0x01,0x22,0x00,0x02,0x11,0x01,0x03,0x11,0x01];
 return Buffer.concat([Buffer.from(b),Buffer.alloc(pad),Buffer.from([0xff,0xd9])]);
}

test('share-card accepts one 1200x630 JPEG with short metadata and refuses anything else',()=>{
 const e=shareFn();
 assert.deepEqual({...e.jpegSize(new Uint8Array(jpeg(1200,630)))},{width:1200,height:630});
 const ok=e.validateShare({image:'data:image/jpeg;base64,'+jpeg(1200,630).toString('base64'),nickname:'Tribün Komedyeni<script>',handle:'alice<b>',tier:'real',mode:'stalk',lang:'th'});
 assert.equal(ok.meta.nickname,'Tribün Komedyeni script');assert.equal(ok.meta.handle,'alice b');
 assert.equal(ok.meta.tier,'real');assert.equal(ok.meta.mode,'stalk');assert.equal(ok.meta.lang,'th');
 assert.equal(e.validateShare({image:jpeg(1200,630).toString('base64'),lang:'xx',tier:'hack',mode:'x'}).meta.lang,'en');
 assert.throws(()=>e.validateShare({image:jpeg(1080,1350).toString('base64')}),/bad_image/,'wrong size');
 assert.throws(()=>e.validateShare({image:Buffer.from('GIF89a....').toString('base64')}),/bad_image/,'not a JPEG');
 assert.throws(()=>e.validateShare({image:jpeg(1200,630,800000).toString('base64')}),/too_large/);
 assert.throws(()=>e.validateShare({}),/bad_request/);
 const ids=new Set(Array.from({length:200},()=>e.newId()));assert.equal(ids.size,200);
 for(const id of ids) assert.match(id,/^[A-Za-z0-9]{10}$/);
});

test('/k/<id> serves X preview tags for a stored card and sends people on to the site',async()=>{
 const src=fs.readFileSync('functions/k/[id].js','utf8').replace(/^export /gm,'');
 const fetched=[];
 const ctx={URL,Response,fetch:async u=>{fetched.push(u);if(u.endsWith('Abc234Defg.jpg'))return {ok:true,body:'JPEGBYTES'};return u.endsWith('Abc234Defg.json')?{ok:true,json:async()=>({nickname:'Tribün "Komedyeni"',lang:'tr',mode:'stalk'})}:{ok:false};}};
 vm.createContext(ctx);vm.runInContext(src+';this.onRequestGet=onRequestGet;',ctx);
 const res=await ctx.onRequestGet({params:{id:'Abc234Defg'},request:{url:'https://xora.roviaqr.com/k/Abc234Defg?ref=Kartal'}});
 const html=await res.text();
 assert.match(res.headers.get('content-type'),/text\/html/);
 assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
 assert.match(html,/og:image" content="https:\/\/xora\.roviaqr\.com\/k\/Abc234Defg\.jpg"/,'image served from the site domain');
 assert.match(html,/og:title" content="&quot;Tribün &quot;Komedyeni&quot;&quot; · XORA kartım"/,'title escaped');
 assert.match(html,/url=https:\/\/xora\.roviaqr\.com\/stalk\?ref=kartal/,'onward link keeps the partner ref');
 const missing=await ctx.onRequestGet({params:{id:'Zzz234Defg'},request:{url:'https://xora.roviaqr.com/k/Zzz234Defg'}});
 assert.equal(missing.status,302);
 const bad=await ctx.onRequestGet({params:{id:'../../etc'},request:{url:'https://xora.roviaqr.com/k/x'}});
 assert.equal(bad.status,302);assert.equal(fetched.length,2,'bad ids never reach storage');
 const img=await ctx.onRequestGet({params:{id:'Abc234Defg.jpg'},request:{url:'https://xora.roviaqr.com/k/Abc234Defg.jpg'}});
 assert.equal(img.headers.get('content-type'),'image/jpeg');assert.equal(await img.text(),'JPEGBYTES');
 assert.ok(fetched[2].endsWith('/cards/Abc234Defg.jpg'));
});
