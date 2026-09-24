/* ============================================================
   XORA — card.js
   X Kimlik Kartı: ekranda gösterim, PNG indirme, X'te paylaşma
   V2: Davranış Merkez Mimarisi desteği + backward compat
   ============================================================ */

/* ---------------- yardımcı: hash'ten sahte barkod ---------------- */

function fakeBarcode(h) {
  var s = "";
  for (var i = 0; i < 22; i++) {
    s += ((h >>> (i % 28)) & 1) ? "▋" : "▏";
  }
  return s;
}

/* ---------------- Fun / Real katmanı ---------------- */

function resultTier(res) {
  return res && res.meta && ["real","fun"].indexOf(res.meta.tier) >= 0 ? res.meta.tier : "legacy";
}

function rarityName(res) {
  if (typeof ensureRealRarity === "function") ensureRealRarity(res);
  return (res && res.rarity && res.rarity.name) || (res && res.meta && res.meta.rarity) || "common";
}

function rarityText(res) {
  var name = rarityName(res);
  return typeof t === "function" ? t("rarity_" + name) : name.toUpperCase();
}

function realRibbonHtml(res) {
  return '<div class="card-status real-status"><span>' + esc(t("real_label")) + '</span><b>' + esc(rarityText(res)) + '</b></div>';
}

function funRibbonHtml() {
  return '<div class="card-status fun-status"><span>' + esc(t("fun_label")) + '</span></div>';
}

function decorateRealCardHtml(html, res) {
  var idx = html.indexOf(">");
  if (idx < 0) return html;
  html = html.slice(0, idx) + ' data-tier="real"' + html.slice(idx);
  idx = html.indexOf(">");
  return html.slice(0, idx + 1) + realRibbonHtml(res) + html.slice(idx + 1);
}

function localized(v, lang) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.tr || v.en || "";
}

// FUN cards read no X data, so they carry no scores or bars. These chips are the persona's style
// tags from FUN_PERSONAS (humor / reply / timeline), shown as words only.
var FUN_TRAIT_DIMENSIONS = ["humor", "reply", "timeline"];

function funTraitChips(res) {
  // funIdentityPersona returns the derived card; the style tags live on the canonical persona.
  var card = typeof funIdentityPersona === "function" ? funIdentityPersona(res) : null;
  var persona = card && typeof FUN_PERSONAS !== "undefined" ? FUN_PERSONAS.find(function (p) { return p.id === card.id; }) : null;
  var traits = persona && persona.traits;
  if (!traits) return [];
  return FUN_TRAIT_DIMENSIONS.filter(function (d) { return traits[d]; }).map(function (d) {
    return { dimension: d, label: t("trait_" + d), value: t("trait_" + d + "_" + traits[d]) };
  });
}

function funTraitChipsHtml(res) {
  var chips = funTraitChips(res);
  if (!chips.length) return "";
  return '<div class="trait-chips">' + chips.map(function (c) {
    return '<span class="trait-chip" data-trait="' + c.dimension + '"><b>' + esc(c.label) + "</b> " + esc(c.value) + "</span>";
  }).join("") + "</div>";
}

function buildFunIdentityCard(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var persona = funIdentityPersona(res);
  var color = (res.card && res.card.color) || (res.archetype && res.archetype.color) || "#10B8B8";
  var emoji = res.profile_emoji || (res.card && res.card.emoji) || (res.archetype && res.archetype.emoji) || "✨";
  var nick = localized((persona && persona.nickname) || res.nickname || (res.card && res.card.nickname) || (res.archetype && res.archetype.name), lang);
  var desc = persona ? funModeTagline(persona, res.mode, lang) : localized(res.tagline || (res.card && res.card.desc) || (res.archetype && res.archetype.desc), lang);
  var comment = funIdentityComment(res, lang);

  return (
    '<div class="idcard funcard" style="--ac:' + color + '" data-tier="fun">' +
      funRibbonHtml() +
      '<div class="idcard-band"><span class="idcard-avatar">' + emoji + '</span></div>' +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + '</p>' +
        '<h2 class="idcard-type">' + esc(nick) + '</h2>' +
        (desc ? '<p class="idcard-desc">' + esc(desc) + '</p>' : '') +
        funTraitChipsHtml(res) +
        '<div class="idcard-quote fun-quote"><p>' + esc(comment) + '</p></div>' +
      '</div>' +
      '<div class="idcard-foot"><span>XORA FUN</span><span class="barcode">' + fakeBarcode(res.hash || 1) + '</span><span class="idcard-host">' + XORA_PUBLIC_HOST + '</span></div>' +
    '</div>'
  );
}

function buildFunMatchCard(m) {
  var comment = typeof matchComment === "function" ? matchComment(m, getLang()) : "";
  return (
    '<div class="idcard matchcard funcard" style="--ac:#FF7A45" data-tier="fun">' +
      funRibbonHtml() +
      '<div class="idcard-band match-band"><span class="idcard-avatar small">' + m.resA.archetype.emoji + '</span><span class="match-x">×</span><span class="idcard-avatar small">' + m.resB.archetype.emoji + '</span></div>' +
      '<div class="idcard-body"><p class="idcard-handle">@' + esc(m.a) + ' × @' + esc(m.b) + '</p>' +
      '<h2 class="idcard-type match-pct">%' + m.overall + '</h2><p class="idcard-desc">' + esc(t("fun_match_label")) + '</p>' +
      '<div class="idcard-quote fun-quote"><span class="quote-label">XORA FUN</span><p>' + esc(comment) + '</p></div></div>' +
      '<div class="idcard-foot"><span>XORA FUN</span><span class="barcode">' + fakeBarcode(xhash(m.a + m.b)) + '</span><span class="idcard-host">' + XORA_PUBLIC_HOST + '</span></div></div>'
  );
}

/* ---------------- REAL kart: AI puanlı metrikler ---------------- */

// The 4-6 evidence-scored metrics analyze-real returns (validated 15-95 on the server). The in-app
// card and the share card both draw exactly these bars; raw behavior_signals are never drawn.
function realScoredBars(res, lang) {
  var c = (res && res.card) || {};
  return ((c.top_behaviors || (res && res.top_behaviors)) || []).slice(0, 6).map(function (b) {
    return { key: b.key, label: b.label ? localized(b.label, lang) : b.key, value: shareClamp(b.value) };
  });
}

// The comment written for the result's own mode: Mirror → comment.mirror, Stalk → comment.stalk
// (results without a stalk entry fall back to mirror), Match → the AI match analysis.
function realModeComment(res, lang) {
  if (!res) return "";
  if (res.mode === "match" || (res.a && res.b && res.resA)) return matchComment(res, lang) || "";
  var c = res.comment || {};
  return localized(res.mode === "stalk" ? (c.stalk || c.mirror) : c.mirror, lang);
}

function buildRealIdentityCard(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var c = res.card || {};
  var color = c.color || "#1E2330";
  var emoji = c.emoji || res.profile_emoji || "🪞";
  var nick = localized(res.nickname || c.nickname, lang);
  var tagline = localized(res.tagline || c.desc, lang);
  var summary = localized(res.profile_summary, lang);
  var comment = realModeComment(res, lang);
  var rows = realScoredBars(res, lang).map(function (row) {
    return '<div class="score-chip" data-metric="' + esc(row.key) + '">' +
      '<span class="score-name">' + esc(row.label) + "</span>" +
      '<span class="score-bar"><i style="width:' + row.value + '%"></i></span>' +
      '<span class="score-val">' + row.value + "</span>" +
    "</div>";
  }).join("");
  return (
    '<div class="idcard realcard" style="--ac:' + color + '">' +
      '<div class="idcard-band"><span class="idcard-avatar">' + emoji + "</span></div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + "</p>" +
        '<h2 class="idcard-type">' + esc(nick) + "</h2>" +
        (tagline ? '<p class="idcard-desc">' + esc(tagline) + "</p>" : "") +
        (summary && summary !== tagline ? '<p class="idcard-summary">' + esc(summary) + "</p>" : "") +
        (rows ? '<div class="real-metrics" data-source="ai_metrics"><div class="idcard-scores">' + rows + "</div></div>" : "") +
        '<div class="idcard-quote">' +
          '<span class="quote-label">' + esc(t("says")) + "</span>" +
          "<p>" + esc(comment) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="idcard-foot"><span>XORA</span><span class="barcode">' + fakeBarcode(res.hash || xhash(String(res.handle || "x"))) + '</span><span class="idcard-host">' + XORA_PUBLIC_HOST + '</span></div>' +
    "</div>"
  );
}

/* ---------------- version detection ---------------- */

function isV3Result(res) {
  return res && res.meta && res.meta.version === "mirror_v3";
}

function isV2Result(res) {
  return !isV3Result(res) && res && res.card && res.card.top_behaviors && res.card.top_behaviors.length > 0;
}

/* ============================================================
   KİMLİK KARTI (Mirror & Stalk)
   V3: Profil okuma — summary, topics, behaviors, signals, yorum
   V2: Davranış skorları + nickname (backward compat)
   V1 fallback: archetype + SCORE_KEYS
   ============================================================ */

function buildIdentityCard(res) {
  if (resultTier(res) === "fun") return buildFunIdentityCard(res);
  if (resultTier(res) === "real") return decorateRealCardHtml(buildRealIdentityCard(res), res);
  var html;
  if (isV3Result(res)) html = buildIdentityCardV3(res);
  else if (isV2Result(res)) html = buildIdentityCardV2(res);
  else html = buildIdentityCardV1(res);
  return resultTier(res) === "real" ? decorateRealCardHtml(html, res) : html;
}

