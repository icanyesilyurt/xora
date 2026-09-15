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

function buildFunIdentityCard(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var color = (res.card && res.card.color) || (res.archetype && res.archetype.color) || "#10B8B8";
  var emoji = res.profile_emoji || (res.card && res.card.emoji) || (res.archetype && res.archetype.emoji) || "✨";
  var nick = localized(res.nickname || (res.card && res.card.nickname) || (res.archetype && res.archetype.name), lang);
  var desc = localized(res.tagline || (res.card && res.card.desc) || (res.archetype && res.archetype.desc), lang);
  var comment = funIdentityComment(res, lang);

  return (
    '<div class="idcard funcard" style="--ac:' + color + '" data-tier="fun">' +
      funRibbonHtml() +
      '<div class="idcard-band"><span class="idcard-avatar">' + emoji + '</span></div>' +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + '</p>' +
        '<h2 class="idcard-type">' + esc(nick) + '</h2>' +
        (desc ? '<p class="idcard-desc">' + esc(desc) + '</p>' : '') +
        '<div class="idcard-quote fun-quote"><p>' + esc(comment) + '</p></div>' +
      '</div>' +
      '<div class="idcard-foot"><span>XORA FUN</span><span class="barcode">' + fakeBarcode(res.hash || 1) + '</span><span>xora.app</span></div>' +
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
      '<h2 class="idcard-type match-pct">%' + m.overall + '</h2><p class="idcard-desc">' + esc(t("match_overall")) + '</p>' +
      '<div class="idcard-quote fun-quote"><span class="quote-label">XORA FUN</span><p>' + esc(comment) + '</p></div></div>' +
      '<div class="idcard-foot"><span>XORA FUN</span><span class="barcode">' + fakeBarcode(xhash(m.a + m.b)) + '</span><span>xora.app</span></div></div>'
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
    ? (lang === "tr" ? "XORA Stalk" : "XORA Stalk")
    : (lang === "tr" ? "XORA Ayna" : "XORA Mirror");

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
        "<span>xora.app</span>" +
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
        "<span>xora.app</span>" +
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
        "<span>xora.app</span>" +
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
        "<span>xora.app</span>" +
      "</div>" +
    "</div>"
  );
}

/* ============================================================
   PNG ÜRETİMİ (canvas) — 1000 x 1250
   ============================================================ */

