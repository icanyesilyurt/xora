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
   REAL PAYLAŞIM KARTI — 1080 x 1350 (4:5)
   Mirror / Stalk: ölçülen X sinyalleri (ham değerler, yuvarlanmış yüzde).
   Match: yapay zekânın uyum skorları.
   Yerleşim önce hesaplanır (shareCardLayout), sonra çizilir (paintShareCard):
   her metin kendi alanına sığacak şekilde küçültülür / kısaltılır.
   ============================================================ */

var SHARE_W = 1080, SHARE_H = 1350;
var SHARE_CARD = { x: 48, y: 44, w: 970, h: 1240 };
var SHARE_PAD = 44;
var SHARE_BAND_H = 220;
var SHARE_FOOT_H = 64;
var SHARE_TILE_H = 140, SHARE_TILE_GAP = 16;
var SHARE_INK = "#1E2330", SHARE_MUT = "#5C6270", SHARE_SOFT = "#7A7F8C", SHARE_CREAM = "#FFF1E3";
var SHARE_FONT = "Nunito, Arial, sans-serif";
var SHARE_EMOJI_FONT = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";

// Which measured signals each mode shows, in grid order. Values are the raw behavior_signals the
// backend stored; nothing is rescaled. Ratios draw a bar of exactly that percentage; the average
// length draws against the 280-character post limit.
var SHARE_SIGNAL_KEYS = {
  mirror: ["original_ratio", "reply_ratio", "question_ratio", "avg_text_length"],
  stalk: ["repost_ratio", "original_ratio", "reply_ratio", "avg_text_length"]
};
var SHARE_SIGNAL_FALLBACK = ["question_ratio", "repost_ratio", "reply_ratio", "original_ratio", "emoji_per_post", "avg_text_length"];
var SHARE_SIGNAL_LABEL = { reply_ratio: "real_m_reply", original_ratio: "real_m_original", repost_ratio: "real_m_repost", question_ratio: "real_m_question", emoji_per_post: "real_m_emoji", avg_text_length: "real_m_length" };
var SHARE_STALK_COPY = {
  repost_ratio: ["stalk_t_repost", "stalk_u_repost"],
  original_ratio: ["stalk_t_original", "stalk_u_original"],
  reply_ratio: ["stalk_t_reply", "stalk_u_reply"],
  avg_text_length: ["stalk_t_length", "stalk_u_length"]
};
var SHARE_MATCH_KEYS = ["vibe", "humor", "chaos", "flirt"];
// Darker text shades for accents that are too light for small type on the cream insight box.
var SHARE_LABEL_INK = { "#FFB000": "#A86B00", "#0FAFAF": "#0B7F7F", "#FF7A45": "#C2410C" };
var SHARE_RARITY_MARK = { common: "●", rare: "◆", epic: "★", legendary: "✦" };

function shareLang() {
  return (typeof getLang === "function") ? getLang() : "tr";
}

function shareUpper(text, lang) {
  try { return String(text).toLocaleUpperCase(lang); } catch (e) { return String(text).toUpperCase(); }
}

function shareSignalTile(key, v, mode, lang) {
  var tile = { key: key, source: "signal", raw: v, zero: v === 0 };
  var isRatio = key !== "avg_text_length" && key !== "emoji_per_post";
  if (isRatio) {
    tile.value = formatPercent(Math.min(v, 1), lang);
    tile.bar = Math.round(Math.min(v, 1) * 100);
  } else if (key === "avg_text_length") {
    tile.value = String(Math.round(v));
    tile.bar = Math.round(Math.min(v / 280, 1) * 100);
  } else {
    tile.value = formatDecimal(v, lang);
    tile.bar = Math.round(Math.min(v / 3, 1) * 100);
  }
  var stalkCopy = mode === "stalk" && SHARE_STALK_COPY[key];
  if (stalkCopy) {
    tile.label = t(stalkCopy[0]);
    tile.unit = t(stalkCopy[1]);
  } else {
    tile.label = t(SHARE_SIGNAL_LABEL[key]);
    tile.unit = key === "avg_text_length" ? String(t("real_m_chars")).replace("{n}", "").trim() : "";
  }
  // A true zero keeps an empty bar; a unit-less tile says so in words next to the number.
  if (tile.zero && !tile.unit) tile.unit = t("share_none");
  return tile;
}