/* --- V3 kart: profil okuma (sadeleştirilmiş) --- */
function buildIdentityCardV3(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var color = (res.card && res.card.color) || "#1B1B1B";
  var nick = res.nickname ? (res.nickname[lang] || res.nickname.tr) : "";
  var emoji = res.profile_emoji || "🪞";
  var tagline = res.tagline ? (res.tagline[lang] || res.tagline.tr) : "";
  var mirror = res.comment ? res.comment.mirror[lang] : "";
  var mode = res.mode || "mirror";
  var quoteLabel = mode === "stalk"
    ? "XORA Stalk"
    : (lang === "tr" ? "XORA Ayna" : lang === "es" ? "XORA Espejo" : lang === "pt" ? "XORA Espelho" : lang === "ar" ? "مرآة XORA" : lang === "fr" ? "Miroir XORA" : lang === "de" ? "XORA Spiegel" : lang === "it" ? "Specchio XORA" : lang === "ja" ? "XORAミラー" : lang === "ko" ? "XORA 미러" : lang === "zh" ? "XORA 鏡子" : lang === "ru" ? "Зеркало XORA" : "XORA Mirror");

  var chips = "";
  var top = res.top_behaviors || [];
  for (var j = 0; j < top.length && j < 6; j++) {
    var b = top[j];
    var label = b.label ? (b.label[lang] || b.label.tr) : b.key;
    chips +=
      '<div class="score-chip">' +
        '<span class="score-name">' + esc(label) + "</span>" +
        '<span class="score-bar"><i style="width:' + b.value + '%"></i></span>' +
        '<span class="score-val">' + b.value + "</span>" +
      "</div>";
  }

  return (
    '<div class="idcard v3card" style="--ac:' + color + '">' +
      '<div class="idcard-band">' +
        '<span class="idcard-avatar">' + emoji + "</span>" +
      "</div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + "</p>" +
        (nick ? '<h2 class="idcard-type">' + esc(nick) + "</h2>" : "") +
        (tagline ? '<p class="idcard-desc">' + esc(tagline) + "</p>" : "") +
        '<div class="idcard-scores">' + chips + "</div>" +
        '<div class="idcard-quote">' +
          '<span class="quote-label">' + esc(quoteLabel) + "</span>" +
          "<p>" + esc(mirror) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="idcard-foot">' +
        "<span>XORA</span>" +
        '<span class="barcode">' + fakeBarcode(res.hash) + "</span>" +
        "<span class=\"idcard-host\">" + XORA_PUBLIC_HOST + "</span>" +
      "</div>" +
    "</div>"
  );
}

/* --- V2 kart: davranış skorları --- */
function buildIdentityCardV2(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var c = res.card;
  var comment = res.comment ? res.comment.mirror[lang] : "";

  var chips = "";
  for (var i = 0; i < c.top_behaviors.length; i++) {
    var b = c.top_behaviors[i];
    var label = b.label ? (b.label[lang] || b.label.tr) : b.key;
    chips +=
      '<div class="score-chip">' +
        '<span class="score-name">' + esc(label) + "</span>" +
        '<span class="score-bar"><i style="width:' + b.value + '%"></i></span>' +
        '<span class="score-val">' + b.value + "</span>" +
      "</div>";
  }

  return (
    '<div class="idcard" style="--ac:' + c.color + '">' +
      '<div class="idcard-band">' +
        '<span class="idcard-avatar">' + c.emoji + "</span>" +
      "</div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + "</p>" +
        '<h2 class="idcard-type">' + esc(c.nickname[lang]) + "</h2>" +
        '<p class="idcard-desc">' + esc(c.desc[lang]) + "</p>" +
        '<div class="idcard-scores">' + chips + "</div>" +
        '<div class="idcard-quote">' +
          '<span class="quote-label">' + esc(t("says")) + "</span>" +
          "<p>" + esc(comment) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="idcard-foot">' +
        "<span>XORA</span>" +
        '<span class="barcode">' + fakeBarcode(res.hash) + "</span>" +
        "<span class=\"idcard-host\">" + XORA_PUBLIC_HOST + "</span>" +
      "</div>" +
    "</div>"
  );
}

/* --- V1 kart: archetype tabanlı (backward compat) --- */
function buildIdentityCardV1(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var a = res.archetype;
  var comment = a.comments[lang][res.ci];

  var chips = "";
  for (var i = 0; i < SCORE_KEYS.length; i++) {
    var k = SCORE_KEYS[i];
    chips +=
      '<div class="score-chip">' +
        '<span class="score-name">' + esc(t(k)) + "</span>" +
        '<span class="score-bar"><i style="width:' + res.scores[k] + '%"></i></span>' +
        '<span class="score-val">' + res.scores[k] + "</span>" +
      "</div>";
  }

  return (
    '<div class="idcard" style="--ac:' + a.color + '">' +
      '<div class="idcard-band">' +
        '<span class="idcard-avatar">' + a.emoji + "</span>" +
      "</div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + "</p>" +
        '<h2 class="idcard-type">' + esc(a.name[lang]) + "</h2>" +
        '<p class="idcard-desc">' + esc(a.desc[lang]) + "</p>" +
        '<div class="idcard-quote">' +
          '<span class="quote-label">' + esc(t("says")) + "</span>" +
          "<p>" + esc(comment) + "</p>" +
        "</div>" +
        '<div class="idcard-scores">' + chips + "</div>" +
      "</div>" +
      '<div class="idcard-foot">' +
        "<span>XORA</span>" +
        '<span class="barcode">' + fakeBarcode(res.hash) + "</span>" +
        "<span class=\"idcard-host\">" + XORA_PUBLIC_HOST + "</span>" +
      "</div>" +
    "</div>"
  );
}

/* ============================================================
   match kartı — unchanged
   ============================================================ */

function buildMatchCard(m) {
  if (resultTier(m) === "fun") return buildFunMatchCard(m);
  return resultTier(m) === "real" ? decorateRealCardHtml(buildMatchCardBase(m), m) : buildMatchCardBase(m);
}

function buildMatchCardBase(m) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  return (
    '<div class="idcard matchcard" style="--ac:#FF7A45">' +
      '<div class="idcard-band match-band">' +
        '<span class="idcard-avatar small">' + m.resA.archetype.emoji + "</span>" +
        '<span class="match-x">×</span>' +
        '<span class="idcard-avatar small">' + m.resB.archetype.emoji + "</span>" +
      "</div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(m.a) + " × @" + esc(m.b) + "</p>" +
        '<h2 class="idcard-type match-pct">%' + m.overall + "</h2>" +
        '<p class="idcard-desc">' + esc(t("match_overall")) + "</p>" +
        '<div class="match-rows">' +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_flirt")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.flirt + '%"></i></span>' +
            '<span class="score-val">%' + m.flirt + "</span>" +
          "</div>" +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_vibe")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.vibe + '%"></i></span>' +
            '<span class="score-val">%' + m.vibe + "</span>" +
          "</div>" +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_humor")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.humor + '%"></i></span>' +
            '<span class="score-val">%' + m.humor + "</span>" +
          "</div>" +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_chaos")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.chaos + '%"></i></span>' +
            '<span class="score-val">%' + m.chaos + "</span>" +
          "</div>" +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_romance")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.romance + '%"></i></span>' +
            '<span class="score-val">%' + m.romance + "</span>" +
          "</div>" +
        "</div>" +
        '<div class="idcard-quote">' +
          '<span class="quote-label">' + esc(t("says")) + "</span>" +
          "<p>" + esc(matchComment(m, lang)) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="idcard-foot">' +
        "<span>XORA</span>" +
        '<span class="barcode">' + fakeBarcode(xhash(m.a + m.b)) + "</span>" +
        "<span class=\"idcard-host\">" + XORA_PUBLIC_HOST + "</span>" +
      "</div>" +
    "</div>"
  );
}

/* ============================================================
   PNG ÜRETİMİ (canvas) — FUN / eski kartlar 1000 x 1250, REAL paylaşım kartı 1080 x 1350
   ============================================================ */

// Japanese and other CJK copy is written without spaces, so it has to wrap on character
// boundaries. Kinsoku basics: closing punctuation never starts a line and an opening bracket
// never ends one. Text without CJK characters keeps the original space-based wrapping.
var CJK_TEXT = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
var CJK_NO_LINE_START = "、。，．・：；？！‼⁇゛゜ゝゞ々ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ）］｝」』】〕〉》”’…!),.:;?]}";
var CJK_NO_LINE_END = "（［｛「『【〔〈《“‘([{";

function cjkUnits(text) {
  var units = [];
  var tokens = String(text).match(/[A-Za-z0-9@#_%+'’.-]+|\s+|[\s\S]/gu) || [];
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    var last = units.length ? units[units.length - 1] : "";
    var glued = units.length && (/^\s+$/.test(token) || CJK_NO_LINE_START.indexOf(token) >= 0 || CJK_NO_LINE_END.indexOf(last.slice(-1)) >= 0);
    if (glued) units[units.length - 1] = last + token;
    else units.push(token);
  }
  return units;
}

function wrapCjkLines(ctx, text, maxW) {
  var lines = [];
  var line = "";
  cjkUnits(text).forEach(function (unit) {
    if (line && ctx.measureText(line + unit).width > maxW) {
      lines.push(line.replace(/\s+$/, ""));
      line = /^\s+$/.test(unit) ? "" : unit;
    } else {
      line += unit;
    }
  });
  if (line.trim()) lines.push(line.replace(/\s+$/, ""));
  return lines.length ? lines : [""];
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  if (CJK_TEXT.test(text)) {
    var lines = wrapCjkLines(ctx, text, maxW);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y);
      if (i < lines.length - 1) y += lineH;
    }
    return y;
  }
  var words = text.split(" ");
  var line = "";
  for (var n = 0; n < words.length; n++) {
    var test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxW && n > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[n] + " ";
      y += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y);
  return y;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Handles, brand names and footers are always drawn LTR; only localized copy follows the language direction.
function copyDirection(lang) {
  return isRtlLang(lang) ? "rtl" : "ltr";
}

