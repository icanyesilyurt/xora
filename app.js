/* ============================================================
   XORA — app.js
   Ortak mantık: depolama, krediler, dil (12 locale, seçici + tarayıcı algılama), üst bar, toast
   ============================================================ */

var LS = {
  users: "xora_users",
  currentUser: "xora_current_user",
  analyses: "xora_analyses",
  hiddenAnalyses: "xora_hidden_analyses",
  credits: "xora_credits",
  history: "xora_history",
  lang: "xora_lang",
  referral: "xora_referral"
};

var COSTS = { mirror: 5, stalk: 5, match: 10 };

// Launch pricing in USD. `list` is the regular price shown struck through; `price` is charged.
// Capacity is derived from COSTS so it can never drift from the real per-analysis prices.
var LAUNCH_DISCOUNT = 0.4;
var CREDIT_PACKAGES = [
  { id: "starter", credits: 10, list: 4.99, price: 2.99, label: "pkg_starter" },
  { id: "popular", credits: 20, list: 9.99, price: 5.99, label: "pkg_popular", featured: true },
  { id: "value", credits: 50, list: 24.99, price: 14.99, label: "pkg_value" },
  { id: "pro", credits: 300, list: 149.99, price: 89.99, label: "pkg_pro", note: "pkg_pro_note" }
];
var FREE_CREDITS = 0;
var xoraSupabase = null;

/* ---------------- yardımcılar ---------------- */

function esc(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function toast(msg) {
  var t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(function () { t.classList.add("show"); });
  clearTimeout(t._z);
  t._z = setTimeout(function () { t.classList.remove("show"); }, 2400);
}

function authDebug() {}

function getSupabaseClient() {
  if (xoraSupabase) return xoraSupabase;
  var cfg = window.XORA_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
  xoraSupabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  return xoraSupabase;
}

/* ---------------- kullanıcı / local auth ---------------- */

function readJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return readJson(LS.users, []);
}

function saveUsers(users) {
  writeJson(LS.users, users || []);
}

function getCurrentUser() {
  return readJson(LS.currentUser, null);
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(LS.currentUser);
    return;
  }
  writeJson(LS.currentUser, user);
}

function getStoredAuthUser() {
  return getCurrentUser();
}

function storeAuthUser(user) {
  setCurrentUser(user);
}

function getUser() {
  var user = getCurrentUser();
  return (user && user.username) || "";
}

function isLoggedIn() {
  return !!getCurrentUser();
}

function isAuthPending() {
  return false;
}

function setUser(username) {
  var user = getCurrentUser();
  if (!user) return;
  user.username = String(username || "").replace(/^@+/, "");
  user.display_name = user.username;
  setCurrentUser(user);
}

function profileFromAuthUser(authUser, username) {
  var meta = (authUser && authUser.user_metadata) || {};
  var cleanUsername = String(username || meta.username || meta.display_name || (authUser && authUser.email ? authUser.email.split("@")[0] : "") || "").replace(/^@+/, "").trim();
  var existing = getCurrentUser();
  return {
    id: authUser.id,
    username: cleanUsername,
    email: authUser.email || "",
    display_name: cleanUsername,
    avatar_url: null,
    credit_balance: FREE_CREDITS,
    last_login_at: new Date().toISOString(),
    last_card: (existing && existing.id === authUser.id && existing.last_card) ? existing.last_card : null
  };
}

async function ensureUserRow(authUser, username) {
  var sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase client yok");
  if (!authUser || !authUser.id) throw new Error("Auth user yok");

  console.log("[XORA db] ensureUserRow id=" + authUser.id);

  var sel = await sb.from("users").select("*").eq("id", authUser.id).maybeSingle();
  console.log("[XORA db] select result", sel);

  if (sel.error) {
    console.error("[XORA db] select failed", sel.error);
    throw sel.error;
  }

  var row;

  if (sel.data) {
    console.log("[XORA db] user exists, updating last_login_at");
    var upd = await sb.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", authUser.id).select().single();
    console.log("[XORA db] update result", upd);
    if (upd.error) {
      console.error("[XORA db] update failed", upd.error);
      throw upd.error;
    }
    row = upd.data;
  } else {
    var cleanUsername = String(username || (authUser.user_metadata && authUser.user_metadata.username) || (authUser.email ? authUser.email.split("@")[0] : "user")).replace(/^@+/, "").trim();
    var payload = {
      id: authUser.id,
      username: cleanUsername,
      display_name: cleanUsername,
      avatar_url: null,
      last_login_at: new Date().toISOString()
    };
    console.log("[XORA db] user not found, inserting", payload);
    var ins = await sb.from("users").insert([payload]).select().single();
    console.log("[XORA db] insert result", ins);
    if (ins.error) {
      console.error("[XORA db] insert failed", ins.error);
      throw ins.error;
    }
    row = ins.data;
  }

  var existing = getCurrentUser();
  var profile = {
    id: authUser.id,
    username: row.username || "",
    email: authUser.email || "",
    display_name: row.display_name || row.username || "",
    avatar_url: row.avatar_url || null,
    credit_balance: row.credit_balance != null ? row.credit_balance : FREE_CREDITS,
    last_login_at: row.last_login_at || new Date().toISOString(),
    last_card: (existing && existing.id === authUser.id && existing.last_card) ? existing.last_card : null
  };
  setCurrentUser(profile);
  localStorage.setItem(LS.credits, String(profile.credit_balance));
  console.log("[XORA db] ensureUserRow done", profile);
  await syncReferral();
  return profile;
}

async function createLocalUser(username, email, password) {
  var sb = getSupabaseClient();
  if (!sb) return { success: false, error: t("auth_connection_failed") };

  var cleanUsername = String(username || "").replace(/^@+/, "").trim();
  var cleanEmail = String(email || "").trim().toLowerCase();

  try {
    console.log("[XORA auth] signUp start", cleanEmail);
    var signup = await sb.auth.signUp({
      email: cleanEmail,
      password: password,
      options: { data: { username: cleanUsername } }
    });
    console.log("[XORA auth] signUp result", signup);
    if (signup.error) return { success: false, error: signup.error.message };
    if (!signup.data || !signup.data.user) return { success: false, error: t("auth_signup_failed") };

    var profile = await ensureUserRow(signup.data.user, cleanUsername);
    return { success: true, user: profile, hasSession: !!signup.data.session };
  } catch (err) {
    console.error("[XORA auth] createLocalUser failed", err);
    return { success: false, error: err.message || String(err) };
  }
}

async function loginLocalUser(email, password) {
  var sb = getSupabaseClient();
  if (!sb) return { success: false, error: t("auth_connection_failed") };

  try {
    console.log("[XORA auth] signIn start");
    var signin = await sb.auth.signInWithPassword({
      email: String(email || "").trim().toLowerCase(),
      password: password
    });
    console.log("[XORA auth] signIn result", signin);
    if (signin.error) return { success: false, error: signin.error.message };
    if (!signin.data || !signin.data.user) return { success: false, error: t("auth_signin_failed") };

    var profile = await ensureUserRow(signin.data.user);
    return { success: true, user: profile };
  } catch (err) {
    console.error("[XORA auth] loginLocalUser failed", err);
    return { success: false, error: err.message || String(err) };
  }
}

function logout() {
  localStorage.removeItem(LS.currentUser);
}

async function clearSession() {
  var sb = getSupabaseClient();
  if (sb) await sb.auth.signOut();
  logout();
}

function requireAuth() {
  if (isLoggedIn()) return true;
  window.location.href = "auth.html";
  return false;
}

async function initSession() {
  var sb = getSupabaseClient();
  if (sb) {
    try {
      var result = await sb.auth.getSession();
      var session = result && result.data && result.data.session;
      if (session && session.user) {
        try {
          await ensureUserRow(session.user);
        } catch (e) {
          console.error("[XORA session] ensureUserRow failed", e);
          setCurrentUser(profileFromAuthUser(session.user));
        }
      }
    } catch (e) {
      console.error("[XORA session] init failed", e);
    }
  }
  document.dispatchEvent(new CustomEvent("xora:session", { detail: getCurrentUser() }));
  return getCurrentUser();
}

/* ---------------- ürün katmanları / referral ---------------- */

function getTierFromUrl() {
  var params = new URLSearchParams(window.location.search || "");
  return params.get("tier") === "real" ? "real" : "fun";
}

function withTier(path, tier) {
  return path + (path.indexOf("?") >= 0 ? "&" : "?") + "tier=" + (tier === "real" ? "real" : "fun");
}

// Referral links (?ref=<code>) are kept for 30 days before signup. Only codes the server confirms
// as an active creator are stored; the first one kept is never replaced, and once the account is
// attributed server-side that attribution is what the browser keeps.
var REFERRAL_CAPTURE_DAYS = 30;
var referralCapture = null;

function referralParam() {
  try {
    var ref = String(new URLSearchParams(window.location.search || "").get("ref") || "").trim().toLowerCase();
    return /^[a-z0-9_-]{2,64}$/.test(ref) ? ref : "";
  } catch (e) { return ""; }
}

async function previewReferral(code) {
  var sb = getSupabaseClient();
  if (!sb || !code) return null;
  try {
    var res = await sb.rpc("xora_referral_preview", { p_code: code });
    if (res.error || !res.data || res.data.code !== code) return null;
    return res.data;
  } catch (e) { return null; }
}

function captureReferral() {
  var ref = referralParam();
  if (!ref || getReferralCode()) {
    renderReferralVia();
    referralCapture = Promise.resolve();
    return referralCapture;
  }
  referralCapture = previewReferral(ref).then(function (creator) {
    if (creator && !getReferralCode()) {
      writeJson(LS.referral, { code: creator.code, handle: creator.handle, first_seen_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + REFERRAL_CAPTURE_DAYS * 86400000).toISOString(), model: "first_touch" });
    }
    renderReferralVia();
  });
  return referralCapture;
}

function saveClaimedReferral(code, expiresAt, handle) {
  var item = readJson(LS.referral, null);
  writeJson(LS.referral, { code: code, handle: handle || (item && item.code === code ? item.handle : "") || "",
    expires_at: expiresAt, model: "first_touch", claimed: true });
}

function renderReferralVia() {
  var el = document.getElementById("refVia");
  if (!el) return;
  var item = readJson(LS.referral, null);
  var handle = getReferralCode() && item && item.handle ? String(item.handle).replace(/^@+/, "") : "";
  if (!handle) { el.hidden = true; el.textContent = ""; return; }
  var parts = t("ref_via").split("{handle}");
  el.innerHTML = esc(parts[0]) + '<bdi dir="ltr">@' + esc(handle) + "</bdi>" + esc(parts[1] || "");
  el.hidden = false;
}

function getReferralCode() {
  var item = readJson(LS.referral, null);
  if (!item || !item.code || !item.expires_at) return "";
  if (!/^[a-z0-9_-]{2,64}$/.test(item.code) || !Number.isFinite(Date.parse(item.expires_at)) || Date.now() >= Date.parse(item.expires_at)) {
    localStorage.removeItem(LS.referral);
    return "";
  }
  return item.code;
}

async function syncReferral() {
  var sb = getSupabaseClient();
  if (!sb || !getCurrentUser()) return;
  try { await (referralCapture || captureReferral()); } catch (e) {}
  try {
    var response = await sb.rpc("xora_capture_referral", {p_code:getReferralCode()});
    if (response.error) { console.warn("referral_sync_failed"); return; }
    if (response.data) saveClaimedReferral(response.data.referral_code, response.data.expires_at, response.data.handle);
    else localStorage.removeItem(LS.referral);
  } catch (e) { console.warn("referral_sync_failed"); }
  renderReferralVia();
}

function markAnalysisTier(result, tier, mode) {
  if (!result) return result;
  result.mode = result.mode || mode || "mirror";
  result.meta = result.meta || {};
  result.meta.tier = tier === "real" ? "real" : "fun";
  if (tier !== "real") result.meta.referral_code = getReferralCode() || null;
  return result;
}

function collectScoreValues(result) {
  var values = [];
  function push(v) {
    var n = Number(v);
    if (isFinite(n)) values.push(Math.max(0, Math.min(100, n)));
  }
  if (!result) return values;
  var list = result.top_behaviors || (result.card && (result.card.top_behaviors || result.card.scores)) || result.metrics || [];
  if (Array.isArray(list)) {
    for (var i = 0; i < list.length; i++) push(list[i] && (list[i].value != null ? list[i].value : list[i].score));
  } else if (list && typeof list === "object") {
    Object.keys(list).forEach(function (k) {
      var v = list[k];
      push(v && typeof v === "object" && v.value != null ? v.value : v);
    });
  }
  return values;
}

function ensureRealRarity(result) {
  if (!result) return result;
  result.meta = result.meta || {};
  if (result.rarity && result.rarity.name) return result;
  var values = collectScoreValues(result);
  var extremes = values.map(function (v) { return Math.abs(v - 50); });
  var avgExtreme = extremes.length ? extremes.reduce(function (a, b) { return a + b; }, 0) / extremes.length : 0;
  var peakExtreme = extremes.length ? Math.max.apply(Math, extremes) : 0;
  var score = Math.max(20, Math.min(99, Math.round(35 + (avgExtreme * 1.25) + (peakExtreme * 0.6))));
  var name = score >= 90 ? "legendary" : score >= 76 ? "epic" : score >= 58 ? "rare" : "common";
  result.rarity = { name: name, score: score };
  result.meta.rarity = name;
  result.meta.rarity_score = score;
  return result;
}

function normalizeRealResult(result, mode) {
  if (!result || !result.meta || result.meta.tier !== "real" || !result.rarity || ["common","rare","epic","legendary"].indexOf(result.rarity.name) < 0) throw new Error("bad_response");
  markAnalysisTier(result, "real", mode);
  return result;
}

function realFunctionName() {
  return "analyze-real";
}

async function requestRealAnalysis(mode, payload) {
  if (isProductionRealDisabled()) throw new Error("real_temporarily_unavailable");
  var sb = getSupabaseClient();
  if (!sb) throw new Error("real_unavailable");
  var sessionRes = await sb.auth.getSession();
  var session = sessionRes && sessionRes.data && sessionRes.data.session;
  if (!session || !session.user) throw new Error("unauthorized");

  var pendingKey = "xora_real_pending:" + session.user.id + ":" + mode + ":" + getLang() + ":" + JSON.stringify(payload || {});
  var requestId = sessionStorage.getItem(pendingKey) || ((window.crypto && typeof window.crypto.randomUUID === "function")
    ? window.crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
  sessionStorage.setItem(pendingKey, requestId);
  var body = Object.assign({}, payload || {}, {
    mode: mode,
    locale: getLang(),
    referral_code: getReferralCode() || null,
    request_id: requestId
  });

  var response = await sb.functions.invoke(realFunctionName(mode), { body: body });
  if (response.error) {
    var msg = response.error.message || "real_unavailable";
    try {
      var context = response.error.context;
      if (context && typeof context.clone === "function") context = context.clone();
      if (context && typeof context.json === "function") {
        var errorBody = await context.json();
        if (errorBody && errorBody.code) msg = errorBody.code;
      }
    } catch (e) {}
    if (["request_failed","insufficient_credits","bad_request","user_not_found","protected_account","insufficient_posts","rate_limited","analysis_failed","unauthorized"].indexOf(msg) >= 0) sessionStorage.removeItem(pendingKey);
    await refreshCreditsFromServer();
    throw new Error(msg);
  }
  var data = response.data || {};
  if (data.status === "error") throw new Error(data.code || "internal_error");
  if (!data.result) throw new Error("bad_response");
  sessionStorage.removeItem(pendingKey);
  if (data.result.meta && data.result.meta.referral_code && data.result.meta.referral_expires_at) {
    saveClaimedReferral(data.result.meta.referral_code, data.result.meta.referral_expires_at);
  } else { localStorage.removeItem(LS.referral); }
  await refreshCreditsFromServer();
  return normalizeRealResult(data.result, mode);
}

async function refreshCreditsFromServer() {
  var sb = getSupabaseClient();
  var user = getCurrentUser();
  if (!sb || !user || !user.id) return getCredits();
  try {
    var res = await sb.from("users").select("credit_balance").eq("id", user.id).maybeSingle();
    if (!res.error && res.data && res.data.credit_balance != null) {
      user.credit_balance = Number(res.data.credit_balance) || 0;
      setCurrentUser(user);
      localStorage.setItem(LS.credits, String(user.credit_balance));
      refreshTopbar();
    }
  } catch (e) {}
  return user.credit_balance;
}

function realErrorMessage(err) {
  var code = String((err && err.message) || err || "internal_error").toLowerCase();
  if (code.indexOf("refund_pending") >= 0) return t("real_err_refund");
  if (code.indexOf("insufficient") >= 0 || code.indexOf("credit") >= 0) return t("real_err_credit");
  if (code.indexOf("protected") >= 0) return t("real_err_protected");
  if (code.indexOf("user_not_found") >= 0 || code.indexOf("not found") >= 0) return t("real_err_not_found");
  if (code.indexOf("posts") >= 0) return t("real_err_posts");
  if (code.indexOf("rate") >= 0) return t("real_err_rate");
  if (code.indexOf("unauthorized") >= 0) return t("real_err_auth");
  return t("real_err_unavailable");
}

// Production hosts: the canonical domain (Cloudflare Pages), its *.pages.dev deployments, which use
// the same production config, and the old GitHub Pages address until it is switched off.
var XORA_PUBLIC_ORIGIN = "https://xora.roviaqr.com";
var XORA_PUBLIC_HOST = "xora.roviaqr.com";
var PRODUCTION_HOSTS = ["xora.roviaqr.com", "icanyesilyurt.github.io"];

function isProductionRealDisabled() {
  var host = String(window.location && window.location.hostname || "").toLowerCase();
  return PRODUCTION_HOSTS.indexOf(host) >= 0 || /\.pages\.dev$/.test(host);
}

function disableProductionRealCtas() {
  if (!isProductionRealDisabled()) return;
  var links = document.querySelectorAll('a[href*="tier=real"], a.real-disabled, .choice-action-real, .mini-mode.real');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    link.setAttribute("aria-disabled", "true");
    link.classList.add("real-disabled");
    link.removeAttribute("href");
    link.setAttribute("title", realComingSoonText());
    var status = link.querySelector(".real-coming-soon") || document.createElement("small");
    status.className = "real-coming-soon";
    status.textContent = realComingSoonText();
    link.appendChild(status);
    link.onclick = function (e) { e.preventDefault(); };
  }
}

function realComingSoonText() {
  return t("real_coming_soon");
}

function showProductionRealPause(tier) {
  if (tier !== "real" || !isProductionRealDisabled()) return false;
  var button = document.getElementById("goBtn");
  if (button) { button.disabled = true; button.textContent = realComingSoonText(); }
  var note = document.getElementById("tierNote");
  if (note) note.textContent = realComingSoonText();
  return true;
}

// Shared links always point at the canonical domain root, never at the host the page runs on.
function getPublicSiteUrl() {
  var cfg = window.XORA_CONFIG || {};
  var base = cfg.PUBLIC_URL ? String(cfg.PUBLIC_URL) : XORA_PUBLIC_ORIGIN + "/";
  try {
    var url = new URL(base);
    var ref = getReferralCode();
    if (ref) url.searchParams.set("ref", ref);
    return url.href;
  } catch (e) { return XORA_PUBLIC_ORIGIN + "/"; }
}

// Creator link: https://xora.roviaqr.com/?ref=<code>
function creatorReferralUrl(code) {
  var url = new URL(XORA_PUBLIC_ORIGIN + "/");
  url.searchParams.set("ref", String(code || "").trim().toLowerCase());
  return url.href;
}

/* ---------------- krediler ---------------- */

function getCredits() {
  if (localStorage.getItem(LS.credits) === null) {
    localStorage.setItem(LS.credits, String(FREE_CREDITS));
  }
  var n = parseInt(localStorage.getItem(LS.credits), 10);
  return isNaN(n) ? 0 : n;
}

