// Runs the serious REAL analysis layer on already saved X data (public.x_cache). Local only: no
// deploy, no credit spend, no X API calls. Results are printed and written to --out.
//
//   Saved data source (one of):
//     --from-file rows.json            JSON array of x_cache rows ({username, profile, posts})
//     SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   read x_cache directly (expired rows included)
//   AI: AI_PROVIDER (openai|anthropic), AI_MODEL, and OPENAI_API_KEY / ANTHROPIC_API_KEY (or AI_API_KEY)
//
//   node scripts/real-analysis-run.mjs zimbahakan kevocaan ifkoparan HonoreDeBerke aleynatilki --out real-analysis-out
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { edgeSource } = require("../tests/helpers.cjs");

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const fromFile = flag("--from-file");
const outDir = flag("--out") || "real-analysis-out";
const handles = args.map(h => h.replace(/^@/, "").toLowerCase());
if (!handles.length) { console.error("usage: real-analysis-run.mjs <handle...> [--from-file rows.json] [--out dir]"); process.exit(2); }

function loadEdge() {
  const source = edgeSource().replace("Deno.serve(main);", "");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, console, Error, Response, Request, Headers, AbortSignal, URL, crypto, fetch,
    createClient: () => { throw new Error("not used by the runner"); },
    Deno: { env: { get: (k) => process.env[k] } } };
  vm.createContext(context); vm.runInContext(js, context);
  return context.exports;
}

async function savedRows() {
  if (fromFile) return JSON.parse(fs.readFileSync(fromFile, "utf8"));
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Provide --from-file or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to read saved x_cache rows.");
  const q = `${url}/rest/v1/x_cache?select=username,profile,posts,fetched_at&username=in.(${handles.map(encodeURIComponent).join(",")})`;
  const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`x_cache read failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function report(r) {
  const lines = [`## @${r.handle}`, "", `Sample: ${r.input_stats.analyzed} posts — ${r.input_stats.original} original, ${r.input_stats.reply} reply, ${r.input_stats.quote} quote, ${r.input_stats.repost} repost`, "", "| Bar | Score | Conf. | Evidence (internal) |", "|---|---|---|---|"];
  for (const t of r.selected_traits) lines.push(`| ${t.label} \`${t.id}\` | ${t.score} | ${t.confidence} | ${t.evidence} (posts ${t.post_refs.join(", ")}) |`);
  lines.push("", `**Persistent interests:** ${r.persistent_interests.map(i => `${i.label} (${i.confidence})`).join(", ") || "—"}`, "", `**Analysis:** ${r.character_analysis}`, "",
    `**Confidence:** ${r.confidence.overall} · data ${r.confidence.data_sufficiency} · limitations: ${r.confidence.limitations.join(", ") || "none"}`);
  if (r.dropped.length) lines.push("", `_Dropped by validator:_ ${r.dropped.map(d => `${d.id} (${d.reason})`).join(", ")}`);
  return lines.join("\n");
}

const edge = loadEdge();
const rows = await savedRows();
fs.mkdirSync(outDir, { recursive: true });
const sections = [];
for (const handle of handles) {
  const row = rows.find(r => String(r.username || r.profile?.username || "").toLowerCase() === handle);
  if (!row) { sections.push(`## @${handle}\n\nNo saved x_cache row.`); console.error(`@${handle}: no saved data`); continue; }
  try {
    const result = await edge.analyzeSerious({ ...row.profile, username: row.profile?.username || handle }, row.posts || [], "tr");
    fs.writeFileSync(path.join(outDir, `${handle}.json`), JSON.stringify(result, null, 2));
    sections.push(report(result));
  } catch (e) {
    sections.push(`## @${handle}\n\nFailed: ${e instanceof Error ? e.message : e}`);
    console.error(`@${handle}: ${e instanceof Error ? e.message : e}`);
  }
}
const md = `# REAL analysis v1 — saved accounts\n\n${sections.join("\n\n---\n\n")}\n`;
fs.writeFileSync(path.join(outDir, "report.md"), md);
console.log(md);