// Canvas resolves missing glyphs through the browser locale, which can draw Japanese kanji with
// Chinese glyph shapes and Korean hangul with a fallback face. For those locales only, name the
// system fonts of that script before the generic family.
var LOCALE_FONT_FALLBACK = {
  ja: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",YuGothic,Meiryo,"Noto Sans JP","Noto Sans CJK JP"',
  ko: '"Apple SD Gothic Neo","Malgun Gothic","Nanum Gothic","Noto Sans KR","Noto Sans CJK KR"',
  zh: '"PingFang TC","Microsoft JhengHei","Noto Sans TC","Noto Sans CJK TC"'
};

function applyLocaleFont(ctx, lang) {
  var fallback = LOCALE_FONT_FALLBACK[lang];
  if (!fallback) return ctx;
  var descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx) || {}, "font");
  if (!descriptor || !descriptor.set || !descriptor.get) return ctx;
  Object.defineProperty(ctx, "font", {
    configurable: true,
    get: function () { return descriptor.get.call(ctx); },
    set: function (value) { descriptor.set.call(ctx, String(value).replace(/,\s*(sans-serif|serif|monospace)\s*$/, "," + fallback + ",$1")); }
  });
  return ctx;
}

function baseCanvas() {
  var cv = document.createElement("canvas");
  cv.width = 1000;
  cv.height = 1250;
  var ctx = cv.getContext("2d");
  applyLocaleFont(ctx, (typeof getLang === "function") ? getLang() : "tr");
  ctx.textAlign = "center";
  ctx.direction = "ltr";

  ctx.fillStyle = "#FFF6E9";
  ctx.fillRect(0, 0, 1000, 1250);
  ctx.fillStyle = "rgba(15,189,189,0.12)";
  ctx.beginPath(); ctx.arc(80, 90, 190, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,122,69,0.12)";
  ctx.beginPath(); ctx.arc(940, 1180, 230, 0, 7); ctx.fill();
  return { cv: cv, ctx: ctx };
}