function addCredits() { throw new Error("server_only_credits"); }
function spendCredits() { throw new Error("server_only_credits"); }

function getHistory() {
  return getAnalysesForCurrentUser();
}

function addHistory(entry) {
  return entry;
}

function getAllAnalyses() {
  return readJson(LS.analyses, []);
}

function saveAllAnalyses(analyses) {
  writeJson(LS.analyses, analyses || []);
}

function saveAnalysis(analysis) {
  var user = getCurrentUser();
  if (!user || !analysis) return null;

  var item = {
    id: "analysis_" + Date.now(),
    userId: user.id,
    type: analysis.type,
    title: analysis.title || null,
    handles: analysis.handles || [],
    result: analysis.result || null,
    createdAt: analysis.createdAt || new Date().toISOString()
  };

  var analyses = getAllAnalyses();
  analyses.unshift(item);
  saveAllAnalyses(analyses);
  user.last_analysis_id = item.id;
  if (item.type === "mirror") {
    user.last_card = {
      id: item.id,
      type: "mirror",
      handle: (item.handles && item.handles[0]) || (item.result && item.result.handle) || null,
      result: item.result,
      createdAt: item.createdAt
    };
    console.log("[XORA] last_card updated", user.last_card);
  }
  setCurrentUser(user);
  saveAnalysisToSupabase(item);
  document.dispatchEvent(new CustomEvent("xora:analysis-saved", { detail: item }));
  return item;
}

function saveAnalysisLocalOnly(type, handles, result) {
  var user = getCurrentUser();
  if (!user || !result) return null;
  var item = {
    id: "analysis_local_" + Date.now(),
    userId: user.id,
    type: type,
    title: result && result.nickname ? (result.nickname[getLang()] || (result.meta && result.nickname[result.meta.locale]) || result.nickname.tr || null) : null,
    handles: handles || [],
    result: result,
    createdAt: new Date().toISOString()
  };
  var analyses = getAllAnalyses();
  analyses.unshift(item);
  saveAllAnalyses(analyses);
  if (type === "mirror") {
    user.last_card = {
      id: item.id,
      type: type,
      handle: (handles && handles[0]) || result.handle || null,
      result: result,
      createdAt: item.createdAt
    };
    setCurrentUser(user);
  }
  document.dispatchEvent(new CustomEvent("xora:analysis-saved", { detail: item }));
  return item;
}

function getLastMirrorAnalysis() {
  var analyses = getAllAnalyses();
  var user = getCurrentUser();
  if (!user) return null;
  for (var i = 0; i < analyses.length; i++) {
    if (analyses[i].userId === user.id && analyses[i].type === "mirror") return analyses[i];
  }
  return null;
}

var MIRROR_COOLDOWN_DAYS = 15;

