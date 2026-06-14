/* ============================================================
   XORA — app.js
   Ortak mantık: depolama, krediler, dil (TR/EN), üst bar, toast
   ============================================================ */

var LS = {
  users: "xora_users",
  currentUser: "xora_current_user",
  analyses: "xora_analyses",
  hiddenAnalyses: "xora_hidden_analyses",
  credits: "xora_credits",
  history: "xora_history",
  lang: "xora_lang"
};

var COSTS = { stalk: 5, match: 10 };
var FREE_CREDITS = 55;
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
      credit_balance: 50,
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
  return profile;
}

async function createLocalUser(username, email, password) {
  var sb = getSupabaseClient();
  if (!sb) return { success: false, error: "Supabase bağlantısı kurulamadı" };

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
    if (!signup.data || !signup.data.user) return { success: false, error: "Üyelik oluşturulamadı" };

    var profile = await ensureUserRow(signup.data.user, cleanUsername);
    return { success: true, user: profile, hasSession: !!signup.data.session };
  } catch (err) {
    console.error("[XORA auth] createLocalUser failed", err);
    return { success: false, error: err.message || String(err) };
  }
}

async function loginLocalUser(email, password) {
  var sb = getSupabaseClient();
  if (!sb) return { success: false, error: "Supabase bağlantısı kurulamadı" };

  try {
    console.log("[XORA auth] signIn start");
    var signin = await sb.auth.signInWithPassword({
      email: String(email || "").trim().toLowerCase(),
      password: password
    });
    console.log("[XORA auth] signIn result", signin);
    if (signin.error) return { success: false, error: signin.error.message };
    if (!signin.data || !signin.data.user) return { success: false, error: "Giriş yapılamadı" };

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
  var next = c - n;
  localStorage.setItem(LS.credits, String(next));
  var user = getCurrentUser();
  if (user) {
    user.credit_balance = next;
    setCurrentUser(user);
  }
  refreshTopbar();
  return true;
}

/* ---------------- geçmiş ---------------- */

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
    user.last_card = item;
  }
  setCurrentUser(user);
  saveAnalysisToSupabase(item);
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
  if (result && result.archetype && result.archetype.name) title = result.archetype.name[getLang()];
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
    mirror_sub: "Kendi X karakterini görmek için X kullanıcı adını yaz.",
    mirror_ph: "@kullaniciadi",
    mirror_btn: "Aynaya Bak",
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
    profile_card_renew: "Yeni Mirror çek"
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
    mirror_sub: "Enter your X username to see your X character.",
    mirror_ph: "@yourhandle",
    mirror_btn: "Look in the Mirror",
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
    profile_card_renew: "Get a new Mirror"
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
  var lb = document.getElementById("langBtn");
  if (lb) {
    lb.addEventListener("click", function () {
      setLang(getLang() === "tr" ? "en" : "tr");
    });
  }
}

function initAuthGuards() {
  var links = document.querySelectorAll("[data-auth-required]");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function (e) {
      if (!isLoggedIn()) {
        e.preventDefault();
        window.location.href = "auth.html";
      }
    });
  }
}

/* ---------------- sayfa açılışı ---------------- */

document.addEventListener("DOMContentLoaded", function () {
  getCredits();   // ilk girişte 10 kredi tanımlanır
  initTopbar();
  initAuthGuards();
  applyI18n();
  initSession();
});