function drawCardFrame(ctx, accent) {
  ctx.save();
  ctx.shadowColor = "rgba(30,35,48,0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, 70, 80, 860, 1090, 36);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, 70, 80, 860, 1090, 36);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#1E2330";
  ctx.stroke();

  ctx.save();
  roundRect(ctx, 70, 80, 860, 300, 36);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(70, 80, 860, 300);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.arc(180, 120, 110, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(860, 330, 130, 0, 7); ctx.fill();
  ctx.restore();
}

function drawCardFooter(ctx, h) {
  ctx.direction = "ltr";
  ctx.fillStyle = "#1E2330";
  roundRect(ctx, 70, 1090, 860, 80, 0);
  ctx.save();
  roundRect(ctx, 70, 80, 860, 1090, 36);
  ctx.clip();
  ctx.fillRect(70, 1090, 860, 80);
  ctx.restore();

  ctx.fillStyle = "#FFF6E9";
  ctx.font = "800 30px Nunito, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("XORA", 110, 1140);
  ctx.textAlign = "right";
  ctx.font = "700 22px Nunito, Arial, sans-serif";
  ctx.fillText(XORA_PUBLIC_HOST, 890, 1140);
  ctx.textAlign = "center";
  // Narrower barcode so it never runs into the domain on the right.
  ctx.font = "18px monospace";
  ctx.fillText(fakeBarcode(h), 500, 1140);
}

/* --- kimlik kartı PNG --- */
function renderIdentityPNG(res) {
  if (resultTier(res) === "fun") return renderFunIdentityPNG(res);
  if (resultTier(res) === "real") return renderShareCard(res);
  if (isV3Result(res)) return renderIdentityPNGV3(res);
  if (isV2Result(res)) return renderIdentityPNGV2(res);
  return renderIdentityPNGV1(res);
}

// Same breaking rules as wrapText (CJK by character, everything else at spaces), returning lines.
function commentLines(ctx, text, maxW) {
  if (CJK_TEXT.test(text)) return wrapCjkLines(ctx, text, maxW);
  var words = String(text).split(" "), lines = [], line = "";
  for (var n = 0; n < words.length; n++) {
    var test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxW && n > 0) { lines.push(line.trim()); line = words[n] + " "; }
    else line = test;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/* ============================================================
   REAL PAYLAŞIM KARTI — 1080 x 1350 (4:5), "Sessiz Gözlemci" kartının yapısı:
   başlık (XORA REAL · mod · nadirlik · @handle) → arketip ikonu → arketip → kısa açıklama →
   4-6 skor çubuğu → XORA analiz kutusu → koyu XORA alt bandı.
   Yerleşim önce hesaplanır (shareCardLayout), sonra çizilir (paintShareCard):
   her metin kendi alanına sığacak şekilde küçültülür / kısaltılır.
   ============================================================ */

var SHARE_W = 1080, SHARE_H = 1350;
var SHARE_CARD = { x: 70, y: 60, w: 940, h: 1230 };
var SHARE_HEADER_H = 300;
var SHARE_FOOT_H = 88;
var SHARE_BAR_PITCH = 50;
var SHARE_INK = "#1E2330", SHARE_MUT = "#5C6270", SHARE_CREAM = "#FFF1E3";
var SHARE_FONT = "Nunito, Arial, sans-serif";
var SHARE_EMOJI_FONT = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
var SHARE_MATCH_KEYS = ["vibe", "humor", "chaos", "flirt", "romance"];
var SHARE_RARITY_MARK = { common: "●", rare: "◆", epic: "★", legendary: "✦" };
// Earlier REAL results stored a fixed mode icon; the card shows an archetype icon, so those fall back.
var SHARE_MODE_ICONS = ["🪞", "👀"];
var SHARE_DEFAULT_ICON = "✨";

function shareLang() {
  return (typeof getLang === "function") ? getLang() : "tr";
}

function shareClamp(v) {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
}

// The first two sentences of a line, so the description under the archetype stays short.
function shareShortLine(text) {
  var parts = shareSentences(text);
  return parts.slice(0, 2).join(CJK_TEXT.test(text || "") ? "" : " ");
}

function shareCardModel(res) {
  var lang = shareLang();
  var isMatch = res && (res.mode === "match" || (res.a && res.b && res.resA));
  var rarity = rarityName(res);
  var base = {
    lang: lang,
    rtl: copyDirection(lang) === "rtl",
    rarityLabel: (SHARE_RARITY_MARK[rarity] ? SHARE_RARITY_MARK[rarity] + " " : "") + rarityText(res),
    realLabel: t("real_label")
  };
  if (isMatch) {
    var iconOf = function (side) { return (side && side.archetype && side.archetype.emoji) || "👤"; };
    return Object.assign(base, {
      kind: "match",
      modeLabel: "MATCH",
      accent: "#FF7A45",
      bandColors: ["#0FBDBD", "#FF7A45"],
      handleLine: "@" + res.a + " × @" + res.b,
      icons: [iconOf(res.resA), iconOf(res.resB)],
      title: formatPercent(shareClamp(res.overall) / 100, lang),
      titleIsScore: true,
      description: t("match_overall"),
      bars: SHARE_MATCH_KEYS.map(function (k) { return { key: k, label: t("match_" + k), value: shareClamp(res[k]) }; }),
      boxLabel: t("share_label_match"),
      analysis: matchComment(res, lang) || "",
      hash: xhash(String(res.a) + String(res.b))
    });
  }
  var mode = res.mode === "stalk" ? "stalk" : "mirror";
  var c = res.card || {};
  var icon = c.emoji || res.profile_emoji || "";
  if (!icon || SHARE_MODE_ICONS.indexOf(icon) >= 0) icon = SHARE_DEFAULT_ICON;
  // The 4-6 evidence-scored REAL metrics the analysis returned; there is no filler row.
  var bars = realScoredBars(res, lang);
  return Object.assign(base, {
    kind: mode,
    modeLabel: mode.toUpperCase(),
    accent: c.color || "#2D3445",
    bandColors: [c.color || "#2D3445"],
    handleLine: "@" + res.handle,
    icons: [icon],
    title: localized(res.nickname || c.nickname, lang),
    description: shareShortLine(localized(res.tagline || c.desc, lang)),
    bars: bars,
    boxLabel: mode === "stalk" ? "XORA STALK" : t("share_label_mirror"),
    analysis: realModeComment(res, lang),
    hash: res.hash || xhash(String(res.handle || "x"))
  });
}

/* ---------- ölçüm yardımcıları ---------- */

function shareFont(weight, size) {
  return weight + " " + size + "px " + SHARE_FONT;
}

function shareWidth(ctx, font, text) {
  ctx.font = font;
  return ctx.measureText(String(text)).width;
}

// Cuts text (by code point) until it fits, ending in an ellipsis.
function shareEllipsize(ctx, font, text, maxW) {
  text = String(text || "");
  if (shareWidth(ctx, font, text) <= maxW) return text;
  var chars = Array.from(text);
  while (chars.length && shareWidth(ctx, font, chars.join("").replace(/\s+$/, "") + "…") > maxW) chars.pop();
  return chars.length ? chars.join("").replace(/\s+$/, "") + "…" : "";
}

// Largest size in [max..min] whose text fits maxW on one line; at min the text is ellipsized.
function shareFitLine(ctx, weight, max, min, text, maxW) {
  for (var s = max; s >= min; s--) {
    if (shareWidth(ctx, shareFont(weight, s), text) <= maxW) return { text: String(text), size: s, font: shareFont(weight, s) };
  }
  var font = shareFont(weight, min);
  return { text: shareEllipsize(ctx, font, text, maxW), size: min, font: font };
}

// Wraps like the other PNG renderers (CJK by character, others at spaces); any line still wider
// than maxW (one unbreakable word) is ellipsized so nothing is drawn outside its zone.
function shareWrap(ctx, font, text, maxW) {
  ctx.font = font;
  return commentLines(ctx, String(text || ""), maxW).map(function (line) {
    return shareWidth(ctx, font, line) <= maxW ? line : shareEllipsize(ctx, font, line, maxW);
  });
}

// Wraps into at most maxLines, stepping the size down first; the last line is ellipsized if needed.
function shareFitLines(ctx, weight, max, min, text, maxW, maxLines) {
  var lines;
  for (var s = max; s >= min; s--) {
    lines = shareWrap(ctx, shareFont(weight, s), text, maxW);
    if (lines.length <= maxLines && lines.join("").indexOf("…") < 0) return { lines: lines, size: s, font: shareFont(weight, s) };
  }
  var font = shareFont(weight, min);
  lines = shareWrap(ctx, font, text, maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = shareEllipsize(ctx, font, lines[maxLines - 1] + "…", maxW);
  }
  return { lines: lines, size: min, font: font };
}

function shareSentences(text) {
  text = String(text || "").trim();
  if (!text) return [];
  var parts = CJK_TEXT.test(text) ? text.split(/(?<=[。！？!?])/) : text.split(/(?<=[.!?؟…])\s+/);
  return parts.map(function (s) { return s.trim(); }).filter(Boolean);
}

var SHARE_INSIGHT_SIZES = [27, 26, 25];
function shareInsightBoxH(lines, size) {
  return 22 + 30 + 10 + lines * Math.round(size * 1.42) + 24;
}

// Target three lines; four only when no whole-sentence version fits in three. Whole sentences are
// dropped from the end before any line is cut, and the box never exceeds the height budget.
function shareFitInsight(ctx, text, maxW, budget) {
  var sentences = shareSentences(text);
  if (!sentences.length) return null;
  var joiner = CJK_TEXT.test(text) ? "" : " ";
  var passes = [3, 4];
  for (var p = 0; p < passes.length; p++) {
    for (var k = sentences.length; k >= 1; k--) {
      var candidate = sentences.slice(0, k).join(joiner);
      for (var s = 0; s < SHARE_INSIGHT_SIZES.length; s++) {
        var size = SHARE_INSIGHT_SIZES[s], font = shareFont(600, size);
        var lines = shareWrap(ctx, font, candidate, maxW);
        if (lines.length <= passes[p] && shareInsightBoxH(lines.length, size) <= budget) {
          return { lines: lines, size: size, font: font, sentences: k, total: sentences.length };
        }
      }
    }
  }
  var small = SHARE_INSIGHT_SIZES[SHARE_INSIGHT_SIZES.length - 1], smallFont = shareFont(600, small);
  var maxLines = 4;
  while (maxLines > 1 && shareInsightBoxH(maxLines, small) > budget) maxLines--;
  var cut = shareWrap(ctx, smallFont, sentences[0], maxW);
  if (cut.length > maxLines) {
    cut = cut.slice(0, maxLines);
    cut[maxLines - 1] = shareEllipsize(ctx, smallFont, cut[maxLines - 1] + "…", maxW);
  }
  return { lines: cut, size: small, font: smallFont, sentences: 1, total: sentences.length, truncated: true };
}

/* ---------- yerleşim ---------- */

// The Sessiz Gözlemci card: header (XORA REAL, mode, rarity, @handle), a round archetype icon over
// the header edge, archetype, short description, 4-6 score bars, the XORA analysis box and the dark
// footer. Returns everything the painter draws with its fitted text, font and box; tests and the
// local render check read the same object.
function shareCardLayout(model, ctx) {
  var card = SHARE_CARD;
  var cx = card.x + card.w / 2;
  var headerBottom = card.y + SHARE_HEADER_H;
  var footTop = card.y + card.h - SHARE_FOOT_H;
  var texts = [];
  var L = { model: model, size: { w: SHARE_W, h: SHARE_H }, card: card, headerBottom: headerBottom, footTop: footTop, texts: texts, zones: {} };
  function text(zone, str, font, x, y, align, box, color, dir) {
    texts.push({ zone: zone, text: str, font: font, x: x, y: y, align: align, box: box, color: color || SHARE_INK, dir: dir || "ltr" });
  }
  var dir = model.rtl ? "rtl" : "ltr";
  var isMatch = model.kind === "match";

  // 1. Header: XORA REAL + mode on the left, rarity on the right (brand words stay LTR).
  var realFont = shareFont(900, 22), modeFont = shareFont(900, 18), rarityFont = shareFont(900, 24);
  var realW = shareWidth(ctx, realFont, model.realLabel) + 38;
  var modeW = shareWidth(ctx, modeFont, model.modeLabel) + 38;
  var rarityW = shareWidth(ctx, rarityFont, model.rarityLabel) + 46;
  var pillMid = card.y + 28 + 25;
  L.pills = [
    { x: card.x + 30, y: pillMid - 23, w: realW, h: 46, fill: SHARE_INK, stroke: null },
    { x: card.x + 30 + realW + 10, y: pillMid - 21, w: modeW, h: 42, fill: "#FFFFFF", stroke: SHARE_INK },
    // On Match the right half of the header is already orange, so the rarity badge turns white.
    { x: card.x + card.w - 30 - rarityW, y: pillMid - 25, w: rarityW, h: 50, fill: isMatch ? "#FFFFFF" : "#FF7A45", stroke: SHARE_INK }
  ];
  text("header", model.realLabel, realFont, L.pills[0].x + realW / 2, pillMid + 8, "center", L.pills[0], "#FFFFFF");
  text("header", model.modeLabel, modeFont, L.pills[1].x + modeW / 2, pillMid + 7, "center", L.pills[1], SHARE_INK);
  text("header", model.rarityLabel, rarityFont, L.pills[2].x + rarityW / 2, pillMid + 9, "center", L.pills[2], isMatch ? SHARE_INK : "#FFFFFF");

  // 3. @handle (Match: both handles), white in the header like the old card.
  var handle = shareFitLine(ctx, 800, 36, 22, model.handleLine, card.w - 120);
  var handleY = card.y + 148;
  texts.push({ zone: "header", text: handle.text, font: handle.font, x: cx, y: handleY, align: "center", box: { x: card.x + 60, y: handleY - 38, w: card.w - 120, h: 46 }, color: "#FFFFFF", dir: "ltr", handle: true });

  // 2. Archetype icon over the header edge (Match: one per account, joined by ×).
  var r = isMatch ? 92 : 108;
  L.icons = isMatch
    ? [{ x: cx - 110, y: headerBottom, r: r, emoji: model.icons[0] }, { x: cx + 110, y: headerBottom, r: r, emoji: model.icons[1] }]
    : [{ x: cx, y: headerBottom, r: r, emoji: model.icons[0] }];
  if (isMatch) L.matchChip = { x: cx, y: headerBottom, r: 36 };

  // Body blocks, then spread evenly between the icon and the footer.
  var bodyTop = headerBottom + r + 18, bodyBottom = footTop - 20;
  var innerW = card.w - 112;
  var score = isMatch ? shareFitLine(ctx, 900, 96, 64, model.title, innerW) : null;
  var title = score ? { lines: [score.text], size: score.size } : shareFitLines(ctx, 900, 60, 44, model.title, innerW, 2);
  var titleLH = Math.round(title.size * 1.05);
  var titleH = title.size + (title.lines.length - 1) * titleLH;
  var desc = model.description ? shareFitLines(ctx, 600, 28, 25, model.description, innerW - 40, 2) : null;
  var descLH = desc ? Math.round(desc.size * 1.35) : 0;
  var descH = desc ? 12 + desc.size + (desc.lines.length - 1) * descLH : 0;
  var bars = (model.bars || []).slice(0, 6);
  var barsH = bars.length ? bars.length * SHARE_BAR_PITCH - 14 : 0;
  var boxW = card.w - 112;
  var fixedH = titleH + descH + barsH;
  var insight = shareFitInsight(ctx, model.analysis, boxW - 68, bodyBottom - bodyTop - fixedH - 4 * 14);
  var boxH = insight ? shareInsightBoxH(insight.lines.length, insight.size) : 0;
  var groups = [titleH + descH, barsH, boxH].filter(function (h) { return h > 0; });
  var gap = Math.max(14, (bodyBottom - bodyTop - groups.reduce(function (a, b) { return a + b; }, 0)) / (groups.length + 1));

  // 4-5. Archetype (Match: the score) and the short description.
  var y = bodyTop + gap;
  L.zones.title = { top: y, bottom: y + titleH + descH };
  title.lines.forEach(function (line, i) {
    var ty = y + Math.round(title.size * 0.86) + i * titleLH;
    texts.push({ zone: "title", text: line, font: shareFont(900, title.size), x: cx, y: ty, align: "center", box: { x: card.x + 56, y: ty - title.size, w: innerW, h: titleLH }, color: SHARE_INK, dir: model.titleIsScore ? "ltr" : dir, score: !!model.titleIsScore });
  });
  y += titleH;
  if (desc) {
    y += 12;
    desc.lines.forEach(function (line, i) {
      var dy = y + Math.round(desc.size * 0.86) + i * descLH;
      text("title", line, desc.font, cx, dy, "center", { x: card.x + 76, y: dy - desc.size, w: innerW - 40, h: descLH }, SHARE_MUT, dir);
    });
    y += desc.size + (desc.lines.length - 1) * descLH;
  }

  // 6. Score bars in the old style: label, bar, value.
  if (bars.length) {
    y += gap;
    var labelW = 290, valueW = 64, colGap = 22;
    var left = card.x + 64, right = card.x + card.w - 64;
    var barX = model.rtl ? left + valueW + colGap : left + labelW + colGap;
    var barW = right - left - labelW - valueW - 2 * colGap;
    L.bars = bars.map(function (b, i) {
      var rowY = y + i * SHARE_BAR_PITCH, base = rowY + 26;
      var lab = shareFitLine(ctx, 700, 27, 18, b.label, labelW);
      text("bars", lab.text, lab.font, model.rtl ? right : left, base, model.rtl ? "right" : "left", { x: model.rtl ? right - labelW : left, y: rowY, w: labelW, h: 36 }, SHARE_MUT, dir);
      texts.push({ zone: "bars", text: String(b.value), font: shareFont(900, 27), x: model.rtl ? left : right, y: base, align: model.rtl ? "left" : "right", box: { x: model.rtl ? left : right - valueW, y: rowY, w: valueW, h: 36 }, color: SHARE_INK, dir: "ltr" });
      return { x: barX, y: rowY + 6, w: barW, h: 24, fill: b.value, rtl: model.rtl, bar: b };
    });
    L.zones.bars = { top: y, bottom: y + barsH };
    y += barsH;
  } else {
    L.bars = [];
    L.zones.bars = { top: y, bottom: y };
  }

  // 7. The XORA analysis box.
  if (insight) {
    y += gap;
    var box = { x: card.x + 56, y: y, w: boxW, h: boxH };
    var lab2 = shareFitLine(ctx, 900, 23, 16, model.boxLabel, boxW - 68);
    text("analysis", lab2.text, lab2.font, cx, y + 22 + 22, "center", { x: box.x + 34, y: y + 18, w: boxW - 68, h: 30 }, SHARE_INK, dir);
    var lh = Math.round(insight.size * 1.42);
    insight.lines.forEach(function (line, i) {
      var ly = y + 22 + 30 + 10 + Math.round(insight.size * 0.9) + i * lh;
      text("analysis", line, insight.font, cx, ly, "center", { x: box.x + 34, y: ly - insight.size, w: boxW - 68, h: lh }, SHARE_INK, dir);
    });
    L.insight = { box: box, lines: insight.lines, size: insight.size, sentences: insight.sentences, total: insight.total, truncated: !!insight.truncated, dashed: model.kind === "stalk" };
    L.zones.analysis = { top: y, bottom: y + boxH };
  } else {
    L.zones.analysis = { top: y, bottom: y };
  }

  // 8. Dark footer: XORA, barcode, host.
  var footY = footTop + 56;
  text("footer", "XORA", shareFont(900, 32), card.x + 40, footY, "left", { x: card.x + 40, y: footTop + 20, w: 130, h: 44 }, "#FFF6E9");
  text("footer", XORA_PUBLIC_HOST, shareFont(800, 23), card.x + card.w - 40, footY, "right", { x: card.x + card.w - 40 - 300, y: footTop + 24, w: 300, h: 38 }, "#FFF6E9");
  L.barcode = { text: fakeBarcode(model.hash), font: "19px monospace", x: cx + 6, y: footY - 2 };
  return L;
}

/* ---------- çizim ---------- */

function paintShareCard(ctx, L) {
  var m = L.model, card = L.card;
  ctx.textBaseline = "alphabetic";
  ctx.direction = "ltr";
  ctx.fillStyle = "#FFF6E9"; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  ctx.fillStyle = "rgba(15,189,189,0.12)"; ctx.beginPath(); ctx.arc(80, 90, 200, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,122,69,0.12)"; ctx.beginPath(); ctx.arc(1040, 1290, 240, 0, 7); ctx.fill();

  // Card with the old soft shadow.
  ctx.save();
  ctx.shadowColor = "rgba(30,35,48,0.20)"; ctx.shadowBlur = 44; ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#FFFFFF"; roundRect(ctx, card.x, card.y, card.w, card.h, 40); ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, card.x, card.y, card.w, card.h, 40); ctx.clip();
  if (m.bandColors.length > 1) {
    var mid = card.x + card.w / 2;
    ctx.fillStyle = m.bandColors[0]; ctx.fillRect(card.x, card.y, card.w / 2, SHARE_HEADER_H);
    ctx.fillStyle = m.bandColors[1]; ctx.fillRect(mid, card.y, card.w / 2, SHARE_HEADER_H);
    ctx.fillStyle = SHARE_INK;
    ctx.beginPath(); ctx.moveTo(mid + 30, card.y); ctx.lineTo(mid + 36, card.y); ctx.lineTo(mid - 30, L.headerBottom); ctx.lineTo(mid - 36, L.headerBottom); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = m.bandColors[0]; ctx.fillRect(card.x, card.y, card.w, SHARE_HEADER_H);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.arc(card.x + 115, card.y + 55, 125, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(card.x + card.w - 60, card.y + 250, 120, 0, 7); ctx.fill();
  }
  ctx.fillStyle = SHARE_INK; ctx.fillRect(card.x, L.headerBottom - 2, card.w, 4);
  ctx.fillRect(card.x, L.footTop, card.w, SHARE_FOOT_H);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = SHARE_INK; roundRect(ctx, card.x, card.y, card.w, card.h, 40); ctx.stroke();

  L.pills.forEach(function (p) {
    ctx.fillStyle = p.fill; roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2); ctx.fill();
    if (p.stroke) { ctx.lineWidth = 3; ctx.strokeStyle = p.stroke; roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2); ctx.stroke(); }
  });

  L.icons.forEach(function (a) {
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = SHARE_INK; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = SHARE_INK;
    ctx.font = Math.round(a.r * 1.07) + "px " + SHARE_EMOJI_FONT; ctx.fillText(a.emoji, a.x, a.y + 6);
    ctx.textBaseline = "alphabetic";
  });
  if (L.matchChip) {
    var chip = L.matchChip;
    ctx.beginPath(); ctx.arc(chip.x, chip.y, chip.r, 0, 7); ctx.fillStyle = SHARE_INK; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = shareFont(900, 40); ctx.fillText("×", chip.x, chip.y + 2);
    ctx.textBaseline = "alphabetic";
  }

  L.bars.forEach(function (b) {
    ctx.fillStyle = "#ECEDF0"; roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.fill();
    var fw = Math.round(b.w * b.fill / 100);
    if (fw > 0) {
      ctx.save(); roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.clip();
      ctx.fillStyle = m.accent; roundRect(ctx, b.rtl ? b.x + b.w - fw : b.x, b.y, fw, b.h, b.h / 2); ctx.fill();
      ctx.restore();
    }
  });

  if (L.insight) {
    var box = L.insight.box;
    ctx.fillStyle = SHARE_CREAM; roundRect(ctx, box.x, box.y, box.w, box.h, 26); ctx.fill();
    if (L.insight.dashed && ctx.setLineDash) ctx.setLineDash([12, 8]);
    ctx.lineWidth = 3; ctx.strokeStyle = m.accent; roundRect(ctx, box.x, box.y, box.w, box.h, 26); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
  }

  L.texts.forEach(function (tx) {
    ctx.font = tx.font; ctx.fillStyle = tx.color; ctx.textAlign = tx.align; ctx.direction = tx.dir;
    if (tx.score || (tx.handle && m.kind === "match")) {
      // Match: the percent sign in XORA orange; handles in white with a soft "×".
      var parts = String(tx.text).split(tx.score ? /([\d٠-٩]+)/ : /( × )/).filter(Boolean);
      var total = parts.reduce(function (w, p) { return w + ctx.measureText(p).width; }, 0);
      var x = tx.x - total / 2;
      ctx.textAlign = "left"; ctx.direction = "ltr";
      parts.forEach(function (p) {
        ctx.fillStyle = tx.score ? (/[\d٠-٩]/.test(p) ? SHARE_INK : "#FF7A45") : (p === " × " ? "rgba(255,255,255,0.85)" : "#FFFFFF");
        ctx.fillText(p, x, tx.y); x += ctx.measureText(p).width;
      });
      return;
    }
    if (tx.handle) {
      ctx.save(); ctx.shadowColor = "rgba(30,35,48,0.35)"; ctx.shadowOffsetY = 2;
      ctx.fillText(tx.text, tx.x, tx.y); ctx.restore();
      return;
    }
    ctx.fillText(tx.text, tx.x, tx.y);
  });
  ctx.direction = "ltr"; ctx.textAlign = "center"; ctx.fillStyle = "#FFF6E9";
  ctx.font = L.barcode.font; ctx.fillText(L.barcode.text, L.barcode.x, L.barcode.y);
}

function renderShareCard(res) {
  var cv = document.createElement("canvas");
  cv.width = SHARE_W;
  cv.height = SHARE_H;
  var ctx = applyLocaleFont(cv.getContext("2d"), shareLang());
  var layout = shareCardLayout(shareCardModel(res), ctx);
  paintShareCard(ctx, layout);
  return cv;
}

function renderFunIdentityPNG(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var persona = funIdentityPersona(res);
  var c = res.card || {};
  var a = res.archetype || {};
  var color = c.color || a.color || "#10B8B8";
  var emoji = res.profile_emoji || c.emoji || a.emoji || "✨";
  var nick = localized((persona && persona.nickname) || res.nickname || c.nickname || a.name, lang);
  var desc = persona ? funModeTagline(persona, res.mode, lang) : localized(res.tagline || c.desc || a.desc, lang);
  var comment = funIdentityComment(res, lang);
  var b = baseCanvas(), ctx = b.ctx;
  drawCardFrame(ctx, color);
  ctx.fillStyle = "#1E2330"; roundRect(ctx, 50, 45, 260, 54, 27); ctx.fill();
  ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "left"; ctx.font = "900 24px Nunito, Arial, sans-serif"; ctx.fillText("XORA FUN · FREE", 72, 80);
  ctx.textAlign = "center";
  ctx.beginPath(); ctx.arc(500, 355, 118, 0, 7); ctx.fillStyle="#FFFFFF"; ctx.fill(); ctx.lineWidth=6; ctx.strokeStyle="#1E2330"; ctx.stroke();
  ctx.font = "126px 'Segoe UI Emoji','Apple Color Emoji',sans-serif"; ctx.fillText(emoji,500,402);
  ctx.fillStyle="#8A8F9C"; ctx.font="700 30px Nunito, Arial, sans-serif"; ctx.fillText("@"+res.handle,500,540);
  ctx.direction = copyDirection(lang);
  ctx.fillStyle="#1E2330"; ctx.font="900 56px Nunito, Arial, sans-serif"; var yNick=wrapText(ctx,nick,500,615,720,62);
  ctx.fillStyle="#5C6270"; ctx.font="600 28px Nunito, Arial, sans-serif"; var y=wrapText(ctx,desc,500,yNick+70,700,34)+42;
  var chips=funTraitChips(res);
  if (chips.length) y=drawTraitChips(ctx,chips,y-16,lang,color)+24;
  ctx.font="700 26px Nunito, Arial, sans-serif";
  var commentLines=1, line="";
  if (CJK_TEXT.test(comment)) commentLines=wrapCjkLines(ctx,comment,660).length;
  else comment.split(" ").forEach(function(word) {
    if (line && ctx.measureText(line+word+" ").width>660) { commentLines++; line=""; }
    line+=word+" ";
  });
  var quoteHeight=Math.max(220,70+(commentLines-1)*34);
  ctx.fillStyle="#FFF1E3"; roundRect(ctx,130,y,740,quoteHeight,24); ctx.fill(); ctx.strokeStyle=color; ctx.lineWidth=3; roundRect(ctx,130,y,740,quoteHeight,24); ctx.stroke();
  ctx.fillStyle="#1E2330"; ctx.font="700 26px Nunito, Arial, sans-serif"; wrapText(ctx,comment,500,y+42,660,34);
  drawCardFooter(ctx,res.hash||1);
  return b.cv;
}

// Chips stay on one row so the comment box keeps its space: the font steps down to fit 740px, and
// if even the smallest size is too wide the labels are dropped and only the values remain.
function drawTraitChips(ctx, chips, top, lang, accent) {
  var rtl = copyDirection(lang) === "rtl";
  var pad = 16, gap = 10, maxW = 740, sizes = [20, 19, 18, 17, 16];
  var size = 16, withLabels = false, parts = [];
  function measure(fontSize, labels) {
    return chips.map(function (c) {
      ctx.font = "700 " + fontSize + "px Nunito, Arial, sans-serif";
      var lw = labels ? ctx.measureText(c.label).width : 0;
      ctx.font = "900 " + fontSize + "px Nunito, Arial, sans-serif";
      var vw = ctx.measureText(c.value).width;
      return { chip: c, lw: lw, vw: vw, w: pad * 2 + vw + (labels ? lw + 8 : 0) };
    });
  }
  function total(list) { return list.reduce(function (a, p) { return a + p.w; }, 0) + gap * (list.length - 1); }
  for (var i = 0; i < sizes.length && !parts.length; i++) {
    var trial = measure(sizes[i], true);
    if (total(trial) <= maxW) { parts = trial; size = sizes[i]; withLabels = true; }
  }
  if (!parts.length) { parts = measure(16, false); size = 16; }
  var h = size + 18;
  var x = 500 - total(parts) / 2;
  var order = rtl ? parts.slice().reverse() : parts;
  ctx.save();
  ctx.textAlign = "left";
  order.forEach(function (p) {
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, x, top, p.w, h, h / 2); ctx.fill();
    ctx.strokeStyle = accent || "#1E2330"; ctx.lineWidth = 2; roundRect(ctx, x, top, p.w, h, h / 2); ctx.stroke();
    var baseline = top + h / 2 + size * 0.36;
    var first = rtl ? "value" : "label", cursor = x + pad;
    [first, first === "label" ? "value" : "label"].forEach(function (part) {
      if (part === "label" && !withLabels) return;
      ctx.font = (part === "label" ? "700 " : "900 ") + size + "px Nunito, Arial, sans-serif";
      ctx.fillStyle = part === "label" ? "#8A8F9C" : "#1E2330";
      ctx.fillText(part === "label" ? p.chip.label : p.chip.value, cursor, baseline);
      cursor += (part === "label" ? p.lw : p.vw) + 8;
    });
    x += p.w + gap;
  });
  ctx.restore();
  return top + h;
}

