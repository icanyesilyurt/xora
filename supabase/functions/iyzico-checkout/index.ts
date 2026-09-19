import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

// Credit purchases through iyzico Checkout Form.
//
//   POST /iyzico-checkout            {action:"create", package_id}   (user JWT)  -> checkout form
//   POST /iyzico-checkout            {action:"verify", purchase_id}  (user JWT)  -> purchase status
//   POST /iyzico-checkout/callback   token=...  (iyzico browser post, no JWT)    -> redirect to site
//
// The browser only ever names a package. Price, currency and credits come from the catalog (here
// and, authoritatively, in the database). Credits are added only after the payment has been
// retrieved from iyzico with our own credentials and every field matched the purchase row; the
// database re-checks the same fields and credits through its idempotent ledger, exactly once.
// Card data never reaches Xora: the card form is iyzico's.

type PackageId = "starter" | "popular" | "value" | "professional";
type CatalogEntry = { credits: number; amount: number; currency: "USD" };
type Purchase = { id: string; user_id: string; package_id: string; credits: number; amount: number | string; currency: string; provider_token: string | null; status: "pending" | "completed" | "failed" };

const CATALOG: Record<PackageId, CatalogEntry> = {
  starter: { credits: 10, amount: 2.99, currency: "USD" },
  popular: { credits: 20, amount: 5.99, currency: "USD" },
  value: { credits: 50, amount: 14.99, currency: "USD" },
  professional: { credits: 300, amount: 89.99, currency: "USD" }
};

