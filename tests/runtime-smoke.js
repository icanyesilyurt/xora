const fs = require("fs");
const vm = require("vm");

const ctx = { console, Math, Date, JSON, setInterval, clearInterval, setTimeout, clearTimeout };
ctx.window = ctx;
let lang = "tr";
ctx.getLang = () => lang;
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
const painted = [];
const canvas2d = () => new Proxy({
  measureText: (v) => ({ width: String(v).length * 12 }),
  fillText: (v, x, y) => painted.push({ v: String(v), x, y }),
  createLinearGradient: () => ({ addColorStop() {} })
}, { get: (o, k) => (k in o ? o[k] : () => {}) });
ctx.document = { createElement: () => ({ getContext: canvas2d }), body: { appendChild() {} } };

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

// Every supported locale must render FUN identity and match cards, HTML and PNG, from its own copy.
const locales = ["tr", "en", "es", "pt", "ar", "fr", "de"];
const persona = ctx.FUN_PERSONAS.find((p) => p.id === fun.persona_id);
for (const code of locales) {
  lang = code;
  const copy = persona.locales[code];
  const html = ctx.buildIdentityCard(fun);
  if (!html.includes(copy.nickname)) throw new Error("Missing " + code + " nickname on card");
  if (!html.includes(copy.comment)) throw new Error("Missing " + code + " comment on card");
  if (!ctx.matchComment(match, code)) throw new Error("Missing " + code + " match comment");

  painted.length = 0;
  ctx.renderIdentityPNG(fun);
  const drawn = painted.filter((p) => p.x === 500 && p.y > 500 && p.y < 1090).map((p) => p.v).join(" ");
  if (!drawn.includes(copy.nickname)) throw new Error("PNG missing " + code + " nickname");
  if (!drawn.includes(copy.comment)) throw new Error("PNG missing " + code + " comment");
  ctx.renderMatchPNG(match);
}
lang = "tr";

// Spanish diacritics must survive the persona copy, the card HTML and the PNG text path.
if (!/[ñáéíóú¿¡]/.test(JSON.stringify(ctx.FUN_PERSONAS.map((p) => p.locales.es)))) throw new Error("Spanish accents missing");
if (!/[ãõçâê]/.test(JSON.stringify(ctx.FUN_PERSONAS.map((p) => p.locales.pt)))) throw new Error("Portuguese accents missing");
if (!/[éèêàçœ]/.test(ctx.FUN_PERSONAS.map((p) => p.locales.fr.comment).join(" "))) throw new Error("French accents missing");
if (!/[äöüß]/.test(ctx.FUN_PERSONAS.map((p) => p.locales.de.comment).join(" "))) throw new Error("German umlauts missing");
if (!ctx.FUN_PERSONAS.every((p) => /^[\u0600-\u06FF\s.،؛؟!]+$/.test(p.locales.ar.nickname + p.locales.ar.tagline))) throw new Error("Arabic copy must be Arabic script");

console.log(JSON.stringify({ ok: true, fun: fun.handle, rarity: real.rarity.name, match: match.overall, locales, es_nickname: persona.locales.es.nickname, pt_nickname: persona.locales.pt.nickname, ar_nickname: persona.locales.ar.nickname, fr_nickname: persona.locales.fr.nickname, de_nickname: persona.locales.de.nickname }));
