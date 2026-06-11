/* ============================================================
   XORA — card.js
   X Kimlik Kartı: ekranda gösterim, PNG indirme, X'te paylaşma
   ============================================================ */

/* ---------------- yardımcı: hash'ten sahte barkod ---------------- */

function fakeBarcode(h) {
  var s = "";
  for (var i = 0; i < 22; i++) {
    s += ((h >>> (i % 28)) & 1) ? "\u258B" : "\u258F"; // ▋ ▏
  }
  return s;
}

/* ---------------- kimlik kartı (Mirror & Stalk) ---------------- */

function buildIdentityCard(res) {
  var lang = getLang();
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

/* ---------------- match kartı ---------------- */

function buildMatchCard(m) {
  var lang = getLang();
  return (
    '<div class="idcard matchcard" style="--ac:#FF7A45">' +
      '<div class="idcard-band match-band">' +
        '<span class="idcard-avatar small">' + m.resA.archetype.emoji + "</span>" +
        '<span class="match-x">\u00D7</span>' +
        '<span class="idcard-avatar small">' + m.resB.archetype.emoji + "</span>" +
      "</div>" +
      '<div class="idcard-body">' +
        '<p class="idcard-handle">@' + esc(m.a) + " \u00D7 @" + esc(m.b) + "</p>" +
        '<h2 class="idcard-type match-pct">%' + m.overall + "</h2>" +
        '<p class="idcard-desc">' + esc(t("match_overall")) + "</p>" +
        '<div class="match-rows">' +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_friend")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.friendship + '%"></i></span>' +
            '<span class="score-val">%' + m.friendship + "</span>" +
          "</div>" +
          '<div class="score-chip">' +
            '<span class="score-name">' + esc(t("match_work")) + "</span>" +
            '<span class="score-bar"><i style="width:' + m.work + '%"></i></span>' +
            '<span class="score-val">%' + m.work + "</span>" +
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

  // krem zemin + köşelerde yumuşak lekeler
  ctx.fillStyle = "#FFF6E9";
  ctx.fillRect(0, 0, 1000, 1250);
  ctx.fillStyle = "rgba(15,189,189,0.12)";
  ctx.beginPath(); ctx.arc(80, 90, 190, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,122,69,0.12)";
  ctx.beginPath(); ctx.arc(940, 1180, 230, 0, 7); ctx.fill();
  return { cv: cv, ctx: ctx };
}

function drawCardFrame(ctx, accent) {
  // beyaz kart
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

  // üst renkli bant
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
  var lang = getLang();
  var a = res.archetype;
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, a.color);

  // avatar halkası + emoji
  ctx.beginPath(); ctx.arc(500, 380, 120, 0, 7);
  ctx.fillStyle = "#FFFFFF"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#1E2330"; ctx.stroke();
  ctx.font = "130px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.fillText(a.emoji, 500, 428);

  // handle + arketip + tanım
  ctx.fillStyle = "#8A8F9C";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText("@" + res.handle, 500, 560);

  ctx.fillStyle = "#1E2330";
  ctx.font = "900 62px Nunito, Arial, sans-serif";
  ctx.fillText(a.name[lang], 500, 632);

  ctx.fillStyle = "#5C6270";
  ctx.font = "600 30px Nunito, Arial, sans-serif";
  ctx.fillText(a.desc[lang], 500, 684);

  // XORA yorumu kutusu
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

  // küçük skorlar (ikinci planda)
  ctx.font = "700 24px Nunito, Arial, sans-serif";
  ctx.fillStyle = "#8A8F9C";
  var sx = [250, 500, 750, 500];
  var line1 = t("sc_viral") + " " + res.scores.sc_viral +
              "   \u2022   " + t("sc_kaos") + " " + res.scores.sc_kaos;
  var line2 = t("sc_mizah") + " " + res.scores.sc_mizah +
              "   \u2022   " + t("sc_gece") + " " + res.scores.sc_gece;
  ctx.fillText(line1, 500, 1010);
  ctx.fillText(line2, 500, 1048);

  drawCardFooter(ctx, res.hash);
  return b.cv;
}

/* --- match kartı PNG --- */
function renderMatchPNG(m) {
  var lang = getLang();
  var b = baseCanvas();
  var ctx = b.ctx;

  drawCardFrame(ctx, "#FF7A45");

  // iki avatar
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
  ctx.fillText("\u00D7", 500, 400);

  // handle'lar + genel uyum
  ctx.fillStyle = "#8A8F9C";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText("@" + m.a + "  \u00D7  @" + m.b, 500, 560);

  ctx.fillStyle = "#1E2330";
  ctx.font = "900 110px Nunito, Arial, sans-serif";
  ctx.fillText("%" + m.overall, 500, 680);

  ctx.fillStyle = "#5C6270";
  ctx.font = "700 30px Nunito, Arial, sans-serif";
  ctx.fillText(t("match_overall"), 500, 728);

  // alt skorlar
  ctx.font = "700 28px Nunito, Arial, sans-serif";
  ctx.fillStyle = "#1E2330";
  ctx.fillText(t("match_friend") + "  %" + m.friendship +
               "      \u2022      " + t("match_work") + "  %" + m.work, 500, 790);

  // XORA yorumu
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
  var lang = getLang();
  var name = res.archetype.name[lang];
  if (lang === "tr") {
    return 'XORA beni analiz etti: "' + name + '" \u00E7\u0131kt\u0131m \uD83D\uDC40 Sen ne \u00E7\u0131kars\u0131n? \u2192 xora.app';
  }
  return 'XORA analyzed me: I\'m a "' + name + '" \uD83D\uDC40 What would you be? \u2192 xora.app';
}

function shareMatchText(m) {
  var lang = getLang();
  if (lang === "tr") {
    return "@" + m.a + " \u00D7 @" + m.b + " uyumu: %" + m.overall +
           " \uD83D\uDD25 XORA hesaplad\u0131. Siz ka\u00E7 \u00E7\u0131kars\u0131n\u0131z? \u2192 xora.app";
  }
  return "@" + m.a + " \u00D7 @" + m.b + " match: " + m.overall +
         "% \uD83D\uDD25 Calculated by XORA. What's your score? \u2192 xora.app";
}