function shareSignalTiles(res, mode, lang) {
  var signals = res && res.behavior_signals;
  var valid = function (k) { var v = signals && signals[k]; return typeof v === "number" && isFinite(v) && v >= 0; };
  var keys = [];
  if (signals && typeof signals === "object") {
    (SHARE_SIGNAL_KEYS[mode] || SHARE_SIGNAL_KEYS.mirror).concat(SHARE_SIGNAL_FALLBACK).forEach(function (k) {
      if (keys.length < 4 && keys.indexOf(k) < 0 && valid(k)) keys.push(k);
    });
  }
  // Same rule as the in-app card: three or more measured signals, else the stored AI metrics.
  if (keys.length >= 3) return { measured: true, tiles: keys.map(function (k) { return shareSignalTile(k, signals[k], mode, lang); }) };
  var legacy = ((res && res.card && res.card.top_behaviors) || []).slice(0, 4).map(function (b) {
    var v = Math.max(0, Math.min(100, Math.round(Number(b.value) || 0)));
    return { key: b.key, source: "ai", label: b.label ? localized(b.label, lang) : b.key, value: String(v), unit: "", bar: v, zero: v === 0 };
  });
  return { measured: false, tiles: legacy };
}

function matchBand(v) {
  return t(v >= 80 ? "match_band_strong" : v >= 60 ? "match_band_clear" : v >= 40 ? "match_band_moderate" : "match_band_low");
}

