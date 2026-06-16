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
  if (isV3Result(res)) return buildIdentityCardV3(res);
  if (isV2Result(res)) return buildIdentityCardV2(res);
  return buildIdentityCardV1(res);
}

/* --- V3 kart: profil okuma --- */
function buildIdentityCardV3(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var color = (res.card && res.card.color) || "#1B1B1B";
  var summary = res.profile_summary ? res.profile_summary[lang] : "";
  var mirror = res.comment ? res.comment.mirror[lang] : "";

  var topicsHtml = "";
  if (res.topics) {
    for (var i = 0; i < res.topics.length && i < 3; i++) {
      var tp = res.topics[i];
      topicsHtml +=
        '<div class="v3-topic">' +
          '<span class="v3-topic-label">' + esc(tp.label[lang]) + "</span>" +
          '<span class="v3-topic-bar"><i style="width:' + tp.weight + '%"></i></span>' +
          '<span class="v3-topic-val">' + tp.weight + "</span>" +
        "</div>";
    }
  }

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

  var signalsHtml = "";
  if (res.repeated_signals) {
    for (var s = 0; s < res.repeated_signals.length && s < 3; s++) {
      var sig = res.repeated_signals[s];
      var txt = sig.text ? sig.text[lang] : (sig.signal ? sig.signal[lang] : "");
      signalsHtml += '<li class="v3-signal">' + esc(txt) + "</li>";
    }
  }

  return (
    '<div class="idcard v3card" style="--ac:' + color + '">' +
      '<div class="idcard-band">' +
        '<span class="idcard-avatar">🪞</span>' +
      "</div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(res.handle) + "</p>" +
        '<div class="v3-summary"><p>' + esc(summary) + "</p></div>" +
        (topicsHtml ? '<div class="v3-topics"><span class="v3-section-label">' + esc(lang === "tr" ? "Konu Haritası" : "Topic Map") + "</span>" + topicsHtml + "</div>" : "") +
        '<div class="idcard-scores">' + chips + "</div>" +
        (signalsHtml ? '<div class="v3-signals"><span class="v3-section-label">' + esc(lang === "tr" ? "Tekrar Eden Sinyaller" : "Repeated Signals") + "</span><ul>" + signalsHtml + "</ul></div>" : "") +
        '<div class="idcard-quote">' +
          '<span class="quote-label">' + esc(lang === "tr" ? "XORA Ayna" : "XORA Mirror") + "</span>" +
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
  if (isV3Result(res)) return renderIdentityPNGV3(res);
  if (isV2Result(res)) return renderIdentityPNGV2(res);
  return renderIdentityPNGV1(res);
}

/* --- V3 PNG: profil okuma --- */
function renderIdentityPNGV3(res) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  var color = (res.card && res.card.color) || "#1B1B1B";
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, color);

  ctx.beginPath(); ctx.arc(500, 380, 120, 0, 7);
  ctx.fillStyle = "#FFFFFF"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
  ctx.font = "130px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.fillText("🪞", 500, 428);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 34px Nunito, Arial, sans-serif";
  ctx.fillText("@" + res.handle, 500, 250);

  var summary = res.profile_summary ? res.profile_summary[lang] : "";
  ctx.fillStyle = "#5C6270";
  ctx.font = "600 24px Nunito, Arial, sans-serif";
  var sumY = wrapText(ctx, summary, 500, 540, 700, 30);

  var curY = sumY + 30;

  if (res.topics && res.topics.length > 0) {
    ctx.fillStyle = color;
    ctx.font = "800 20px Nunito, Arial, sans-serif";
    ctx.fillText(lang === "tr" ? "KONU HARİTASI" : "TOPIC MAP", 500, curY);
    curY += 10;
    for (var ti = 0; ti < res.topics.length && ti < 3; ti++) {
      var tp = res.topics[ti];
      var tpLabel = tp.label[lang];
      curY += 28;
      ctx.textAlign = "left";
      ctx.font = "700 20px Nunito, Arial, sans-serif";
      ctx.fillStyle = "#5C6270";
      ctx.fillText(tpLabel, 200, curY);
      ctx.fillStyle = "#ECEDF0";
      roundRect(ctx, 450, curY - 14, 250, 18, 9);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, 450, curY - 14, Math.max(Math.round(250 * tp.weight / 100), 10), 18, 9);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.font = "800 18px Nunito, Arial, sans-serif";
      ctx.fillStyle = "#1E2330";
      ctx.fillText(tp.weight, 730, curY);
    }
    ctx.textAlign = "center";
    curY += 20;
  }

  var top = res.top_behaviors || [];
  for (var i = 0; i < top.length && i < 6; i++) {
    var label = top[i].label ? (top[i].label[lang] || top[i].label.tr) : top[i].key;
    var val = top[i].value;
    curY += 32;
    ctx.textAlign = "left";
    ctx.font = "700 20px Nunito, Arial, sans-serif";
    ctx.fillStyle = "#5C6270";
    ctx.fillText(label, 200, curY);
    ctx.fillStyle = "#ECEDF0";
    roundRect(ctx, 430, curY - 14, 250, 18, 9);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, 430, curY - 14, Math.max(Math.round(250 * val / 100), 10), 18, 9);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.font = "800 20px Nunito, Arial, sans-serif";
    ctx.fillStyle = "#1E2330";
    ctx.fillText(val, 720, curY);
  }
  ctx.textAlign = "center";
  curY += 25;

  var mirror = res.comment ? res.comment.mirror[lang] : "";
  if (mirror) {
    var boxH = 140;
    if (curY + boxH > 1060) boxH = 1060 - curY;
    ctx.fillStyle = "#FFF1E3";
    roundRect(ctx, 130, curY, 740, boxH, 24);
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    roundRect(ctx, 130, curY, 740, boxH, 24);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "800 20px Nunito, Arial, sans-serif";
    ctx.fillText(lang === "tr" ? "XORA AYNA" : "XORA MIRROR", 500, curY + 30);

    ctx.fillStyle = "#1E2330";
    ctx.font = "600 20px Nunito, Arial, sans-serif";
    wrapText(ctx, mirror, 500, curY + 56, 660, 26);
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
  if (isV3Result(res)) {
    if (lang === "tr") {
      return "XORA beni okudu 🪞 @" + res.handle + " profilim hazır 👀 Sen ne çıkarsın? → xora.app";
    }
    return "XORA read me 🪞 @" + res.handle + " profile ready 👀 What would yours say? → xora.app";
  }
  var name;
  if (isV2Result(res)) {
    name = res.card.nickname[lang];
  } else {
    name = res.archetype.name[lang];
  }
  if (lang === "tr") {
    return 'XORA beni analiz etti: "' + name + '" çıktım 👀 Sen ne çıkarsın? → xora.app';
  }
  return 'XORA analyzed me: I\'m a "' + name + '" 👀 What would you be? → xora.app';
}

function shareMatchText(m) {
  var lang = (typeof getLang === "function") ? getLang() : "tr";
  if (lang === "tr") {
    return "@" + m.a + " × @" + m.b + " uyumu: %" + m.overall +
           " 🔥 XORA hesapladı. Siz kaç çıkarsınız? → xora.app";
  }
  return "@" + m.a + " × @" + m.b + " match: " + m.overall +
         "% 🔥 Calculated by XORA. What's your score? → xora.app";
}
