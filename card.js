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

/* ---------------- REAL kart: ölçülen davranış ---------------- */

// REAL metric rows come only from behavior_signals, which analyze-real computes from the fetched
// posts (computeSignals). Ratios are shown as percentages; the two open-ended values use a fixed
// reference for the bar (3 emoji per post, 280 characters) while the text shows the measured value.
var REAL_SIGNAL_ROWS = [
  { key: "reply_ratio", label: "real_m_reply", kind: "ratio" },
  { key: "original_ratio", label: "real_m_original", kind: "ratio" },
  { key: "repost_ratio", label: "real_m_repost", kind: "ratio" },
  { key: "question_ratio", label: "real_m_question", kind: "ratio" },
  { key: "emoji_per_post", label: "real_m_emoji", kind: "per_post", full: 3 },
  { key: "avg_text_length", label: "real_m_length", kind: "chars", full: 280 }
];

function realMetricRows(res, lang) {
  var signals = res && res.behavior_signals;
  var rows = [];
  if (signals && typeof signals === "object") {
    REAL_SIGNAL_ROWS.forEach(function (def) {
      var v = signals[def.key];
      if (typeof v !== "number" || !isFinite(v) || v < 0) return;
      var row = { key: def.key, label: t(def.label) };
      if (def.kind === "ratio") {
        v = Math.min(v, 1);
        row.bar = Math.round(v * 100);
        row.value = formatPercent(v, lang);
      } else {
        row.bar = Math.round(Math.min(v / def.full, 1) * 100);
        row.value = def.kind === "per_post" ? formatDecimal(v, lang) : fillTemplate(t("real_m_chars"), { n: Math.round(v) });
      }
      rows.push(row);
    });
  }
  if (rows.length >= 3) return { measured: true, rows: rows };
  // Results saved before behavior_signals existed only carry the AI-assessed metrics; keep showing those.
  var legacy = ((res && res.card && res.card.top_behaviors) || []).slice(0, 6).map(function (b) {
    return { key: b.key, label: b.label ? localized(b.label, lang) : b.key, bar: b.value, value: String(b.value) };
  });
  return { measured: false, rows: legacy };
}