function renderFunMatchPNG(m) {
  var cv = renderMatchPNGBase(m, { scores: false, overallLabel: t("fun_match_label") }), ctx = cv.getContext("2d");
  ctx.save();
  ctx.fillStyle="#1E2330"; roundRect(ctx,48,46,260,54,27); ctx.fill();
  ctx.fillStyle="#fff"; ctx.font="900 24px Nunito, Arial, sans-serif"; ctx.textAlign="left"; ctx.fillText("XORA FUN · FREE",70,81);
  ctx.restore();
  return cv;
}

/* --- V3 PNG: profil okuma (sadeleştirilmiş) --- */
function renderIdentityPNGV3(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var color = (res.card && res.card.color) || "#1B1B1B";
  var nick = res.nickname ? (res.nickname[lang] || res.nickname.tr) : "";
  var emoji = res.profile_emoji || "🪞";
  var tagline = res.tagline ? (res.tagline[lang] || res.tagline.tr) : "";
  var mode = res.mode || "mirror";
  var quoteLabel = mode === "stalk" ? "XORA STALK" : (lang === "tr" ? "XORA AYNA" : lang === "es" ? "XORA ESPEJO" : lang === "pt" ? "XORA ESPELHO" : lang === "ar" ? "مرآة XORA" : lang === "fr" ? "MIROIR XORA" : lang === "de" ? "XORA SPIEGEL" : lang === "it" ? "SPECCHIO XORA" : lang === "ja" ? "XORAミラー" : lang === "ko" ? "XORA 미러" : lang === "zh" ? "XORA 鏡子" : lang === "ru" ? "ЗЕРКАЛО XORA" : "XORA MIRROR");
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, color);

  ctx.beginPath(); ctx.arc(500, 380, 120, 0, 7);
  ctx.fillStyle = "#FFFFFF"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
  ctx.font = "130px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.fillText(emoji, 500, 428);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 34px Nunito, Arial, sans-serif";
  ctx.fillText("@" + res.handle, 500, 250);
  ctx.direction = copyDirection(lang);

  var curNickY = 530;
  if (nick) {
    ctx.fillStyle = "#1E2330";
    ctx.font = "900 42px Nunito, Arial, sans-serif";
    ctx.fillText(nick, 500, curNickY);
    curNickY += 36;
  }

  ctx.fillStyle = "#5C6270";
  ctx.font = "600 24px Nunito, Arial, sans-serif";
  var sumY = wrapText(ctx, tagline, 500, curNickY + 10, 700, 30);

  var curY = sumY + 30;

  var top = res.top_behaviors || [];
  for (var i = 0; i < top.length && i < 6; i++) {
    var label = top[i].label ? (top[i].label[lang] || top[i].label.tr) : top[i].key;
    var val = top[i].value;
    curY += 36;
    ctx.textAlign = "left";
    ctx.font = "700 22px Nunito, Arial, sans-serif";
    ctx.fillStyle = "#5C6270";
    ctx.fillText(label, 180, curY);
    ctx.fillStyle = "#ECEDF0";
    roundRect(ctx, 430, curY - 16, 270, 20, 10);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, 430, curY - 16, Math.max(Math.round(270 * val / 100), 10), 20, 10);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.font = "800 22px Nunito, Arial, sans-serif";
    ctx.fillStyle = "#1E2330";
    ctx.fillText(val, 740, curY);
  }
  ctx.textAlign = "center";
  curY += 30;

  var mirror = res.comment ? res.comment.mirror[lang] : "";
  if (mirror) {
    var boxH = 160;
    if (curY + boxH > 1060) boxH = 1060 - curY;
    ctx.fillStyle = "#FFF1E3";
    roundRect(ctx, 130, curY, 740, boxH, 24);
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    roundRect(ctx, 130, curY, 740, boxH, 24);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "800 22px Nunito, Arial, sans-serif";
    ctx.fillText(quoteLabel, 500, curY + 32);

    ctx.fillStyle = "#1E2330";
    ctx.font = "600 22px Nunito, Arial, sans-serif";
    wrapText(ctx, mirror, 500, curY + 62, 660, 28);
  }

  drawCardFooter(ctx, res.hash);
  return b.cv;
}