function shareCardModel(res) {
  var lang = shareLang();
  var isMatch = res && (res.mode === "match" || (res.a && res.b && res.resA));
  var rarity = rarityName(res);
  var base = {
    lang: lang,
    rtl: copyDirection(lang) === "rtl",
    rarity: rarity,
    rarityLabel: (SHARE_RARITY_MARK[rarity] ? SHARE_RARITY_MARK[rarity] + " " : "") + rarityText(res),
    realLabel: t("real_label")
  };
  if (isMatch) {
    var tiles = SHARE_MATCH_KEYS.map(function (k) {
      var v = Math.max(0, Math.min(100, Math.round(Number(res[k]) || 0)));
      return { key: k, source: "ai", label: t("match_" + k), value: String(v), unit: matchBand(v), bar: v, zero: v === 0 };
    });
    return Object.assign(base, {
      kind: "match",
      accent: "#FF7A45",
      bandColors: ["#0FBDBD", "#FF7A45"],
      handles: [res.a, res.b],
      nicknames: [localized(res.resA && res.resA.nickname, lang), localized(res.resB && res.resB.nickname, lang)],
      emojis: [(res.resA && res.resA.archetype && res.resA.archetype.emoji) || "👤", (res.resB && res.resB.archetype && res.resB.archetype.emoji) || "👤"],
      hero: formatPercent(Math.max(0, Math.min(100, Number(res.overall) || 0)) / 100, lang),
      subtitle: t("match_overall"),
      tiles: tiles,
      heading: null,
      insightLabel: t("share_says_match"),
      insight: matchComment(res, lang) || "",
      hash: xhash(String(res.a) + String(res.b))
    });
  }
  var mode = res.mode === "stalk" ? "stalk" : "mirror";
  var c = res.card || {};
  var metrics = shareSignalTiles(res, mode, lang);
  var comment = res.comment ? localized(res.comment[mode] || res.comment.mirror, lang) : "";
  var hash = res.hash || xhash(String(res.handle || "x"));
  return Object.assign(base, {
    kind: mode,
    accent: c.color || "#2D3445",
    bandColors: [c.color || "#2D3445"],
    handles: [res.handle],
    emojis: [c.emoji || res.profile_emoji || (mode === "stalk" ? "👀" : "🪞")],
    title: localized(res.nickname || c.nickname, lang),
    subtitle: localized(res.tagline || c.desc, lang),
    tiles: metrics.tiles,
    heading: metrics.measured ? { left: t("real_metrics_title"), right: t("share_measured") } : null,
    insightLabel: t(mode === "stalk" ? "share_says_stalk" : "share_says_mirror"),
    insight: comment || "",
    // The localized word is isolated so an RTL word never reorders the "#id" part.
    caseLabel: mode === "stalk" ? "\u2068" + t("share_case") + "\u2069 #" + (hash >>> 0).toString(16).toUpperCase().slice(-4).padStart(4, "0") : "",
    hash: hash
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

function shareSentences(text) {
  text = String(text || "").trim();
  if (!text) return [];
  var parts = CJK_TEXT.test(text) ? text.split(/(?<=[。！？!?])/) : text.split(/(?<=[.!?؟…])\s+/);
  return parts.map(function (s) { return s.trim(); }).filter(Boolean);
}

var SHARE_INSIGHT_SIZES = [30, 28];
function shareInsightBoxH(lines, size) {
  return 64 + lines * Math.round(size * 1.36) + 22;
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
        var size = SHARE_INSIGHT_SIZES[s], font = shareFont(700, size);
        var lines = shareWrap(ctx, font, candidate, maxW);
        if (lines.length <= passes[p] && shareInsightBoxH(lines.length, size) <= budget) {
          return { lines: lines, size: size, font: font, sentences: k, total: sentences.length };
        }
      }
    }
  }
  var small = SHARE_INSIGHT_SIZES[SHARE_INSIGHT_SIZES.length - 1], smallFont = shareFont(700, small);
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

// Returns everything the painter draws, with the final (fitted) text, its font and the box it must
// stay inside. Tests and the local render check read the same object.
function shareCardLayout(model, ctx) {
  var card = SHARE_CARD;
  var left = card.x + SHARE_PAD, right = card.x + card.w - SHARE_PAD, width = right - left;
  var cx = card.x + card.w / 2;
  var bandBottom = card.y + SHARE_BAND_H;
  var footTop = card.y + card.h - SHARE_FOOT_H;
  var contentBottom = footTop - 34;
  var texts = [];
  var L = { model: model, size: { w: SHARE_W, h: SHARE_H }, card: card, bandBottom: bandBottom, footTop: footTop, texts: texts, zones: {} };
  function text(zone, str, font, x, y, align, box, color, dir) {
    texts.push({ zone: zone, text: str, font: font, x: x, y: y, align: align, box: box, color: color || SHARE_INK, dir: dir || "ltr" });
  }
  var dir = model.rtl ? "rtl" : "ltr";

  // Band pills (brand words and rarity stay LTR).
  var pillFont = shareFont(900, 22), modeFont = shareFont(900, 18);
  var realW = shareWidth(ctx, pillFont, model.realLabel) + 36;
  var modeWord = model.kind.toUpperCase();
  var modeW = shareWidth(ctx, modeFont, modeWord) + 38;
  var rarityW = shareWidth(ctx, pillFont, model.rarityLabel) + 42;
  var pillY = card.y + 26;
  L.pills = [
    { x: card.x + 30, y: pillY, w: realW, h: 48, fill: SHARE_INK, stroke: null },
    { x: card.x + 30 + realW + 10, y: pillY, w: modeW, h: 48, fill: "#FFFFFF", stroke: SHARE_INK },
    // On Match the right half of the band is already orange, so the rarity pill turns white.
    { x: card.x + card.w - 30 - rarityW, y: pillY, w: rarityW, h: 48, fill: model.kind === "match" ? "#FFFFFF" : "#FF7A45", stroke: SHARE_INK }
  ];
  text("band", model.realLabel, pillFont, L.pills[0].x + realW / 2, pillY + 32, "center", L.pills[0], "#FFFFFF");
  text("band", modeWord, modeFont, L.pills[1].x + modeW / 2, pillY + 31, "center", L.pills[1], SHARE_INK);
  text("band", model.rarityLabel, pillFont, L.pills[2].x + rarityW / 2, pillY + 32, "center", L.pills[2], model.kind === "match" ? SHARE_INK : "#FFFFFF");

  var y;
  if (model.kind === "match") {
    L.avatars = [{ x: cx - 100, y: bandBottom, r: 70, emoji: model.emojis[0] }, { x: cx + 100, y: bandBottom, r: 70, emoji: model.emojis[1] }];
    L.matchChip = { x: cx, y: bandBottom, r: 32 };
    var colW = cx - 40 - left;
    var hA = shareFitLine(ctx, 800, 28, 18, "@" + model.handles[0], colW);
    var hB = shareFitLine(ctx, 800, 28, 18, "@" + model.handles[1], colW);
    var handleY = bandBottom + 70 + 44;
    text("identity", hA.text, hA.font, cx - 40, handleY, "right", { x: left, y: handleY - 30, w: colW, h: 36 }, SHARE_SOFT);
    text("identity", hB.text, hB.font, cx + 40, handleY, "left", { x: cx + 40, y: handleY - 30, w: colW, h: 36 }, SHARE_SOFT);
    y = handleY;
    if (model.nicknames[0] || model.nicknames[1]) {
      var nickY = handleY + 30;
      [0, 1].forEach(function (i) {
        if (!model.nicknames[i]) return;
        var n = shareFitLine(ctx, 800, 20, 16, model.nicknames[i], colW);
        text("identity", n.text, n.font, i ? cx + 40 : cx - 40, nickY, i ? "left" : "right", { x: i ? cx + 40 : left, y: nickY - 22, w: colW, h: 28 }, SHARE_MUT, dir);
      });
      y = nickY;
    }
    var hero = shareFitLine(ctx, 900, 124, 80, model.hero, width);
    var heroY = y + 12 + Math.round(hero.size * 0.9);
    L.hero = { text: hero.text, font: hero.font, x: cx, y: heroY, size: hero.size };
    texts.push({ zone: "identity", text: hero.text, font: hero.font, x: cx, y: heroY, align: "center", box: { x: left, y: heroY - hero.size, w: width, h: hero.size + 8 }, color: SHARE_INK, dir: "ltr", hero: true });
    var sub = shareFitLine(ctx, 800, 28, 20, model.subtitle, width);
    y = heroY + 44;
    text("identity", sub.text, sub.font, cx, y, "center", { x: left, y: y - 30, w: width, h: 38 }, SHARE_MUT, dir);
    y += 12;
  } else {
    L.avatars = [{ x: cx, y: bandBottom, r: 75, emoji: model.emojis[0] }];
    if (model.caseLabel) {
      var caseFont = "700 20px monospace";
      var caseW = shareWidth(ctx, caseFont, model.caseLabel) + 32;
      L.stamp = { x: card.x + card.w - 40 - caseW, y: bandBottom - 26 - 42, w: caseW, h: 42 };
      text("band", model.caseLabel, caseFont, L.stamp.x + caseW / 2, L.stamp.y + 28, "center", L.stamp, SHARE_INK);
    }
    var handle = shareFitLine(ctx, 800, 30, 20, "@" + model.handles[0], width);
    y = bandBottom + 75 + 14 + 30;
    text("identity", handle.text, handle.font, cx, y, "center", { x: left, y: y - 32, w: width, h: 40 }, SHARE_SOFT);
    // Title: up to two lines, stepping down from 66px; a third line is never drawn.
    var titleSize = 66, titleLines;
    for (; titleSize >= 48; titleSize -= 2) {
      titleLines = shareWrap(ctx, shareFont(900, titleSize), model.title, width);
      if (titleLines.length <= 2 && titleLines.join("").indexOf("…") < 0) break;
    }
    if (titleSize < 48) {
      titleSize = 48;
      titleLines = shareWrap(ctx, shareFont(900, 48), model.title, width);
      if (titleLines.length > 2) titleLines = [titleLines[0], shareEllipsize(ctx, shareFont(900, 48), titleLines[1] + "…", width)];
    }
    var titleLH = Math.round(titleSize * 1.08);
    titleLines.forEach(function (line, i) {
      var ty = y + 14 + Math.round(titleSize * 0.86) + i * titleLH;
      text("identity", line, shareFont(900, titleSize), cx, ty, "center", { x: left, y: ty - titleSize, w: width, h: titleLH }, SHARE_INK, dir);
    });
    y = y + 14 + Math.round(titleSize * 0.86) + (titleLines.length - 1) * titleLH;
    if (model.subtitle) {
      var subFont = shareFont(600, 28);
      var subText = shareEllipsize(ctx, subFont, model.subtitle, width);
      y += 46;
      text("identity", subText, subFont, cx, y, "center", { x: left, y: y - 30, w: width, h: 38 }, SHARE_MUT, dir);
    }
    y += 12;
  }
  L.zones.identity = { top: bandBottom, bottom: y };

  // Tile block and insight: heights are fixed, the free space is split evenly between them.
  var headingH = model.heading ? 38 : 0;
  var tilesH = headingH + SHARE_TILE_H * 2 + SHARE_TILE_GAP;
  var minGap = 20;
  var insightBudget = contentBottom - y - tilesH - 2 * minGap;
  var insightW = width - 60;
  var insight = shareFitInsight(ctx, model.insight, insightW, insightBudget);
  var insightH = insight ? shareInsightBoxH(insight.lines.length, insight.size) : 0;
  var gap = Math.max(minGap, (contentBottom - y - tilesH - insightH) / 2);
  var tilesTop = Math.round(y + gap);
  L.zones.tiles = { top: tilesTop, bottom: tilesTop + tilesH };

  if (model.heading) {
    var hy = tilesTop + 20;
    var half = (width - 16) / 2;
    var hl = shareFitLine(ctx, 900, 18, 14, shareUpper(model.heading.left, model.lang), half);
    var hr = shareFitLine(ctx, 800, 18, 14, model.heading.right, half);
    var startX = model.rtl ? right - 4 : left + 4, endX = model.rtl ? left + 4 : right - 4;
    text("tiles", hl.text, hl.font, startX, hy, model.rtl ? "right" : "left", { x: model.rtl ? right - half : left, y: hy - 20, w: half, h: 26 }, SHARE_MUT, dir);
    text("tiles", hr.text, hr.font, endX, hy, model.rtl ? "left" : "right", { x: model.rtl ? left : right - half, y: hy - 20, w: half, h: 26 }, SHARE_MUT, dir);
  }
  var colWidth = (width - SHARE_TILE_GAP) / 2;
  var gridTop = tilesTop + headingH;
  var labelWeight = model.kind === "mirror" ? 800 : 900, labelMax = model.kind === "mirror" ? 22 : 24;
  L.tiles = model.tiles.slice(0, 4).map(function (tile, i) {
    var col = i % 2, row = Math.floor(i / 2);
    if (model.rtl) col = 1 - col;
    var tx = left + col * (colWidth + SHARE_TILE_GAP), ty = gridTop + row * (SHARE_TILE_H + SHARE_TILE_GAP);
    var inner = { x: tx + 22, w: colWidth - 44 };
    var edge = model.rtl ? inner.x + inner.w : inner.x, align = model.rtl ? "right" : "left";
    var label = shareFitLine(ctx, labelWeight, labelMax, 16, tile.label, inner.w);
    text("tile" + i, label.text, label.font, edge, ty + 40, align, { x: inner.x, y: ty + 16, w: inner.w, h: 30 }, model.kind === "mirror" ? SHARE_MUT : SHARE_INK, dir);
    var valueFont = shareFont(900, 56);
    var valueW = shareWidth(ctx, valueFont, tile.value);
    texts.push({ zone: "tile" + i, text: tile.value, font: valueFont, x: edge, y: ty + 98, align: align, box: { x: inner.x, y: ty + 50, w: inner.w, h: 56 }, color: SHARE_INK, dir: "ltr", value: true });
    if (tile.unit) {
      var unitW = inner.w - valueW - 10;
      var unit = shareFitLine(ctx, 800, 22, 16, tile.unit, unitW);
      var ux = model.rtl ? edge - valueW - 10 : edge + valueW + 10;
      text("tile" + i, unit.text, unit.font, ux, ty + 98, align, { x: model.rtl ? inner.x : ux, y: ty + 76, w: unitW, h: 28 }, SHARE_MUT, dir);
    }
    return { x: tx, y: ty, w: colWidth, h: SHARE_TILE_H, bar: { x: inner.x, y: ty + 112, w: inner.w, h: 12, fill: tile.bar, rtl: model.rtl }, tile: tile };
  });

  var insightTop = Math.round(L.zones.tiles.bottom + gap);
  if (insight) {
    var box = { x: left, y: insightTop, w: width, h: insightH };
    var labelFit = shareFitLine(ctx, 900, 20, 14, shareUpper(model.insightLabel, model.lang), insightW);
    text("insight", labelFit.text, labelFit.font, cx, insightTop + 42, "center", { x: left + 30, y: insightTop + 20, w: insightW, h: 28 }, SHARE_LABEL_INK[model.accent] || model.accent, dir);
    var lh = Math.round(insight.size * 1.36);
    insight.lines.forEach(function (line, i) {
      var ly = insightTop + 64 + Math.round(insight.size * 0.95) + i * lh;
      text("insight", line, insight.font, cx, ly, "center", { x: left + 30, y: ly - insight.size, w: insightW, h: lh }, SHARE_INK, dir);
    });
    L.insight = { box: box, lines: insight.lines, size: insight.size, sentences: insight.sentences, total: insight.total, truncated: !!insight.truncated, dashed: model.kind === "stalk" };
    L.zones.insight = { top: insightTop, bottom: insightTop + insightH };
  } else {
    L.zones.insight = { top: insightTop, bottom: insightTop };
  }

  var footY = footTop + 42;
  text("footer", "XORA", shareFont(900, 28), card.x + 36, footY, "left", { x: card.x + 36, y: footTop + 12, w: 140, h: 40 }, "#FFF6E9");
  text("footer", XORA_PUBLIC_HOST, shareFont(800, 20), card.x + card.w - 36, footY, "right", { x: card.x + card.w - 36 - 260, y: footTop + 16, w: 260, h: 34 }, "#FFF6E9");
  L.barcode = { text: fakeBarcode(model.hash), font: "17px monospace", x: cx + 10, y: footY - 2 };
  return L;
}

/* ---------- çizim ---------- */

function paintShareCard(ctx, L) {
  var m = L.model, card = L.card;
  ctx.textBaseline = "alphabetic";
  ctx.direction = "ltr";
  ctx.fillStyle = "#FFF6E9"; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  ctx.fillStyle = "rgba(15,189,189,0.12)"; ctx.beginPath(); ctx.arc(80, 90, 190, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,122,69,0.12)"; ctx.beginPath(); ctx.arc(1040, 1270, 230, 0, 7); ctx.fill();

  // Card body with the XORA hard shadow.
  ctx.fillStyle = "rgba(30,35,48,0.85)"; roundRect(ctx, card.x + 14, card.y + 16, card.w, card.h, 40); ctx.fill();
  ctx.fillStyle = "#FFFFFF"; roundRect(ctx, card.x, card.y, card.w, card.h, 40); ctx.fill();

  ctx.save();
  roundRect(ctx, card.x, card.y, card.w, card.h, 40); ctx.clip();
  if (m.bandColors.length > 1) {
    var mid = card.x + card.w / 2;
    ctx.fillStyle = m.bandColors[0]; ctx.fillRect(card.x, card.y, card.w / 2, SHARE_BAND_H);
    ctx.fillStyle = m.bandColors[1]; ctx.fillRect(mid, card.y, card.w / 2, SHARE_BAND_H);
    ctx.fillStyle = SHARE_INK;
    ctx.beginPath(); ctx.moveTo(mid + 24, card.y); ctx.lineTo(mid + 30, card.y); ctx.lineTo(mid - 24, L.bandBottom); ctx.lineTo(mid - 30, L.bandBottom); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = m.bandColors[0]; ctx.fillRect(card.x, card.y, card.w, SHARE_BAND_H);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.arc(card.x + 180, card.y + 50, 110, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(card.x + card.w - 90, card.y + 220, 130, 0, 7); ctx.fill();
  }
  ctx.fillStyle = SHARE_INK; ctx.fillRect(card.x, L.bandBottom - 2.5, card.w, 5);
  ctx.fillStyle = SHARE_INK; ctx.fillRect(card.x, L.footTop, card.w, SHARE_FOOT_H);
  ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = SHARE_INK; roundRect(ctx, card.x, card.y, card.w, card.h, 40); ctx.stroke();

  L.pills.forEach(function (p) {
    ctx.fillStyle = p.fill; roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2); ctx.fill();
    if (p.stroke) { ctx.lineWidth = 3; ctx.strokeStyle = p.stroke; roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2); ctx.stroke(); }
  });
  if (L.stamp) {
    ctx.save();
    ctx.translate(L.stamp.x + L.stamp.w / 2, L.stamp.y + L.stamp.h / 2); ctx.rotate(-0.07); ctx.translate(-(L.stamp.x + L.stamp.w / 2), -(L.stamp.y + L.stamp.h / 2));
    ctx.fillStyle = "rgba(255,255,255,0.88)"; roundRect(ctx, L.stamp.x, L.stamp.y, L.stamp.w, L.stamp.h, 10); ctx.fill();
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3; ctx.strokeStyle = SHARE_INK; roundRect(ctx, L.stamp.x, L.stamp.y, L.stamp.w, L.stamp.h, 10); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.restore();
  }

  L.avatars.forEach(function (a) {
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = SHARE_INK; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = SHARE_INK;
    ctx.font = Math.round(a.r * 1.05) + "px " + SHARE_EMOJI_FONT; ctx.fillText(a.emoji, a.x, a.y + 4);
    ctx.textBaseline = "alphabetic";
  });
  if (L.matchChip) {
    var chip = L.matchChip;
    ctx.beginPath(); ctx.arc(chip.x, chip.y, chip.r, 0, 7); ctx.fillStyle = SHARE_INK; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = shareFont(900, 36); ctx.fillText("×", chip.x, chip.y + 2);
    ctx.textBaseline = "alphabetic";
  }

  L.tiles.forEach(function (tl) {
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, tl.x, tl.y, tl.w, tl.h, 22); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = SHARE_INK; roundRect(ctx, tl.x, tl.y, tl.w, tl.h, 22); ctx.stroke();
    var b = tl.bar;
    // The track is always drawn; the fill is exactly the measured share and is omitted at 0.
    ctx.fillStyle = "#E3E5EA"; roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.fill();
    var fw = Math.round(b.w * b.fill / 100);
    if (fw > 0) {
      ctx.save(); roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.clip();
      ctx.fillStyle = m.accent; ctx.fillRect(b.rtl ? b.x + b.w - fw : b.x, b.y, fw, b.h);
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
    if (tx.hero) {
      // Digits in ink, the percent sign in XORA orange.
      var parts = String(tx.text).split(/([\d٠-٩]+)/).filter(Boolean);
      var total = parts.reduce(function (w, p) { return w + ctx.measureText(p).width; }, 0);
      var x = tx.x - total / 2;
      ctx.textAlign = "left"; ctx.direction = "ltr";
      parts.forEach(function (p) {
        ctx.fillStyle = /[\d٠-٩]/.test(p) ? SHARE_INK : "#FF7A45";
        ctx.fillText(p, x, tx.y); x += ctx.measureText(p).width;
      });
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
