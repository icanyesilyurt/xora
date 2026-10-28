// share-card: stores a card's 1200x630 preview image and a little metadata so the card can be
// shared on X as a link (xora.roviaqr.com/k/<id>) that X shows with the card image.
// Works for Fun cards too, so no sign-in is required; the upload is limited to one JPEG of
// exactly 1200x630 under 700 KB, plus short display strings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "cards";
const MAX_BYTES = 700_000;
const WIDTH = 1200, HEIGHT = 630;
const LANGS = ["tr","en","es","pt","ar","fr","de","it","ja","ko","zh","ru","id","th"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function cleanText(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Width and height of a baseline or progressive JPEG, read from its SOF segment.
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}
export function newId() {
  const abc = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(r, x => abc[x % abc.length]).join("");
}
export function validateShare(body: any) {
  if (!body || typeof body.image !== "string") throw new Error("bad_request");
  const b64 = body.image.replace(/^data:image\/jpeg;base64,/, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length > Math.ceil(MAX_BYTES * 4 / 3) + 4) throw new Error("too_large");
  const bytes = base64ToBytes(b64);
  if (bytes.length > MAX_BYTES) throw new Error("too_large");
  const size = jpegSize(bytes);
  if (!size || size.width !== WIDTH || size.height !== HEIGHT) throw new Error("bad_image");
  const lang = LANGS.includes(body.lang) ? body.lang : "en";
  const meta = {
    nickname: cleanText(body.nickname, 60),
    handle: cleanText(body.handle, 40).replace(/[^A-Za-z0-9_@ ×]/g, ""),
    tier: body.tier === "real" ? "real" : "fun",
    mode: ["mirror", "stalk", "match"].includes(body.mode) ? body.mode : "mirror",
    lang,
    created_at: new Date().toISOString(),
  };
  return { bytes, meta };
}

async function main(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ status: "error", code: "method_not_allowed" }, 405);
  let parsed;
  try { parsed = validateShare(await req.json()); }
  catch (e) { const code = e instanceof Error ? e.message : "bad_request"; return json({ status: "error", code }, code === "too_large" ? 413 : 400); }
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ status: "error", code: "not_configured" }, 503);
  const service = createClient(url, key, { auth: { persistSession: false } });
  const id = newId();
  const img = await service.storage.from(BUCKET).upload(`${id}.jpg`, parsed.bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (img.error) { console.warn("share_card_upload_failed", img.error.message); return json({ status: "error", code: "store_failed" }, 500); }
  const meta = await service.storage.from(BUCKET).upload(`${id}.json`, new TextEncoder().encode(JSON.stringify(parsed.meta)), { contentType: "application/json", cacheControl: "31536000", upsert: false });
  if (meta.error) { console.warn("share_card_meta_failed", meta.error.message); return json({ status: "error", code: "store_failed" }, 500); }
  return json({ status: "ok", id });
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve(main);
export { main };