function isMirrorOnCooldown() {
  var last = getLastMirrorAnalysis();
  if (!last || !last.createdAt) return false;
  var elapsed = Date.now() - new Date(last.createdAt).getTime();
  return elapsed < MIRROR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

function getMirrorCooldownRemaining() {
  var last = getLastMirrorAnalysis();
  if (!last || !last.createdAt) return 0;
  var elapsed = Date.now() - new Date(last.createdAt).getTime();
  var remaining = (MIRROR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) - elapsed;
  return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
}

async function saveAnalysisToSupabase(item) {
  var sb = getSupabaseClient();
  var user = getCurrentUser();
  if (!sb) { console.warn("[XORA db] analyses insert skipped — no Supabase client"); return null; }
  if (!user || !user.id) { console.warn("[XORA db] analyses insert skipped — no user id"); return null; }
  if (!item) { console.warn("[XORA db] analyses insert skipped — no item"); return null; }

  var row = {
    user_id: user.id,
    analysis_type: item.type,
    title: item.title || null,
    result: item.result || null
  };

  console.log("[XORA db] analyses insert payload", row);
  try {
    var response = await sb.from("analyses").insert([row]).select();
    if (response.error) {
      console.error("[XORA db] analyses insert failed", response.error);
      return null;
    }
    console.log("[XORA db] analyses insert success", response.data);
    return response.data;
  } catch (err) {
    console.error("[XORA db] analyses insert failed", err);
    return null;
  }
}

function getAnalysesForCurrentUser() {
  var user = getCurrentUser();
  if (!user) return [];
  return getAllAnalyses().filter(function (item) {
    return item.userId === user.id;
  });
}

async function getRemoteAnalyses(limit) {
  var sb = getSupabaseClient();
  var user = getCurrentUser();
  if (sb && user) {
    try {
      var response = await sb
        .from("analyses")
        .select("id,user_id,analysis_type,title,result,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit || 30);
      if (!response.error) return response.data || [];
      console.error("[XORA db] analyses fetch failed", response.error);
    } catch (err) {
      console.error("[XORA db] analyses fetch failed", err);
    }
  }
  return getAnalysesForCurrentUser().slice(0, limit || 30);
}

function deleteAnalysesLocal(ids) {
  if (!ids || !ids.length) return { deleted: 0 };
  var idSet = {};
  for (var i = 0; i < ids.length; i++) idSet[String(ids[i])] = true;
  var all = getAllAnalyses();
  var before = all.length;
  var filtered = all.filter(function (item) { return !idSet[String(item.id)]; });
  var deleted = before - filtered.length;
  saveAllAnalyses(filtered);
  console.log("[XORA delete] local result", { requested: ids.length, deleted: deleted });
  return { deleted: deleted };
}

function getHiddenAnalyses() {
  return readJson(LS.hiddenAnalyses, []);
}

function hideRemoteAnalyses(remoteIds) {
  if (!remoteIds || !remoteIds.length) return;
  var hidden = getHiddenAnalyses();
  var existing = {};
  for (var i = 0; i < hidden.length; i++) existing[hidden[i]] = true;
  for (var j = 0; j < remoteIds.length; j++) {
    if (!existing[remoteIds[j]]) hidden.push(remoteIds[j]);
  }
  writeJson(LS.hiddenAnalyses, hidden);
  console.log("[XORA delete] hidden remote ids updated", hidden);
}

function isAnalysisHidden(remoteId) {
  var hidden = getHiddenAnalyses();
  for (var i = 0; i < hidden.length; i++) {
    if (hidden[i] === remoteId) return true;
  }
  return false;
}

function saveAnalysisRecord(type, handles, result) {
  var title = null;
  if (result && result.meta && /^mirror_v/.test(result.meta.version || "")) title = "@" + (result.handle || (handles && handles[0]) || "?");
  if (!title && result && result.card && result.card.nickname) title = result.card.nickname[getLang()];
  if (!title && result && result.archetype && result.archetype.name) title = result.archetype.name[getLang()];
  if (!title && result && result.title) title = result.title;
  if (!title && type === "match" && result && result.overall != null) title = "%" + result.overall;

  return saveAnalysis({
    type: type,
    title: title,
    handles: handles || [],
    result: result || null
  });
}

/* ---------------- dil (TR varsayılan) ---------------- */

var I18N = {
  tr: {
    nav_profile: "Profil",
    nav_login: "Giriş Yap",
    /* ana sayfa */
    home_hi: "Merhaba, ben XORA.",
    home_sub: "İstersen eğlen, istersen gerçekten analiz ettir. XORA iki durumda da fazla konuşur.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Kendi X karakterini çıkar. Aynaya bak, kim olduğunu gör.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Merak ettiğin hesabı analiz et. Kimseye söylemeyiz.",
    card_match_t: "X Match",
    card_match_d: "İki hesabı karşılaştır. Uyum mu, felaket mi?",
    badge_free: "Ücretsiz",
    tier_fun: "Eğlence Kartı",
    tier_real: "Gerçek Analiz",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Ücretsiz · X verisi okunmaz",
    tier_real_note: "X verisine dayalı · kredi kullanır",
    home_diff_h: "İki XORA var. İkisi de aynı derecede meraklı.",
    home_fun_h: "XORA Fun",
    home_fun_d: "Ücretsizdir. X verilerini okumaz; eğlence kartını anında üretir. Reroll serbest.",
    home_real_h: "XORA Real",
    home_real_d: "Gerçek X verisini analiz eder. X API ve analiz altyapısı bize de ücretli; bu yüzden kredi kullanır.",
    home_real_joke: "Yine de sizi eğlenceden mahrum bırakacak kadar kapitalist değiliz.",
    badge_c5: "5 Kredi",
    badge_c10: "10 Kredi",
    /* mirror */
    mirror_h1: "X Mirror",
    mirror_sub: "Kendi X karakterini görmek için X kullanıcı adını yaz.",
    mirror_ph: "@kullaniciadi",
    mirror_btn: "Aynaya Bak",
    fun_btn: "Ücretsiz Kartı Çek",
    real_btn_5: "Gerçek Analiz · 5 Kredi",
    real_btn_10: "Gerçek Analiz · 10 Kredi",
    reroll_btn: "Tekrar Çek",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Bu kart gerçek X verisine dayalıdır. API ve analiz maliyeti nedeniyle kredi kullanır.",
    fun_explainer: "Bu kart eğlence amaçlıdır; X verilerini analiz etmez.",
    mirror_connect_cta: "X hesabını bağla ve analiz et",
    mirror_login_note: "Mirror için X hesabını bağlaman gerekir.",
    mirror_profile_h: "Profilini Tamamla",
    mirror_profile_sub: "Kartını oluşturmadan önce bilgilerini gözden geçir.",
    mirror_display_name: "Görünen ad",
    mirror_country: "Ülke",
    mirror_city: "Şehir",
    mirror_bio: "Kısa bio",
    mirror_website: "Web sitesi",
    mirror_avatar_url: "Profil fotoğrafı URL",
    mirror_save: "Kaydet",
    mirror_skip: "Şimdilik geç",
    auth_title: "XORA’ya Giriş Yap",
    auth_sub: "Analizlerini kaydetmek için XORA hesabına giriş yap.",
    auth_login_tab: "Giriş Yap",
    auth_signup_tab: "Üye Ol",
    auth_email: "E-posta",
    auth_username: "Kullanıcı adı",
    auth_password: "Şifre",
    auth_password_confirm: "Şifre tekrar",
    auth_login_btn: "Giriş Yap",
    auth_signup_btn: "Üye Ol",
    auth_have_account: "Hesabın varsa giriş yap.",
    auth_need_account: "Hesabın yoksa üye ol.",
    auth_success: "Giriş başarılı",
    auth_signup_check_email: "Üyelik oluşturuldu. Mail doğrulaması gerekiyorsa e-postanı kontrol et.",
    auth_username_required: "Kullanıcı adı boş olamaz.",
    auth_email_required: "E-posta boş olamaz.",
    auth_password_required: "Şifre boş olamaz.",
    auth_password_min: "Şifre minimum 6 karakter olmalı.",
    auth_password_mismatch: "Şifreler uyuşmuyor.",
    auth_config_missing: "Auth ayarları eksik.",
    auth_connection_failed: "Supabase bağlantısı kurulamadı",
    auth_signup_failed: "Üyelik oluşturulamadı",
    auth_signin_failed: "Giriş yapılamadı",
    /* stalk */
    stalk_h1: "X Stalk",
    stalk_sub: "Bir kullanıcı adı yaz, XORA gizlice baksın. Bu iş aramızda kalır.",
    stalk_ph: "@merakettigin",
    stalk_btn: "Gizlice Analiz Et",
    stalk_note: "Bu analiz 5 Merak Kredisi kullanır.",
    /* match */
    match_h1: "X Match",
    match_sub: "İki hesabı yan yana koy. XORA uyumu söylesin, kavgayı sen çıkar.",
    match_ph1: "@birinci",
    match_ph2: "@ikinci",
    match_btn: "Uyumu Hesapla",
    match_note: "Bu karşılaştırma 10 Merak Kredisi kullanır.",
    /* sonuç ekranı */
    btn_download: "Kartı İndir",
    btn_share: "X'te Paylaş",
    btn_again: "Tekrar Dene",
    upsell_mirror: "Peki ya o kişi? 👀",
    upsell_mirror_btn: "X Stalk ile bak",
    says: "XORA diyor ki",
    match_overall: "Genel Uyum",
    fun_match_label: "XORA FUN UYUMU",
    ref_via: "{handle} önerisiyle",
    match_flirt: "Flört Potansiyeli",
    match_vibe: "Kafa Uyumu",
    match_humor: "Mizah Uyumu",
    match_chaos: "Kaos Riski",
    match_romance: "Romantik Uyum",
    /* skorlar */
    sc_viral: "Viral Potansiyel",
    sc_kaos: "Kaos Seviyesi",
    sc_mizah: "Mizah Dozu",
    sc_gece: "Gece Aktivitesi",
    /* profil */
    profile_h1: "Profil",
    profile_balance: "Merak Kredisi",
    profile_last: "Son Kartın",
    profile_history: "Geçmiş Analizler",
    profile_logout: "Çıkış Yap",
    profile_nouser: "Devam etmek için giriş yapmalısın.",
    profile_gomirror: "Giriş Yap",
    profile_empty: "Henüz X kimlik kartın yok.",
    profile_empty_sub: "İlk analizini başlat.",
    profile_actions: "Analiz Başlat",
    logout_confirm: "Çıkış yapılsın mı?",
    logout_done: "Çıkış yapıldı",
    /* krediler */
    credits_h1: "Merak Kredisi",
    credits_sub: "Fun bedava. Real analiz ise X verisini gerçekten okuduğu için kredi kullanır.",
    credits_balance: "Bakiyen",
    credits_buy: "Satın Al",
    credits_note: "Ödeme iyzico ile bağlanacak. Bu sürümde satın alma butonları test amaçlı pasiftir.",
    trait_humor: "Mizah",
    trait_reply: "Reply enerjisi",
    trait_timeline: "Timeline modu",
    trait_humor_dry: "Kuru",
    trait_humor_playful: "Oyunbaz",
    trait_humor_deadpan: "Ciddi yüzle",
    trait_humor_ironic: "İğneleyici",
    trait_humor_warm: "Sıcak",
    trait_humor_witty: "Hazırcevap",
    trait_reply_curious: "Meraklı",
    trait_reply_measured: "Ölçülü",
    trait_reply_quick: "Hızlı",
    trait_reply_supportive: "Destekçi",
    trait_reply_teasing: "Takılgan",
    trait_reply_selective: "Seçici",
    trait_timeline_opens_topics: "Konu açar",
    trait_timeline_goes_deep: "Derine iner",
    trait_timeline_calms_threads: "Ortamı yumuşatır",
    trait_timeline_reads_first: "Önce okur",
    trait_timeline_gets_everyone_in: "Herkesi katar",
    trait_timeline_tells_stories: "Hikâye anlatır",
    trait_timeline_drops_one_liners: "Tek cümleyle bitirir",
    real_metrics_title: "X'teki davranış",
    real_m_reply: "Yanıt oranı",
    real_m_original: "Özgün gönderi",
    real_m_repost: "Repost oranı",
    real_m_question: "Soru içeren gönderi",
    real_m_emoji: "Gönderi başına emoji",
    real_m_length: "Ort. uzunluk",
    real_m_chars: "{n} karakter",
    pricing_launch: "LANSMAN FIRSATI · {pct} İNDİRİM",
    pkg_starter: "BAŞLANGIÇ",
    pkg_popular: "EN POPÜLER",
    pkg_value: "AVANTAJLI",
    pkg_pro: "PROFESYONEL",
    pkg_pro_note: "İçerik üreticileri ve ajanslar",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Normal fiyat",
    toast_loaded: "kredi yüklendi ⚡",
    payment_soon: "iyzico bağlantısını bir sonraki adımda açıyoruz.",
    real_err_credit: "Kredin bu analiz için yetmiyor.",
    real_err_protected: "Bu hesap korumalı; XORA kapıyı kıramıyor.",
    real_err_not_found: "Bu X hesabını bulamadım.",
    real_err_posts: "Gerçek analiz için yeterli paylaşım yok.",
    real_err_rate: "X şu an biraz huysuz. Kısa süre sonra tekrar dene.",
    real_err_auth: "Gerçek analiz için XORA hesabına giriş yapmalısın.",
    real_err_unavailable: "Analiz tamamlanamadı. Bakiye ve geçmişini kontrol edip tekrar dene.",
    real_err_refund: "İade bekliyor. İstek kimliğin korunuyor; daha sonra tekrar kontrol et.",
    real_coming_soon: "Gerçek analiz yakında aktif",
    rarity_common: "COMMON",
    rarity_rare: "RARE",
    rarity_epic: "EPIC",
    rarity_legendary: "LEGENDARY",
    /* hatalar / bildirimler */
    toast_handle: "Önce bir kullanıcı adı yaz",
    toast_two: "İki kullanıcı adı da gerekli",
    toast_same: "İki farklı hesap girmelisin 🙂",
    toast_nocredit: "Kredin yetersiz, yönlendiriyorum…",
    toast_saved: "Kart indirildi",
    cost_info: "kredi kullanıldı",
    date_today: "bugün",
    mirror_cooldown: "X kimlik kartın hâlâ güncel. Yeni kart için {days} gün sonra tekrar gel.",
    view_card: "Kartı Görüntüle",
    close: "Kapat",
    history_select: "Seç",
    history_cancel: "İptal",
    history_delete: "Seçilenleri Temizle",
    history_none_selected: "Temizlemek için analiz seç.",
    history_deleted: "Seçilen analizler geçmişinden kaldırıldı.",
    history_not_found: "Silinecek kayıt bulunamadı.",
    profile_card_expired: "Mirror kartının süresi doldu.",
    profile_card_renew: "Yeni Mirror çek",
    card_load_failed: "Kart yüklenemedi"
  },
  en: {
    nav_profile: "Profile",
    nav_login: "Sign In",
    home_hi: "Hi, I'm XORA.",
    home_sub: "Come for the joke, stay for the real analysis. XORA talks too much either way.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Reveal your own X character. Look in the mirror.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analyze the account you're curious about. We won't tell.",
    card_match_t: "X Match",
    card_match_d: "Compare two accounts. Soulmates or disaster?",
    badge_free: "Free",
    tier_fun: "Fun Card",
    tier_real: "Real Analysis",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Free · no X data read",
    tier_real_note: "Based on X data · uses credits",
    home_diff_h: "Two XORAs. Both equally nosy.",
    home_fun_h: "XORA Fun",
    home_fun_d: "Free. It does not read your X data; it creates an instant entertainment card. Rerolls are on us.",
    home_real_h: "XORA Real",
    home_real_d: "Reads real X data. X API and analysis cost us money too, so Real uses credits.",
    home_real_joke: "We are still not capitalist enough to take the fun away from you.",
    badge_c5: "5 Credits",
    badge_c10: "10 Credits",
    mirror_h1: "X Mirror",
    mirror_sub: "Enter your X username to see your X character.",
    mirror_ph: "@yourhandle",
    mirror_btn: "Look in the Mirror",
    fun_btn: "Draw Free Card",
    real_btn_5: "Real Analysis · 5 Credits",
    real_btn_10: "Real Analysis · 10 Credits",
    reroll_btn: "Reroll",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "This card is based on real X data. API and analysis costs are why it uses credits.",
    fun_explainer: "This is an entertainment card; it does not analyze X data.",
    mirror_connect_cta: "Connect X account and analyze",
    mirror_login_note: "Mirror requires connecting your X account.",
    mirror_profile_h: "Complete Your Profile",
    mirror_profile_sub: "Review your details before creating your card.",
    mirror_display_name: "Display name",
    mirror_country: "Country",
    mirror_city: "City",
    mirror_bio: "Short bio",
    mirror_website: "Website",
    mirror_avatar_url: "Profile photo URL",
    mirror_save: "Save",
    mirror_skip: "Skip for now",
    auth_title: "Sign in to XORA",
    auth_sub: "Sign in to your XORA account to save your analyses.",
    auth_login_tab: "Sign In",
    auth_signup_tab: "Sign Up",
    auth_email: "Email",
    auth_username: "Username",
    auth_password: "Password",
    auth_password_confirm: "Confirm password",
    auth_login_btn: "Sign In",
    auth_signup_btn: "Sign Up",
    auth_have_account: "Already have an account? Sign in.",
    auth_need_account: "Need an account? Sign up.",
    auth_success: "Signed in",
    auth_signup_check_email: "Account created. If email confirmation is required, check your inbox.",
    auth_username_required: "Username is required.",
    auth_email_required: "Email is required.",
    auth_password_required: "Password is required.",
    auth_password_min: "Password must be at least 6 characters.",
    auth_password_mismatch: "Passwords do not match.",
    auth_config_missing: "Auth config is missing.",
    auth_connection_failed: "Could not connect to Supabase",
    auth_signup_failed: "Account could not be created",
    auth_signin_failed: "Sign-in failed",
    stalk_h1: "X Stalk",
    stalk_sub: "Type a username, XORA takes a quiet look. This stays between us.",
    stalk_ph: "@thatperson",
    stalk_btn: "Analyze Quietly",
    stalk_note: "This analysis uses 5 Curiosity Credits.",
    match_h1: "X Match",
    match_sub: "Put two accounts side by side. XORA calls the chemistry.",
    match_ph1: "@first",
    match_ph2: "@second",
    match_btn: "Calculate the Match",
    match_note: "This comparison uses 10 Curiosity Credits.",
    btn_download: "Download Card",
    btn_share: "Share on X",
    btn_again: "Try Again",
    upsell_mirror: "Now... what about them? 👀",
    upsell_mirror_btn: "Check with X Stalk",
    says: "XORA says",
    match_overall: "Overall Match",
    fun_match_label: "XORA FUN MATCH",
    ref_via: "via {handle}",
    match_flirt: "Flirt Potential",
    match_vibe: "Vibe Match",
    match_humor: "Humor Match",
    match_chaos: "Chaos Risk",
    match_romance: "Romantic Match",
    sc_viral: "Viral Potential",
    sc_kaos: "Chaos Level",
    sc_mizah: "Humor Dose",
    sc_gece: "Night Activity",
    profile_h1: "Profile",
    profile_balance: "Curiosity Credits",
    profile_last: "Your Last Card",
    profile_history: "Past Analyses",
    profile_logout: "Log Out",
    profile_nouser: "Sign in to continue.",
    profile_gomirror: "Sign In",
    profile_empty: "You do not have an X identity card yet.",
    profile_empty_sub: "Start your first analysis.",
    profile_actions: "Start Analysis",
    logout_confirm: "Log out?",
    logout_done: "Logged out",
    credits_h1: "Curiosity Credits",
    credits_sub: "Fun is free. Real uses credits because it actually reads X data.",
    credits_balance: "Your balance",
    credits_buy: "Buy",
    credits_note: "Payments will be connected through iyzico. Purchase buttons are disabled in this build.",
    trait_humor: "Humor",
    trait_reply: "Reply energy",
    trait_timeline: "Timeline mode",
    trait_humor_dry: "Dry",
    trait_humor_playful: "Playful",
    trait_humor_deadpan: "Deadpan",
    trait_humor_ironic: "Ironic",
    trait_humor_warm: "Warm",
    trait_humor_witty: "Quick-witted",
    trait_reply_curious: "Curious",
    trait_reply_measured: "Measured",
    trait_reply_quick: "Quick",
    trait_reply_supportive: "Supportive",
    trait_reply_teasing: "Teasing",
    trait_reply_selective: "Selective",
    trait_timeline_opens_topics: "Starts topics",
    trait_timeline_goes_deep: "Goes deep",
    trait_timeline_calms_threads: "Cools things down",
    trait_timeline_reads_first: "Reads first",
    trait_timeline_gets_everyone_in: "Brings people in",
    trait_timeline_tells_stories: "Tells stories",
    trait_timeline_drops_one_liners: "One-liner closer",
    real_metrics_title: "Behavior on X",
    real_m_reply: "Reply rate",
    real_m_original: "Original posts",
    real_m_repost: "Repost rate",
    real_m_question: "Posts with questions",
    real_m_emoji: "Emoji per post",
    real_m_length: "Avg. length",
    real_m_chars: "{n} chars",
    pricing_launch: "LAUNCH OFFER · {pct} OFF",
    pkg_starter: "STARTER",
    pkg_popular: "MOST POPULAR",
    pkg_value: "VALUE",
    pkg_pro: "PROFESSIONAL",
    pkg_pro_note: "Creators & Agencies",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Regular price",
    toast_loaded: "credits loaded ⚡",
    payment_soon: "We are connecting iyzico in the next step.",
    real_err_credit: "You do not have enough credits for this analysis.",
    real_err_protected: "That account is protected. Even XORA has boundaries.",
    real_err_not_found: "I could not find that X account.",
    real_err_posts: "There are not enough posts for a real analysis.",
    real_err_rate: "X is being difficult right now. Try again shortly.",
    real_err_auth: "Sign in to your XORA account for Real analysis.",
    real_err_unavailable: "Analysis could not finish. Check your balance and history before retrying.",
    real_err_refund: "Refund pending. Your request ID is retained; check again later.",
    real_coming_soon: "Real analysis coming soon",
    rarity_common: "COMMON",
    rarity_rare: "RARE",
    rarity_epic: "EPIC",
    rarity_legendary: "LEGENDARY",
    toast_handle: "Type a username first",
    toast_two: "Both usernames are required",
    toast_same: "Enter two different accounts 🙂",
    toast_nocredit: "Not enough credits, redirecting…",
    toast_saved: "Card downloaded",
    cost_info: "credits used",
    date_today: "today",
    mirror_cooldown: "Your X identity card is still current. Come back in {days} days for a new one.",
    view_card: "View Card",
    close: "Close",
    history_select: "Select",
    history_cancel: "Cancel",
    history_delete: "Delete Selected",
    history_none_selected: "Select analyses to delete.",
    history_deleted: "Selected analyses removed from history.",
    history_not_found: "No records found to delete.",
    profile_card_expired: "Your Mirror card has expired.",
    profile_card_renew: "Get a new Mirror",
    card_load_failed: "Card could not be loaded"
  },
  es: {
    nav_profile: "Perfil",
    nav_login: "Iniciar Sesión",
    /* ana sayfa */
    home_hi: "Hola, soy XORA.",
    home_sub: "Ven por la broma, quédate por el análisis real. XORA habla de más en los dos casos.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Descubre tu personaje de X. Mírate al espejo.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analiza esa cuenta que te da curiosidad. No se lo contamos a nadie.",
    card_match_t: "X Match",
    card_match_d: "Compara dos cuentas. ¿Almas gemelas o desastre?",
    badge_free: "Gratis",
    tier_fun: "Tarjeta Fun",
    tier_real: "Análisis Real",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Gratis · no lee datos de X",
    tier_real_note: "Basado en datos de X · usa créditos",
    home_diff_h: "Hay dos XORA. Los dos igual de curiosos.",
    home_fun_h: "XORA Fun",
    home_fun_d: "Es gratis. No lee tus datos de X; crea una tarjeta de entretenimiento al instante. Repite las veces que quieras.",
    home_real_h: "XORA Real",
    home_real_d: "Analiza datos reales de X. La API de X y el análisis también nos cuestan dinero, por eso Real usa créditos.",
    home_real_joke: "Aun así, no somos tan capitalistas como para quitarte la diversión.",
    badge_c5: "5 Créditos",
    badge_c10: "10 Créditos",
    /* mirror */
    mirror_h1: "X Mirror",
    mirror_sub: "Escribe tu usuario de X para ver tu personaje de X.",
    mirror_ph: "@tuusuario",
    mirror_btn: "Mírate al Espejo",
    fun_btn: "Saca tu Tarjeta Gratis",
    real_btn_5: "Análisis Real · 5 Créditos",
    real_btn_10: "Análisis Real · 10 Créditos",
    reroll_btn: "Sacar Otra",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Esta tarjeta se basa en datos reales de X. Usa créditos por el coste de la API y del análisis.",
    fun_explainer: "Esta tarjeta es de entretenimiento; no analiza datos de X.",
    mirror_connect_cta: "Conecta tu cuenta de X y analízala",
    mirror_login_note: "Mirror requiere conectar tu cuenta de X.",
    mirror_profile_h: "Completa tu Perfil",
    mirror_profile_sub: "Revisa tus datos antes de crear tu tarjeta.",
    mirror_display_name: "Nombre visible",
    mirror_country: "País",
    mirror_city: "Ciudad",
    mirror_bio: "Bio corta",
    mirror_website: "Sitio web",
    mirror_avatar_url: "URL de la foto de perfil",
    mirror_save: "Guardar",
    mirror_skip: "Omitir por ahora",
    auth_title: "Inicia sesión en XORA",
    auth_sub: "Inicia sesión en tu cuenta de XORA para guardar tus análisis.",
    auth_login_tab: "Iniciar Sesión",
    auth_signup_tab: "Crear Cuenta",
    auth_email: "Correo electrónico",
    auth_username: "Nombre de usuario",
    auth_password: "Contraseña",
    auth_password_confirm: "Repite la contraseña",
    auth_login_btn: "Iniciar Sesión",
    auth_signup_btn: "Crear Cuenta",
    auth_have_account: "¿Ya tienes cuenta? Inicia sesión.",
    auth_need_account: "¿No tienes cuenta? Regístrate.",
    auth_success: "Sesión iniciada",
    auth_signup_check_email: "Cuenta creada. Si hace falta confirmar el correo, revisa tu bandeja de entrada.",
    auth_username_required: "El nombre de usuario es obligatorio.",
    auth_email_required: "El correo electrónico es obligatorio.",
    auth_password_required: "La contraseña es obligatoria.",
    auth_password_min: "La contraseña debe tener al menos 6 caracteres.",
    auth_password_mismatch: "Las contraseñas no coinciden.",
    auth_config_missing: "Falta la configuración de acceso.",
    auth_connection_failed: "No se pudo conectar con Supabase",
    auth_signup_failed: "No se pudo crear la cuenta",
    auth_signin_failed: "No se pudo iniciar sesión",
    /* stalk */
    stalk_h1: "X Stalk",
    stalk_sub: "Escribe un usuario y XORA le echa un vistazo en silencio. Esto queda entre nosotros.",
    stalk_ph: "@esapersona",
    stalk_btn: "Analizar en Silencio",
    stalk_note: "Este análisis usa 5 Créditos de Curiosidad.",
    /* match */
    match_h1: "X Match",
    match_sub: "Pon dos cuentas frente a frente. XORA dice si hay química.",
    match_ph1: "@primera",
    match_ph2: "@segunda",
    match_btn: "Calcular la Compatibilidad",
    match_note: "Esta comparación usa 10 Créditos de Curiosidad.",
    /* sonuç ekranı */
    btn_download: "Descargar Tarjeta",
    btn_share: "Compartir en X",
    btn_again: "Probar de Nuevo",
    upsell_mirror: "Y ahora... ¿qué hay de esa persona? 👀",
    upsell_mirror_btn: "Mírala con X Stalk",
    says: "XORA dice",
    match_overall: "Compatibilidad General",
    fun_match_label: "COMPATIBILIDAD XORA FUN",
    ref_via: "vía {handle}",
    match_flirt: "Potencial de Coqueteo",
    match_vibe: "Sintonía",
    match_humor: "Humor en Común",
    match_chaos: "Riesgo de Caos",
    match_romance: "Compatibilidad Romántica",
    /* skorlar */
    sc_viral: "Potencial Viral",
    sc_kaos: "Nivel de Caos",
    sc_mizah: "Dosis de Humor",
    sc_gece: "Actividad Nocturna",
    /* profil */
    profile_h1: "Perfil",
    profile_balance: "Créditos de Curiosidad",
    profile_last: "Tu Última Tarjeta",
    profile_history: "Análisis Anteriores",
    profile_logout: "Cerrar Sesión",
    profile_nouser: "Inicia sesión para continuar.",
    profile_gomirror: "Iniciar Sesión",
    profile_empty: "Todavía no tienes tu tarjeta de identidad de X.",
    profile_empty_sub: "Empieza tu primer análisis.",
    profile_actions: "Iniciar Análisis",
    logout_confirm: "¿Cerrar sesión?",
    logout_done: "Sesión cerrada",
    /* krediler */
    credits_h1: "Créditos de Curiosidad",
    credits_sub: "Fun es gratis. Real usa créditos porque de verdad lee datos de X.",
    credits_balance: "Tu saldo",
    credits_buy: "Comprar",
    credits_note: "Los pagos se conectarán a través de iyzico. Los botones de compra están desactivados en esta versión.",
    trait_humor: "Humor",
    trait_reply: "Respuestas",
    trait_timeline: "Modo timeline",
    trait_humor_dry: "Seco",
    trait_humor_playful: "Juguetón",
    trait_humor_deadpan: "Impasible",
    trait_humor_ironic: "Irónico",
    trait_humor_warm: "Cálido",
    trait_humor_witty: "Ingenioso",
    trait_reply_curious: "Curioso",
    trait_reply_measured: "Mesurado",
    trait_reply_quick: "Rápido",
    trait_reply_supportive: "Solidario",
    trait_reply_teasing: "Bromista",
    trait_reply_selective: "Selectivo",
    trait_timeline_opens_topics: "Abre temas",
    trait_timeline_goes_deep: "Va a fondo",
    trait_timeline_calms_threads: "Calma los ánimos",
    trait_timeline_reads_first: "Primero lee",
    trait_timeline_gets_everyone_in: "Suma a todos",
    trait_timeline_tells_stories: "Cuenta historias",
    trait_timeline_drops_one_liners: "Cierra con una frase",
    real_metrics_title: "Comportamiento en X",
    real_m_reply: "Tasa de respuestas",
    real_m_original: "Posts originales",
    real_m_repost: "Tasa de reposts",
    real_m_question: "Posts con preguntas",
    real_m_emoji: "Emojis por post",
    real_m_length: "Longitud media",
    real_m_chars: "{n} caracteres",
    pricing_launch: "OFERTA DE LANZAMIENTO · {pct} DE DESCUENTO",
    pkg_starter: "INICIAL",
    pkg_popular: "MÁS POPULAR",
    pkg_value: "AHORRO",
    pkg_pro: "PROFESIONAL",
    pkg_pro_note: "Creadores y agencias",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Precio normal",
    toast_loaded: "créditos añadidos ⚡",
    payment_soon: "Conectaremos iyzico en el siguiente paso.",
    real_err_credit: "No tienes créditos suficientes para este análisis.",
    real_err_protected: "Esa cuenta es privada. Hasta XORA tiene límites.",
    real_err_not_found: "No encontré esa cuenta de X.",
    real_err_posts: "No hay publicaciones suficientes para un análisis real.",
    real_err_rate: "X está de mal humor ahora mismo. Inténtalo de nuevo en un rato.",
    real_err_auth: "Inicia sesión en tu cuenta de XORA para el análisis Real.",
    real_err_unavailable: "El análisis no pudo completarse. Revisa tu saldo y tu historial antes de reintentar.",
    real_err_refund: "Reembolso en proceso. Tu ID de solicitud se conserva; vuelve a comprobarlo más tarde.",
    real_coming_soon: "El análisis real llegará pronto",
    rarity_common: "COMÚN",
    rarity_rare: "RARA",
    rarity_epic: "ÉPICA",
    rarity_legendary: "LEGENDARIA",
    /* hatalar / bildirimler */
    toast_handle: "Primero escribe un nombre de usuario",
    toast_two: "Hacen falta los dos nombres de usuario",
    toast_same: "Escribe dos cuentas diferentes 🙂",
    toast_nocredit: "No tienes créditos suficientes, te redirijo…",
    toast_saved: "Tarjeta descargada",
    cost_info: "créditos usados",
    date_today: "hoy",
    mirror_cooldown: "Tu tarjeta de identidad de X sigue vigente. Vuelve en {days} días para una nueva.",
    view_card: "Ver Tarjeta",
    close: "Cerrar",
    history_select: "Seleccionar",
    history_cancel: "Cancelar",
    history_delete: "Eliminar Seleccionados",
    history_none_selected: "Selecciona los análisis que quieres eliminar.",
    history_deleted: "Los análisis seleccionados se eliminaron de tu historial.",
    history_not_found: "No se encontraron registros para eliminar.",
    profile_card_expired: "Tu tarjeta Mirror ha caducado.",
    profile_card_renew: "Saca un nuevo Mirror",
    card_load_failed: "No se pudo cargar la tarjeta"
  },
  pt: {
    nav_profile: "Perfil",
    nav_login: "Entrar",
    /* ana sayfa */
    home_hi: "Oi, eu sou a XORA.",
    home_sub: "Venha pela brincadeira, fique pela análise real. A XORA fala demais nos dois casos.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Descubra seu personagem no X. Olhe no espelho.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analise aquela conta que te deixa curioso. A gente não conta pra ninguém.",
    card_match_t: "X Match",
    card_match_d: "Compare duas contas. Almas gêmeas ou desastre?",
    badge_free: "Grátis",
    tier_fun: "Cartão Fun",
    tier_real: "Análise Real",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Grátis · não lê dados do X",
    tier_real_note: "Baseado em dados do X · usa créditos",
    home_diff_h: "Existem duas XORA. As duas igualmente curiosas.",
    home_fun_h: "XORA Fun",
    home_fun_d: "É grátis. Não lê seus dados do X; cria um cartão de entretenimento na hora. Pode tirar outro quantas vezes quiser.",
    home_real_h: "XORA Real",
    home_real_d: "Analisa dados reais do X. A API do X e a análise também custam dinheiro para nós, por isso o Real usa créditos.",
    home_real_joke: "Mesmo assim, não somos capitalistas a ponto de tirar a sua diversão.",
    badge_c5: "5 Créditos",
    badge_c10: "10 Créditos",
    /* mirror */
    mirror_h1: "X Mirror",
    mirror_sub: "Digite seu usuário do X para ver seu personagem no X.",
    mirror_ph: "@seuusuario",
    mirror_btn: "Olhar no Espelho",
    fun_btn: "Tirar Cartão Grátis",
    real_btn_5: "Análise Real · 5 Créditos",
    real_btn_10: "Análise Real · 10 Créditos",
    reroll_btn: "Tirar Outro",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Este cartão é baseado em dados reais do X. Usa créditos por causa do custo da API e da análise.",
    fun_explainer: "Este cartão é de entretenimento; não analisa dados do X.",
    mirror_connect_cta: "Conecte sua conta do X e analise",
    mirror_login_note: "O Mirror exige conectar sua conta do X.",
    mirror_profile_h: "Complete seu Perfil",
    mirror_profile_sub: "Revise seus dados antes de criar seu cartão.",
    mirror_display_name: "Nome de exibição",
    mirror_country: "País",
    mirror_city: "Cidade",
    mirror_bio: "Bio curta",
    mirror_website: "Site",
    mirror_avatar_url: "URL da foto de perfil",
    mirror_save: "Salvar",
    mirror_skip: "Pular por enquanto",
    auth_title: "Entre na XORA",
    auth_sub: "Entre na sua conta XORA para salvar suas análises.",
    auth_login_tab: "Entrar",
    auth_signup_tab: "Criar Conta",
    auth_email: "E-mail",
    auth_username: "Nome de usuário",
    auth_password: "Senha",
    auth_password_confirm: "Repita a senha",
    auth_login_btn: "Entrar",
    auth_signup_btn: "Criar Conta",
    auth_have_account: "Já tem conta? Entre.",
    auth_need_account: "Não tem conta? Cadastre-se.",
    auth_success: "Login feito",
    auth_signup_check_email: "Conta criada. Se for preciso confirmar o e-mail, confira sua caixa de entrada.",
    auth_username_required: "O nome de usuário é obrigatório.",
    auth_email_required: "O e-mail é obrigatório.",
    auth_password_required: "A senha é obrigatória.",
    auth_password_min: "A senha precisa ter pelo menos 6 caracteres.",
    auth_password_mismatch: "As senhas não coincidem.",
    auth_config_missing: "A configuração de acesso está incompleta.",
    auth_connection_failed: "Não foi possível conectar ao Supabase",
    auth_signup_failed: "Não foi possível criar a conta",
    auth_signin_failed: "Não foi possível entrar",
    /* stalk */
    stalk_h1: "X Stalk",
    stalk_sub: "Digite um usuário e a XORA dá uma olhada discreta. Isso fica só entre nós.",
    stalk_ph: "@essapessoa",
    stalk_btn: "Analisar em Silêncio",
    stalk_note: "Esta análise usa 5 Créditos de Curiosidade.",
    /* match */
    match_h1: "X Match",
    match_sub: "Coloque duas contas lado a lado. A XORA diz se rola química.",
    match_ph1: "@primeira",
    match_ph2: "@segunda",
    match_btn: "Calcular a Compatibilidade",
    match_note: "Esta comparação usa 10 Créditos de Curiosidade.",
    /* sonuç ekranı */
    btn_download: "Baixar Cartão",
    btn_share: "Compartilhar no X",
    btn_again: "Tentar de Novo",
    upsell_mirror: "E agora... e aquela pessoa? 👀",
    upsell_mirror_btn: "Veja com o X Stalk",
    says: "A XORA diz",
    match_overall: "Compatibilidade Geral",
    fun_match_label: "COMPATIBILIDADE XORA FUN",
    ref_via: "via {handle}",
    match_flirt: "Potencial de Flerte",
    match_vibe: "Sintonia",
    match_humor: "Humor em Comum",
    match_chaos: "Risco de Caos",
    match_romance: "Compatibilidade Romântica",
    /* skorlar */
    sc_viral: "Potencial Viral",
    sc_kaos: "Nível de Caos",
    sc_mizah: "Dose de Humor",
    sc_gece: "Atividade Noturna",
    /* profil */
    profile_h1: "Perfil",
    profile_balance: "Créditos de Curiosidade",
    profile_last: "Seu Último Cartão",
    profile_history: "Análises Anteriores",
    profile_logout: "Sair",
    profile_nouser: "Entre para continuar.",
    profile_gomirror: "Entrar",
    profile_empty: "Você ainda não tem seu cartão de identidade do X.",
    profile_empty_sub: "Comece sua primeira análise.",
    profile_actions: "Iniciar Análise",
    logout_confirm: "Sair da conta?",
    logout_done: "Você saiu da conta",
    /* krediler */
    credits_h1: "Créditos de Curiosidade",
    credits_sub: "O Fun é grátis. O Real usa créditos porque lê de verdade os dados do X.",
    credits_balance: "Seu saldo",
    credits_buy: "Comprar",
    credits_note: "Os pagamentos serão conectados pelo iyzico. Os botões de compra estão desativados nesta versão.",
    trait_humor: "Humor",
    trait_reply: "Respostas",
    trait_timeline: "Modo timeline",
    trait_humor_dry: "Seco",
    trait_humor_playful: "Brincalhão",
    trait_humor_deadpan: "Cara séria",
    trait_humor_ironic: "Irônico",
    trait_humor_warm: "Caloroso",
    trait_humor_witty: "Espirituoso",
    trait_reply_curious: "Curioso",
    trait_reply_measured: "Ponderado",
    trait_reply_quick: "Rápido",
    trait_reply_supportive: "Apoiador",
    trait_reply_teasing: "Provocador",
    trait_reply_selective: "Seletivo",
    trait_timeline_opens_topics: "Puxa assunto",
    trait_timeline_goes_deep: "Vai fundo",
    trait_timeline_calms_threads: "Acalma a conversa",
    trait_timeline_reads_first: "Lê antes",
    trait_timeline_gets_everyone_in: "Chama todo mundo",
    trait_timeline_tells_stories: "Conta histórias",
    trait_timeline_drops_one_liners: "Fecha com uma frase",
    real_metrics_title: "Comportamento no X",
    real_m_reply: "Taxa de respostas",
    real_m_original: "Posts originais",
    real_m_repost: "Taxa de reposts",
    real_m_question: "Posts com perguntas",
    real_m_emoji: "Emojis por post",
    real_m_length: "Tamanho médio",
    real_m_chars: "{n} caracteres",
    pricing_launch: "OFERTA DE LANÇAMENTO · {pct} OFF",
    pkg_starter: "INICIAL",
    pkg_popular: "MAIS POPULAR",
    pkg_value: "CUSTO-BENEFÍCIO",
    pkg_pro: "PROFISSIONAL",
    pkg_pro_note: "Criadores e agências",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Preço normal",
    toast_loaded: "créditos adicionados ⚡",
    payment_soon: "Vamos conectar o iyzico na próxima etapa.",
    real_err_credit: "Você não tem créditos suficientes para esta análise.",
    real_err_protected: "Essa conta é protegida. Até a XORA tem limites.",
    real_err_not_found: "Não encontrei essa conta do X.",
    real_err_posts: "Não há publicações suficientes para uma análise real.",
    real_err_rate: "O X está difícil agora. Tente de novo daqui a pouco.",
    real_err_auth: "Entre na sua conta XORA para fazer a análise Real.",
    real_err_unavailable: "Não foi possível concluir a análise. Confira seu saldo e seu histórico antes de tentar de novo.",
    real_err_refund: "Reembolso pendente. O ID da sua solicitação foi mantido; confira de novo mais tarde.",
    real_coming_soon: "A análise real chega em breve",
    rarity_common: "COMUM",
    rarity_rare: "RARO",
    rarity_epic: "ÉPICO",
    rarity_legendary: "LENDÁRIO",
    /* hatalar / bildirimler */
    toast_handle: "Primeiro digite um nome de usuário",
    toast_two: "Os dois nomes de usuário são obrigatórios",
    toast_same: "Digite duas contas diferentes 🙂",
    toast_nocredit: "Créditos insuficientes, redirecionando…",
    toast_saved: "Cartão baixado",
    cost_info: "créditos usados",
    date_today: "hoje",
    mirror_cooldown: "Seu cartão de identidade do X ainda está válido. Volte em {days} dias para um novo.",
    view_card: "Ver Cartão",
    close: "Fechar",
    history_select: "Selecionar",
    history_cancel: "Cancelar",
    history_delete: "Excluir Selecionados",
    history_none_selected: "Selecione as análises que deseja excluir.",
    history_deleted: "As análises selecionadas foram removidas do seu histórico.",
    history_not_found: "Nenhum registro encontrado para excluir.",
    profile_card_expired: "Seu cartão Mirror expirou.",
    profile_card_renew: "Tire um novo Mirror",
    card_load_failed: "Não foi possível carregar o cartão"
  },
  ar: {
    nav_profile: "الملف الشخصي",
    nav_login: "تسجيل الدخول",
    home_hi: "مرحبًا، أنا XORA.",
    home_sub: "تعال من أجل المرح وابقَ من أجل التحليل الحقيقي. XORA تتكلم كثيرًا في الحالتين.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "اكتشف شخصيتك على X. انظر في المرآة.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "حلل الحساب الذي يثير فضولك. لن نخبر أحدًا.",
    card_match_t: "X Match",
    card_match_d: "قارن بين حسابين. توأم روح أم كارثة؟",
    badge_free: "مجانًا",
    tier_fun: "بطاقة Fun",
    tier_real: "تحليل حقيقي",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "مجانًا · لا يقرأ بيانات X",
    tier_real_note: "يعتمد على بيانات X · يستخدم الرصيد",
    home_diff_h: "هناك نسختان من XORA. وكلتاهما فضولية بالقدر نفسه.",
    home_fun_h: "XORA Fun",
    home_fun_d: "مجانية. لا تقرأ بياناتك على X، بل تنشئ بطاقة ترفيهية فورًا. يمكنك سحب بطاقة جديدة متى شئت.",
    home_real_h: "XORA Real",
    home_real_d: "تحلل بيانات حقيقية من X. واجهة X البرمجية والتحليل يكلفاننا أيضًا، لذلك يستخدم Real الرصيد.",
    home_real_joke: "ومع ذلك، لسنا رأسماليين إلى حد حرمانك من المرح.",
    badge_c5: "5 أرصدة",
    badge_c10: "10 أرصدة",
    mirror_h1: "X Mirror",
    mirror_sub: "اكتب اسم مستخدمك على X لترى شخصيتك على X.",
    mirror_ph: "@اسم_المستخدم",
    mirror_btn: "انظر في المرآة",
    fun_btn: "اسحب بطاقة مجانية",
    real_btn_5: "تحليل حقيقي · 5 أرصدة",
    real_btn_10: "تحليل حقيقي · 10 أرصدة",
    reroll_btn: "اسحب بطاقة أخرى",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "تعتمد هذه البطاقة على بيانات حقيقية من X. وتستخدم الرصيد بسبب تكلفة الواجهة البرمجية والتحليل.",
    fun_explainer: "هذه بطاقة ترفيهية؛ ولا تحلل بيانات X.",
    mirror_connect_cta: "اربط حسابك على X وحلله",
    mirror_login_note: "يتطلب Mirror ربط حسابك على X.",
    mirror_profile_h: "أكمل ملفك الشخصي",
    mirror_profile_sub: "راجع بياناتك قبل إنشاء بطاقتك.",
    mirror_display_name: "الاسم الظاهر",
    mirror_country: "الدولة",
    mirror_city: "المدينة",
    mirror_bio: "نبذة قصيرة",
    mirror_website: "الموقع الإلكتروني",
    mirror_avatar_url: "رابط صورة الملف الشخصي",
    mirror_save: "حفظ",
    mirror_skip: "تخطَّ الآن",
    auth_title: "سجل الدخول إلى XORA",
    auth_sub: "سجل الدخول إلى حسابك في XORA لحفظ تحليلاتك.",
    auth_login_tab: "تسجيل الدخول",
    auth_signup_tab: "إنشاء حساب",
    auth_email: "البريد الإلكتروني",
    auth_username: "اسم المستخدم",
    auth_password: "كلمة المرور",
    auth_password_confirm: "أعد كتابة كلمة المرور",
    auth_login_btn: "تسجيل الدخول",
    auth_signup_btn: "إنشاء حساب",
    auth_have_account: "لديك حساب؟ سجل الدخول.",
    auth_need_account: "ليس لديك حساب؟ أنشئ حسابًا.",
    auth_success: "تم تسجيل الدخول",
    auth_signup_check_email: "تم إنشاء الحساب. إذا كان تأكيد البريد مطلوبًا، فتحقق من صندوق الوارد.",
    auth_username_required: "اسم المستخدم مطلوب.",
    auth_email_required: "البريد الإلكتروني مطلوب.",
    auth_password_required: "كلمة المرور مطلوبة.",
    auth_password_min: "يجب ألا تقل كلمة المرور عن 6 أحرف.",
    auth_password_mismatch: "كلمتا المرور غير متطابقتين.",
    auth_config_missing: "إعدادات الدخول غير مكتملة.",
    auth_connection_failed: "تعذر الاتصال بـ Supabase",
    auth_signup_failed: "تعذر إنشاء الحساب",
    auth_signin_failed: "تعذر تسجيل الدخول",
    stalk_h1: "X Stalk",
    stalk_sub: "اكتب اسم مستخدم وستلقي XORA نظرة بهدوء. هذا يبقى بيننا.",
    stalk_ph: "@الحساب",
    stalk_btn: "حلل بهدوء",
    stalk_note: "يستخدم هذا التحليل 5 من أرصدة الفضول.",
    match_h1: "X Match",
    match_sub: "ضع حسابين جنبًا إلى جنب، وستخبرك XORA إن كان بينهما انسجام.",
    match_ph1: "@الحساب_الأول",
    match_ph2: "@الحساب_الثاني",
    match_btn: "احسب التوافق",
    match_note: "تستخدم هذه المقارنة 10 من أرصدة الفضول.",
    btn_download: "تنزيل البطاقة",
    btn_share: "شارك على X",
    btn_again: "حاول مجددًا",
    upsell_mirror: "والآن... ماذا عن ذلك الشخص؟ 👀",
    upsell_mirror_btn: "ألقِ نظرة عبر X Stalk",
    says: "XORA تقول",
    match_overall: "التوافق العام",
    fun_match_label: "توافق XORA FUN",
    ref_via: "عبر {handle}",
    match_flirt: "احتمال الإعجاب",
    match_vibe: "الانسجام",
    match_humor: "حس الدعابة المشترك",
    match_chaos: "خطر الفوضى",
    match_romance: "التوافق العاطفي",
    sc_viral: "قابلية الانتشار",
    sc_kaos: "مستوى الفوضى",
    sc_mizah: "جرعة الدعابة",
    sc_gece: "النشاط الليلي",
    profile_h1: "الملف الشخصي",
    profile_balance: "أرصدة الفضول",
    profile_last: "بطاقتك الأخيرة",
    profile_history: "التحليلات السابقة",
    profile_logout: "تسجيل الخروج",
    profile_nouser: "سجل الدخول للمتابعة.",
    profile_gomirror: "تسجيل الدخول",
    profile_empty: "لا تملك بطاقة هوية على X بعد.",
    profile_empty_sub: "ابدأ تحليلك الأول.",
    profile_actions: "ابدأ التحليل",
    logout_confirm: "هل تريد تسجيل الخروج؟",
    logout_done: "تم تسجيل الخروج",
    credits_h1: "أرصدة الفضول",
    credits_sub: "Fun مجاني. أما Real فيستخدم الرصيد لأنه يقرأ بيانات X فعلًا.",
    credits_balance: "رصيدك",
    credits_buy: "شراء",
    credits_note: "سيتم ربط الدفع عبر iyzico. أزرار الشراء معطلة في هذا الإصدار.",
    trait_humor: "الفكاهة",
    trait_reply: "طاقة الردود",
    trait_timeline: "نمط الخط الزمني",
    trait_humor_dry: "جافة",
    trait_humor_playful: "مرحة",
    trait_humor_deadpan: "بوجه جاد",
    trait_humor_ironic: "ساخرة",
    trait_humor_warm: "دافئة",
    trait_humor_witty: "حاضرة البديهة",
    trait_reply_curious: "فضولية",
    trait_reply_measured: "متزنة",
    trait_reply_quick: "سريعة",
    trait_reply_supportive: "داعمة",
    trait_reply_teasing: "مشاكسة",
    trait_reply_selective: "انتقائية",
    trait_timeline_opens_topics: "يفتح المواضيع",
    trait_timeline_goes_deep: "يتعمق",
    trait_timeline_calms_threads: "يهدّئ النقاش",
    trait_timeline_reads_first: "يقرأ أولًا",
    trait_timeline_gets_everyone_in: "يُشرك الجميع",
    trait_timeline_tells_stories: "يروي القصص",
    trait_timeline_drops_one_liners: "يختم بجملة واحدة",
    real_metrics_title: "السلوك على X",
    real_m_reply: "نسبة الردود",
    real_m_original: "منشورات أصلية",
    real_m_repost: "نسبة إعادة النشر",
    real_m_question: "منشورات فيها أسئلة",
    real_m_emoji: "رموز تعبيرية لكل منشور",
    real_m_length: "متوسط الطول",
    real_m_chars: "{n} حرف",
    pricing_launch: "عرض الإطلاق · خصم {pct}",
    pkg_starter: "المبتدئ",
    pkg_popular: "الأكثر شيوعًا",
    pkg_value: "الأفضل قيمة",
    pkg_pro: "احترافي",
    pkg_pro_note: "لصنّاع المحتوى والوكالات",
    pkg_capacity: "تحليلات Mirror/Stalk: {ms} • Match: {mt}",
    pkg_regular: "السعر العادي",
    toast_loaded: "تمت إضافة الرصيد ⚡",
    payment_soon: "سنربط iyzico في الخطوة التالية.",
    real_err_credit: "رصيدك لا يكفي لهذا التحليل.",
    real_err_protected: "هذا الحساب محمي. حتى XORA لها حدود.",
    real_err_not_found: "لم أجد هذا الحساب على X.",
    real_err_posts: "لا توجد منشورات كافية لتحليل حقيقي.",
    real_err_rate: "X مزدحمة الآن. حاول مجددًا بعد قليل.",
    real_err_auth: "سجل الدخول إلى حسابك في XORA لإجراء التحليل الحقيقي.",
    real_err_unavailable: "تعذر إكمال التحليل. تحقق من رصيدك وسجلك قبل إعادة المحاولة.",
    real_err_refund: "الاسترداد قيد المعالجة. تم الاحتفاظ بمعرف طلبك؛ تحقق مرة أخرى لاحقًا.",
    real_coming_soon: "التحليل الحقيقي قادم قريبًا",
    rarity_common: "عادية",
    rarity_rare: "نادرة",
    rarity_epic: "ملحمية",
    rarity_legendary: "أسطورية",
    toast_handle: "اكتب اسم مستخدم أولًا",
    toast_two: "اسما المستخدمين مطلوبان",
    toast_same: "اكتب حسابين مختلفين 🙂",
    toast_nocredit: "الرصيد غير كافٍ، جارٍ تحويلك…",
    toast_saved: "تم تنزيل البطاقة",
    cost_info: "رصيد مستخدم",
    date_today: "اليوم",
    mirror_cooldown: "بطاقة هويتك على X ما زالت سارية. عد بعد {days} يومًا للحصول على بطاقة جديدة.",
    view_card: "عرض البطاقة",
    close: "إغلاق",
    history_select: "تحديد",
    history_cancel: "إلغاء",
    history_delete: "حذف المحدد",
    history_none_selected: "حدد التحليلات التي تريد حذفها.",
    history_deleted: "تمت إزالة التحليلات المحددة من سجلك.",
    history_not_found: "لا توجد سجلات للحذف.",
    profile_card_expired: "انتهت صلاحية بطاقة Mirror الخاصة بك.",
    profile_card_renew: "اسحب Mirror جديدة",
    card_load_failed: "تعذر تحميل البطاقة"
  },
  fr: {
    nav_profile: "Profil",
    nav_login: "Se connecter",
    home_hi: "Salut, moi c'est XORA.",
    home_sub: "Viens pour rire, reste pour la vraie analyse. XORA parle trop dans les deux cas.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Découvre ton personnage sur X. Regarde-toi dans le miroir.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analyse le compte qui t'intrigue. On ne le dira à personne.",
    card_match_t: "X Match",
    card_match_d: "Compare deux comptes. Âmes sœurs ou catastrophe\u00a0?",
    badge_free: "Gratuit",
    tier_fun: "Carte Fun",
    tier_real: "Analyse réelle",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Gratuit · ne lit pas les données X",
    tier_real_note: "Basé sur les données X · utilise des crédits",
    home_diff_h: "Il y a deux XORA. Aussi curieuses l'une que l'autre.",
    home_fun_h: "XORA Fun",
    home_fun_d: "Gratuit. Ne lit pas tes données X\u00a0; crée une carte de divertissement en un instant. Tu peux en tirer une autre autant de fois que tu veux.",
    home_real_h: "XORA Real",
    home_real_d: "Analyse de vraies données X. L'API X et l'analyse nous coûtent aussi de l'argent, c'est pourquoi Real utilise des crédits.",
    home_real_joke: "Mais on n'est pas assez capitalistes pour te priver du plaisir.",
    badge_c5: "5 crédits",
    badge_c10: "10 crédits",
    mirror_h1: "X Mirror",
    mirror_sub: "Entre ton nom d'utilisateur X pour découvrir ton personnage sur X.",
    mirror_ph: "@tonpseudo",
    mirror_btn: "Se regarder dans le miroir",
    fun_btn: "Tirer une carte gratuite",
    real_btn_5: "Analyse réelle · 5 crédits",
    real_btn_10: "Analyse réelle · 10 crédits",
    reroll_btn: "En tirer une autre",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Cette carte repose sur de vraies données X. Elle utilise des crédits à cause du coût de l'API et de l'analyse.",
    fun_explainer: "Cette carte est un divertissement\u00a0; elle n'analyse pas les données X.",
    mirror_connect_cta: "Connecte ton compte X et lance l'analyse",
    mirror_login_note: "Mirror nécessite de connecter ton compte X.",
    mirror_profile_h: "Complète ton profil",
    mirror_profile_sub: "Vérifie tes informations avant de créer ta carte.",
    mirror_display_name: "Nom affiché",
    mirror_country: "Pays",
    mirror_city: "Ville",
    mirror_bio: "Courte bio",
    mirror_website: "Site web",
    mirror_avatar_url: "URL de la photo de profil",
    mirror_save: "Enregistrer",
    mirror_skip: "Passer pour l'instant",
    auth_title: "Connexion à XORA",
    auth_sub: "Connecte-toi à ton compte XORA pour enregistrer tes analyses.",
    auth_login_tab: "Se connecter",
    auth_signup_tab: "Créer un compte",
    auth_email: "E-mail",
    auth_username: "Nom d'utilisateur",
    auth_password: "Mot de passe",
    auth_password_confirm: "Confirme le mot de passe",
    auth_login_btn: "Se connecter",
    auth_signup_btn: "Créer un compte",
    auth_have_account: "Déjà un compte\u00a0? Connecte-toi.",
    auth_need_account: "Pas encore de compte\u00a0? Inscris-toi.",
    auth_success: "Connexion réussie",
    auth_signup_check_email: "Compte créé. Si une confirmation par e-mail est nécessaire, vérifie ta boîte de réception.",
    auth_username_required: "Le nom d'utilisateur est obligatoire.",
    auth_email_required: "L'e-mail est obligatoire.",
    auth_password_required: "Le mot de passe est obligatoire.",
    auth_password_min: "Le mot de passe doit contenir au moins 6 caractères.",
    auth_password_mismatch: "Les mots de passe ne correspondent pas.",
    auth_config_missing: "La configuration de connexion est incomplète.",
    auth_connection_failed: "Impossible de se connecter à Supabase",
    auth_signup_failed: "Impossible de créer le compte",
    auth_signin_failed: "Impossible de se connecter",
    stalk_h1: "X Stalk",
    stalk_sub: "Entre un nom d'utilisateur et XORA jette un coup d'œil discret. Ça reste entre nous.",
    stalk_ph: "@cettepersonne",
    stalk_btn: "Analyser discrètement",
    stalk_note: "Cette analyse utilise 5 crédits de curiosité.",
    match_h1: "X Match",
    match_sub: "Mets deux comptes côte à côte. XORA te dit s'il y a une alchimie.",
    match_ph1: "@premier",
    match_ph2: "@second",
    match_btn: "Calculer la compatibilité",
    match_note: "Cette comparaison utilise 10 crédits de curiosité.",
    btn_download: "Télécharger la carte",
    btn_share: "Partager sur X",
    btn_again: "Réessayer",
    upsell_mirror: "Et maintenant… cette personne-là\u00a0? 👀",
    upsell_mirror_btn: "Jette un œil avec X Stalk",
    says: "XORA dit",
    match_overall: "Compatibilité globale",
    fun_match_label: "COMPATIBILITÉ XORA FUN",
    ref_via: "via {handle}",
    match_flirt: "Potentiel de flirt",
    match_vibe: "Complicité",
    match_humor: "Humour en commun",
    match_chaos: "Risque de chaos",
    match_romance: "Compatibilité amoureuse",
    sc_viral: "Potentiel viral",
    sc_kaos: "Niveau de chaos",
    sc_mizah: "Dose d'humour",
    sc_gece: "Activité nocturne",
    profile_h1: "Profil",
    profile_balance: "Crédits de curiosité",
    profile_last: "Ta dernière carte",
    profile_history: "Analyses précédentes",
    profile_logout: "Se déconnecter",
    profile_nouser: "Connecte-toi pour continuer.",
    profile_gomirror: "Se connecter",
    profile_empty: "Tu n'as pas encore de carte d'identité X.",
    profile_empty_sub: "Lance ta première analyse.",
    profile_actions: "Lancer une analyse",
    logout_confirm: "Se déconnecter\u00a0?",
    logout_done: "Déconnexion réussie",
    credits_h1: "Crédits de curiosité",
    credits_sub: "Fun est gratuit. Real utilise des crédits parce qu'il lit vraiment les données X.",
    credits_balance: "Ton solde",
    credits_buy: "Acheter",
    credits_note: "Les paiements seront connectés via iyzico. Les boutons d'achat sont désactivés dans cette version.",
    trait_humor: "Humour",
    trait_reply: "Réponses",
    trait_timeline: "Mode timeline",
    trait_humor_dry: "Sec",
    trait_humor_playful: "Joueur",
    trait_humor_deadpan: "Pince-sans-rire",
    trait_humor_ironic: "Ironique",
    trait_humor_warm: "Chaleureux",
    trait_humor_witty: "Vif d'esprit",
    trait_reply_curious: "Curieux",
    trait_reply_measured: "Mesuré",
    trait_reply_quick: "Rapide",
    trait_reply_supportive: "Bienveillant",
    trait_reply_teasing: "Taquin",
    trait_reply_selective: "Sélectif",
    trait_timeline_opens_topics: "Lance les sujets",
    trait_timeline_goes_deep: "Creuse",
    trait_timeline_calms_threads: "Apaise les échanges",
    trait_timeline_reads_first: "Lit d'abord",
    trait_timeline_gets_everyone_in: "Rassemble tout le monde",
    trait_timeline_tells_stories: "Raconte des histoires",
    trait_timeline_drops_one_liners: "Conclut en une phrase",
    real_metrics_title: "Comportement sur X",
    real_m_reply: "Taux de réponses",
    real_m_original: "Posts originaux",
    real_m_repost: "Taux de reposts",
    real_m_question: "Posts avec questions",
    real_m_emoji: "Émojis par post",
    real_m_length: "Longueur moyenne",
    real_m_chars: "{n} caractères",
    pricing_launch: "OFFRE DE LANCEMENT · {pct} DE RÉDUCTION",
    pkg_starter: "DÉCOUVERTE",
    pkg_popular: "LE PLUS POPULAIRE",
    pkg_value: "AVANTAGEUX",
    pkg_pro: "PROFESSIONNEL",
    pkg_pro_note: "Créateurs et agences",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Prix normal",
    toast_loaded: "crédits ajoutés ⚡",
    payment_soon: "On connecte iyzico à la prochaine étape.",
    real_err_credit: "Tu n'as pas assez de crédits pour cette analyse.",
    real_err_protected: "Ce compte est protégé. Même XORA a des limites.",
    real_err_not_found: "Je n'ai pas trouvé ce compte X.",
    real_err_posts: "Il n'y a pas assez de publications pour une analyse réelle.",
    real_err_rate: "X fait des siennes en ce moment. Réessaie dans un instant.",
    real_err_auth: "Connecte-toi à ton compte XORA pour l'analyse réelle.",
    real_err_unavailable: "L'analyse n'a pas pu aboutir. Vérifie ton solde et ton historique avant de réessayer.",
    real_err_refund: "Remboursement en attente. L'identifiant de ta demande est conservé\u00a0; vérifie à nouveau plus tard.",
    real_coming_soon: "L'analyse réelle arrive bientôt",
    rarity_common: "COMMUNE",
    rarity_rare: "RARE",
    rarity_epic: "ÉPIQUE",
    rarity_legendary: "LÉGENDAIRE",
    toast_handle: "Entre d'abord un nom d'utilisateur",
    toast_two: "Les deux noms d'utilisateur sont requis",
    toast_same: "Entre deux comptes différents 🙂",
    toast_nocredit: "Crédits insuffisants, redirection…",
    toast_saved: "Carte téléchargée",
    cost_info: "crédits utilisés",
    date_today: "aujourd'hui",
    mirror_cooldown: "Ta carte d'identité X est encore valable. Reviens dans {days} jours pour en obtenir une nouvelle.",
    view_card: "Voir la carte",
    close: "Fermer",
    history_select: "Sélectionner",
    history_cancel: "Annuler",
    history_delete: "Supprimer la sélection",
    history_none_selected: "Sélectionne les analyses à supprimer.",
    history_deleted: "Les analyses sélectionnées ont été retirées de ton historique.",
    history_not_found: "Aucun enregistrement à supprimer.",
    profile_card_expired: "Ta carte Mirror a expiré.",
    profile_card_renew: "Tirer un nouveau Mirror",
    card_load_failed: "Impossible de charger la carte"
  },
  de: {
    nav_profile: "Profil",
    nav_login: "Anmelden",
    home_hi: "Hallo, ich bin XORA.",
    home_sub: "Komm wegen des Spaßes, bleib für die echte Analyse. XORA redet so oder so zu viel.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Entdecke deine X-Persönlichkeit. Schau in den Spiegel.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analysiere das Konto, das dich neugierig macht. Wir verraten es niemandem.",
    card_match_t: "X Match",
    card_match_d: "Vergleiche zwei Konten. Seelenverwandt oder Katastrophe?",
    badge_free: "Kostenlos",
    tier_fun: "Fun-Karte",
    tier_real: "Echte Analyse",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Kostenlos · liest keine X-Daten",
    tier_real_note: "Basiert auf X-Daten · kostet Punkte",
    home_diff_h: "Es gibt zwei XORAs. Beide gleich neugierig.",
    home_fun_h: "XORA Fun",
    home_fun_d: "Kostenlos. Liest deine X-Daten nicht, sondern erstellt sofort eine Unterhaltungskarte. Du kannst so oft neu ziehen, wie du willst.",
    home_real_h: "XORA Real",
    home_real_d: "Analysiert echte X-Daten. Die X-Schnittstelle und die Analyse kosten auch uns Geld, deshalb nutzt Real Punkte.",
    home_real_joke: "Trotzdem sind wir nicht kapitalistisch genug, um dir den Spaß zu nehmen.",
    badge_c5: "5 Punkte",
    badge_c10: "10 Punkte",
    mirror_h1: "X Mirror",
    mirror_sub: "Gib deinen X-Benutzernamen ein, um deine X-Persönlichkeit zu sehen.",
    mirror_ph: "@deinname",
    mirror_btn: "In den Spiegel schauen",
    fun_btn: "Kostenlose Karte ziehen",
    real_btn_5: "Echte Analyse · 5 Punkte",
    real_btn_10: "Echte Analyse · 10 Punkte",
    reroll_btn: "Neu ziehen",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Diese Karte basiert auf echten X-Daten. Wegen der Kosten für Schnittstelle und Analyse nutzt sie Punkte.",
    fun_explainer: "Diese Karte dient der Unterhaltung; sie analysiert keine X-Daten.",
    mirror_connect_cta: "X-Konto verbinden und analysieren",
    mirror_login_note: "Für Mirror musst du dein X-Konto verbinden.",
    mirror_profile_h: "Profil vervollständigen",
    mirror_profile_sub: "Prüfe deine Angaben, bevor du deine Karte erstellst.",
    mirror_display_name: "Anzeigename",
    mirror_country: "Land",
    mirror_city: "Stadt",
    mirror_bio: "Kurze Bio",
    mirror_website: "Webseite",
    mirror_avatar_url: "URL des Profilbilds",
    mirror_save: "Speichern",
    mirror_skip: "Vorerst überspringen",
    auth_title: "Bei XORA anmelden",
    auth_sub: "Melde dich bei deinem XORA-Konto an, um deine Analysen zu speichern.",
    auth_login_tab: "Anmelden",
    auth_signup_tab: "Registrieren",
    auth_email: "E-Mail",
    auth_username: "Benutzername",
    auth_password: "Passwort",
    auth_password_confirm: "Passwort wiederholen",
    auth_login_btn: "Anmelden",
    auth_signup_btn: "Registrieren",
    auth_have_account: "Schon ein Konto? Melde dich an.",
    auth_need_account: "Noch kein Konto? Registriere dich.",
    auth_success: "Angemeldet",
    auth_signup_check_email: "Konto erstellt. Falls eine Bestätigung per E-Mail nötig ist, schau in dein Postfach.",
    auth_username_required: "Der Benutzername ist erforderlich.",
    auth_email_required: "Die E-Mail-Adresse ist erforderlich.",
    auth_password_required: "Das Passwort ist erforderlich.",
    auth_password_min: "Das Passwort muss mindestens 6 Zeichen lang sein.",
    auth_password_mismatch: "Die Passwörter stimmen nicht überein.",
    auth_config_missing: "Die Anmeldeeinstellungen sind unvollständig.",
    auth_connection_failed: "Verbindung zu Supabase fehlgeschlagen",
    auth_signup_failed: "Konto konnte nicht erstellt werden",
    auth_signin_failed: "Anmeldung fehlgeschlagen",
    stalk_h1: "X Stalk",
    stalk_sub: "Gib einen Benutzernamen ein, und XORA schaut sich unauffällig um. Das bleibt unter uns.",
    stalk_ph: "@diesePerson",
    stalk_btn: "Unauffällig analysieren",
    stalk_note: "Diese Analyse kostet 5 Neugierpunkte.",
    match_h1: "X Match",
    match_sub: "Stell zwei Konten nebeneinander. XORA sagt dir, ob die Chemie stimmt.",
    match_ph1: "@erstes",
    match_ph2: "@zweites",
    match_btn: "Übereinstimmung berechnen",
    match_note: "Dieser Vergleich kostet 10 Neugierpunkte.",
    btn_download: "Karte herunterladen",
    btn_share: "Auf X teilen",
    btn_again: "Nochmal versuchen",
    upsell_mirror: "Und jetzt … was ist mit dieser Person? 👀",
    upsell_mirror_btn: "Mit X Stalk nachsehen",
    says: "XORA sagt",
    match_overall: "Gesamtübereinstimmung",
    fun_match_label: "XORA FUN ÜBEREINSTIMMUNG",
    ref_via: "über {handle}",
    match_flirt: "Flirtfaktor",
    match_vibe: "Wellenlänge",
    match_humor: "Gleicher Humor",
    match_chaos: "Chaosrisiko",
    match_romance: "Romantische Chemie",
    sc_viral: "Viralpotenzial",
    sc_kaos: "Chaosgrad",
    sc_mizah: "Humoranteil",
    sc_gece: "Nachtaktivität",
    profile_h1: "Profil",
    profile_balance: "Neugierpunkte",
    profile_last: "Deine letzte Karte",
    profile_history: "Frühere Analysen",
    profile_logout: "Abmelden",
    profile_nouser: "Melde dich an, um fortzufahren.",
    profile_gomirror: "Anmelden",
    profile_empty: "Du hast noch keine X-Identitätskarte.",
    profile_empty_sub: "Starte deine erste Analyse.",
    profile_actions: "Analyse starten",
    logout_confirm: "Abmelden?",
    logout_done: "Abgemeldet",
    credits_h1: "Neugierpunkte",
    credits_sub: "Fun ist kostenlos. Real nutzt Punkte, weil es wirklich X-Daten liest.",
    credits_balance: "Dein Guthaben",
    credits_buy: "Kaufen",
    credits_note: "Zahlungen werden über iyzico angebunden. Käufe sind in dieser Version noch deaktiviert.",
    trait_humor: "Humor",
    trait_reply: "Antworten",
    trait_timeline: "Timeline-Modus",
    trait_humor_dry: "Trocken",
    trait_humor_playful: "Verspielt",
    trait_humor_deadpan: "Todernst",
    trait_humor_ironic: "Ironisch",
    trait_humor_warm: "Herzlich",
    trait_humor_witty: "Schlagfertig",
    trait_reply_curious: "Neugierig",
    trait_reply_measured: "Besonnen",
    trait_reply_quick: "Schnell",
    trait_reply_supportive: "Unterstützend",
    trait_reply_teasing: "Neckisch",
    trait_reply_selective: "Wählerisch",
    trait_timeline_opens_topics: "Setzt Themen",
    trait_timeline_goes_deep: "Geht in die Tiefe",
    trait_timeline_calms_threads: "Beruhigt Threads",
    trait_timeline_reads_first: "Liest erst mit",
    trait_timeline_gets_everyone_in: "Holt alle rein",
    trait_timeline_tells_stories: "Erzählt Geschichten",
    trait_timeline_drops_one_liners: "Beendet mit einem Satz",
    real_metrics_title: "Verhalten auf X",
    real_m_reply: "Antwortquote",
    real_m_original: "Eigene Posts",
    real_m_repost: "Repost-Quote",
    real_m_question: "Posts mit Fragen",
    real_m_emoji: "Emojis pro Post",
    real_m_length: "Ø Länge",
    real_m_chars: "{n} Zeichen",
    pricing_launch: "LAUNCH-ANGEBOT · {pct} RABATT",
    pkg_starter: "STARTER",
    pkg_popular: "AM BELIEBTESTEN",
    pkg_value: "SPARPAKET",
    pkg_pro: "PROFI",
    pkg_pro_note: "Creator & Agenturen",
    pkg_capacity: "{ms}× Mirror/Stalk • {mt}× Match",
    pkg_regular: "Regulärer Preis",
    toast_loaded: "Punkte hinzugefügt ⚡",
    payment_soon: "Im nächsten Schritt binden wir iyzico an.",
    real_err_credit: "Du hast nicht genug Punkte für diese Analyse.",
    real_err_protected: "Dieses Konto ist geschützt. Auch XORA hat Grenzen.",
    real_err_not_found: "Ich konnte dieses X-Konto nicht finden.",
    real_err_posts: "Für eine echte Analyse gibt es nicht genug Beiträge.",
    real_err_rate: "X ist gerade überlastet. Versuch es gleich noch einmal.",
    real_err_auth: "Melde dich bei deinem XORA-Konto an, um die echte Analyse zu nutzen.",
    real_err_unavailable: "Die Analyse konnte nicht abgeschlossen werden. Prüfe dein Guthaben und deinen Verlauf, bevor du es erneut versuchst.",
    real_err_refund: "Rückerstattung ausstehend. Deine Anfrage-ID bleibt erhalten; schau später noch einmal nach.",
    real_coming_soon: "Die echte Analyse kommt bald",
    rarity_common: "GEWÖHNLICH",
    rarity_rare: "SELTEN",
    rarity_epic: "EPISCH",
    rarity_legendary: "LEGENDÄR",
    toast_handle: "Gib zuerst einen Benutzernamen ein",
    toast_two: "Beide Benutzernamen sind erforderlich",
    toast_same: "Gib zwei verschiedene Konten ein 🙂",
    toast_nocredit: "Nicht genug Punkte, du wirst weitergeleitet …",
    toast_saved: "Karte heruntergeladen",
    cost_info: "Punkte verbraucht",
    date_today: "heute",
    mirror_cooldown: "Deine X-Identitätskarte ist noch aktuell. Komm in {days} Tagen für eine neue wieder.",
    view_card: "Karte ansehen",
    close: "Schließen",
    history_select: "Auswählen",
    history_cancel: "Abbrechen",
    history_delete: "Auswahl löschen",
    history_none_selected: "Wähle die Analysen aus, die du löschen möchtest.",
    history_deleted: "Die ausgewählten Analysen wurden aus deinem Verlauf entfernt.",
    history_not_found: "Keine Einträge zum Löschen gefunden.",
    profile_card_expired: "Deine Mirror-Karte ist abgelaufen.",
    profile_card_renew: "Neue Mirror-Karte ziehen",
    card_load_failed: "Karte konnte nicht geladen werden"
  },
  it: {
    nav_profile: "Profilo",
    nav_login: "Accedi",
    home_hi: "Ciao, sono XORA.",
    home_sub: "Vieni per ridere, resta per l'analisi vera. XORA parla troppo in entrambi i casi.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Scopri il tuo personaggio su X. Guardati allo specchio.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analizza l'account che ti incuriosisce. Non lo diremo a nessuno.",
    card_match_t: "X Match",
    card_match_d: "Confronta due account. Anime gemelle o disastro?",
    badge_free: "Gratis",
    tier_fun: "Carta Fun",
    tier_real: "Analisi reale",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Gratis · non legge i dati di X",
    tier_real_note: "Basata sui dati di X · usa crediti",
    home_diff_h: "Esistono due XORA. Curiose allo stesso modo.",
    home_fun_h: "XORA Fun",
    home_fun_d: "È gratis. Non legge i tuoi dati di X: crea subito una carta di intrattenimento. Puoi pescarne un'altra tutte le volte che vuoi.",
    home_real_h: "XORA Real",
    home_real_d: "Analizza dati reali di X. L'API di X e l'analisi costano anche a noi, per questo Real usa crediti.",
    home_real_joke: "Ma non siamo così capitalisti da toglierti il divertimento.",
    badge_c5: "5 crediti",
    badge_c10: "10 crediti",
    mirror_h1: "X Mirror",
    mirror_sub: "Inserisci il tuo nome utente di X per scoprire il tuo personaggio su X.",
    mirror_ph: "@iltuonome",
    mirror_btn: "Guardati allo specchio",
    fun_btn: "Pesca una carta gratis",
    real_btn_5: "Analisi reale · 5 crediti",
    real_btn_10: "Analisi reale · 10 crediti",
    reroll_btn: "Pescane un'altra",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Questa carta si basa su dati reali di X. Usa crediti per il costo dell'API e dell'analisi.",
    fun_explainer: "Questa carta è solo intrattenimento; non analizza i dati di X.",
    mirror_connect_cta: "Collega il tuo account X e avvia l'analisi",
    mirror_login_note: "Per usare Mirror devi collegare il tuo account X.",
    mirror_profile_h: "Completa il tuo profilo",
    mirror_profile_sub: "Controlla i tuoi dati prima di creare la carta.",
    mirror_display_name: "Nome visualizzato",
    mirror_country: "Paese",
    mirror_city: "Città",
    mirror_bio: "Bio breve",
    mirror_website: "Sito web",
    mirror_avatar_url: "URL della foto profilo",
    mirror_save: "Salva",
    mirror_skip: "Salta per ora",
    auth_title: "Accedi a XORA",
    auth_sub: "Accedi al tuo account XORA per salvare le tue analisi.",
    auth_login_tab: "Accedi",
    auth_signup_tab: "Registrati",
    auth_email: "Email",
    auth_username: "Nome utente",
    auth_password: "Password",
    auth_password_confirm: "Ripeti la password",
    auth_login_btn: "Accedi",
    auth_signup_btn: "Registrati",
    auth_have_account: "Hai già un account? Accedi.",
    auth_need_account: "Non hai un account? Registrati.",
    auth_success: "Accesso effettuato",
    auth_signup_check_email: "Account creato. Se serve confermare l'email, controlla la tua casella di posta.",
    auth_username_required: "Il nome utente è obbligatorio.",
    auth_email_required: "L'email è obbligatoria.",
    auth_password_required: "La password è obbligatoria.",
    auth_password_min: "La password deve avere almeno 6 caratteri.",
    auth_password_mismatch: "Le password non coincidono.",
    auth_config_missing: "La configurazione di accesso è incompleta.",
    auth_connection_failed: "Impossibile connettersi a Supabase",
    auth_signup_failed: "Impossibile creare l'account",
    auth_signin_failed: "Accesso non riuscito",
    stalk_h1: "X Stalk",
    stalk_sub: "Scrivi un nome utente e XORA darà un'occhiata in silenzio. Resta tra noi.",
    stalk_ph: "@quellapersona",
    stalk_btn: "Analizza in silenzio",
    stalk_note: "Questa analisi usa 5 crediti curiosità.",
    match_h1: "X Match",
    match_sub: "Metti due account a confronto. XORA ti dice se c'è chimica.",
    match_ph1: "@primo",
    match_ph2: "@secondo",
    match_btn: "Calcola l'affinità",
    match_note: "Questo confronto usa 10 crediti curiosità.",
    btn_download: "Scarica la carta",
    btn_share: "Condividi su X",
    btn_again: "Riprova",
    upsell_mirror: "E adesso… che mi dici di quella persona? 👀",
    upsell_mirror_btn: "Guarda con X Stalk",
    says: "XORA dice",
    match_overall: "Affinità generale",
    fun_match_label: "AFFINITÀ XORA FUN",
    ref_via: "tramite {handle}",
    match_flirt: "Potenziale di flirt",
    match_vibe: "Sintonia",
    match_humor: "Stesso umorismo",
    match_chaos: "Rischio caos",
    match_romance: "Intesa romantica",
    sc_viral: "Potenziale virale",
    sc_kaos: "Livello di caos",
    sc_mizah: "Dose di umorismo",
    sc_gece: "Attività notturna",
    profile_h1: "Profilo",
    profile_balance: "Crediti curiosità",
    profile_last: "La tua ultima carta",
    profile_history: "Analisi precedenti",
    profile_logout: "Esci",
    profile_nouser: "Accedi per continuare.",
    profile_gomirror: "Accedi",
    profile_empty: "Non hai ancora una carta d'identità di X.",
    profile_empty_sub: "Avvia la tua prima analisi.",
    profile_actions: "Avvia un'analisi",
    logout_confirm: "Vuoi uscire?",
    logout_done: "Disconnessione effettuata",
    credits_h1: "Crediti curiosità",
    credits_sub: "Fun è gratis. Real usa crediti perché legge davvero i dati di X.",
    credits_balance: "Il tuo saldo",
    credits_buy: "Acquista",
    credits_note: "I pagamenti verranno collegati tramite iyzico. In questa versione i pulsanti di acquisto sono disattivati.",
    trait_humor: "Umorismo",
    trait_reply: "Risposte",
    trait_timeline: "Modalità timeline",
    trait_humor_dry: "Secco",
    trait_humor_playful: "Giocoso",
    trait_humor_deadpan: "Impassibile",
    trait_humor_ironic: "Ironico",
    trait_humor_warm: "Caloroso",
    trait_humor_witty: "Arguto",
    trait_reply_curious: "Curioso",
    trait_reply_measured: "Misurato",
    trait_reply_quick: "Veloce",
    trait_reply_supportive: "Solidale",
    trait_reply_teasing: "Stuzzicante",
    trait_reply_selective: "Selettivo",
    trait_timeline_opens_topics: "Apre argomenti",
    trait_timeline_goes_deep: "Va a fondo",
    trait_timeline_calms_threads: "Calma gli animi",
    trait_timeline_reads_first: "Prima legge",
    trait_timeline_gets_everyone_in: "Coinvolge tutti",
    trait_timeline_tells_stories: "Racconta storie",
    trait_timeline_drops_one_liners: "Chiude con una battuta",
    real_metrics_title: "Comportamento su X",
    real_m_reply: "Tasso di risposte",
    real_m_original: "Post originali",
    real_m_repost: "Tasso di repost",
    real_m_question: "Post con domande",
    real_m_emoji: "Emoji per post",
    real_m_length: "Lunghezza media",
    real_m_chars: "{n} caratteri",
    pricing_launch: "OFFERTA DI LANCIO · {pct} DI SCONTO",
    pkg_starter: "BASE",
    pkg_popular: "IL PIÙ SCELTO",
    pkg_value: "CONVENIENZA",
    pkg_pro: "PROFESSIONALE",
    pkg_pro_note: "Creator e agenzie",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Prezzo normale",
    toast_loaded: "crediti aggiunti ⚡",
    payment_soon: "Collegheremo iyzico nel prossimo passaggio.",
    real_err_credit: "Non hai abbastanza crediti per questa analisi.",
    real_err_protected: "Questo account è protetto. Anche XORA ha dei limiti.",
    real_err_not_found: "Non ho trovato questo account X.",
    real_err_posts: "Non ci sono abbastanza post per un'analisi reale.",
    real_err_rate: "X è sovraccarico in questo momento. Riprova tra poco.",
    real_err_auth: "Accedi al tuo account XORA per l'analisi reale.",
    real_err_unavailable: "Non è stato possibile completare l'analisi. Controlla saldo e cronologia prima di riprovare.",
    real_err_refund: "Rimborso in attesa. L'ID della tua richiesta è stato conservato; ricontrolla più tardi.",
    real_coming_soon: "L'analisi reale arriva presto",
    rarity_common: "COMUNE",
    rarity_rare: "RARA",
    rarity_epic: "EPICA",
    rarity_legendary: "LEGGENDARIA",
    toast_handle: "Prima scrivi un nome utente",
    toast_two: "Servono entrambi i nomi utente",
    toast_same: "Inserisci due account diversi 🙂",
    toast_nocredit: "Crediti insufficienti, ti reindirizzo…",
    toast_saved: "Carta scaricata",
    cost_info: "crediti usati",
    date_today: "oggi",
    mirror_cooldown: "La tua carta d'identità di X è ancora valida. Torna tra {days} giorni per averne una nuova.",
    view_card: "Vedi la carta",
    close: "Chiudi",
    history_select: "Seleziona",
    history_cancel: "Annulla",
    history_delete: "Elimina selezionati",
    history_none_selected: "Seleziona le analisi da eliminare.",
    history_deleted: "Le analisi selezionate sono state rimosse dalla cronologia.",
    history_not_found: "Nessun elemento da eliminare.",
    profile_card_expired: "La tua carta Mirror è scaduta.",
    profile_card_renew: "Pesca un nuovo Mirror",
    card_load_failed: "Impossibile caricare la carta"
  },
  ja: {
    nav_profile: "プロフィール",
    nav_login: "ログイン",
    home_hi: "こんにちは、XORAです。",
    home_sub: "気軽に楽しむもよし、本格的に分析するもよし。どちらでもXORAはよくしゃべります。",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Xでのあなたのキャラを見つけよう。鏡をのぞいてみて。",
    card_stalk_t: "X Stalk",
    card_stalk_d: "気になるアカウントを分析。誰にも言いません。",
    card_match_t: "X Match",
    card_match_d: "2つのアカウントを比べよう。運命の相手？それとも大惨事？",
    badge_free: "無料",
    tier_fun: "Funカード",
    tier_real: "本格分析",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "無料 · Xのデータは読みません",
    tier_real_note: "Xのデータに基づく · クレジットを使用",
    home_diff_h: "XORAは2種類。どちらも同じくらい好奇心旺盛です。",
    home_fun_h: "XORA Fun",
    home_fun_d: "無料です。Xのデータは読まず、エンタメ用のカードをすぐに作ります。何度でも引き直せます。",
    home_real_h: "XORA Real",
    home_real_d: "Xの実データを分析します。X APIと分析には私たちもコストがかかるため、Realはクレジットを使います。",
    home_real_joke: "それでも、あなたから楽しみを奪うほど商売っ気は強くありません。",
    badge_c5: "5クレジット",
    badge_c10: "10クレジット",
    mirror_h1: "X Mirror",
    mirror_sub: "Xのユーザー名を入力して、Xでのあなたのキャラを見てみよう。",
    mirror_ph: "@ユーザー名",
    mirror_btn: "鏡をのぞく",
    fun_btn: "無料カードを引く",
    real_btn_5: "本格分析 · 5クレジット",
    real_btn_10: "本格分析 · 10クレジット",
    reroll_btn: "もう一度引く",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "このカードはXの実データに基づいています。APIと分析のコストがかかるため、クレジットを使います。",
    fun_explainer: "このカードはエンタメ用です。Xのデータは分析しません。",
    mirror_connect_cta: "Xアカウントを連携して分析する",
    mirror_login_note: "MirrorにはXアカウントの連携が必要です。",
    mirror_profile_h: "プロフィールを完成させる",
    mirror_profile_sub: "カードを作る前に情報を確認してください。",
    mirror_display_name: "表示名",
    mirror_country: "国",
    mirror_city: "都市",
    mirror_bio: "ひとこと紹介",
    mirror_website: "ウェブサイト",
    mirror_avatar_url: "プロフィール画像のURL",
    mirror_save: "保存",
    mirror_skip: "今はスキップ",
    auth_title: "XORAにログイン",
    auth_sub: "分析結果を保存するには、XORAアカウントにログインしてください。",
    auth_login_tab: "ログイン",
    auth_signup_tab: "新規登録",
    auth_email: "メールアドレス",
    auth_username: "ユーザー名",
    auth_password: "パスワード",
    auth_password_confirm: "パスワード（確認）",
    auth_login_btn: "ログイン",
    auth_signup_btn: "新規登録",
    auth_have_account: "アカウントをお持ちの方はログイン",
    auth_need_account: "アカウントがない方は新規登録",
    auth_success: "ログインしました",
    auth_signup_check_email: "アカウントを作成しました。メール認証が必要な場合は受信トレイを確認してください。",
    auth_username_required: "ユーザー名を入力してください。",
    auth_email_required: "メールアドレスを入力してください。",
    auth_password_required: "パスワードを入力してください。",
    auth_password_min: "パスワードは6文字以上にしてください。",
    auth_password_mismatch: "パスワードが一致しません。",
    auth_config_missing: "ログイン設定が不足しています。",
    auth_connection_failed: "Supabaseに接続できませんでした",
    auth_signup_failed: "アカウントを作成できませんでした",
    auth_signin_failed: "ログインできませんでした",
    stalk_h1: "X Stalk",
    stalk_sub: "ユーザー名を入力すると、XORAがこっそりのぞきます。ここだけの話です。",
    stalk_ph: "@気になる人",
    stalk_btn: "こっそり分析する",
    stalk_note: "この分析には好奇心クレジットを5使います。",
    match_h1: "X Match",
    match_sub: "2つのアカウントを並べると、XORAが相性を教えます。",
    match_ph1: "@1人目",
    match_ph2: "@2人目",
    match_btn: "相性を計算する",
    match_note: "この比較には好奇心クレジットを10使います。",
    btn_download: "カードを保存",
    btn_share: "Xでシェア",
    btn_again: "もう一度試す",
    upsell_mirror: "じゃあ、あの人は？👀",
    upsell_mirror_btn: "X Stalkで見てみる",
    says: "XORAのひと言",
    match_overall: "総合相性",
    fun_match_label: "XORA FUN相性",
    ref_via: "{handle} さんの紹介",
    match_flirt: "恋の予感",
    match_vibe: "波長",
    match_humor: "笑いのツボ",
    match_chaos: "カオス度",
    match_romance: "ロマンス度",
    sc_viral: "拡散力",
    sc_kaos: "カオス度",
    sc_mizah: "ユーモア度",
    sc_gece: "夜ふかし度",
    profile_h1: "プロフィール",
    profile_balance: "好奇心クレジット",
    profile_last: "最新のカード",
    profile_history: "過去の分析",
    profile_logout: "ログアウト",
    profile_nouser: "続けるにはログインしてください。",
    profile_gomirror: "ログイン",
    profile_empty: "まだXのIDカードがありません。",
    profile_empty_sub: "最初の分析を始めましょう。",
    profile_actions: "分析を始める",
    logout_confirm: "ログアウトしますか？",
    logout_done: "ログアウトしました",
    credits_h1: "好奇心クレジット",
    credits_sub: "Funは無料。RealはXのデータを実際に読むため、クレジットを使います。",
    credits_balance: "残高",
    credits_buy: "購入",
    credits_note: "決済はiyzicoで連携予定です。このバージョンでは購入ボタンは無効です。",
    trait_humor: "ユーモア",
    trait_reply: "リプの温度",
    trait_timeline: "タイムラインでは",
    trait_humor_dry: "ドライ",
    trait_humor_playful: "遊び心",
    trait_humor_deadpan: "真顔",
    trait_humor_ironic: "皮肉まじり",
    trait_humor_warm: "あたたかい",
    trait_humor_witty: "切り返し上手",
    trait_reply_curious: "好奇心旺盛",
    trait_reply_measured: "落ち着いてる",
    trait_reply_quick: "反応が早い",
    trait_reply_supportive: "寄り添う",
    trait_reply_teasing: "ちょっかい好き",
    trait_reply_selective: "厳選派",
    trait_timeline_opens_topics: "話題をつくる",
    trait_timeline_goes_deep: "深掘りする",
    trait_timeline_calms_threads: "場をなごませる",
    trait_timeline_reads_first: "まず読む",
    trait_timeline_gets_everyone_in: "みんなを巻き込む",
    trait_timeline_tells_stories: "物語を語る",
    trait_timeline_drops_one_liners: "ひと言で締める",
    real_metrics_title: "Xでの行動",
    real_m_reply: "リプライ率",
    real_m_original: "オリジナル投稿",
    real_m_repost: "リポスト率",
    real_m_question: "質問を含む投稿",
    real_m_emoji: "投稿あたりの絵文字",
    real_m_length: "平均の長さ",
    real_m_chars: "{n}文字",
    pricing_launch: "ローンチ特価 · {pct}オフ",
    pkg_starter: "スターター",
    pkg_popular: "いちばん人気",
    pkg_value: "お得",
    pkg_pro: "プロ",
    pkg_pro_note: "クリエイター・代理店向け",
    pkg_capacity: "Mirror/Stalk {ms}回 • Match {mt}回",
    pkg_regular: "通常価格",
    toast_loaded: "クレジットを追加しました ⚡",
    payment_soon: "次のステップでiyzicoを連携します。",
    real_err_credit: "この分析に必要なクレジットが足りません。",
    real_err_protected: "このアカウントは非公開です。XORAにも越えられない線があります。",
    real_err_not_found: "そのXアカウントは見つかりませんでした。",
    real_err_posts: "本格分析に必要な投稿数が足りません。",
    real_err_rate: "Xが混み合っています。少し待ってからもう一度お試しください。",
    real_err_auth: "本格分析にはXORAアカウントへのログインが必要です。",
    real_err_unavailable: "分析を完了できませんでした。残高と履歴を確認してから再試行してください。",
    real_err_refund: "返金処理中です。リクエストIDは保存されています。しばらくしてから確認してください。",
    real_coming_soon: "本格分析はまもなく公開",
    rarity_common: "コモン",
    rarity_rare: "レア",
    rarity_epic: "エピック",
    rarity_legendary: "レジェンダリー",
    toast_handle: "まずユーザー名を入力してください",
    toast_two: "ユーザー名を2つ入力してください",
    toast_same: "別々のアカウントを入力してください 🙂",
    toast_nocredit: "クレジットが足りません。移動します…",
    toast_saved: "カードを保存しました",
    cost_info: "クレジット使用",
    date_today: "今日",
    mirror_cooldown: "XのIDカードはまだ有効です。新しいカードは{days}日後に作れます。",
    view_card: "カードを見る",
    close: "閉じる",
    history_select: "選択",
    history_cancel: "キャンセル",
    history_delete: "選択した項目を削除",
    history_none_selected: "削除する分析を選んでください。",
    history_deleted: "選択した分析を履歴から削除しました。",
    history_not_found: "削除する項目が見つかりません。",
    profile_card_expired: "Mirrorカードの有効期限が切れました。",
    profile_card_renew: "新しいMirrorを引く",
    card_load_failed: "カードを読み込めませんでした"
  },
  ko: {
    nav_profile: "프로필",
    nav_login: "로그인",
    home_hi: "안녕하세요, XORA예요.",
    home_sub: "가볍게 즐겨도 좋고 제대로 분석해도 좋아요. 어느 쪽이든 XORA는 할 말이 많습니다.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "X에서 당신이 어떤 사람인지 확인해 보세요. 거울을 들여다볼 시간입니다.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "궁금한 계정을 분석해 드려요. 아무한테도 말하지 않습니다.",
    card_match_t: "X Match",
    card_match_d: "두 계정을 나란히 놓아 보세요. 운명일까요, 대참사일까요?",
    badge_free: "무료",
    tier_fun: "펀 카드",
    tier_real: "정식 분석",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "무료 · X 데이터는 읽지 않아요",
    tier_real_note: "X 데이터 기반 · 크레딧 사용",
    home_diff_h: "XORA는 두 가지예요. 궁금한 게 많은 건 둘 다 똑같습니다.",
    home_fun_h: "XORA Fun",
    home_fun_d: "무료예요. X 데이터를 읽지 않고 재미로 보는 카드를 바로 만들어 드립니다. 몇 번이든 다시 뽑을 수 있어요.",
    home_real_h: "XORA Real",
    home_real_d: "X의 실제 데이터를 분석합니다. X API와 분석에는 저희도 비용이 들기 때문에 Real은 크레딧을 사용해요.",
    home_real_joke: "그렇다고 재미까지 빼앗을 만큼 장사꾼은 아닙니다.",
    badge_c5: "5 크레딧",
    badge_c10: "10 크레딧",
    mirror_h1: "X Mirror",
    mirror_sub: "X 아이디를 입력하고 X에서의 당신이 어떤 사람인지 확인해 보세요.",
    mirror_ph: "@아이디",
    mirror_btn: "거울 들여다보기",
    fun_btn: "무료 카드 뽑기",
    real_btn_5: "정식 분석 · 5 크레딧",
    real_btn_10: "정식 분석 · 10 크레딧",
    reroll_btn: "다시 뽑기",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "이 카드는 X의 실제 데이터를 바탕으로 합니다. API와 분석에 비용이 들기 때문에 크레딧을 사용해요.",
    fun_explainer: "이 카드는 재미로 보는 카드예요. X 데이터는 분석하지 않습니다.",
    mirror_connect_cta: "X 계정 연결하고 분석하기",
    mirror_login_note: "Mirror를 이용하려면 X 계정 연결이 필요해요.",
    mirror_profile_h: "프로필 완성하기",
    mirror_profile_sub: "카드를 만들기 전에 정보를 확인해 주세요.",
    mirror_display_name: "표시 이름",
    mirror_country: "국가",
    mirror_city: "도시",
    mirror_bio: "한 줄 소개",
    mirror_website: "웹사이트",
    mirror_avatar_url: "프로필 사진 URL",
    mirror_save: "저장",
    mirror_skip: "나중에 하기",
    auth_title: "XORA 로그인",
    auth_sub: "분석 결과를 저장하려면 XORA 계정으로 로그인하세요.",
    auth_login_tab: "로그인",
    auth_signup_tab: "회원가입",
    auth_email: "이메일",
    auth_username: "아이디",
    auth_password: "비밀번호",
    auth_password_confirm: "비밀번호 확인",
    auth_login_btn: "로그인",
    auth_signup_btn: "회원가입",
    auth_have_account: "이미 계정이 있다면 로그인",
    auth_need_account: "계정이 없다면 회원가입",
    auth_success: "로그인했어요",
    auth_signup_check_email: "계정을 만들었어요. 이메일 인증이 필요하면 받은편지함을 확인해 주세요.",
    auth_username_required: "아이디를 입력해 주세요.",
    auth_email_required: "이메일을 입력해 주세요.",
    auth_password_required: "비밀번호를 입력해 주세요.",
    auth_password_min: "비밀번호는 6자 이상이어야 해요.",
    auth_password_mismatch: "비밀번호가 일치하지 않아요.",
    auth_config_missing: "로그인 설정이 빠져 있어요.",
    auth_connection_failed: "Supabase에 연결하지 못했어요",
    auth_signup_failed: "계정을 만들지 못했어요",
    auth_signin_failed: "로그인하지 못했어요",
    stalk_h1: "X Stalk",
    stalk_sub: "아이디를 입력하면 XORA가 몰래 들여다봅니다. 여기서만 하는 이야기예요.",
    stalk_ph: "@궁금한 계정",
    stalk_btn: "몰래 분석하기",
    stalk_note: "이 분석에는 호기심 크레딧 5가 사용돼요.",
    match_h1: "X Match",
    match_sub: "두 계정을 나란히 놓으면 XORA가 궁합을 알려 드려요.",
    match_ph1: "@첫 번째 계정",
    match_ph2: "@두 번째 계정",
    match_btn: "궁합 계산하기",
    match_note: "이 비교에는 호기심 크레딧 10이 사용돼요.",
    btn_download: "카드 저장",
    btn_share: "X에 공유",
    btn_again: "다시 해보기",
    upsell_mirror: "그럼 그 사람은 어떨까요? 👀",
    upsell_mirror_btn: "X Stalk로 확인하기",
    says: "XORA 한마디",
    match_overall: "전체 궁합",
    fun_match_label: "XORA FUN 궁합",
    ref_via: "{handle} 님의 추천",
    match_flirt: "설렘 지수",
    match_vibe: "분위기 합",
    match_humor: "유머 코드",
    match_chaos: "혼돈 지수",
    match_romance: "로맨스 지수",
    sc_viral: "확산력",
    sc_kaos: "혼돈 지수",
    sc_mizah: "유머 지수",
    sc_gece: "밤샘 지수",
    profile_h1: "프로필",
    profile_balance: "호기심 크레딧",
    profile_last: "최근 카드",
    profile_history: "지난 분석",
    profile_logout: "로그아웃",
    profile_nouser: "계속하려면 로그인해 주세요.",
    profile_gomirror: "로그인",
    profile_empty: "아직 X 아이디 카드가 없어요.",
    profile_empty_sub: "첫 분석을 시작해 보세요.",
    profile_actions: "분석 시작하기",
    logout_confirm: "로그아웃할까요?",
    logout_done: "로그아웃했어요",
    credits_h1: "호기심 크레딧",
    credits_sub: "Fun은 무료예요. Real은 X 데이터를 실제로 읽기 때문에 크레딧을 사용합니다.",
    credits_balance: "잔액",
    credits_buy: "구매",
    credits_note: "결제는 iyzico로 연동할 예정이에요. 이 버전에서는 구매 버튼이 꺼져 있습니다.",
    trait_humor: "유머",
    trait_reply: "답글 스타일",
    trait_timeline: "타임라인 모드",
    trait_humor_dry: "건조한",
    trait_humor_playful: "장난스러운",
    trait_humor_deadpan: "무표정",
    trait_humor_ironic: "비꼬는",
    trait_humor_warm: "따뜻한",
    trait_humor_witty: "재치 있는",
    trait_reply_curious: "호기심 많은",
    trait_reply_measured: "차분한",
    trait_reply_quick: "빠른",
    trait_reply_supportive: "응원하는",
    trait_reply_teasing: "장난치는",
    trait_reply_selective: "골라서 하는",
    trait_timeline_opens_topics: "화제를 연다",
    trait_timeline_goes_deep: "깊게 판다",
    trait_timeline_calms_threads: "분위기를 푼다",
    trait_timeline_reads_first: "먼저 읽는다",
    trait_timeline_gets_everyone_in: "모두를 끌어들인다",
    trait_timeline_tells_stories: "이야기를 푼다",
    trait_timeline_drops_one_liners: "한마디로 끝낸다",
    real_metrics_title: "X에서의 활동",
    real_m_reply: "답글 비율",
    real_m_original: "직접 쓴 글",
    real_m_repost: "리포스트 비율",
    real_m_question: "질문이 있는 글",
    real_m_emoji: "글당 이모지",
    real_m_length: "평균 길이",
    real_m_chars: "{n}자",
    pricing_launch: "출시 기념 · {pct} 할인",
    pkg_starter: "스타터",
    pkg_popular: "가장 인기",
    pkg_value: "알뜰",
    pkg_pro: "프로",
    pkg_pro_note: "크리에이터·에이전시용",
    pkg_capacity: "Mirror/Stalk {ms}회 • Match {mt}회",
    pkg_regular: "정가",
    toast_loaded: "크레딧을 추가했어요 ⚡",
    payment_soon: "다음 단계에서 iyzico를 연동합니다.",
    real_err_credit: "이 분석에 필요한 크레딧이 부족해요.",
    real_err_protected: "이 계정은 비공개예요. XORA도 넘지 못하는 선이 있습니다.",
    real_err_not_found: "그런 X 계정을 찾지 못했어요.",
    real_err_posts: "정식 분석에 필요한 글이 충분하지 않아요.",
    real_err_rate: "X가 붐비고 있어요. 잠시 후 다시 시도해 주세요.",
    real_err_auth: "정식 분석을 하려면 XORA 계정으로 로그인해야 해요.",
    real_err_unavailable: "분석을 마치지 못했어요. 잔액과 기록을 확인한 뒤 다시 시도해 주세요.",
    real_err_refund: "환불을 처리하고 있어요. 요청 ID는 저장해 두었습니다. 잠시 후 확인해 주세요.",
    real_coming_soon: "정식 분석 곧 공개",
    rarity_common: "커먼",
    rarity_rare: "레어",
    rarity_epic: "에픽",
    rarity_legendary: "레전더리",
    toast_handle: "먼저 아이디를 입력해 주세요",
    toast_two: "아이디를 두 개 입력해 주세요",
    toast_same: "서로 다른 계정을 입력해 주세요 🙂",
    toast_nocredit: "크레딧이 부족해요. 이동합니다…",
    toast_saved: "카드를 저장했어요",
    cost_info: "크레딧 사용",
    date_today: "오늘",
    mirror_cooldown: "X 아이디 카드가 아직 유효해요. 새 카드는 {days}일 뒤에 만들 수 있습니다.",
    view_card: "카드 보기",
    close: "닫기",
    history_select: "선택",
    history_cancel: "취소",
    history_delete: "선택 항목 삭제",
    history_none_selected: "삭제할 분석을 선택해 주세요.",
    history_deleted: "선택한 분석을 기록에서 삭제했어요.",
    history_not_found: "삭제할 항목을 찾지 못했어요.",
    profile_card_expired: "Mirror 카드의 유효 기간이 끝났어요.",
    profile_card_renew: "새 Mirror 뽑기",
    card_load_failed: "카드를 불러오지 못했어요"
  },
  zh: {
    nav_profile: "個人檔案",
    nav_login: "登入",
    home_hi: "你好，我是 XORA。",
    home_sub: "想輕鬆玩一下也行，想認真分析也行。不管哪一種，XORA 的話都不少。",
    card_mirror_t: "X Mirror",
    card_mirror_d: "看看你在 X 上是什麼樣的人。照照鏡子吧。",
    card_stalk_t: "X Stalk",
    card_stalk_d: "幫你分析好奇的帳號。我不會跟別人說。",
    card_match_t: "X Match",
    card_match_d: "把兩個帳號放在一起看看。是命中注定，還是一場災難？",
    badge_free: "免費",
    tier_fun: "娛樂卡片",
    tier_real: "正式分析",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "免費 · 不會讀取 X 資料",
    tier_real_note: "以 X 資料為準 · 會使用點數",
    home_diff_h: "XORA 有兩種。好奇心一樣旺盛。",
    home_fun_h: "XORA Fun",
    home_fun_d: "完全免費。不讀取 X 資料，直接幫你做一張好玩的卡片。想抽幾次都可以。",
    home_real_h: "XORA Real",
    home_real_d: "分析 X 上的真實資料。X API 和分析對我們也是成本，所以 Real 會使用點數。",
    home_real_joke: "不過我們還沒有現實到要把樂趣也收費。",
    badge_c5: "5 點",
    badge_c10: "10 點",
    mirror_h1: "X Mirror",
    mirror_sub: "輸入 X 帳號，看看你在 X 上是什麼樣的人。",
    mirror_ph: "@帳號",
    mirror_btn: "照鏡子",
    fun_btn: "抽免費卡片",
    real_btn_5: "正式分析 · 5 點",
    real_btn_10: "正式分析 · 10 點",
    reroll_btn: "再抽一次",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "這張卡片以 X 的真實資料為準。因為 API 和分析都有成本，所以會使用點數。",
    fun_explainer: "這張卡片只是好玩用的，不會分析 X 資料。",
    mirror_connect_cta: "連結 X 帳號開始分析",
    mirror_login_note: "使用 Mirror 需要先連結 X 帳號。",
    mirror_profile_h: "完成個人檔案",
    mirror_profile_sub: "製作卡片前請先確認資料。",
    mirror_display_name: "顯示名稱",
    mirror_country: "國家",
    mirror_city: "城市",
    mirror_bio: "一句話介紹",
    mirror_website: "網站",
    mirror_avatar_url: "頭像 URL",
    mirror_save: "儲存",
    mirror_skip: "先跳過",
    auth_title: "登入 XORA",
    auth_sub: "想保存分析結果，請先登入 XORA 帳號。",
    auth_login_tab: "登入",
    auth_signup_tab: "註冊",
    auth_email: "電子郵件",
    auth_username: "使用者名稱",
    auth_password: "密碼",
    auth_password_confirm: "確認密碼",
    auth_login_btn: "登入",
    auth_signup_btn: "註冊",
    auth_have_account: "已經有帳號了，去登入",
    auth_need_account: "還沒有帳號，去註冊",
    auth_success: "已登入",
    auth_signup_check_email: "帳號建立好了。如果需要驗證信，請到收件匣確認。",
    auth_username_required: "請輸入使用者名稱。",
    auth_email_required: "請輸入電子郵件。",
    auth_password_required: "請輸入密碼。",
    auth_password_min: "密碼至少要 6 個字元。",
    auth_password_mismatch: "兩次輸入的密碼不一樣。",
    auth_config_missing: "登入設定不完整。",
    auth_connection_failed: "無法連線到 Supabase",
    auth_signup_failed: "無法建立帳號",
    auth_signin_failed: "無法登入",
    stalk_h1: "X Stalk",
    stalk_sub: "輸入帳號，XORA 會幫你偷偷看一眼。只有我們知道。",
    stalk_ph: "@好奇的帳號",
    stalk_btn: "偷偷分析",
    stalk_note: "這次分析會用掉 5 點好奇心點數。",
    match_h1: "X Match",
    match_sub: "把兩個帳號放在一起，XORA 幫你算合不合。",
    match_ph1: "@第一個帳號",
    match_ph2: "@第二個帳號",
    match_btn: "算合不合",
    match_note: "這次比較會用掉 10 點好奇心點數。",
    btn_download: "儲存卡片",
    btn_share: "分享到 X",
    btn_again: "再試一次",
    upsell_mirror: "那他呢？👀",
    upsell_mirror_btn: "用 X Stalk 看看",
    says: "XORA 說",
    match_overall: "整體速配",
    fun_match_label: "XORA FUN 速配",
    ref_via: "由 {handle} 推薦",
    match_flirt: "曖昧指數",
    match_vibe: "頻率",
    match_humor: "笑點",
    match_chaos: "混亂指數",
    match_romance: "浪漫指數",
    sc_viral: "擴散力",
    sc_kaos: "混亂指數",
    sc_mizah: "幽默指數",
    sc_gece: "熬夜指數",
    profile_h1: "個人檔案",
    profile_balance: "好奇心點數",
    profile_last: "最新卡片",
    profile_history: "過去的分析",
    profile_logout: "登出",
    profile_nouser: "請先登入再繼續。",
    profile_gomirror: "登入",
    profile_empty: "還沒有 X 身分卡。",
    profile_empty_sub: "從第一次分析開始吧。",
    profile_actions: "開始分析",
    logout_confirm: "要登出嗎？",
    logout_done: "已登出",
    credits_h1: "好奇心點數",
    credits_sub: "Fun 免費。Real 會實際讀取 X 資料，所以要用點數。",
    credits_balance: "餘額",
    credits_buy: "購買",
    credits_note: "之後會串接 iyzico 付款。這個版本的購買按鈕還沒開放。",
    trait_humor: "幽默",
    trait_reply: "回覆能量",
    trait_timeline: "時間軸模式",
    trait_humor_dry: "偏冷",
    trait_humor_playful: "愛玩",
    trait_humor_deadpan: "面無表情",
    trait_humor_ironic: "帶點反諷",
    trait_humor_warm: "溫暖",
    trait_humor_witty: "反應快",
    trait_reply_curious: "好奇",
    trait_reply_measured: "穩重",
    trait_reply_quick: "秒回",
    trait_reply_supportive: "給支持",
    trait_reply_teasing: "愛鬧",
    trait_reply_selective: "挑著回",
    trait_timeline_opens_topics: "開話題",
    trait_timeline_goes_deep: "深入聊",
    trait_timeline_calms_threads: "緩和氣氛",
    trait_timeline_reads_first: "先看再說",
    trait_timeline_gets_everyone_in: "拉大家進來",
    trait_timeline_tells_stories: "說故事",
    trait_timeline_drops_one_liners: "一句話結束",
    real_metrics_title: "X 上的行為",
    real_m_reply: "回覆比例",
    real_m_original: "原創貼文",
    real_m_repost: "轉發比例",
    real_m_question: "含提問的貼文",
    real_m_emoji: "每則貼文表情符號",
    real_m_length: "平均長度",
    real_m_chars: "{n} 字",
    pricing_launch: "上線優惠 · 立省 {pct}",
    pkg_starter: "入門",
    pkg_popular: "最受歡迎",
    pkg_value: "超值",
    pkg_pro: "專業",
    pkg_pro_note: "創作者與代理商",
    pkg_capacity: "Mirror/Stalk {ms} 次 • Match {mt} 次",
    pkg_regular: "原價",
    toast_loaded: "點數已加值 ⚡",
    payment_soon: "下一步會串接 iyzico。",
    real_err_credit: "點數不夠，無法進行這次分析。",
    real_err_protected: "這個帳號沒有公開。XORA 也有不能越過的界線。",
    real_err_not_found: "找不到這個 X 帳號。",
    real_err_posts: "貼文數量不足，無法做正式分析。",
    real_err_rate: "X 現在有點忙。請稍後再試一次。",
    real_err_auth: "要做正式分析，請先登入 XORA 帳號。",
    real_err_unavailable: "分析沒有完成。請確認餘額和紀錄後再試一次。",
    real_err_refund: "退款處理中。請求 ID 已經保存，請稍後再確認。",
    real_coming_soon: "正式分析即將推出",
    rarity_common: "普通",
    rarity_rare: "稀有",
    rarity_epic: "史詩",
    rarity_legendary: "傳說",
    toast_handle: "請先輸入帳號",
    toast_two: "請輸入兩個帳號",
    toast_same: "請輸入兩個不同的帳號 🙂",
    toast_nocredit: "點數不夠，正在為你跳轉…",
    toast_saved: "卡片已儲存",
    cost_info: "使用點數",
    date_today: "今天",
    mirror_cooldown: "X 身分卡還在有效期內。{days} 天後可以做新的卡片。",
    view_card: "看卡片",
    close: "關閉",
    history_select: "選取",
    history_cancel: "取消",
    history_delete: "刪除選取項目",
    history_none_selected: "請先選擇要刪除的分析。",
    history_deleted: "已從紀錄中刪除選取的分析。",
    history_not_found: "找不到要刪除的項目。",
    profile_card_expired: "Mirror 卡片已經過期。",
    profile_card_renew: "抽一張新的 Mirror",
    card_load_failed: "卡片載入失敗"
  },
  ru: {
    nav_profile: "Профиль",
    nav_login: "Войти",
    home_hi: "Привет, это XORA.",
    home_sub: "Можно просто развлечься, а можно разобраться всерьёз. В обоих случаях XORA есть что сказать.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Посмотри, какой ты в X. Самое время заглянуть в зеркало.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Разберём аккаунт, который тебе интересен. Никому не расскажем.",
    card_match_t: "X Match",
    card_match_d: "Поставь два аккаунта рядом. Судьба или катастрофа?",
    badge_free: "Бесплатно",
    tier_fun: "Весёлая карточка",
    tier_real: "Настоящий разбор",
    tier_fun_short: "FREE",
    tier_real_short: "REAL",
    tier_free_note: "Бесплатно · данные X не читаем",
    tier_real_note: "По данным X · тратит кредиты",
    home_diff_h: "XORA бывает двух видов. Любопытства хватает обоим.",
    home_fun_h: "XORA Fun",
    home_fun_d: "Совершенно бесплатно. Данные X не читаем, просто сразу делаем карточку для настроения. Тянуть можно сколько угодно.",
    home_real_h: "XORA Real",
    home_real_d: "Разбираем настоящие данные из X. X API и анализ стоят денег и нам, поэтому Real тратит кредиты.",
    home_real_joke: "Но не настолько, чтобы забирать у тебя всё веселье.",
    badge_c5: "5 кредитов",
    badge_c10: "10 кредитов",
    mirror_h1: "X Mirror",
    mirror_sub: "Введи имя пользователя X и посмотри, какой ты в X.",
    mirror_ph: "@имя пользователя",
    mirror_btn: "Заглянуть в зеркало",
    fun_btn: "Вытянуть бесплатную карточку",
    real_btn_5: "Настоящий разбор · 5 кредитов",
    real_btn_10: "Настоящий разбор · 10 кредитов",
    reroll_btn: "Вытянуть ещё раз",
    real_label: "XORA REAL",
    fun_label: "XORA FUN · FREE",
    real_explainer: "Эта карточка построена на настоящих данных X. API и анализ стоят денег, поэтому она тратит кредиты.",
    fun_explainer: "Эта карточка сделана для настроения и не анализирует данные X.",
    mirror_connect_cta: "Подключить аккаунт X и разобрать",
    mirror_login_note: "Для Mirror нужно подключить аккаунт X.",
    mirror_profile_h: "Заполни профиль",
    mirror_profile_sub: "Проверь данные, прежде чем делать карточку.",
    mirror_display_name: "Отображаемое имя",
    mirror_country: "Страна",
    mirror_city: "Город",
    mirror_bio: "Пара слов о себе",
    mirror_website: "Сайт",
    mirror_avatar_url: "URL аватара",
    mirror_save: "Сохранить",
    mirror_skip: "Пока пропустить",
    auth_title: "Вход в XORA",
    auth_sub: "Чтобы сохранять результаты, войди в аккаунт XORA.",
    auth_login_tab: "Вход",
    auth_signup_tab: "Регистрация",
    auth_email: "Почта",
    auth_username: "Имя пользователя",
    auth_password: "Пароль",
    auth_password_confirm: "Пароль ещё раз",
    auth_login_btn: "Войти",
    auth_signup_btn: "Зарегистрироваться",
    auth_have_account: "Уже есть аккаунт — войти",
    auth_need_account: "Нет аккаунта — зарегистрироваться",
    auth_success: "Вход выполнен",
    auth_signup_check_email: "Аккаунт создан. Если нужно подтверждение, загляни в почту.",
    auth_username_required: "Введи имя пользователя.",
    auth_email_required: "Введи адрес почты.",
    auth_password_required: "Введи пароль.",
    auth_password_min: "Пароль должен быть не короче 6 символов.",
    auth_password_mismatch: "Пароли не совпадают.",
    auth_config_missing: "Не хватает настроек входа.",
    auth_connection_failed: "Не удалось подключиться к Supabase",
    auth_signup_failed: "Не удалось создать аккаунт",
    auth_signin_failed: "Не удалось войти",
    stalk_h1: "X Stalk",
    stalk_sub: "Введи имя пользователя, и XORA тихонько заглянет. Останется между нами.",
    stalk_ph: "@интересный аккаунт",
    stalk_btn: "Разобрать по-тихому",
    stalk_note: "Этот разбор стоит 5 кредитов любопытства.",
    match_h1: "X Match",
    match_sub: "Поставь два аккаунта рядом, и XORA скажет, как у них с совместимостью.",
    match_ph1: "@первый аккаунт",
    match_ph2: "@второй аккаунт",
    match_btn: "Посчитать совместимость",
    match_note: "Это сравнение стоит 10 кредитов любопытства.",
    btn_download: "Сохранить карточку",
    btn_share: "Поделиться в X",
    btn_again: "Попробовать ещё раз",
    upsell_mirror: "А что насчёт него? 👀",
    upsell_mirror_btn: "Посмотреть через X Stalk",
    says: "XORA говорит",
    match_overall: "Общая совместимость",
    fun_match_label: "СОВМЕСТИМОСТЬ XORA FUN",
    ref_via: "по приглашению {handle}",
    match_flirt: "Флирт",
    match_vibe: "Настрой",
    match_humor: "Юмор",
    match_chaos: "Хаос",
    match_romance: "Романтика",
    sc_viral: "Охват",
    sc_kaos: "Хаос",
    sc_mizah: "Юмор",
    sc_gece: "Ночная жизнь",
    profile_h1: "Профиль",
    profile_balance: "Кредиты любопытства",
    profile_last: "Последняя карточка",
    profile_history: "Прошлые разборы",
    profile_logout: "Выйти",
    profile_nouser: "Чтобы продолжить, войди в аккаунт.",
    profile_gomirror: "Войти",
    profile_empty: "Пока нет ни одной карточки X.",
    profile_empty_sub: "Начни с первого разбора.",
    profile_actions: "Начать разбор",
    logout_confirm: "Выйти из аккаунта?",
    logout_done: "Ты вышел из аккаунта",
    credits_h1: "Кредиты любопытства",
    credits_sub: "Fun бесплатный. Real по-настоящему читает данные X, поэтому тратит кредиты.",
    credits_balance: "Баланс",
    credits_buy: "Купить",
    credits_note: "Оплату подключим через iyzico. В этой версии кнопка покупки пока не работает.",
    trait_humor: "Юмор",
    trait_reply: "Ответы",
    trait_timeline: "Лента",
    trait_humor_dry: "Сухой",
    trait_humor_playful: "Игривый",
    trait_humor_deadpan: "С каменным лицом",
    trait_humor_ironic: "Ироничный",
    trait_humor_warm: "Тёплый",
    trait_humor_witty: "Остроумный",
    trait_reply_curious: "Любопытный",
    trait_reply_measured: "Сдержанный",
    trait_reply_quick: "Быстрый",
    trait_reply_supportive: "Поддерживающий",
    trait_reply_teasing: "Подкалывающий",
    trait_reply_selective: "Избирательный",
    trait_timeline_opens_topics: "Начинает темы",
    trait_timeline_goes_deep: "Уходит вглубь",
    trait_timeline_calms_threads: "Сглаживает споры",
    trait_timeline_reads_first: "Сначала читает",
    trait_timeline_gets_everyone_in: "Всех вовлекает",
    trait_timeline_tells_stories: "Рассказывает истории",
    trait_timeline_drops_one_liners: "Заканчивает одной фразой",
    real_metrics_title: "Поведение в X",
    real_m_reply: "Доля ответов",
    real_m_original: "Свои посты",
    real_m_repost: "Доля репостов",
    real_m_question: "Посты с вопросами",
    real_m_emoji: "Эмодзи на пост",
    real_m_length: "Средняя длина",
    real_m_chars: "{n} симв.",
    pricing_launch: "СТАРТОВОЕ ПРЕДЛОЖЕНИЕ · СКИДКА {pct}",
    pkg_starter: "СТАРТ",
    pkg_popular: "САМЫЙ ПОПУЛЯРНЫЙ",
    pkg_value: "ВЫГОДНЫЙ",
    pkg_pro: "ПРОФИ",
    pkg_pro_note: "Для авторов и агентств",
    pkg_capacity: "{ms} Mirror/Stalk • {mt} Match",
    pkg_regular: "Обычная цена",
    toast_loaded: "Кредиты начислены ⚡",
    payment_soon: "На следующем шаге подключим iyzico.",
    real_err_credit: "Кредитов для этого разбора не хватает.",
    real_err_protected: "Этот аккаунт закрыт. Есть границы, которые XORA не переходит.",
    real_err_not_found: "Такой аккаунт в X не нашёлся.",
    real_err_posts: "Записей слишком мало для настоящего разбора.",
    real_err_rate: "В X сейчас многолюдно. Попробуй ещё раз чуть позже.",
    real_err_auth: "Для настоящего разбора нужно войти в аккаунт XORA.",
    real_err_unavailable: "Разбор не завершился. Проверь баланс и историю и попробуй снова.",
    real_err_refund: "Возврат в обработке. Номер запроса сохранён, загляни чуть позже.",
    real_coming_soon: "Настоящий разбор скоро",
    rarity_common: "ОБЫЧНАЯ",
    rarity_rare: "РЕДКАЯ",
    rarity_epic: "ЭПИЧЕСКАЯ",
    rarity_legendary: "ЛЕГЕНДАРНАЯ",
    toast_handle: "Сначала введи имя пользователя",
    toast_two: "Введи два имени пользователя",
    toast_same: "Введи два разных аккаунта 🙂",
    toast_nocredit: "Кредитов не хватает, переносим тебя…",
    toast_saved: "Карточка сохранена",
    cost_info: "Расход кредитов",
    date_today: "Сегодня",
    mirror_cooldown: "Карточка X ещё действует. Новую можно сделать через {days} дн.",
    view_card: "Открыть карточку",
    close: "Закрыть",
    history_select: "Выбрать",
    history_cancel: "Отмена",
    history_delete: "Удалить выбранное",
    history_none_selected: "Выбери разборы, которые нужно удалить.",
    history_deleted: "Выбранные разборы удалены из истории.",
    history_not_found: "Не нашлось того, что нужно удалить.",
    profile_card_expired: "Срок действия карточки Mirror истёк.",
    profile_card_renew: "Вытянуть новый Mirror",
    card_load_failed: "Не удалось загрузить карточку"
  }
};

var LANGS = ["tr", "en", "es", "pt", "ar", "fr", "de", "it", "ja", "ko", "zh", "ru"];
var RTL_LANGS = ["ar"];
var LANG_NAMES = { tr: "Türkçe", en: "English", es: "Español", pt: "Português", ar: "العربية", fr: "Français", de: "Deutsch", it: "Italiano", ja: "日本語", ko: "한국어", zh: "繁體中文", ru: "Русский" };

// Priority: a language the user picked (saved under LS.lang) > the first supported browser
// language > English. Detection is never written back, so only a manual choice is persisted and
// a later browser change still applies until the user picks a language themselves.
function savedLang() {
  var lang = null;
  try { lang = localStorage.getItem(LS.lang); } catch (e) { lang = null; }
  return LANGS.indexOf(lang) >= 0 ? lang : null;
}

// Matches on the base language, so en-GB -> en, pt-BR -> pt and zh-HK -> zh. Order is the
// browser's preference order; the first supported entry wins.
function detectBrowserLang(languages) {
  for (var i = 0; i < (languages || []).length; i++) {
    var base = String(languages[i] || "").toLowerCase().split(/[-_]/)[0];
    if (LANGS.indexOf(base) >= 0) return base;
  }
  return null;
}

function browserLanguages() {
  if (typeof navigator === "undefined" || !navigator) return [];
  var list = navigator.languages && navigator.languages.length ? Array.prototype.slice.call(navigator.languages) : [];
  if (navigator.language) list.push(navigator.language);
  return list;
}

function getLang() {
  return savedLang() || detectBrowserLang(browserLanguages()) || "en";
}

function langDir(lang) {
  return RTL_LANGS.indexOf(lang) >= 0 ? "rtl" : "ltr";
}

function setLang(l) {
  if (LANGS.indexOf(l) < 0) return;
  localStorage.setItem(LS.lang, l);
  applyI18n();
  document.dispatchEvent(new CustomEvent("xora:lang"));
}

/* ---------------- dil seçici ---------------- */

function renderLangMenu(menu) {
  var current = getLang();
  menu.innerHTML = LANGS.map(function (l) {
    var selected = l === current;
    return '<button type="button" role="option" class="lang-option' + (selected ? " is-current" : "") +
      '" data-lang="' + l + '" lang="' + l + '" dir="' + langDir(l) + '" aria-selected="' + selected + '">' +
      LANG_NAMES[l] + "</button>";
  }).join("");
}

function openLangMenu() {
  var btn = document.getElementById("langBtn");
  var menu = document.getElementById("langMenu");
  if (!btn || !menu) return;
  renderLangMenu(menu);
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  var current = menu.querySelector && menu.querySelector('[aria-selected="true"]');
  if (current && current.focus) current.focus();
}

function closeLangMenu() {
  var btn = document.getElementById("langBtn");
  var menu = document.getElementById("langMenu");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function chooseLang(l) {
  closeLangMenu();
  setLang(l);
  var btn = document.getElementById("langBtn");
  if (btn && btn.focus) btn.focus();
}

// Turns the existing #langBtn pill into a small popover listing every locale. The button stays in
// place; it is only wrapped so the menu can sit directly under it.
function initLangPicker() {
  var btn = document.getElementById("langBtn");
  if (!btn || !btn.parentNode || btn.getAttribute("aria-haspopup")) return;
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "langMenu");

  var wrap = document.createElement("span");
  wrap.className = "lang-picker";
  btn.parentNode.insertBefore(wrap, btn);
  wrap.appendChild(btn);

  var menu = document.createElement("div");
  menu.id = "langMenu";
  menu.className = "lang-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrap.appendChild(menu);

  btn.addEventListener("click", function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (menu.hidden) openLangMenu(); else closeLangMenu();
  });
  menu.addEventListener("click", function (e) {
    var option = e && e.target && e.target.closest ? e.target.closest("[data-lang]") : null;
    if (option) chooseLang(option.getAttribute("data-lang"));
  });
  menu.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    var options = Array.prototype.slice.call(menu.querySelectorAll("[data-lang]"));
    var at = options.indexOf(document.activeElement);
    var next = options[(at + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length];
    if (next) next.focus();
    e.preventDefault();
  });
  document.addEventListener("click", function (e) {
    if (!menu.hidden && !wrap.contains(e.target)) closeLangMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) { closeLangMenu(); btn.focus(); }
  });
}

