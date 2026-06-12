/* ============================================================
   XORA — app.js
   Ortak mantık: depolama, krediler, dil (TR/EN), üst bar, toast
   ============================================================ */

var LS = {
  user:    "xora_user",
  authUser:"xora_auth_user",
  credits: "xora_credits",
  history: "xora_history",
  lang:    "xora_lang"
};

var COSTS = { stalk: 5, match: 10 };
var FREE_CREDITS = 10;

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

/* ---------------- kullanıcı / session ---------------- */

var xoraSupabase = null;
var xoraSessionReady = false;
var xoraSessionPromise = null;
var xoraAuthListenerReady = false;
var xoraAuthCallbackPending = false;

function authDebug(label, data) {
  if (!window.console) return;
  console.log("[XORA auth]", label, data || "");
}

function getStoredAuthUser() {
  try { return JSON.parse(localStorage.getItem(LS.authUser)) || null; }
  catch (e) { return null; }
}

function storeAuthUser(u) {
  if (!u) {
    localStorage.removeItem(LS.authUser);
    localStorage.removeItem(LS.user);
    return;
  }
  localStorage.setItem(LS.authUser, JSON.stringify(u));
  if (u.username) localStorage.setItem(LS.user, u.username);
}

function getUser() {
  var u = getStoredAuthUser();
  return (u && u.username) || "";
}

function getCurrentUser() {
  return getStoredAuthUser();
}

function isLoggedIn() {
  return !!getStoredAuthUser();
}

function isAuthPending() {
  return xoraAuthCallbackPending;
}

function setUser(h) {
  var handle = String(h || "").replace(/^@+/, "");
  var u = getStoredAuthUser();
  if (u) {
    u.username = handle;
    storeAuthUser(u);
  }
}

function getSupabaseClient() {
  if (xoraSupabase) return xoraSupabase;
  var cfg = window.XORA_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY ||
      cfg.SUPABASE_URL.indexOf("YOUR_PROJECT_REF") !== -1) {
    return null;
  }
  xoraSupabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  });
  return xoraSupabase;
}

function normalizeXProfile(authUser) {
  if (!authUser) return null;
  var meta = authUser.user_metadata || {};
  var identities = authUser.identities || [];
  var identity = identities.find(function (i) {
    return i.provider === "x" || i.provider === "twitter";
  }) || identities[0] || null;
  var data = (identity && identity.identity_data) || {};

  function firstValue(keys) {
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (meta[key]) return meta[key];
      if (data[key]) return data[key];
    }
    return "";
  }

  var username = firstValue([
    "user_name",
    "username",
    "preferred_username",
    "screen_name",
    "nickname"
  ]);
  username = String(username).replace(/^@+/, "");
  if (!username && authUser.email) username = authUser.email.split("@")[0];
  if (!username) username = "x_user_" + String(authUser.id || "").slice(0, 8);

  var displayName = firstValue(["name", "full_name", "display_name"]) || username;
  var avatarUrl = firstValue(["avatar_url", "picture", "profile_image_url", "profile_image_url_https"]);
  var providerId = firstValue(["provider_id", "sub", "id"]) ||
                   (identity && identity.id) ||
                   authUser.id;

  authDebug("user metadata", {
    authUserId: authUser.id,
    provider: identity && identity.provider,
    metadata: meta,
    identityData: data,
    mappedUsername: username
  });

  return {
    id: authUser.id,
    x_user_id: providerId,
    username: username,
    display_name: displayName,
    avatar_url: avatarUrl || "",
    lang: getLang()
  };
}