/* --- V2 PNG: davranış skorları --- */
function renderIdentityPNGV2(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var c = res.card;
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, c.color);

  ctx.beginPath(); ctx.arc(500, 380, 120, 0, 7);
  ctx.fillStyle = "#FFFFFF"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
  ctx.font = "130px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.fillText(c.emoji, 500, 428);

  ctx.fillStyle = "#8A8F9C";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText("@" + res.handle, 500, 560);
  ctx.direction = copyDirection(lang);

  ctx.fillStyle = "#1E2330";
  ctx.font = "900 56px Nunito, Arial, sans-serif";
  ctx.fillText(c.nickname[lang], 500, 632);

  ctx.fillStyle = "#5C6270";
  ctx.font = "600 28px Nunito, Arial, sans-serif";
  wrapText(ctx, c.desc[lang], 500, 678, 700, 34);

  var scoreY = 730;
  var top = c.top_behaviors;
  for (var i = 0; i < top.length && i < 6; i++) {
    var label = top[i].label ? (top[i].label[lang] || top[i].label.tr) : top[i].key;
    var val = top[i].value;
    var barX = 160;
    var barW = 520;
    var barH = 22;
    var y = scoreY + (i * 42);

    ctx.textAlign = "left";
    ctx.font = "700 22px Nunito, Arial, sans-serif";
    ctx.fillStyle = "#5C6270";
    ctx.fillText(label, barX, y + 16);

    ctx.fillStyle = "#ECEDF0";
    roundRect(ctx, barX + 250, y, barW - 250, barH, 11);
    ctx.fill();

    ctx.fillStyle = c.color;
    var fillW = Math.round((barW - 250) * val / 100);
    roundRect(ctx, barX + 250, y, Math.max(fillW, 12), barH, 11);
    ctx.fill();

    ctx.textAlign = "right";
    ctx.font = "800 22px Nunito, Arial, sans-serif";
    ctx.fillStyle = "#1E2330";
    ctx.fillText(val, barX + barW + 40, y + 17);
  }

  var commentY = scoreY + 6 * 42 + 20;
  var comment = res.comment ? res.comment.mirror[lang] : "";

  ctx.fillStyle = "#FFF1E3";
  roundRect(ctx, 130, commentY, 740, 180, 24);
  ctx.fill();
  ctx.strokeStyle = c.color; ctx.lineWidth = 3;
  roundRect(ctx, 130, commentY, 740, 180, 24);
  ctx.stroke();

  ctx.fillStyle = c.color;
  ctx.font = "800 24px Nunito, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(t("says").toUpperCase(), 500, commentY + 38);

  ctx.fillStyle = "#1E2330";
  ctx.font = "600 24px Nunito, Arial, sans-serif";
  wrapText(ctx, comment, 500, commentY + 72, 660, 32);

  drawCardFooter(ctx, res.hash);
  return b.cv;
}

