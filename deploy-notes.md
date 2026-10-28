# XORA Deploy Notes

## Supabase

Supabase URL:
https://jafrxhkppvvchyjbkldd.supabase.co

Supabase anon/publishable key `config.js` içine yazılır:

```js
SUPABASE_ANON_KEY: "PASTE_SUPABASE_ANON_OR_PUBLISHABLE_KEY_HERE"
```

Service role key frontend'e asla yazılmaz.

X Client Secret frontend'e asla yazılmaz.

## Hosting: Cloudflare Pages

GitHub is source control only. Production is served by Cloudflare Pages at https://xora.roviaqr.com.

- Production branch: `main` (other branches get preview deployments on `*.pages.dev`)
- Framework preset: None
- Build command: `npm run build` (runs `scripts/build-pages.mjs`, no dependencies)
- Build output directory: `dist`
- Environment variable: `SKIP_DEPENDENCY_INSTALL=true` (the build needs no npm packages)

The build publishes only the 7 pages, `app.js`, `xora.js`, `card.js`, `config.js` and `style.css`.
Cloudflare serves `/mirror` for `mirror.html` (the `.html` URL redirects there), so canonical
links are extensionless. `*.pages.dev` uses the production `config.js`, so REAL stays gated there too.

Supabase Auth (at cutover): Site URL `https://xora.roviaqr.com`, redirect allow list
`https://xora.roviaqr.com/**`.

## XORA V2 / Real backend

Fun/Real deployment and secret setup are documented in `XORA_V2_SETUP.md`.

`XORA Real` must not be advertised as live until the V2 migration is applied, `analyze-real` is deployed, and a real X+AI smoke test succeeds. There is intentionally no fake/demo fallback on the paid Real path.

## Card share links (`/k/<id>`)

- `functions/k/[id].js` is a Cloudflare Pages Function (Pages picks up `functions/` from the repo
  root automatically). It serves the Open Graph / X card tags for a shared card and forwards
  visitors to the site.
- The `share-card` edge function stores each preview (1200x630 JPEG + small JSON) in the public
  `cards` storage bucket (migration `20261029100000_xora_card_share_bucket.sql`).
- Deploy: run the migration SQL, then `supabase functions deploy share-card --use-api`.