async function ensurePublicUser(session) {
  if (!session || !session.user) {
    console.warn("[XORA db] ensurePublicUser skipped: no session user");
    return null;
  }

  var sb = getSupabaseClient();
  if (!sb) {
    console.warn("[XORA db] ensurePublicUser skipped: no Supabase client");
    return null;
  }

  var user = session.user;
  var meta = user.user_metadata || {};
  var identities = user.identities || [];
  var identity = identities.find(function (i) {
    return i.provider === "x" || i.provider === "twitter";
  }) || identities[0] || null;
  var data = (identity && identity.identity_data) || {};

  function pick(keys) {
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (meta[key]) return meta[key];
      if (data[key]) return data[key];
    }
    return null;
  }

  var xHandle = pick(["user_name", "username", "preferred_username", "screen_name", "name"]) ||
                (user.email ? user.email.split("@")[0] : null) ||
                ("x_user_" + String(user.id || "").slice(0, 8));
  xHandle = String(xHandle).replace(/^@+/, "");

  var payload = {
    id: user.id,
    x_user_id: pick(["provider_id", "sub", "id"]) || (identity && identity.id) || user.id,
    username: xHandle,
    display_name: pick(["full_name", "name", "display_name"]) || xHandle,
    avatar_url: pick(["avatar_url", "picture", "profile_image_url", "profile_image_url_https"]) || null,
    lang: getLang(),
    last_login_at: new Date().toISOString()
  };

  console.log("[XORA db] upsert called at", new Date().toISOString());
  console.log("[XORA db] users upsert payload", payload);

  var result;
  try {
    result = await sb
      .from("users")
      .upsert(payload, { onConflict: "id" })
      .select();
  } catch (err) {
    console.error("[XORA db] users upsert failed", err);
    console.error("[XORA db] users upsert failed full", JSON.stringify(err, null, 2));
    return null;
  }

  if (result.error) {
    console.error("[XORA db] users upsert failed", result.error);
    console.error("[XORA db] users upsert failed full", JSON.stringify(result.error, null, 2));
    return null;
  }

  console.log("[XORA db] users upsert result", result.data);
  return result.data;
}

async function upsertSupabaseUser(profile) {
  var sb = getSupabaseClient();
  if (!sb || !profile) return profile;

  var row = {
    id: profile.id,
    x_user_id: profile.x_user_id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    lang: profile.lang,
    last_login_at: new Date().toISOString()
  };

  var result;
  try {
    result = await sb
      .from("users")
      .upsert(row, { onConflict: "id" })
      .select("id,x_user_id,username,display_name,avatar_url,lang,credit_balance")
      .single();
  } catch (err) {
    authDebug("users upsert exception", err);
    console.warn("XORA users upsert exception:", err);
    return profile;
  }

  authDebug("users upsert result", {
    payload: row,
    data: result.data,
    error: result.error
  });

  if (result.error) {
    console.warn("XORA users upsert failed:", result.error.message, result.error);
    return profile;
  }

  var dbUser = result.data || {};
  if (dbUser.credit_balance !== undefined && dbUser.credit_balance !== null) {
    localStorage.setItem(LS.credits, String(dbUser.credit_balance));
    refreshTopbar();
  }

  return {
    id: dbUser.id || profile.id,
    x_user_id: dbUser.x_user_id || profile.x_user_id,
    username: dbUser.username || profile.username,
    display_name: dbUser.display_name || profile.display_name,
    avatar_url: dbUser.avatar_url || profile.avatar_url,
    lang: dbUser.lang || profile.lang,
    credit_balance: dbUser.credit_balance
  };
}

function getOAuthReturnInfo() {
  var search = new URLSearchParams(window.location.search || "");
  var hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
  return {
    code: search.get("code"),
    state: search.get("state"),
    error: search.get("error") || hash.get("error"),
    errorDescription: search.get("error_description") || hash.get("error_description"),
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    hasCallback: !!(search.get("code") || hash.get("access_token") || search.get("error") || hash.get("error"))
  };
}

