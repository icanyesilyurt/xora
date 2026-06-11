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
