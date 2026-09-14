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

## GitHub Pages

GitHub Pages URL formatı:

https://icanyesilyurt.github.io/REPO_NAME/

Auth redirect URL formatı:

https://icanyesilyurt.github.io/REPO_NAME/mirror.html

Repo adı `xora` ise örnek:

https://icanyesilyurt.github.io/xora/mirror.html

Bu URL Supabase Auth redirect allow list'e eklenmeli ve `config.js` içinde
`AUTH_REDIRECT_URL` olarak kullanılmalıdır.

## XORA V2 / Real backend

Fun/Real deployment and secret setup are documented in `XORA_V2_SETUP.md`.

`XORA Real` must not be advertised as live until the V2 migration is applied, `analyze-real` is deployed, and a real X+AI smoke test succeeds. There is intentionally no fake/demo fallback on the paid Real path.