/* --- V1 PNG: archetype tabanlı (backward compat) --- */
function renderIdentityPNGV1(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var a = res.archetype;
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, a.color);

  ctx.beginPath(); ctx.arc(500, 380, 120, 0, 7);
  ctx.fillStyle = "#FFFFFF"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
  ctx.font = "130px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.fillText(a.emoji, 500, 428);

  ctx.fillStyle = "#8A8F9C";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText("@" + res.handle, 500, 560);
  ctx.direction = copyDirection(lang);

  ctx.fillStyle = "#1E2330";
  ctx.font = "900 62px Nunito, Arial, sans-serif";
  ctx.fillText(a.name[lang], 500, 632);

  ctx.fillStyle = "#5C6270";
  ctx.font = "600 30px Nunito, Arial, sans-serif";
  ctx.fillText(a.desc[lang], 500, 684);

  ctx.fillStyle = "#FFF1E3";
  roundRect(ctx, 130, 730, 740, 230, 24);
  ctx.fill();
  ctx.strokeStyle = a.color; ctx.lineWidth = 3;
  roundRect(ctx, 130, 730, 740, 230, 24);
  ctx.stroke();

  ctx.fillStyle = a.color;
  ctx.font = "800 26px Nunito, Arial, sans-serif";
  ctx.fillText(t("says").toUpperCase(), 500, 778);

  ctx.fillStyle = "#1E2330";
  ctx.font = "600 30px Nunito, Arial, sans-serif";
  wrapText(ctx, a.comments[lang][res.ci], 500, 822, 660, 40);

  ctx.font = "700 24px Nunito, Arial, sans-serif";
  ctx.fillStyle = "#8A8F9C";
  var line1 = t("sc_viral") + " " + res.scores.sc_viral +
              "   •   " + t("sc_kaos") + " " + res.scores.sc_kaos;
  var line2 = t("sc_mizah") + " " + res.scores.sc_mizah +
              "   •   " + t("sc_gece") + " " + res.scores.sc_gece;
  ctx.fillText(line1, 500, 1010);
  ctx.fillText(line2, 500, 1048);

  drawCardFooter(ctx, res.hash);
  return b.cv;
}

/* --- match kartı PNG --- unchanged */
function renderMatchPNG(m) {
  if (resultTier(m) === "fun") return renderFunMatchPNG(m);
  return resultTier(m) === "real" ? renderShareCard(m) : renderMatchPNGBase(m);
}

function renderMatchPNGBase(m, opts) {
  var showScores = !(opts && opts.scores === false);
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, "#FF7A45");

  function avatar(x, emoji) {
    ctx.beginPath(); ctx.arc(x, 380, 95, 0, 7);
    ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
    ctx.font = "100px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.fillText(emoji, x, 416);
  }
  avatar(340, m.resA.archetype.emoji);
  avatar(660, m.resB.archetype.emoji);
  ctx.fillStyle = "#1E2330";
  ctx.font = "900 60px Nunito, Arial, sans-serif";
  ctx.fillText("×", 500, 400);

  ctx.fillStyle = "#8A8F9C";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText("@" + m.a + "  ×  @" + m.b, 500, 560);

  ctx.fillStyle = "#1E2330";
  ctx.font = "900 110px Nunito, Arial, sans-serif";
  ctx.fillText("%" + m.overall, 500, 680);
  ctx.direction = copyDirection(lang);

  ctx.fillStyle = "#5C6270";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText((opts && opts.overallLabel) || t("match_overall"), 500, 728);

  ctx.font = "700 24px Nunito, Arial, sans-serif";
  ctx.fillStyle = "#1E2330";
  var mLine1 = t("match_flirt") + " %" + m.flirt + "  •  " +
               t("match_vibe") + " %" + m.vibe + "  •  " +
               t("match_humor") + " %" + m.humor;
  var mLine2 = t("match_chaos") + " %" + m.chaos + "  •  " +
               t("match_romance") + " %" + m.romance;
  if (showScores) {
    ctx.fillText(mLine1, 500, 780);
    ctx.fillText(mLine2, 500, 812);
  }

  ctx.fillStyle = "#FFF1E3";
  roundRect(ctx, 130, 830, 740, 215, 24);
  ctx.fill();
  ctx.strokeStyle = "#FF7A45"; ctx.lineWidth = 3;
  roundRect(ctx, 130, 830, 740, 215, 24);
  ctx.stroke();

  ctx.fillStyle = "#FF7A45";
  ctx.font = "800 26px Nunito, Arial, sans-serif";
  ctx.fillText(t("says").toUpperCase(), 500, 876);

  ctx.fillStyle = "#1E2330";
  ctx.font = "600 29px Nunito, Arial, sans-serif";
  wrapText(ctx, matchComment(m, lang), 500, 918, 660, 38);

  drawCardFooter(ctx, xhash(m.a + m.b));
  return b.cv;
}

/* ---------------- indir & paylaş ---------------- */

function downloadCanvas(cv, filename) {
  var a = document.createElement("a");
  a.download = filename;
  a.href = cv.toDataURL("image/png");
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast(t("toast_saved"));
}

function ltrIsolate(text) {
  return "\u2066" + text + "\u2069";
}

function shareOnX(text) {
  var url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
  window.open(url, "_blank", "noopener");
}

function shareIdentityText(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var name = "";
  if (isV3Result(res)) name = localized(res.nickname, lang);
  else if (isV2Result(res)) name = localized(res.card && res.card.nickname, lang);
  else name = localized(res.archetype && res.archetype.name, lang);
  if (resultTier(res) === "fun") {
    var persona=funIdentityPersona(res);
    if (persona) name=localized(persona.nickname,lang);
  }

  if (resultTier(res) === "real") {
    var rarity = rarityText(res);
    if (lang === "tr") return 'XORA REAL beni okudu: "' + name + '" · ' + rarity + ' 👀 Sen ne çıkarsın? → ' + getPublicSiteUrl();
    if (lang === "es") return 'XORA REAL me leyó: "' + name + '" · ' + rarity + ' 👀 ¿Qué diría el tuyo? → ' + getPublicSiteUrl();
    if (lang === "pt") return 'A XORA REAL me leu: "' + name + '" · ' + rarity + ' 👀 E o seu, o que diria? → ' + getPublicSiteUrl();
    if (lang === "ar") return 'قرأتني XORA REAL: «' + name + '» · ' + rarity + ' 👀 وماذا ستقول عنك؟ ← ' + ltrIsolate(getPublicSiteUrl());
    if (lang === "fr") return 'Mon analyse XORA REAL\u00a0: «\u00a0' + name + '\u00a0» · ' + rarity + ' 👀 Et la tienne\u00a0? → ' + getPublicSiteUrl();
    if (lang === "de") return 'XORA REAL hat mich gelesen: „' + name + '“ · ' + rarity + ' 👀 Und was sagt es über dich? → ' + getPublicSiteUrl();
    if (lang === "it") return 'XORA REAL mi ha letto: «' + name + '» · ' + rarity + ' 👀 E di te cosa direbbe? → ' + getPublicSiteUrl();
    if (lang === "ja") return 'XORA REALに読まれた結果：「' + name + '」 · ' + rarity + ' 👀 あなたはどう出る？ → ' + getPublicSiteUrl();
    if (lang === "ko") return 'XORA REAL이 읽어낸 나: ‘' + name + '’ · ' + rarity + ' 👀 당신은 어떻게 나올까요? → ' + getPublicSiteUrl();
    if (lang === "zh") return 'XORA REAL 讀出來的我：「' + name + '」 · ' + rarity + ' 👀 你會是什麼樣子？ → ' + getPublicSiteUrl();
    if (lang === "ru") return 'XORA REAL прочитала меня: «' + name + '» · ' + rarity + ' 👀 А что скажет о тебе? → ' + getPublicSiteUrl();
    return 'XORA REAL read me: "' + name + '" · ' + rarity + ' 👀 What would yours say? → ' + getPublicSiteUrl();
  }
  if (lang === "tr") return 'XORA FUN kartım: "' + name + '" 😅 Seninkini çek → ' + getPublicSiteUrl();
  if (lang === "es") return 'Mi tarjeta XORA FUN: "' + name + '" 😅 Saca la tuya → ' + getPublicSiteUrl();
  if (lang === "pt") return 'Meu cartão XORA FUN: "' + name + '" 😅 Tire o seu → ' + getPublicSiteUrl();
  if (lang === "ar") return 'بطاقتي في XORA FUN: «' + name + '» 😅 اسحب بطاقتك ← ' + ltrIsolate(getPublicSiteUrl());
  if (lang === "fr") return 'Ma carte XORA FUN\u00a0: «\u00a0' + name + '\u00a0» 😅 Tire la tienne → ' + getPublicSiteUrl();
  if (lang === "de") return 'Meine XORA FUN-Karte: „' + name + '“ 😅 Zieh deine eigene → ' + getPublicSiteUrl();
  if (lang === "it") return 'La mia carta XORA FUN: «' + name + '» 😅 Pesca la tua → ' + getPublicSiteUrl();
  if (lang === "ja") return 'XORA FUNのカード：「' + name + '」😅 あなたも引いてみて → ' + getPublicSiteUrl();
  if (lang === "ko") return '내 XORA FUN 카드: ‘' + name + '’ 😅 당신도 뽑아 보세요 → ' + getPublicSiteUrl();
  if (lang === "zh") return '我的 XORA FUN 卡片：「' + name + '」😅 你也來抽一張 → ' + getPublicSiteUrl();
  if (lang === "ru") return 'Моя карточка XORA FUN: «' + name + '» 😅 Вытяни свою → ' + getPublicSiteUrl();
  return 'My XORA FUN card: "' + name + '" 😅 Draw yours → ' + getPublicSiteUrl();
}

