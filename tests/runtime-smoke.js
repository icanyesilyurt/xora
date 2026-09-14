const fs = require("fs");
const vm = require("vm");

const ctx = { console, Math, Date, JSON, setInterval, clearInterval, setTimeout, clearTimeout };
ctx.window = ctx;
ctx.getLang = () => "tr";
ctx.t = (key) => ({
  real_label: "XORA REAL",
  fun_label: "XORA FUN · ÜCRETSİZ",
  rarity_common: "COMMON",
  rarity_rare: "RARE",
  rarity_epic: "EPIC",
  rarity_legendary: "LEGENDARY",
  says: "XORA DİYOR",
  match_overall: "GENEL UYUM"
}[key] || key);
ctx.esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
ctx.getPublicSiteUrl = () => "https://example.test/xora/";
ctx.toast = () => {};
ctx.document = { createElement: () => ({ getContext: () => ({}) }), body: { appendChild() {} } };

vm.createContext(ctx);
for (const file of ["xora.js", "card.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
}

const fun = ctx.analyzeFunHandle("icanyesilyurt", "mirror", 2);
const funHtml = ctx.buildIdentityCard(fun);
if (!funHtml.includes("XORA FUN") || funHtml.includes("XORA REAL")) throw new Error("Fun card tier failed");
if (/COMMON|RARE|EPIC|LEGENDARY/.test(funHtml)) throw new Error("Fun card must not show rarity");

const real = JSON.parse(JSON.stringify(fun));
real.meta = { ...(real.meta || {}), tier: "real", version: "xora_real_v1" };
real.rarity = { name: "epic", score: 82 };
real.card.top_behaviors = [
  {key:"ironi",label:{tr:"İroni",en:"Irony"},value:88},
  {key:"gozlemcilik",label:{tr:"Gözlem",en:"Observation"},value:81},
  {key:"kaos",label:{tr:"Kaos",en:"Chaos"},value:64},
  {key:"ozgunluk",label:{tr:"Özgünlük",en:"Originality"},value:78}
];
real.top_behaviors = real.card.top_behaviors;
real.behaviors = real.card.top_behaviors;
const realHtml = ctx.buildIdentityCard(real);
if (!realHtml.includes("XORA REAL") || !realHtml.includes("EPIC")) throw new Error("Real card ribbon failed");

const match = ctx.matchFunHandles("alice", "bob", 1);
const matchHtml = ctx.buildMatchCard(match);
if (!matchHtml.includes("XORA FUN")) throw new Error("Fun match failed");
if (!ctx.shareIdentityText(real).includes("https://example.test/xora/")) throw new Error("Share URL failed");

console.log(JSON.stringify({ ok: true, fun: fun.handle, rarity: real.rarity.name, match: match.overall }));
