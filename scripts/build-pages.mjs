// Cloudflare Pages build: copies only the public site into dist/. No dependencies, no bundling.
// Tests, migrations, edge functions, docs and package files are never published.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

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

// The custom domain serves .js/.css with a 4-hour browser cache while HTML always revalidates.
// Stamping each asset reference with its content hash gives every deploy new asset URLs, so a
// fresh page can never run against a JS/CSS file cached from an older deploy.
const version = Object.fromEntries(ASSETS.map((a) => [a, createHash("sha256").update(readFileSync(a)).digest("hex").slice(0, 10)]));
const assetRef = new RegExp(`\\b(href|src)="(?:\\./)?(${ASSETS.map((a) => a.replace(".", "\\.")).join("|")})(?:\\?[^"#]*)?"`, "g");
for (const page of PAGES) {
  const html = readFileSync(page, "utf8");
  writeFileSync(`${OUT}/${page}`, html.replace(assetRef, (_, attr, asset) => `${attr}="${asset}?v=${version[asset]}"`));
}
console.log(`dist/: ${PAGES.length} pages, ${ASSETS.length} assets`);