/* ---------------- sayı ve fiyat biçimi ---------------- */

var NUMBER_LOCALES = { tr: "tr-TR", en: "en-US", es: "es-ES", pt: "pt-BR", ar: "ar-u-nu-latn", fr: "fr-FR", de: "de-DE", it: "it-IT", ja: "ja-JP", ko: "ko-KR", zh: "zh-TW", ru: "ru-RU" };

function numberLocale(lang) {
  return NUMBER_LOCALES[lang || getLang()] || "en-US";
}

function formatPercent(ratio, lang) {
  return new Intl.NumberFormat(numberLocale(lang), { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

function formatDecimal(value, lang) {
  return new Intl.NumberFormat(numberLocale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

// Prices stay in USD. Arabic uses the plain $x.xx form: its Intl output mixes RTL marks with "US$",
// while price text is already shown as an LTR-isolated value inside RTL pages.
function formatPrice(usd, lang) {
  var l = lang || getLang();
  return new Intl.NumberFormat(l === "ar" ? "en-US" : numberLocale(l), { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }).format(usd);
}

function fillTemplate(text, values) {
  return String(text).replace(/\{(\w+)\}/g, function (m, k) { return values[k] != null ? values[k] : m; });
}

function packageCapacity(pkg) {
  return { mirrorStalk: Math.floor(pkg.credits / COSTS.mirror), match: Math.floor(pkg.credits / COSTS.match) };
}

function renderCreditPackages(container, banner) {
  var lang = getLang();
  if (banner) banner.textContent = fillTemplate(t("pricing_launch"), { pct: formatPercent(LAUNCH_DISCOUNT, lang) });
  if (!container) return;
  container.innerHTML = CREDIT_PACKAGES.map(function (pkg) {
    var cap = packageCapacity(pkg);
    var list = formatPrice(pkg.list, lang);
    return '<div class="pack pack-' + pkg.id + (pkg.featured ? ' hot' : '') + '" data-package="' + pkg.id + '">' +
      '<p class="pack-badge">' + esc(t(pkg.label)) + '</p>' +
      '<p class="pack-amount">' + pkg.credits + ' <small>⚡</small></p>' +
      '<p class="pack-name">' + esc(fillTemplate(t("pkg_capacity"), { ms: cap.mirrorStalk, mt: cap.match })) + '</p>' +
      (pkg.note ? '<p class="pack-note">' + esc(t(pkg.note)) + '</p>' : '') +
      '<p class="pack-price"><s class="pack-old" aria-label="' + esc(t("pkg_regular") + ": " + list) + '">' + esc(list) + '</s> ' +
        '<span class="pack-now">' + esc(formatPrice(pkg.price, lang)) + '</span></p>' +
      '<button type="button" class="btn btn-sm' + (pkg.featured ? ' btn-orange' : '') + '" data-amount="' + pkg.credits + '" data-i18n="credits_buy">' + esc(t("credits_buy")) + '</button>' +
    '</div>';
  }).join("");
}

function t(key) {
  var lang = getLang();
  if (I18N[lang] && I18N[lang][key] !== undefined) return I18N[lang][key];
  if (I18N.tr[key] !== undefined) return I18N.tr[key];
  return key;
}

function applyI18n() {
  document.documentElement.lang = getLang();
  document.documentElement.dir = langDir(getLang());
  var nodes = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
  }
  var phs = document.querySelectorAll("[data-i18n-ph]");
  for (var j = 0; j < phs.length; j++) {
    phs[j].placeholder = t(phs[j].getAttribute("data-i18n-ph"));
  }
  var lb = document.getElementById("langBtn");
  if (lb) {
    var current = getLang();
    lb.textContent = current.toUpperCase();
    lb.title = LANG_NAMES[current];
    lb.setAttribute("aria-label", LANG_NAMES[current]);
  }
  renderReferralVia();
  refreshAuthUi();
}

/* ---------------- üst bar ---------------- */

function refreshTopbar() {
  var cv = document.getElementById("creditVal");
  var loggedIn = isLoggedIn();
  var creditsPill = document.querySelector(".credits-pill");
  if (creditsPill) creditsPill.hidden = !loggedIn;
  if (cv) {
    var profile = getCurrentUser();
    cv.textContent = loggedIn && profile && profile.credit_balance != null ? profile.credit_balance : getCredits();
  }
}

function openAuthModal() {
  window.location.href = "auth.html";
}

function closeAuthModal() {
  var modal = document.getElementById("authModal");
  if (modal) modal.hidden = true;
}

function ensureAuthModal() {
  return;
}

function refreshAuthUi() {
  var loggedIn = isLoggedIn();
  authDebug("current auth state", {
    loggedIn: loggedIn,
    user: getStoredAuthUser()
  });
  var links = document.querySelectorAll('[data-i18n="nav_profile"]');
  for (var i = 0; i < links.length; i++) {
    links[i].textContent = loggedIn ? t("nav_profile") : t("nav_login");
    links[i].setAttribute("href", loggedIn ? "profile.html" : "auth.html");
    links[i].onclick = loggedIn ? null : function (e) {
      e.preventDefault();
      openAuthModal();
    };
  }
  refreshTopbar();
}

function initTopbar() {
  refreshTopbar();
  refreshAuthUi();
  initLangPicker();
}

function initAuthGuards() {
  var links = document.querySelectorAll("[data-auth-required]");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function (e) {
      if (this.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
      if (!isLoggedIn()) {
        e.preventDefault();
        window.location.href = "auth.html";
      }
    });
  }
}

/* ---------------- sayfa açılışı ---------------- */

document.addEventListener("DOMContentLoaded", function () {
  captureReferral();
  getCredits();
  initTopbar();
  initAuthGuards();
  disableProductionRealCtas();
  applyI18n();
  initSession();
});
document.addEventListener("xora:lang", disableProductionRealCtas);
