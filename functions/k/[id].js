// Cloudflare Pages Function: xora.roviaqr.com/k/<id>
// A shared XORA card. X (and other link previews) read the Open Graph tags and show the card
// image; people who open the link are sent on to the site to make their own card.
const STORAGE = "https://jafrxhkppvvchyjbkldd.supabase.co/storage/v1/object/public/cards/";

const COPY = {
  tr: ["XORA kartım", "X'te kimsin? Kendi kartını çıkar."],
  en: ["My XORA card", "Who are you on X? Get your own card."],
  es: ["Mi tarjeta XORA", "¿Quién eres en X? Saca tu propia tarjeta."],
  pt: ["Meu cartão XORA", "Quem é você no X? Tire o seu cartão."],
  ar: ["بطاقتي في XORA", "من أنت على X؟ احصل على بطاقتك."],
  fr: ["Ma carte XORA", "Qui es-tu sur X ? Tire ta propre carte."],
  de: ["Meine XORA-Karte", "Wer bist du auf X? Hol dir deine eigene Karte."],
  it: ["La mia carta XORA", "Chi sei su X? Pesca la tua carta."],
  ja: ["私のXORAカード", "Xでのあなたは？自分のカードを引いてみて。"],
  ko: ["내 XORA 카드", "X에서 당신은 누구인가요? 카드를 뽑아 보세요."],
  zh: ["我的 XORA 卡片", "你在 X 上是什麼樣子？抽一張自己的卡。"],
  ru: ["Моя карточка XORA", "Кто ты в X? Вытяни свою карточку."],
  id: ["Kartu XORA-ku", "Kamu siapa di X? Ambil kartumu sendiri."],
  th: ["การ์ด XORA ของฉัน", "คุณเป็นใครบน X? จั่วการ์ดของคุณเอง"],
};

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function onRequestGet({ params, request }) {
  let id = String(params.id || "");
  const site = new URL(request.url).origin + "/";
  // The preview image is served from this domain too, so link-preview bots only ever talk to
  // xora.roviaqr.com.
  if (/^[A-Za-z0-9]{10}\.jpg$/.test(id)) {
    const img = await fetch(STORAGE + id, { cf: { cacheTtl: 31536000, cacheEverything: true } });
    if (!img.ok) return new Response("Not found", { status: 404 });
    return new Response(img.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  if (!/^[A-Za-z0-9]{10}$/.test(id)) return Response.redirect(site, 302);
  let meta = null;
  try {
    const res = await fetch(STORAGE + id + ".json", { cf: { cacheTtl: 86400 } });
    if (res.ok) meta = await res.json();
  } catch (e) { meta = null; }
  if (!meta) return Response.redirect(site, 302);

  const lang = COPY[meta.lang] ? meta.lang : "en";
  const [heading, desc] = COPY[lang];
  const title = meta.nickname ? `"${meta.nickname}" · ${heading}` : heading;
  const image = site + "k/" + id + ".jpg";
  const ref = new URL(request.url).searchParams.get("ref");
  const target = site + (meta.mode === "match" ? "match" : meta.mode === "stalk" ? "stalk" : "mirror") +
    (ref && /^[a-z0-9_-]{2,64}$/i.test(ref) ? "?ref=" + encodeURIComponent(ref.toLowerCase()) : "");

  const html = `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="XORA">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(site + "k/" + id)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<link rel="canonical" href="${esc(site + "k/" + id)}">
</head>
<body style="margin:0;background:#FFF6EC;font-family:sans-serif;text-align:center;padding:24px">
<img src="${esc(image)}" alt="${esc(title)}" style="max-width:100%;border-radius:16px">
<p><a href="${esc(target)}">${esc(desc)}</a></p>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
