/* ============================================================
   XORA — xora.js
   Analiz motoru (V1 simülasyon)
   - Aynı kullanıcı adı → her zaman aynı sonuç (deterministik hash)
   - 12 arketip, TR/EN yorumlar
   - Düşünme ekranı mesajları
   ============================================================ */

/* ---------------- deterministik hash ---------------- */

function normHandle(s) {
  return String(s || "").trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
}

function xhash(str) {
  var s = normHandle(str);
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/* ---------------- 12 arketip ---------------- */
/* Her arketip: emoji avatar, vurgu rengi, isim, kısa tanım, 2 XORA yorumu (TR+EN) */

var ARCHETYPES = [
  {
    id: "gece-filozofu", emoji: "🦉", color: "#0FAFAF",
    name: { tr: "Gece Filozofu", en: "Night Philosopher" },
    desc: {
      tr: "Gündüz sessiz, gece 02:47'de derin.",
      en: "Quiet by day, profound at 2:47 AM."
    },
    comments: {
      tr: [
        "Gündüz attığın tweetler kibar, gece attıkların kitap olur. İkisini de okudum, geceyi tercih ederim.",
        "Saat 03:00 tweetlerinde bir üniversite kürsüsü gizli. Sabah silmen ayrı bir karakter analizi konusu."
      ],
      en: [
        "Your daytime posts are polite; your 3 AM posts could fill a book. I read both. I prefer the night shift.",
        "There's a philosophy department hidden in your late-night posts. Deleting them by morning is its own case study."
      ]
    }
  },
  {
    id: "reply-savascisi", emoji: "⚔️", color: "#FF7A45",
    name: { tr: "Reply Savaşçısı", en: "Reply Warrior" },
    desc: {
      tr: "Timeline'a değil, yanıtlara yaşar.",
      en: "Lives in the replies, not the timeline."
    },
    comments: {
      tr: [
        "Kendi tweetin az ama başkalarının tweet'inin altı senin evin. Kira ödemeden oturuyorsun, helal.",
        "Yanlış bir bilgi gördüğünde dayanamıyorsun, biliyorum. Timeline'ın gönüllü hakemisin."
      ],
      en: [
        "You barely post, but the replies section is your home. You live there rent-free, respect.",
        "You physically cannot scroll past wrong information. You're the timeline's volunteer referee."
      ]
    }
  },
  {
    id: "sessiz-stalker", emoji: "🕵️", color: "#5B8DEF",
    name: { tr: "Sessiz Stalker", en: "Silent Stalker" },
    desc: {
      tr: "Her şeyi görür, hiçbir şey beğenmez.",
      en: "Sees everything, likes nothing."
    },
    comments: {
      tr: [
        "Herkesi okuyorsun ama iz bırakmıyorsun. Beğeni butonun tozlanmış, sildim üstünü.",
        "Sen tweet atmazsın, gözlem yaparsın. Bu kartı bile kimseye göstermeyebilirsin ama içinden paylaşmak geçiyor."
      ],
      en: [
        "You read everyone but leave no trace. Your like button has dust on it. I wiped it for you.",
        "You don't post, you observe. You might not even show this card to anyone — but you're tempted."
      ]
    }
  },
  {
    id: "timeline-ogretmeni", emoji: "📚", color: "#16A07A",
    name: { tr: "Timeline Öğretmeni", en: "Timeline Teacher" },
    desc: {
      tr: "Thread'le gelir, kaynakça ile gider.",
      en: "Arrives with a thread, leaves with citations."
    },
    comments: {
      tr: [
        "Her konuda 7 maddelik thread'in hazır. İnsanlar sormadan cevap veriyorsun ama dürüst olayım: faydalı.",
        "Tweetlerinde 'aslında' kelimesi rekor kırıyor. Sınıfın en çalışkanısın, timeline senin tahtaların."
      ],
      en: [
        "You have a 7-part thread ready on every topic. You answer before anyone asks — honestly though, it's useful.",
        "The word 'actually' is breaking records in your posts. The timeline is your whiteboard."
      ]
    }
  },
  {
    id: "kaos-elcisi", emoji: "🌪️", color: "#FF5470",
    name: { tr: "Kaos Elçisi", en: "Chaos Ambassador" },
    desc: {
      tr: "Tartışma yoksa, yaratır.",
      en: "If there's no debate, creates one."
    },
    comments: {
      tr: [
        "Bir tweetinle üç grup birbirine girdi, sen çayını alıp izledin. Bu bir yetenek, korkutucu bir yetenek.",
        "Sen 'sadece soru soruyorum' diyorsun ama o sorular tansiyon yükseltmek için tasarlanmış. Saygı duyuyorum."
      ],
      en: [
        "One of your posts started a three-way fight while you watched with your tea. It's a talent. A scary one.",
        "You say you're 'just asking questions' but those questions are engineered for maximum drama. Respect."
      ]
    }
  },
  {
    id: "ana-karakter", emoji: "🎬", color: "#F2B705",
    name: { tr: "Ana Karakter", en: "Main Character" },
    desc: {
      tr: "Timeline bir film, başrol belli.",
      en: "The timeline is a movie. Guess who stars."
    },
    comments: {
      tr: [
        "Hava durumunu bile kendi hikayenle bağlayıp anlatıyorsun. İzleyici kitlen var, başrolü hak ediyorsun.",
        "Her olayda bir 'ben de tam o sırada...' tweet'in var. Senaryo güzel, devam filmi bekliyoruz."
      ],
      en: [
        "You can connect even the weather forecast to your personal arc. You have an audience — the lead role is deserved.",
        "Every event comes with your 'funny thing, I was just...' post. Great script. We await the sequel."
      ]
    }
  },
  {
    id: "mizah-kacakcisi", emoji: "🃏", color: "#FF8C42",
    name: { tr: "Mizah Kaçakçısı", en: "Humor Smuggler" },
    desc: {
      tr: "En ciddi konuya espriyle girer.",
      en: "Enters the most serious topic with a joke."
    },
    comments: {
      tr: [
        "Cenazede bile güldürecek bir caps'in hazır. Bazıları buna saygısızlık diyor, ben zanaat diyorum.",
        "Ciddi tweetlerin bile punchline ile bitiyor. Kontrol edemiyorsun, biliyorum. Etme zaten."
      ],
      en: [
        "You have a meme ready for any situation, including funerals. Some call it disrespect. I call it craft.",
        "Even your serious posts end with a punchline. You can't help it. Please don't."
      ]
    }
  },
  {
    id: "strateji-tilkisi", emoji: "🦊", color: "#E8590C",
    name: { tr: "Strateji Tilkisi", en: "Strategy Fox" },
    desc: {
      tr: "Her tweet bir hamle, her beğeni bir yatırım.",
      en: "Every post is a move, every like an investment."
    },
    comments: {
      tr: [
        "Tweet saatlerin tesadüf değil, etkileşim grafiğini ezbere biliyorsun. Network'ün bir satranç tahtası.",
        "Kimi ne zaman beğendiğin bile planlı. Soğukkanlısın ama timeline'da herkes seni 'samimi' sanıyor. İşte strateji."
      ],
      en: [
        "Your posting times are not a coincidence — you know your engagement graph by heart. Your network is a chessboard.",
        "Even your likes are scheduled. Everyone thinks you're 'genuine'. That, my friend, is strategy."
      ]
    }
  },
  {
    id: "duygu-yayincisi", emoji: "📡", color: "#D6336C",
    name: { tr: "Duygu Yayıncısı", en: "Emotion Broadcaster" },
    desc: {
      tr: "Hisleri canlı yayında, 7/24.",
      en: "Feelings on live broadcast, 24/7."
    },
    comments: {
      tr: [
        "Mutluluğun da üzüntün de anında timeline'da. Takipçilerin senin dizini izliyor, bölüm atlamak yok.",
        "Şarkı sözü tweetlerinden ruh halini takip edebiliyorum. Bu hafta dalgalı geçmiş, geçmiş olsun."
      ],
      en: [
        "Your joy and your heartbreak hit the timeline in real time. Your followers are watching your series — no skipping episodes.",
        "I can track your mood through your song-lyric posts. Rough week apparently. Get well soon."
      ]
    }
  },
  {
    id: "gundem-avcisi", emoji: "🎯", color: "#0CA678",
    name: { tr: "Gündem Avcısı", en: "Trend Hunter" },
    desc: {
      tr: "Trend daha trend olmadan oradadır.",
      en: "There before the trend is a trend."
    },
    comments: {
      tr: [
        "Gündem patlamadan 20 dakika önce tweet atmışsın, yine. Ajansların senden öğreneceği var.",
        "Trend listesi senin doğal yaşam alanın. Bir konu eskidi mi ilk sen terk ediyorsun, vefasız ama etkili."
      ],
      en: [
        "You posted 20 minutes before the topic exploded. Again. News agencies could learn from you.",
        "The trends tab is your natural habitat. You're the first to abandon a dying topic — ruthless but effective."
      ]
    }
  },
  {
    id: "bilge-troll", emoji: "🧙", color: "#7048E8",
    name: { tr: "Bilge Troll", en: "Wise Troll" },
    desc: {
      tr: "Şaka mı, ders mi? Hiç belli olmaz.",
      en: "Joke or lesson? Nobody ever knows."
    },
    comments: {
      tr: [
        "İnsanlar tweetlerine gülerken bir şey öğrendiklerini fark etmiyor. Bu en tehlikeli öğretmenlik türü.",
        "Trolün içinde bir filozof, filozofun içinde bir trol var. Hangisi asıl sen? XORA bile emin değil."
      ],
      en: [
        "People laugh at your posts without noticing they just learned something. The most dangerous kind of teaching.",
        "There's a philosopher inside the troll, and a troll inside the philosopher. Which one is you? Even XORA isn't sure."
      ]
    }
  },
  {
    id: "alinti-ustasi", emoji: "💬", color: "#1098AD",
    name: { tr: "Alıntı Ustası", en: "Quote Master" },
    desc: {
      tr: "Alıntı tweet'i sanata çevirdi.",
      en: "Turned the quote post into an art form."
    },
    comments: {
      tr: [
        "Sen tweet atmıyorsun, tweetlere altyazı yazıyorsun. Ve dürüst olayım: altyazılar orijinalinden iyi.",
        "Bir tweet'i alıntılayıp tek cümleyle yıkıyorsun. Bu güç yanlış ellerde felaket olurdu, sende sanat."
      ],
      en: [
        "You don't post, you write subtitles for other people's posts. Honestly? The subtitles are better than the originals.",
        "You quote a post and demolish it in one sentence. In the wrong hands this power would be a disaster. In yours, it's art."
      ]
    }
  }
];

/* ---------------- skor etiketleri ---------------- */

var SCORE_KEYS = ["sc_viral", "sc_kaos", "sc_mizah", "sc_gece"];

/* ---------------- analiz (Mirror + Stalk aynı motor) ---------------- */

function analyzeHandle(rawHandle) {
  var handle = normHandle(rawHandle);
  var h = xhash(handle);
  var a = ARCHETYPES[h % ARCHETYPES.length];
  var scores = {
    sc_viral: 30 + (h % 66),
    sc_kaos:  22 + ((h >>> 3) % 74),
    sc_mizah: 20 + ((h >>> 6) % 76),
    sc_gece:  15 + ((h >>> 9) % 81)
  };
  var ci = (h >>> 4) % a.comments.tr.length;
  return { handle: handle, hash: h, archetype: a, scores: scores, ci: ci };
}

function archetypeById(id) {
  for (var i = 0; i < ARCHETYPES.length; i++) {
    if (ARCHETYPES[i].id === id) return ARCHETYPES[i];
  }
  return ARCHETYPES[0];
}

/* ---------------- match motoru ---------------- */

var MATCH_COMMENTS = {
  tr: [
    "{a} planlıyor, {b} sabote ediyor. Garip ama bu ikili çalışıyor.",
    "{a} ile {b} aynı tweete iki zıt yorum yazar, sonra birlikte kahve içer. Nadir bulunan bir denge.",
    "{a} gündemi yakalar, {b} gündemi yaratır. Birleşirlerse timeline'a huzur yok.",
    "{a} konuşur, {b} kaydeder. On yıl sonra bu arşiv birinin başını yakar, muhtemelen {a}'nın.",
    "{a} ve {b} birbirini takip ediyor ama beğenmiyor. Bu sessizlik bir anlaşma mı, gerilim mi? XORA gerilimden yana.",
    "{a} fikri bulur, {b} fikri savunur. İş bölümü net, telif tartışması kaçınılmaz."
  ],
  en: [
    "{a} makes the plan, {b} sabotages it. Strange, but this duo works.",
    "{a} and {b} would write opposite replies to the same post, then grab coffee together. A rare equilibrium.",
    "{a} catches the trend, {b} creates it. If they team up, the timeline gets no rest.",
    "{a} talks, {b} keeps receipts. In ten years that archive burns someone — probably {a}.",
    "{a} and {b} follow each other but never like. Is that silence a treaty or tension? XORA votes tension.",
    "{a} finds the idea, {b} defends it. Clear division of labor. Credit dispute inevitable."
  ]
};

function matchHandles(rawA, rawB) {
  var a = normHandle(rawA);
  var b = normHandle(rawB);
  var pair = [a, b].slice().sort();
  var c = xhash(pair[0] + "\u2022" + pair[1]);   // sıra bağımsız, deterministik

  var friendship = 42 + (c % 57);                 // 42–98
  var work = 40 + ((c >>> 4) % 59);               // 40–98
  var overall = Math.round((friendship + work) / 2 + ((c >>> 8) % 7) - 3);
  overall = Math.max(35, Math.min(99, overall));

  return {
    a: a, b: b,
    resA: analyzeHandle(a),
    resB: analyzeHandle(b),
    friendship: friendship,
    work: work,
    overall: overall,
    ci: (c >>> 6) % MATCH_COMMENTS.tr.length
  };
}

function matchComment(m, lang) {
  return MATCH_COMMENTS[lang][m.ci]
    .replace(/\{a\}/g, "@" + m.a)
    .replace(/\{b\}/g, "@" + m.b);
}

/* ---------------- düşünme ekranı ---------------- */

var THINKING = {
  mirror: {
    tr: [
      "Timeline'ının tozunu alıyorum...",
      "Gece 3 tweetlerini görmezden gelmeye çalışıyorum... olmuyor.",
      "Birkaç fazla iddialı cümle buldum, not aldım.",
      "Sildiğin tweetleri saymıyorum, söz.",
      "Beğenilerini yargılamıyorum, sadece... not alıyorum.",
      "XORA bazen fazla dürüst olabilir, hazır ol."
    ],
    en: [
      "Dusting off your timeline...",
      "Trying to ignore your 3 AM posts... I can't.",
      "Found a few overly confident sentences. Noted.",
      "Not counting your deleted posts. Promise.",
      "Not judging your likes. Just... taking notes.",
      "XORA can be a little too honest. Brace yourself."
    ]
  },
  stalk: {
    tr: [
      "Profile sessizce giriyorum...",
      "İz bırakmıyorum, merak etme.",
      "Hmm. İlginç bir beğeni geçmişi.",
      "Bunu senden duymuş olmayayım...",
      "Takip ettiklerine de baktım, çok şey anlatıyor.",
      "Bulduklarımı sadece sana söyleyeceğim."
    ],
    en: [
      "Entering the profile quietly...",
      "Leaving no trace, don't worry.",
      "Hmm. Interesting like history.",
      "You didn't hear this from me...",
      "Checked who they follow too. It says a lot.",
      "I'll tell only you what I found."
    ]
  },
  match: {
    tr: [
      "İki timeline'ı yan yana koyuyorum...",
      "Ortak beğenileri tarıyorum... ilginç.",
      "Biri gündüz, biri gece aktif. Not aldım.",
      "Reply geçmişlerinde gerilim tespit edildi.",
      "Kimya hesaplanıyor, laboratuvar önlüğümü giydim.",
      "Sonuç birinizi üzebilir. Hazırsanız açıklıyorum."
    ],
    en: [
      "Putting the two timelines side by side...",
      "Scanning shared likes... interesting.",
      "One is a day person, one is a night person. Noted.",
      "Tension detected in the reply history.",
      "Calculating chemistry. Lab coat is on.",
      "The result may upset one of you. Revealing now."
    ]
  }
};

/* Düşünme animasyonu: mesajları sırayla gösterir, sonra onDone çağırır */
function playThinking(msgEl, mode, onDone) {
  var msgs = THINKING[mode][getLang()] || THINKING[mode].tr;
  var i = 0;
  msgEl.textContent = msgs[0];
  msgEl.classList.add("pop");
  var iv = setInterval(function () {
    i++;
    if (i >= 5) {                 // 5 mesaj ≈ 4.5 saniye
      clearInterval(iv);
      onDone();
      return;
    }
    msgEl.classList.remove("pop");
    void msgEl.offsetWidth;       // animasyonu sıfırla
    msgEl.textContent = msgs[i % msgs.length];
    msgEl.classList.add("pop");
  }, 900);
}