function shareMatchText(m) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  if (resultTier(m) === "real") {
    var rarity = rarityText(m);
    if (lang === "tr") return "XORA REAL: @" + m.a + " × @" + m.b + " uyumu %" + m.overall + " · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "es") return "XORA REAL: @" + m.a + " × @" + m.b + " compatibilidad " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "pt") return "XORA REAL: @" + m.a + " × @" + m.b + " compatibilidade " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "ar") return "توافق " + ltrIsolate("@" + m.a + " × @" + m.b) + " في XORA REAL: " + ltrIsolate(m.overall + "%") + " · " + rarity + " 🔥 ← " + ltrIsolate(getPublicSiteUrl());
    if (lang === "fr") return "XORA REAL\u00a0: @" + m.a + " × @" + m.b + " compatibilité " + m.overall + "\u00a0% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "de") return "XORA REAL: @" + m.a + " × @" + m.b + " Übereinstimmung " + m.overall + "\u00a0% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "it") return "XORA REAL: @" + m.a + " × @" + m.b + " affinità " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "ja") return "XORA REAL：@" + m.a + " × @" + m.b + " の相性 " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "ko") return "XORA REAL: @" + m.a + " × @" + m.b + " 궁합 " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "zh") return "XORA REAL：@" + m.a + " × @" + m.b + " 速配 " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    if (lang === "ru") return "XORA REAL: @" + m.a + " × @" + m.b + " совместимость " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
    return "XORA REAL: @" + m.a + " × @" + m.b + " match " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
  }
  if (lang === "tr") return "XORA FUN: @" + m.a + " × @" + m.b + " uyumu %" + m.overall + " 😅 Siz kaç çıkarsınız? → " + getPublicSiteUrl();
  if (lang === "es") return "XORA FUN: @" + m.a + " × @" + m.b + " compatibilidad " + m.overall + "% 😅 ¿Cuánto sacarían ustedes? → " + getPublicSiteUrl();
  if (lang === "pt") return "XORA FUN: @" + m.a + " × @" + m.b + " compatibilidade " + m.overall + "% 😅 E vocês, quanto dariam? → " + getPublicSiteUrl();
  if (lang === "ar") return "توافق " + ltrIsolate("@" + m.a + " × @" + m.b) + " في XORA FUN: " + ltrIsolate(m.overall + "%") + " 😅 وأنتم، كم ستكون نسبتكم؟ ← " + ltrIsolate(getPublicSiteUrl());
  if (lang === "fr") return "XORA FUN\u00a0: @" + m.a + " × @" + m.b + " compatibilité " + m.overall + "\u00a0% 😅 Et vous, combien\u00a0? → " + getPublicSiteUrl();
  if (lang === "de") return "XORA FUN: @" + m.a + " × @" + m.b + " Übereinstimmung " + m.overall + "\u00a0% 😅 Und wie viel habt ihr? → " + getPublicSiteUrl();
  if (lang === "it") return "XORA FUN: @" + m.a + " × @" + m.b + " affinità " + m.overall + "% 😅 E voi quanto fate? → " + getPublicSiteUrl();
  if (lang === "ja") return "XORA FUN：@" + m.a + " × @" + m.b + " の相性 " + m.overall + "% 😅 あなたたちは何%？ → " + getPublicSiteUrl();
  if (lang === "ko") return "XORA FUN: @" + m.a + " × @" + m.b + " 궁합 " + m.overall + "% 😅 두 분은 몇 %일까요? → " + getPublicSiteUrl();
  if (lang === "zh") return "XORA FUN：@" + m.a + " × @" + m.b + " 速配 " + m.overall + "% 😅 你們呢？ → " + getPublicSiteUrl();
  if (lang === "ru") return "XORA FUN: @" + m.a + " × @" + m.b + " совместимость " + m.overall + "% 😅 А сколько у вас? → " + getPublicSiteUrl();
  return "XORA FUN: @" + m.a + " × @" + m.b + " match " + m.overall + "% 😅 Try yours → " + getPublicSiteUrl();
}


// Suppress sample-count sentences in historical cards as well as new cards/exports.
function cardPresentationCopy(value, key) {
  if (key === "meta") return value;
  if (typeof value === "string") {
    var keep = function (sentence) { return !/[\d٠-٩][\d٠-٩\s/.,%'-]*(?:منشور|تغريد)|(?:منشور|تغريد)[^.!?؟]{0,35}[\d٠-٩]|(?:تم تحليل|حللت|حللنا)[^.!?؟]{0,35}(?:منشور|تغريد)|[\d０-９][\d０-９\s]*[件本]?の?(?:投稿|ツイート|ポスト)|(?:投稿|ツイート|ポスト)[^。！？!?]{0,20}[\d０-９]|(?:投稿|ツイート|ポスト)[^。！？!?]{0,20}分析|分析[^。！？!?]{0,20}(?:投稿|ツイート|ポスト)|\d[\d\s]*개?의?\s*(?:게시글|게시물|트윗|포스트)|(?:게시글|게시물|트윗|포스트)[^.!?]{0,20}\d|(?:게시글|게시물|트윗|포스트)[^.!?]{0,20}분석|분석[^.!?]{0,20}(?:게시글|게시물|트윗|포스트)|[\d０-９][\d０-９\s]*[則篇條]?(?:貼文|推文|發文)|(?:貼文|推文|發文)[^。！？!?]{0,20}[\d０-９]|(?:貼文|推文|發文)[^。！？!?]{0,20}分析|分析[^。！？!?]{0,20}(?:貼文|推文|發文)|\d[\d\s]*(?:пост|твит|публикаци|запис)[а-яё]*|(?:пост|твит|публикаци)[а-яё]*[^.!?]{0,35}\d|(?:проанализирова|проанализиру)[а-яё]*[^.!?]{0,35}(?:пост|твит|публикаци)|\d[\d\s/.,%'-]*(?:posts?|tweets?|tuits?|paylaşım|gönderi|tweet|publicacion(?:es)?|publica(?:ção|ções|cao|coes)|publications?|beitr(?:ag|age|agen|äge|ägen)|pubblicazion[ei])|(?:posts?|tweets?|tuits?|paylaşım|gönderi|publicacion(?:es)?|publica(?:ção|ções|cao|coes)|publications?|beitr(?:ag|age|agen|äge|ägen)|pubblicazion[ei]|sample)[^.!?]{0,35}\d|(?:analy[sz]ed|incelenen|analiz edilen|analizad\w*|analisad\w*|analys(?:é|e)\w*|analysiert\w*|analizzat\w*)[^.!?]{0,35}(?:posts?|tweets?|tuits?|paylaşım|gönderi|publicacion(?:es)?|publica(?:ção|ções|cao|coes)|publications?|beitr(?:ag|age|agen|äge|ägen)|pubblicazion[ei])/iu.test(sentence); };
    // Japanese sentences end without a trailing space: split on the sentence mark itself and rejoin unchanged.
    if (CJK_TEXT.test(value)) return value.split(/(?<=[。！？])/).filter(keep).join("");
    return value.split(/(?<=[.!?؟])\s+/).filter(keep).join(" ");
  }
  if (Array.isArray(value)) return value.map(function(v){return cardPresentationCopy(v);});
  if (value && typeof value === "object") {
    var copy={}; Object.keys(value).forEach(function(k){copy[k]=cardPresentationCopy(value[k],k);}); return copy;
  }
  return value;
}
// REAL AI copy is generated only in the request locale ({es: "..."}). Renderers read copy[activeLang],
// so project the generated text onto the active language instead of rendering blanks.
// UI chrome (buttons, labels, rarity) still follows the active language.
var PLANNED_LOCALES = ["tr","en","es","pt","it","fr","de","ru","ja","ko","zh","ar"];
function realLocaleView(value, lang, source) {
  if (Array.isArray(value)) return value.map(function(v){return realLocaleView(v,lang,source);});
  if (!value || typeof value !== "object") return value;
  var keys=Object.keys(value), copy={};
  keys.forEach(function(k){copy[k]=realLocaleView(value[k],lang,source);});
  var localizedCopy=keys.length>0 && keys.every(function(k){return PLANNED_LOCALES.indexOf(k)>=0;});
  if (localizedCopy && copy[lang]===undefined) copy[lang]=copy[copy[source]!==undefined ? source : keys[0]];
  return copy;
}
function realCopyForActiveLang(result) {
  if (resultTier(result) !== "real") return result;
  var lang=(typeof getLang === "function") ? getLang() : "tr";
  return realLocaleView(result, lang, result.meta && result.meta.locale);
}
["buildIdentityCard","buildMatchCard","renderIdentityPNG","renderMatchPNG","shareIdentityText","shareMatchText"].forEach(function(name){
  var original=window[name];
  window[name]=function(result){return original(cardPresentationCopy(realCopyForActiveLang(result)));};
});
