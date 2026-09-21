// Cloudflare Pages build: copies only the public site into dist/. No dependencies, no bundling.
// Tests, migrations, edge functions, docs and package files are never published.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const PAGES = ["index.html", "mirror.html", "stalk.html", "match.html", "credits.html", "profile.html", "auth.html"];
const ASSETS = ["app.js", "xora.js", "card.js", "config.js", "style.css"];
const OUT = "dist";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const file of [...PAGES, ...ASSETS]) {
  if (!existsSync(file)) throw new Error("missing public file: " + file);
  cpSync(file, `${OUT}/${file}`);
}

// Every local href/src in the pages must be something we published.
const published = new Set([...PAGES, ...ASSETS]);
for (const page of PAGES) {
  const html = readFileSync(page, "utf8");
  for (const [, ref] of html.matchAll(/\b(?:href|src)="([^"#?]+)[^"]*"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
    if (!published.has(ref.replace(/^\.?\//, ""))) throw new Error(`${page} references unpublished ${ref}`);
  }
}
console.log(`dist/: ${PAGES.length} pages, ${ASSETS.length} assets`);