function buildRealIdentityCard(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var c = res.card || {};
  var color = c.color || "#1E2330";
  var emoji = c.emoji || res.profile_emoji || "🪞";
  var nick = localized(res.nickname || c.nickname, lang);
  var tagline = localized(res.tagline || c.desc, lang);
  var summary = localized(res.profile_summary, lang);
  var comment = res.comment ? localized(res.comment.mirror, lang) : "";
  var metrics = realMetricRows(res, lang);
  var rows = metrics.rows.map(function (row) {
    return '<div class="score-chip" data-metric="' + esc(row.key) + '">' +
      '<span class="score-name">' + esc(row.label) + "</span>" +
      '<span class="score-bar"><i style="width:' + row.bar + '%"></i></span>' +
      '<span class="score-val">' + esc(row.value) + "</span>" +
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
        (rows ? '<div class="real-metrics"' + (metrics.measured ? ' data-source="behavior_signals"' : ' data-source="ai_metrics"') + ">" +
          (metrics.measured ? '<p class="real-metrics-title">' + esc(t("real_metrics_title")) + "</p>" : "") +
          '<div class="idcard-scores">' + rows + "</div></div>" : "") +
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
   PNG ÜRETİMİ (canvas) — 1000 x 1250
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
  if (resultTier(res) === "real") return stampRealCanvas(renderRealIdentityPNG(res), res);
  var cv;
  if (isV3Result(res)) cv = renderIdentityPNGV3(res);
  else if (isV2Result(res)) cv = renderIdentityPNGV2(res);
  else cv = renderIdentityPNGV1(res);
  return resultTier(res) === "real" ? stampRealCanvas(cv, res) : cv;
}

/* --- REAL PNG: ölçülen davranış satırları --- */
// Everything is laid out top-down and measured, so the comment box always ends above the footer
// (y=1090): its font steps down, and only as a last resort the comment is cut with an ellipsis.
function renderRealIdentityPNG(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var c = res.card || {};
  var color = c.color || "#1E2330";
  var emoji = c.emoji || res.profile_emoji || "🪞";
  var nick = localized(res.nickname || c.nickname, lang);
  var tagline = localized(res.tagline || c.desc, lang);
  var summary = localized(res.profile_summary, lang);
  var comment = res.comment ? localized(res.comment.mirror, lang) : "";
  var metrics = realMetricRows(res, lang);
  var b = baseCanvas(), ctx = b.ctx;
  drawCardFrame(ctx, color);

  ctx.textAlign = "center";
  ctx.beginPath(); ctx.arc(500, 300, 76, 0, 7);
  ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
  ctx.font = "84px 'Segoe UI Emoji','Apple Color Emoji',sans-serif"; ctx.fillText(emoji, 500, 330);
  ctx.fillStyle = "#8A8F9C"; ctx.font = "700 28px Nunito, Arial, sans-serif"; ctx.fillText("@" + res.handle, 500, 418);
  ctx.direction = copyDirection(lang);

  ctx.fillStyle = "#1E2330"; ctx.font = "900 50px Nunito, Arial, sans-serif";
  var y = wrapText(ctx, nick, 500, 476, 720, 56);
  if (tagline) { ctx.fillStyle = "#5C6270"; ctx.font = "600 25px Nunito, Arial, sans-serif"; y = wrapText(ctx, tagline, 500, y + 44, 720, 31); }
  if (summary && summary !== tagline) { ctx.fillStyle = "#8A8F9C"; ctx.font = "600 21px Nunito, Arial, sans-serif"; y = wrapText(ctx, summary, 500, y + 34, 720, 27); }

  if (metrics.rows.length) {
    y += 26;
    if (metrics.measured) {
      ctx.fillStyle = "#8A8F9C"; ctx.font = "900 17px Nunito, Arial, sans-serif";
      ctx.fillText(t("real_metrics_title").toUpperCase(), 500, y + 14);
      y += 26;
    }
    var labelX = 140, labelW = 250, barX = 410, barW = 330, valueX = 860, rowH = 36;
    metrics.rows.forEach(function (row, i) {
      var ry = y + i * rowH;
      ctx.textAlign = "left";
      var size = 21;
      ctx.font = "800 " + size + "px Nunito, Arial, sans-serif";
      while (size > 15 && ctx.measureText(row.label).width > labelW) { size--; ctx.font = "800 " + size + "px Nunito, Arial, sans-serif"; }
      ctx.fillStyle = "#5C6270"; ctx.fillText(row.label, labelX, ry + 17);
      ctx.fillStyle = "#ECEDF0"; roundRect(ctx, barX, ry, barW, 20, 10); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, barX, ry, Math.max(Math.round(barW * row.bar / 100), 12), 20, 10); ctx.fill();
      ctx.textAlign = "right"; ctx.fillStyle = "#1E2330"; ctx.font = "900 21px Nunito, Arial, sans-serif";
      ctx.fillText(row.value, valueX, ry + 17);
    });
    y += metrics.rows.length * rowH;
  }

  var top = y + 16, limit = 1072;
  var fonts = [[23, 29], [21, 27], [19, 24], [17, 22]], lines = [], font = fonts[fonts.length - 1];
  for (var f = 0; f < fonts.length; f++) {
    ctx.font = "600 " + fonts[f][0] + "px Nunito, Arial, sans-serif";
    lines = commentLines(ctx, comment, 660);
    font = fonts[f];
    if (top + 70 + lines.length * font[1] <= limit) break;
  }
  var maxLines = Math.max(1, Math.floor((limit - top - 70) / font[1]));
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  var boxH = 70 + lines.length * font[1];
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFF1E3"; roundRect(ctx, 130, top, 740, boxH, 24); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; roundRect(ctx, 130, top, 740, boxH, 24); ctx.stroke();
  ctx.fillStyle = color; ctx.font = "900 20px Nunito, Arial, sans-serif"; ctx.fillText(t("says").toUpperCase(), 500, top + 32);
  ctx.fillStyle = "#1E2330"; ctx.font = "600 " + font[0] + "px Nunito, Arial, sans-serif";
  lines.forEach(function (line, i) { ctx.fillText(line, 500, top + 62 + i * font[1]); });

  drawCardFooter(ctx, res.hash || xhash(String(res.handle || "x")));
  return b.cv;
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

/* --- V3 PNG: profil okuma (sadeleştirilmiş) --- */
function stampRealCanvas(cv, res) {
  var ctx = cv.getContext("2d");
  var label = "XORA REAL · " + rarityText(res);
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "900 24px Nunito, Arial, sans-serif";
  var w = ctx.measureText(label).width + 44;
  ctx.fillStyle = "#1E2330";
  roundRect(ctx, 48, 46, w, 54, 27); ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(label, 70, 81);
  ctx.restore();
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
  return resultTier(m) === "real" ? stampRealCanvas(renderMatchPNGBase(m), m) : renderMatchPNGBase(m);
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