function cleanOAuthUrl() {
  if (!window.history || !window.history.replaceState) return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function waitForSession(sb, attempts) {
  for (var i = 0; i < attempts; i++) {
    var result = await sb.auth.getSession();
    authDebug("getSession result", {
      attempt: i + 1,
      hasSession: !!(result.data && result.data.session),
      error: result.error
    });
    if (result.data && result.data.session) return result.data.session;
    await sleep(350);
  }
  return null;
}

async function hydrateAuthUser(authUser, source) {
  authDebug("hydrate user", { source: source, hasUser: !!authUser, authUserId: authUser && authUser.id });
  var profile = normalizeXProfile(authUser);

  authDebug("derived profile payload", profile);
  storeAuthUser(profile);
  xoraAuthCallbackPending = false;
  xoraSessionReady = true;
  cleanOAuthUrl();
  refreshAuthUi();
  document.dispatchEvent(new CustomEvent("xora:session", { detail: profile }));

  var saved = await upsertSupabaseUser(profile);
  storeAuthUser(saved || profile);
  refreshAuthUi();
  document.dispatchEvent(new CustomEvent("xora:session", { detail: saved || profile }));
  return saved || profile;
}

async function syncSession() {
  var sb = getSupabaseClient();
  if (!sb) {
    xoraSessionReady = true;
    document.dispatchEvent(new CustomEvent("xora:session"));
    return getStoredAuthUser();
  }

  var callback = getOAuthReturnInfo();
  xoraAuthCallbackPending = callback.hasCallback;
  authDebug("sync start", {
    callbackUrl: window.location.href,
    hasCallback: callback.hasCallback,
    hasCode: !!callback.code,
    hasAccessToken: !!callback.accessToken,
    codeExchange: callback.code ? "auto-detectSessionInUrl" : "not-needed"
  });

  if (callback.error) {
    console.warn("XORA OAuth callback error:", callback.error, callback.errorDescription || "");
  }

  if (callback.code) {
    authDebug("code exchange result", {
      mode: "automatic",
      manualExchangeCalled: false
    });
  }

  var session = await waitForSession(sb, callback.hasCallback ? 12 : 1);
  if (!session) {
    xoraAuthCallbackPending = false;
    storeAuthUser(null);
    xoraSessionReady = true;
    refreshAuthUi();
    document.dispatchEvent(new CustomEvent("xora:session"));
    return null;
  }

  await ensurePublicUser(session);
  return hydrateAuthUser(session.user, "get-session");
}

function initSession() {
  var sb = getSupabaseClient();
  if (sb && !xoraAuthListenerReady) {
    xoraAuthListenerReady = true;
    sb.auth.onAuthStateChange(function (event, session) {
      authDebug("auth event", { event: event, hasSession: !!session, authUserId: session && session.user && session.user.id });
      if (session && session.user) {
        if (event === "SIGNED_IN") ensurePublicUser(session);
        xoraSessionPromise = hydrateAuthUser(session.user, "auth-event:" + event);
      } else if (event === "SIGNED_OUT") {
        xoraAuthCallbackPending = false;
        storeAuthUser(null);
        refreshAuthUi();
        document.dispatchEvent(new CustomEvent("xora:session"));
      }
    });
  }
  if (!xoraSessionPromise) {
    xoraSessionPromise = syncSession();
  }
  return xoraSessionPromise;
}

function getRedirectUrl() {
  var cfg = window.XORA_CONFIG || {};
  if (cfg.AUTH_REDIRECT_URL) return cfg.AUTH_REDIRECT_URL;
  if (window.location.hostname === "icanyesilyurt.github.io") {
    return "https://icanyesilyurt.github.io/xora/mirror.html";
  }
  return window.location.href;
}

async function signInWithX() {
  var sb = getSupabaseClient();
  if (!sb) {
    toast(t("auth_config_missing"));
    return;
  }
  var redirectTo = getRedirectUrl();
  authDebug("sign in redirect", { redirectTo: redirectTo });
  var result = await sb.auth.signInWithOAuth({
    provider: "x",
    options: { redirectTo: redirectTo }
  });
  authDebug("signInWithOAuth result", { data: result.data, error: result.error });
  if (result.error) toast(result.error.message);
}

async function clearSession() {
  var sb = getSupabaseClient();
  if (sb) await sb.auth.signOut();
  storeAuthUser(null);
  localStorage.removeItem(LS.history);
}

/* ---------------- krediler ---------------- */

function getCredits() {
  if (localStorage.getItem(LS.credits) === null) {
    localStorage.setItem(LS.credits, String(FREE_CREDITS));
  }
  var n = parseInt(localStorage.getItem(LS.credits), 10);
  return isNaN(n) ? 0 : n;
}

function addCredits(n) {
  localStorage.setItem(LS.credits, String(getCredits() + n));
  refreshTopbar();
}

function spendCredits(n) {
  var c = getCredits();
  if (c < n) return false;
  localStorage.setItem(LS.credits, String(c - n));
  refreshTopbar();
  return true;
}

/* ---------------- geçmiş ---------------- */

function getHistory() {
  try { return JSON.parse(localStorage.getItem(LS.history)) || []; }
  catch (e) { return []; }
}

function addHistory(entry) {
  var h = getHistory();
  entry.ts = Date.now();
  h.unshift(entry);
  if (h.length > 30) h = h.slice(0, 30);
  localStorage.setItem(LS.history, JSON.stringify(h));
}

async function getRemoteAnalyses(limit) {
  var sb = getSupabaseClient();
  var profile = getCurrentUser();
  if (!sb || !profile) return [];

  var result = await sb
    .from("analyses")
    .select("id,type,target_username,target_username_2,result_title,result_subtitle,result_quote,avatar_emoji,metrics,raw_result,language,created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit || 30);

  if (result.error) {
    console.warn("XORA analyses fetch failed:", result.error.message);
    return [];
  }
  return result.data || [];
}

/* ---------------- dil (TR varsayılan) ---------------- */

var I18N = {
  tr: {
    nav_profile: "Profil",
    nav_login: "Giriş Yap",
    /* ana sayfa */
    home_hi: "Merhaba, ben XORA.",
    home_sub: "X'te aslında kim olduğunu söylerim. Hazırsan başlayalım.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Kendi X karakterini çıkar. Aynaya bak, kim olduğunu gör.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Merak ettiğin hesabı analiz et. Kimseye söylemeyiz.",
    card_match_t: "X Match",
    card_match_d: "İki hesabı karşılaştır. Uyum mu, felaket mi?",
    badge_free: "Ücretsiz",
    badge_c5: "5 Kredi",
    badge_c10: "10 Kredi",
    /* mirror */
    mirror_h1: "X Mirror",
    mirror_sub: "Hesabını bağla, XORA son paylaşımlarına baksın. Kendi kartın her zaman ücretsiz.",
    mirror_ph: "@kullaniciadin",
    mirror_btn: "Aynaya Bak",
    mirror_login_cta: "X ile giriş yap ve kartımı çıkar",
    mirror_login_note: "Mirror için X hesabını bağlaman gerekir.",
    auth_title: "XORA’ya Giriş Yap",
    auth_sub: "Kendi X kartını oluşturmak için hesabını bağla.",
    auth_x_btn: "X ile Giriş Yap",
    auth_config_missing: "Supabase ayarları eksik. config.js dosyasını doldur.",
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
    match_friend: "Arkadaşlık",
    match_work: "İş Ortaklığı",
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
    profile_nouser: "Henüz hesabını bağlamadın.",
    profile_gomirror: "X ile Giriş Yap",
    profile_empty: "Henüz analiz yapmadın. İlk kartını çıkar!",
    logout_confirm: "Çıkış yapılsın mı? Geçmiş analizler silinir, kredilerin durur.",
    logout_done: "Çıkış yapıldı",
    /* krediler */
    credits_h1: "Merak Kredisi",
    credits_sub: "Kendi kartın hep ücretsiz. Başkalarını merak etmek kredi ister.",
    credits_balance: "Bakiyen",
    credits_buy: "Yükle",
    credits_note: "V1 demo: ödeme alınmaz, krediler anında yüklenir.",
    pkg1_n: "Çaylak Paketi",
    pkg2_n: "Meraklı Paketi",
    pkg3_n: "Dedektif Paketi",
    toast_loaded: "kredi yüklendi ⚡",
    /* hatalar / bildirimler */
    toast_handle: "Önce bir kullanıcı adı yaz",
    toast_two: "İki kullanıcı adı da gerekli",
    toast_same: "İki farklı hesap girmelisin 🙂",
    toast_nocredit: "Kredin yetersiz, yönlendiriyorum…",
    toast_saved: "Kart indirildi",
    cost_info: "kredi kullanıldı",
    date_today: "bugün"
  },
  en: {
    nav_profile: "Profile",
    nav_login: "Sign In",
    home_hi: "Hi, I'm XORA.",
    home_sub: "I'll tell you who you really are on X. Ready when you are.",
    card_mirror_t: "X Mirror",
    card_mirror_d: "Reveal your own X character. Look in the mirror.",
    card_stalk_t: "X Stalk",
    card_stalk_d: "Analyze the account you're curious about. We won't tell.",
    card_match_t: "X Match",
    card_match_d: "Compare two accounts. Soulmates or disaster?",
    badge_free: "Free",
    badge_c5: "5 Credits",
    badge_c10: "10 Credits",
    mirror_h1: "X Mirror",
    mirror_sub: "Connect your account and let XORA read your recent posts. Your own card is always free.",
    mirror_ph: "@yourhandle",
    mirror_btn: "Look in the Mirror",
    mirror_login_cta: "Sign in with X and create my card",
    mirror_login_note: "Mirror requires connecting your X account.",
    auth_title: "Sign in to XORA",
    auth_sub: "Connect your X account to create your own card.",
    auth_x_btn: "Sign in with X",
    auth_config_missing: "Supabase config is missing. Fill config.js first.",
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
    match_friend: "Friendship",
    match_work: "Work Partnership",
    sc_viral: "Viral Potential",
    sc_kaos: "Chaos Level",
    sc_mizah: "Humor Dose",
    sc_gece: "Night Activity",
    profile_h1: "Profile",
    profile_balance: "Curiosity Credits",
    profile_last: "Your Last Card",
    profile_history: "Past Analyses",
    profile_logout: "Log Out",
    profile_nouser: "You haven't connected your account yet.",
    profile_gomirror: "Sign in with X",
    profile_empty: "No analyses yet. Get your first card!",
    logout_confirm: "Log out? Your history will be cleared, credits stay.",
    logout_done: "Logged out",
    credits_h1: "Curiosity Credits",
    credits_sub: "Your own card is always free. Curiosity about others costs credits.",
    credits_balance: "Your balance",
    credits_buy: "Load",
    credits_note: "V1 demo: no payment taken, credits load instantly.",
    pkg1_n: "Rookie Pack",
    pkg2_n: "Curious Pack",
    pkg3_n: "Detective Pack",
    toast_loaded: "credits loaded ⚡",
    toast_handle: "Type a username first",
    toast_two: "Both usernames are required",
    toast_same: "Enter two different accounts 🙂",
    toast_nocredit: "Not enough credits, redirecting…",
    toast_saved: "Card downloaded",
    cost_info: "credits used",
    date_today: "today"
  }
};

function getLang() { return localStorage.getItem(LS.lang) || "tr"; }

function setLang(l) {
  localStorage.setItem(LS.lang, l);
  applyI18n();
  document.dispatchEvent(new CustomEvent("xora:lang"));
}

function t(key) {
  var lang = getLang();
  if (I18N[lang] && I18N[lang][key] !== undefined) return I18N[lang][key];
  if (I18N.tr[key] !== undefined) return I18N.tr[key];
  return key;
}

function applyI18n() {
  document.documentElement.lang = getLang();
  var nodes = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
  }
  var phs = document.querySelectorAll("[data-i18n-ph]");
  for (var j = 0; j < phs.length; j++) {
    phs[j].placeholder = t(phs[j].getAttribute("data-i18n-ph"));
  }
  var lb = document.getElementById("langBtn");
  if (lb) lb.textContent = getLang() === "tr" ? "EN" : "TR";
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
  var modal = document.getElementById("authModal");
  if (!modal) return;
  modal.hidden = false;
  applyI18n();
  var btn = document.getElementById("authModalBtn");
  if (btn) btn.focus();
}

function closeAuthModal() {
  var modal = document.getElementById("authModal");
  if (modal) modal.hidden = true;
}

function ensureAuthModal() {
  if (document.getElementById("authModal")) return;
  var modal = document.createElement("div");
  modal.className = "auth-modal";
  modal.id = "authModal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="auth-backdrop" data-auth-close></div>' +
    '<div class="auth-dialog panel" role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
      '<button type="button" class="pill auth-close" data-auth-close>×</button>' +
      '<h2 id="authTitle" data-i18n="auth_title">XORA’ya Giriş Yap</h2>' +
      '<p class="history-date auth-copy" data-i18n="auth_sub">Kendi X kartını oluşturmak için hesabını bağla.</p>' +
      '<button type="button" class="btn" id="authModalBtn" data-i18n="auth_x_btn">X ile Giriş Yap</button>' +
    '</div>';
  document.body.appendChild(modal);

  var closers = modal.querySelectorAll("[data-auth-close]");
  for (var i = 0; i < closers.length; i++) {
    closers[i].addEventListener("click", closeAuthModal);
  }
  document.getElementById("authModalBtn").addEventListener("click", signInWithX);
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
    links[i].setAttribute("href", loggedIn ? "profile.html" : "#auth");
    links[i].onclick = loggedIn ? null : function (e) {
      e.preventDefault();
      openAuthModal();
    };
  }
  refreshTopbar();
}

function initTopbar() {
  ensureAuthModal();
  refreshTopbar();
  refreshAuthUi();
  var lb = document.getElementById("langBtn");
  if (lb) {
    lb.addEventListener("click", function () {
      setLang(getLang() === "tr" ? "en" : "tr");
    });
  }
}

/* ---------------- sayfa açılışı ---------------- */

document.addEventListener("DOMContentLoaded", function () {
  getCredits();   // ilk girişte 10 kredi tanımlanır
  initTopbar();
  applyI18n();
  initSession();
});