const IYZICO_SANDBOX_URL = "https://sandbox-api.iyzipay.com";
const IYZICO_LIVE_URL = "https://api.iyzipay.com";
const INITIALIZE_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";
const REQUIRED_SECRETS = ["IYZICO_API_KEY", "IYZICO_SECRET_KEY", "IYZICO_BASE_URL"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function isPackageId(v: unknown): v is PackageId {
  return typeof v === "string" && Object.hasOwn(CATALOG, v);
}

const cents = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
// iyzico expects decimal strings with a dot, e.g. "5.99".
const price = (amount: number | string) => (cents(amount) / 100).toFixed(2);

// ---------------------------------------------------------------------------------------------
// iyzico client

class PaymentConfigError extends Error {
  missing: string[];
  constructor(missing: string[]) { super("payment_not_configured"); this.missing = missing; }
}

// Sandbox by default. The live endpoint is refused unless IYZICO_LIVE=true is set explicitly, and
// no other host is ever accepted, so a misconfigured base URL cannot receive the signed request.
function iyzicoConfig() {
  const env = (k: string) => (Deno.env.get(k) || "").trim();
  const missing = REQUIRED_SECRETS.filter((k) => !env(k));
  if (missing.length) throw new PaymentConfigError([...missing]);
  const baseUrl = env("IYZICO_BASE_URL").replace(/\/+$/, "");
  const live = baseUrl === IYZICO_LIVE_URL;
  if (baseUrl !== IYZICO_SANDBOX_URL && !(live && env("IYZICO_LIVE") === "true")) throw new PaymentConfigError(["IYZICO_BASE_URL"]);
  return { apiKey: env("IYZICO_API_KEY"), secretKey: env("IYZICO_SECRET_KEY"), baseUrl, live };
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// IYZWSv2: HMAC-SHA256(secretKey, randomKey + uriPath + body) as hex, then
// base64("apiKey:<key>&randomKey:<rnd>&signature:<hex>"). The signed body is the exact body sent.
async function iyzicoAuthHeaders(apiKey: string, secretKey: string, path: string, body: string, randomKey: string) {
  const signature = await hmacSha256Hex(secretKey, randomKey + path + body);
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: "IYZWSv2 " + btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`),
    "x-iyzi-rnd": randomKey
  };
}

async function iyzicoRequest(path: string, payload: Record<string, unknown>) {
  const cfg = iyzicoConfig();
  const body = JSON.stringify(payload);
  const randomKey = Date.now().toString() + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const headers = await iyzicoAuthHeaders(cfg.apiKey, cfg.secretKey, path, body, randomKey);
  const res = await fetch(cfg.baseUrl + path, { method: "POST", headers, body, signal: AbortSignal.timeout(20000) });
  let data: any;
  try { data = await res.json(); } catch { throw new Error("iyzico_bad_response"); }
  return data;
}

// ---------------------------------------------------------------------------------------------
// Verification of a retrieved checkout result against the purchase it belongs to.

type Verdict =
  | { kind: "success"; paymentId: string; packageId: string; amount: number; currency: string }
  | { kind: "failed"; reason: string }
  | { kind: "pending"; reason: string };

function verifyCheckoutResult(data: any, purchase: Purchase): Verdict {
  if (!data || typeof data !== "object") return { kind: "pending", reason: "no_response" };
  // An API-level error without a payment status is not an answer about this payment (it can be
  // our own configuration); leave the purchase pending rather than failing a paid order.
  if (data.status !== "success") return data.paymentStatus === "FAILURE" ? { kind: "failed", reason: "payment_failed" } : { kind: "pending", reason: "retrieve_error" };
  if (data.paymentStatus === "FAILURE") return { kind: "failed", reason: "payment_failed" };
  if (data.paymentStatus !== "SUCCESS") return { kind: "pending", reason: "payment_" + String(data.paymentStatus || "unknown").toLowerCase() };
  if (data.fraudStatus === -1) return { kind: "failed", reason: "fraud_rejected" };
  if (data.fraudStatus === 0) return { kind: "pending", reason: "fraud_review" };

  const expected = cents(purchase.amount);
  const mismatch =
    data.token !== purchase.provider_token ||
    data.conversationId !== purchase.id ||
    data.basketId !== purchase.id ||
    typeof data.paymentId !== "string" && typeof data.paymentId !== "number" ||
    String(data.paymentId || "") === "" ||
    String(data.currency || "").toUpperCase() !== purchase.currency ||
    cents(data.price) !== expected ||
    cents(data.paidPrice) !== expected;
  if (mismatch) return { kind: "failed", reason: "payment_mismatch" };

  // The purchased item must be exactly this package at this price.
  let packageId = purchase.package_id;
  if (Array.isArray(data.itemTransactions)) {
    const items = data.itemTransactions;
    if (items.length !== 1 || items[0]?.itemId !== purchase.package_id || cents(items[0]?.price) !== expected) {
      return { kind: "failed", reason: "payment_mismatch" };
    }
    packageId = items[0].itemId;
  }
  return { kind: "success", paymentId: String(data.paymentId), packageId, amount: cents(data.paidPrice) / 100, currency: String(data.currency).toUpperCase() };
}

// Settles a purchase with iyzico's answer. Only a verified success reaches the crediting RPC.
async function settlePurchase(service: any, purchase: Purchase) {
  if (purchase.status !== "pending" || !purchase.provider_token) return { status: purchase.status, credits: purchase.credits };
  let data: any;
  try {
    data = await iyzicoRequest(RETRIEVE_PATH, { locale: "en", conversationId: purchase.id, token: purchase.provider_token });
  } catch {
    return { status: "pending" as const, credits: purchase.credits };
  }
  const verdict = verifyCheckoutResult(data, purchase);
  if (verdict.kind === "pending") return { status: "pending" as const, credits: purchase.credits };
  if (verdict.kind === "failed") {
    await service.rpc("xora_fail_credit_purchase", { p_purchase_id: purchase.id, p_reason: verdict.reason });
    return { status: "failed" as const, credits: purchase.credits };
  }
  const done = await service.rpc("xora_complete_credit_purchase", {
    p_purchase_id: purchase.id, p_token: purchase.provider_token, p_provider_payment_id: verdict.paymentId,
    p_package_id: verdict.packageId, p_amount: verdict.amount, p_currency: verdict.currency
  });
  if (done.error) return { status: "pending" as const, credits: purchase.credits };
  return { status: done.data?.status === "completed" ? "completed" as const : "failed" as const, credits: purchase.credits, balance: done.data?.balance };
}

// ---------------------------------------------------------------------------------------------
// Handlers

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") || "", key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("server_config");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function authenticatedUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") || "", anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) throw new Error("server_config");
  const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data, error } = await client.auth.getUser();
  return error || !data?.user ? null : data.user;
}

const PURCHASE_COLUMNS = "id,user_id,package_id,credits,amount,currency,provider_token,status";

function clientIp(req: Request) {
  const raw = req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "";
  return /^[0-9a-f.:]{3,45}$/i.test(raw.trim()) ? raw.trim() : "127.0.0.1";
}

// Buyer data iyzico requires. Xora sells a digital good and does not collect national ID or a
// postal address, so those fields carry iyzico's documented placeholder values.
function buyerFor(user: any, profile: any, ip: string) {
  const name = String(profile?.display_name || profile?.username || "").trim().split(/\s+/).filter(Boolean);
  const first = (name[0] || "Xora").slice(0, 50), last = (name.slice(1).join(" ") || "User").slice(0, 50);
  const email = typeof user.email === "string" && user.email.includes("@") ? user.email : `${user.id}@users.xora.app`;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    buyer: {
      id: user.id, name: first, surname: last, email, identityNumber: "11111111111",
      registrationAddress: "Digital goods - address not collected", city: "Istanbul", country: "Turkey",
      ip, lastLoginDate: now, registrationDate: now
    },
    billingAddress: { contactName: `${first} ${last}`, city: "Istanbul", country: "Turkey", address: "Digital goods - address not collected" }
  };
}

async function createCheckout(req: Request, body: any) {
  // Only package_id is read from the request; any amount, credits or currency sent is ignored.
  if (!isPackageId(body?.package_id)) return json({ status: "error", code: "unknown_package" }, 400);
  const user = await authenticatedUser(req);
  if (!user) return json({ status: "error", code: "unauthorized" }, 401);
  // Configuration preflight precedes any database write or network call. Only secret NAMES are
  // logged, never values, and nothing about the configuration is returned to the browser.
  let cfg;
  try { cfg = iyzicoConfig(); } catch (e) {
    console.warn("iyzico not configured; missing or invalid:", e instanceof PaymentConfigError ? e.missing.join(",") : "unknown");
    return json({ status: "error", code: "payment_not_configured" }, 503);
  }
  const service = serviceClient();

  const begun = await service.rpc("xora_begin_credit_purchase", { p_user_id: user.id, p_package_id: body.package_id });
  if (begun.error) {
    const code = /too_many_pending/.test(begun.error.message) ? "too_many_pending" : /unknown_package/.test(begun.error.message) ? "unknown_package" : "purchase_failed";
    return json({ status: "error", code }, code === "purchase_failed" ? 500 : 400);
  }
  const p = begun.data;
  const expected = CATALOG[body.package_id as PackageId];
  // The database catalog is authoritative; refuse if the two catalogs ever disagree.
  if (p.package_id !== body.package_id || Number(p.credits) !== expected.credits || cents(p.amount) !== cents(expected.amount) || p.currency !== expected.currency) {
    await service.rpc("xora_fail_credit_purchase", { p_purchase_id: p.purchase_id, p_reason: "catalog_mismatch" });
    return json({ status: "error", code: "purchase_failed" }, 500);
  }

  const profile = (await service.from("users").select("display_name,username").eq("id", user.id).maybeSingle()).data;
  const callbackUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "") + "/functions/v1/iyzico-checkout/callback";
  const amount = price(p.amount);
  const request = {
    locale: body.locale === "tr" ? "tr" : "en",
    conversationId: p.purchase_id,
    price: amount,
    paidPrice: amount,
    currency: p.currency,
    basketId: p.purchase_id,
    paymentGroup: "PRODUCT",
    callbackUrl,
    enabledInstallments: [1],
    ...buyerFor(user, profile, clientIp(req)),
    basketItems: [{ id: p.package_id, name: `XORA ${p.credits} credits`, category1: "Digital credits", itemType: "VIRTUAL", price: amount }]
  };

  let data: any;
  try { data = await iyzicoRequest(INITIALIZE_PATH, request); } catch { data = null; }
  if (!data || data.status !== "success" || typeof data.token !== "string" || data.conversationId !== p.purchase_id) {
    await service.rpc("xora_fail_credit_purchase", { p_purchase_id: p.purchase_id, p_reason: "initialize_failed" });
    return json({ status: "error", code: "checkout_unavailable" }, 502);
  }
  const attached = await service.rpc("xora_attach_credit_purchase_token", { p_purchase_id: p.purchase_id, p_token: data.token });
  if (attached.error) return json({ status: "error", code: "purchase_failed" }, 500);
  return json({
    status: "ok", purchase_id: p.purchase_id, package_id: p.package_id, credits: p.credits, sandbox: !cfg.live,
    checkout_form_content: typeof data.checkoutFormContent === "string" ? data.checkoutFormContent : null,
    payment_page_url: typeof data.paymentPageUrl === "string" ? data.paymentPageUrl : null
  });
}

async function verifyPurchase(req: Request, body: any) {
  if (typeof body?.purchase_id !== "string" || !UUID.test(body.purchase_id)) return json({ status: "error", code: "bad_request" }, 400);
  const user = await authenticatedUser(req);
  if (!user) return json({ status: "error", code: "unauthorized" }, 401);
  const service = serviceClient();
  const found = await service.from("credit_purchases").select(PURCHASE_COLUMNS).eq("id", body.purchase_id).eq("user_id", user.id).maybeSingle();
  if (found.error || !found.data) return json({ status: "error", code: "not_found" }, 404);
  let result;
  try { result = await settlePurchase(service, found.data); } catch { result = { status: found.data.status, credits: found.data.credits }; }
  return json({ status: "ok", purchase_id: found.data.id, package_id: found.data.package_id, payment_status: result.status, credits: found.data.credits });
}

function siteRedirect(status: string, purchaseId?: string) {
  const site = (Deno.env.get("XORA_SITE_URL") || "").trim();
  if (/^https:\/\/|^http:\/\/localhost(:\d+)?\//.test(site)) {
    const target = new URL("credits.html", site.endsWith("/") ? site : site + "/");
    target.searchParams.set("payment", status);
    if (purchaseId) target.searchParams.set("purchase", purchaseId);
    return new Response(null, { status: 303, headers: { Location: target.toString(), "Cache-Control": "no-store" } });
  }
  return new Response("<!doctype html><meta charset=utf-8><title>XORA</title><p>Payment " + (status === "completed" ? "received" : "not completed") + ". You can return to XORA.</p>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function handleCallback(req: Request) {
  let token = "";
  try {
    if (req.method === "POST") token = String(new URLSearchParams(await req.text()).get("token") || "");
    else token = new URL(req.url).searchParams.get("token") || "";
  } catch { token = ""; }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(token)) return siteRedirect("failed");
  const service = serviceClient();
  const found = await service.from("credit_purchases").select(PURCHASE_COLUMNS).eq("provider_token", token).maybeSingle();
  if (found.error || !found.data) return siteRedirect("failed");
  let result;
  try { result = await settlePurchase(service, found.data); } catch { result = { status: "pending" }; }
  return siteRedirect(result.status, found.data.id);
}

async function main(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (new URL(req.url).pathname.replace(/\/+$/, "").endsWith("/callback")) {
    try { return await handleCallback(req); } catch { return siteRedirect("failed"); }
  }
  if (req.method !== "POST") return json({ status: "error", code: "method_not_allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ status: "error", code: "bad_request" }, 400); }
  try {
    if (body?.action === "create") return await createCheckout(req, body);
    if (body?.action === "verify") return await verifyPurchase(req, body);
    return json({ status: "error", code: "bad_request" }, 400);
  } catch {
    return json({ status: "error", code: "internal_error" }, 500);
  }
}

Deno.serve(main);

export { main, CATALOG, iyzicoConfig, iyzicoAuthHeaders, verifyCheckoutResult, settlePurchase, INITIALIZE_PATH, RETRIEVE_PATH, IYZICO_SANDBOX_URL, IYZICO_LIVE_URL };