function wrapText(ctx, text, x, y, maxW, lineH) {
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

function baseCanvas() {
  var cv = document.createElement("canvas");
  cv.width = 1000;
  cv.height = 1250;
  var ctx = cv.getContext("2d");
  ctx.textAlign = "center";

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
  ctx.font = "700 26px Nunito, Arial, sans-serif";
  ctx.fillText("xora.app", 890, 1140);
  ctx.textAlign = "center";
  ctx.font = "26px monospace";
  ctx.fillText(fakeBarcode(h), 500, 1140);
}

/* --- kimlik kartı PNG --- */
function renderIdentityPNG(res) {
  if (resultTier(res) === "fun") return renderFunIdentityPNG(res);
  var cv;
  if (isV3Result(res)) cv = renderIdentityPNGV3(res);
  else if (isV2Result(res)) cv = renderIdentityPNGV2(res);
  else cv = renderIdentityPNGV1(res);
  return resultTier(res) === "real" ? stampRealCanvas(cv, res) : cv;
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
  var c = res.card || {};
  var a = res.archetype || {};
  var color = c.color || a.color || "#10B8B8";
  var emoji = res.profile_emoji || c.emoji || a.emoji || "✨";
  var nick = localized(res.nickname || c.nickname || a.name, lang);
  var desc = localized(res.tagline || c.desc || a.desc, lang);
  var comment = funIdentityComment(res, lang);
  var b = baseCanvas(), ctx = b.ctx;
  drawCardFrame(ctx, color);
  ctx.fillStyle = "#1E2330"; roundRect(ctx, 50, 45, 260, 54, 27); ctx.fill();
  ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "left"; ctx.font = "900 24px Nunito, Arial, sans-serif"; ctx.fillText("XORA FUN · FREE", 72, 80);
  ctx.textAlign = "center";
  ctx.beginPath(); ctx.arc(500, 355, 118, 0, 7); ctx.fillStyle="#FFFFFF"; ctx.fill(); ctx.lineWidth=6; ctx.strokeStyle="#1E2330"; ctx.stroke();
  ctx.font = "126px 'Segoe UI Emoji','Apple Color Emoji',sans-serif"; ctx.fillText(emoji,500,402);
  ctx.fillStyle="#8A8F9C"; ctx.font="700 30px Nunito, Arial, sans-serif"; ctx.fillText("@"+res.handle,500,540);
  ctx.fillStyle="#1E2330"; ctx.font="900 56px Nunito, Arial, sans-serif"; var yNick=wrapText(ctx,nick,500,615,720,62);
  ctx.fillStyle="#5C6270"; ctx.font="600 28px Nunito, Arial, sans-serif"; var y=wrapText(ctx,desc,500,yNick+70,700,34)+42;
  ctx.font="700 26px Nunito, Arial, sans-serif";
  var commentLines=1, line="";
  comment.split(" ").forEach(function(word) {
    if (line && ctx.measureText(line+word+" ").width>660) { commentLines++; line=""; }
    line+=word+" ";
  });
  var quoteHeight=Math.max(220,70+(commentLines-1)*34);
  ctx.fillStyle="#FFF1E3"; roundRect(ctx,130,y,740,quoteHeight,24); ctx.fill(); ctx.strokeStyle=color; ctx.lineWidth=3; roundRect(ctx,130,y,740,quoteHeight,24); ctx.stroke();
  ctx.fillStyle="#1E2330"; ctx.font="700 26px Nunito, Arial, sans-serif"; wrapText(ctx,comment,500,y+42,660,34);
  drawCardFooter(ctx,res.hash||1);
  return b.cv;
}

function renderFunMatchPNG(m) {
  var cv = renderMatchPNGBase(m), ctx = cv.getContext("2d");
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
  var quoteLabel = mode === "stalk" ? "XORA STALK" : (lang === "tr" ? "XORA AYNA" : "XORA MIRROR");
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

function renderMatchPNGBase(m) {
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

  ctx.fillStyle = "#5C6270";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText(t("match_overall"), 500, 728);

  ctx.font = "700 24px Nunito, Arial, sans-serif";
  ctx.fillStyle = "#1E2330";
  var mLine1 = t("match_flirt") + " %" + m.flirt + "  •  " +
               t("match_vibe") + " %" + m.vibe + "  •  " +
               t("match_humor") + " %" + m.humor;
  var mLine2 = t("match_chaos") + " %" + m.chaos + "  •  " +
               t("match_romance") + " %" + m.romance;
  ctx.fillText(mLine1, 500, 780);
  ctx.fillText(mLine2, 500, 812);

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

  if (resultTier(res) === "real") {
    var rarity = rarityText(res);
    if (lang === "tr") return 'XORA REAL beni okudu: "' + name + '" · ' + rarity + ' 👀 Sen ne çıkarsın? → ' + getPublicSiteUrl();
    return 'XORA REAL read me: "' + name + '" · ' + rarity + ' 👀 What would yours say? → ' + getPublicSiteUrl();
  }
  if (lang === "tr") return 'XORA FUN kartım: "' + name + '" 😅 Seninkini çek → ' + getPublicSiteUrl();
  return 'My XORA FUN card: "' + name + '" 😅 Draw yours → ' + getPublicSiteUrl();
}

function shareMatchText(m) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  if (resultTier(m) === "real") {
    var rarity = rarityText(m);
    if (lang === "tr") return "XORA REAL: @" + m.a + " × @" + m.b + " uyumu %" + m.overall + " · " + rarity + " 🔥 → " + getPublicSiteUrl();
    return "XORA REAL: @" + m.a + " × @" + m.b + " match " + m.overall + "% · " + rarity + " 🔥 → " + getPublicSiteUrl();
  }
  if (lang === "tr") return "XORA FUN: @" + m.a + " × @" + m.b + " uyumu %" + m.overall + " 😅 Siz kaç çıkarsınız? → " + getPublicSiteUrl();
  return "XORA FUN: @" + m.a + " × @" + m.b + " match " + m.overall + "% 😅 Try yours → " + getPublicSiteUrl();
}


// Suppress sample-count sentences in historical cards as well as new cards/exports.
function cardPresentationCopy(value, key) {
  if (key === "meta") return value;
  if (typeof value === "string") {
    return value.split(/(?<=[.!?])\s+/).filter(function(sentence) {
      return !/\d[\d\s/.,%'-]*(?:posts?|tweets?|paylaşım|gönderi|tweet)|(?:posts?|tweets?|paylaşım|gönderi|sample)[^.!?]{0,35}\d|(?:analy[sz]ed|incelenen|analiz edilen)[^.!?]{0,35}(?:posts?|tweets?|paylaşım|gönderi)/iu.test(sentence);
    }).join(" ");
  }
  if (Array.isArray(value)) return value.map(function(v){return cardPresentationCopy(v);});
  if (value && typeof value === "object") {
    var copy={}; Object.keys(value).forEach(function(k){copy[k]=cardPresentationCopy(value[k],k);}); return copy;
  }
  return value;
}
["buildIdentityCard","buildMatchCard","renderIdentityPNG","renderMatchPNG","shareIdentityText","shareMatchText"].forEach(function(name){
  var original=window[name];
  window[name]=function(result){return original(cardPresentationCopy(result));};
});
