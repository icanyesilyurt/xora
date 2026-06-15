/* ============================================================
   XORA — xora.js
   Analiz motoru (V2 — Davranış Merkez Mimarisi)
   - Aynı kullanıcı adı → her zaman aynı sonuç (deterministik hash)
   - 120 davranış havuzu, 10 demo profil şablonu
   - Backward compatible: archetype/scores shim for card.js/match
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

/* ============================================================
   DAVRANIŞ HAVUZU — 120 davranış, 10 küme
   Her davranış: key, cluster, label TR/EN
   ============================================================ */

var BEHAVIOR_POOL = [
  /* Küme 1 — Duygu ve İç Dünya */
  { key: "ofke", cluster: "duygu", label: { tr: "Öfke", en: "Anger" } },
  { key: "nese", cluster: "duygu", label: { tr: "Neşe", en: "Joy" } },
  { key: "uzuntu", cluster: "duygu", label: { tr: "Üzüntü", en: "Sadness" } },
  { key: "kaygi", cluster: "duygu", label: { tr: "Kaygı", en: "Anxiety" } },
  { key: "ozlem", cluster: "duygu", label: { tr: "Özlem", en: "Longing" } },
  { key: "nostalji", cluster: "duygu", label: { tr: "Nostalji", en: "Nostalgia" } },
  { key: "romantizm", cluster: "duygu", label: { tr: "Romantizm", en: "Romanticism" } },
  { key: "flort", cluster: "duygu", label: { tr: "Flört", en: "Flirtation" } },
  { key: "empati", cluster: "duygu", label: { tr: "Empati", en: "Empathy" } },
  { key: "duygu_yogunlugu", cluster: "duygu", label: { tr: "Duygu Yoğunluğu", en: "Emotional Intensity" } },
  { key: "duygu_salinımı", cluster: "duygu", label: { tr: "Duygu Salınımı", en: "Emotional Swing" } },
  { key: "bastirilmis_duygu", cluster: "duygu", label: { tr: "Bastırılmış Duygu", en: "Suppressed Emotion" } },
  { key: "ic_catisma", cluster: "duygu", label: { tr: "İç Çatışma", en: "Inner Conflict" } },
  { key: "kirilganlik", cluster: "duygu", label: { tr: "Kırılganlık", en: "Vulnerability" } },
  { key: "hayal_kirikligi", cluster: "duygu", label: { tr: "Hayal Kırıklığı", en: "Disappointment" } },
  { key: "umut", cluster: "duygu", label: { tr: "Umut", en: "Hope" } },

  /* Küme 2 — Sosyal Dinamik */
  { key: "aidiyet", cluster: "sosyal", label: { tr: "Aidiyet", en: "Belonging" } },
  { key: "taraftarlik", cluster: "sosyal", label: { tr: "Taraftarlık", en: "Fan Loyalty" } },
  { key: "liderlik", cluster: "sosyal", label: { tr: "Liderlik", en: "Leadership" } },
  { key: "rekabet", cluster: "sosyal", label: { tr: "Rekabet", en: "Competitiveness" } },
  { key: "savunma", cluster: "sosyal", label: { tr: "Savunma", en: "Defensiveness" } },
  { key: "koruma", cluster: "sosyal", label: { tr: "Koruma", en: "Protectiveness" } },
  { key: "onay_arama", cluster: "sosyal", label: { tr: "Onay Arama", en: "Approval Seeking" } },
  { key: "topluluk_dili", cluster: "sosyal", label: { tr: "Topluluk Dili", en: "Community Language" } },
  { key: "tartisma", cluster: "sosyal", label: { tr: "Tartışma", en: "Debate" } },
  { key: "son_soz", cluster: "sosyal", label: { tr: "Son Söz", en: "Last Word" } },
  { key: "provokasyon", cluster: "sosyal", label: { tr: "Provokasyon", en: "Provocation" } },
  { key: "ates_cekme", cluster: "sosyal", label: { tr: "Ateş Çekme", en: "Fire Magnet" } },
  { key: "sadakat", cluster: "sosyal", label: { tr: "Sadakat", en: "Loyalty" } },
  { key: "guven", cluster: "sosyal", label: { tr: "Güven", en: "Trust" } },
  { key: "yalnizlik", cluster: "sosyal", label: { tr: "Yalnızlık", en: "Loneliness" } },
  { key: "izolasyon", cluster: "sosyal", label: { tr: "İzolasyon", en: "Isolation" } },

  /* Küme 3 — Mizah ve İfade */
  { key: "mizah", cluster: "ifade", label: { tr: "Mizah", en: "Humor" } },
  { key: "ironi", cluster: "ifade", label: { tr: "İroni", en: "Irony" } },
  { key: "kara_mizah", cluster: "ifade", label: { tr: "Kara Mizah", en: "Dark Humor" } },
  { key: "oz_ironi", cluster: "ifade", label: { tr: "Öz İroni", en: "Self-Irony" } },
  { key: "abarti", cluster: "ifade", label: { tr: "Abartı", en: "Exaggeration" } },
  { key: "kufur", cluster: "ifade", label: { tr: "Küfür", en: "Profanity" } },
  { key: "caps_meme", cluster: "ifade", label: { tr: "Caps/Meme", en: "Meme Power" } },
  { key: "absurt", cluster: "ifade", label: { tr: "Absürt", en: "Absurdist" } },
  { key: "sarkastik", cluster: "ifade", label: { tr: "Sarkastik", en: "Sarcasm" } },
  { key: "espri_zamanlama", cluster: "ifade", label: { tr: "Espri Zamanlaması", en: "Comedy Timing" } },
  { key: "emoji_yogunlugu", cluster: "ifade", label: { tr: "Emoji Yoğunluğu", en: "Emoji Density" } },
  { key: "emoji_cesitliligi", cluster: "ifade", label: { tr: "Emoji Çeşitliliği", en: "Emoji Variety" } },
  { key: "caps_lock", cluster: "ifade", label: { tr: "Caps Lock", en: "Caps Lock" } },
  { key: "noktalama", cluster: "ifade", label: { tr: "Noktalama", en: "Punctuation" } },

  /* Küme 4 — Düşünce ve Zeka */
  { key: "merak", cluster: "dusunce", label: { tr: "Merak", en: "Curiosity" } },
  { key: "sorgulama", cluster: "dusunce", label: { tr: "Sorgulama", en: "Questioning" } },
  { key: "derinlik", cluster: "dusunce", label: { tr: "Derinlik", en: "Depth" } },
  { key: "genelleme", cluster: "dusunce", label: { tr: "Genelleme", en: "Generalization" } },
  { key: "referans", cluster: "dusunce", label: { tr: "Referans", en: "Referencing" } },
  { key: "elestirel_dusunce", cluster: "dusunce", label: { tr: "Eleştirel Düşünce", en: "Critical Thinking" } },
  { key: "bilgi_paylasma", cluster: "dusunce", label: { tr: "Bilgi Paylaşma", en: "Knowledge Sharing" } },
  { key: "spekulasyon", cluster: "dusunce", label: { tr: "Spekülasyon", en: "Speculation" } },
  { key: "dikkat", cluster: "dusunce", label: { tr: "Dikkat", en: "Attention to Detail" } },
  { key: "gozlem", cluster: "dusunce", label: { tr: "Gözlem", en: "Observation" } },
  { key: "felsefe", cluster: "dusunce", label: { tr: "Felsefe", en: "Philosophy" } },
  { key: "ic_ses", cluster: "dusunce", label: { tr: "İç Ses", en: "Inner Voice" } },

  /* Küme 5 — Zaman ve Ritim */
  { key: "gece_aktiflik", cluster: "zaman", label: { tr: "Gece Aktifliği", en: "Night Activity" } },
  { key: "patlama", cluster: "zaman", label: { tr: "Patlama", en: "Burst" } },
  { key: "sessizlik", cluster: "zaman", label: { tr: "Sessizlik", en: "Silence" } },
  { key: "rutin", cluster: "zaman", label: { tr: "Rutin", en: "Routine" } },
  { key: "olay_tetikli", cluster: "zaman", label: { tr: "Olay Tetikli", en: "Event Triggered" } },
  { key: "tepki_hizi", cluster: "zaman", label: { tr: "Tepki Hızı", en: "Reaction Speed" } },
  { key: "sabir", cluster: "zaman", label: { tr: "Sabır", en: "Patience" } },
  { key: "gece_gunduz_fark", cluster: "zaman", label: { tr: "Gece-Gündüz Farkı", en: "Day-Night Contrast" } },
  { key: "hafta_sonu_fark", cluster: "zaman", label: { tr: "Hafta Sonu Farkı", en: "Weekend Shift" } },
  { key: "mevsimsellik", cluster: "zaman", label: { tr: "Mevsimsellik", en: "Seasonality" } },

  /* Küme 6 — Kontrol ve Strateji */
  { key: "kontrol", cluster: "strateji", label: { tr: "Kontrol", en: "Control" } },
  { key: "zamanlama_stratejisi", cluster: "strateji", label: { tr: "Zamanlama Stratejisi", en: "Timing Strategy" } },
  { key: "performans", cluster: "strateji", label: { tr: "Performans", en: "Performance" } },
  { key: "viral_pesinde", cluster: "strateji", label: { tr: "Viral Peşinde", en: "Chasing Viral" } },
  { key: "marka", cluster: "strateji", label: { tr: "Marka", en: "Personal Brand" } },
  { key: "network", cluster: "strateji", label: { tr: "Network", en: "Networking" } },
  { key: "risk_alma", cluster: "strateji", label: { tr: "Risk Alma", en: "Risk Taking" } },
  { key: "hesap", cluster: "strateji", label: { tr: "Hesap", en: "Calculation" } },
  { key: "maske", cluster: "strateji", label: { tr: "Maske", en: "Mask" } },
  { key: "silme", cluster: "strateji", label: { tr: "Silme", en: "Delete Tendency" } },
  { key: "filtre", cluster: "strateji", label: { tr: "Filtre", en: "Filter" } },
  { key: "planli_kaos", cluster: "strateji", label: { tr: "Planlı Kaos", en: "Planned Chaos" } },

  /* Küme 7 — Kimlik ve Benlik */
  { key: "oz_farkindalik", cluster: "kimlik", label: { tr: "Öz Farkındalık", en: "Self-Awareness" } },
  { key: "oz_elestiri", cluster: "kimlik", label: { tr: "Öz Eleştiri", en: "Self-Criticism" } },
  { key: "tutarlilik", cluster: "kimlik", label: { tr: "Tutarlılık", en: "Consistency" } },
  { key: "isyan", cluster: "kimlik", label: { tr: "İsyan", en: "Rebellion" } },
  { key: "adalet", cluster: "kimlik", label: { tr: "Adalet", en: "Justice" } },
  { key: "cesaret", cluster: "kimlik", label: { tr: "Cesaret", en: "Courage" } },
  { key: "milliyetcilik", cluster: "kimlik", label: { tr: "Milliyetçilik", en: "Nationalism" } },
  { key: "inanc", cluster: "kimlik", label: { tr: "İnanç", en: "Faith" } },
  { key: "dijital_kimlik", cluster: "kimlik", label: { tr: "Dijital Kimlik", en: "Digital Persona" } },
  { key: "platform_bagimliligi", cluster: "kimlik", label: { tr: "Platform Bağımlılığı", en: "Platform Addiction" } },

  /* Küme 8 — İçerik ve Tüketim */
  { key: "gundem_takibi", cluster: "icerik", label: { tr: "Gündem Takibi", en: "Trend Following" } },
  { key: "haber_hizi", cluster: "icerik", label: { tr: "Haber Hızı", en: "News Speed" } },
  { key: "konu_cesitliligi", cluster: "icerik", label: { tr: "Konu Çeşitliliği", en: "Topic Variety" } },
  { key: "konu_derinligi", cluster: "icerik", label: { tr: "Konu Derinliği", en: "Topic Depth" } },
  { key: "alinti", cluster: "icerik", label: { tr: "Alıntı", en: "Quoting" } },
  { key: "thread", cluster: "icerik", label: { tr: "Thread", en: "Thread" } },
  { key: "gorsel_icerik", cluster: "icerik", label: { tr: "Görsel İçerik", en: "Visual Content" } },
  { key: "muzik_paylasimi", cluster: "icerik", label: { tr: "Müzik Paylaşımı", en: "Music Sharing" } },
  { key: "link_paylasimi", cluster: "icerik", label: { tr: "Link Paylaşımı", en: "Link Sharing" } },
  { key: "reply_orani", cluster: "icerik", label: { tr: "Reply Oranı", en: "Reply Rate" } },

  /* Küme 9 — İlişki ve Bağlanma */
  { key: "baglanma", cluster: "iliski", label: { tr: "Bağlanma", en: "Attachment" } },
  { key: "itiraf", cluster: "iliski", label: { tr: "İtiraf", en: "Confession" } },
  { key: "gizlilik", cluster: "iliski", label: { tr: "Gizlilik", en: "Privacy" } },
  { key: "mesafe", cluster: "iliski", label: { tr: "Mesafe", en: "Distance" } },
  { key: "fedakarlik", cluster: "iliski", label: { tr: "Fedakarlık", en: "Self-Sacrifice" } },
  { key: "sinir", cluster: "iliski", label: { tr: "Sınır", en: "Boundaries" } },
  { key: "bagimsizlik", cluster: "iliski", label: { tr: "Bağımsızlık", en: "Independence" } },

  /* Küme 10 — Enerji ve Yaşam */
  { key: "enerji", cluster: "yasam", label: { tr: "Enerji", en: "Energy" } },
  { key: "yorgunluk", cluster: "yasam", label: { tr: "Yorgunluk", en: "Fatigue" } },
  { key: "motivasyon", cluster: "yasam", label: { tr: "Motivasyon", en: "Motivation" } },
  { key: "kacis", cluster: "yasam", label: { tr: "Kaçış", en: "Escapism" } },
  { key: "stres", cluster: "yasam", label: { tr: "Stres", en: "Stress" } },
  { key: "sikayet", cluster: "yasam", label: { tr: "Şikayet", en: "Complaining" } },
  { key: "hayal_gucu", cluster: "yasam", label: { tr: "Hayal Gücü", en: "Imagination" } },
  { key: "yaraticilik", cluster: "yasam", label: { tr: "Yaratıcılık", en: "Creativity" } }
];

var BEHAVIOR_MAP = {};
for (var _bi = 0; _bi < BEHAVIOR_POOL.length; _bi++) {
  BEHAVIOR_MAP[BEHAVIOR_POOL[_bi].key] = BEHAVIOR_POOL[_bi];
}

function getBehaviorLabel(key, lang) {
  var b = BEHAVIOR_MAP[key];
  if (!b) return key;
  return b.label[lang] || b.label.tr;
}

/* ============================================================
   DEMO PROFİL ŞABLONLARI — 10 adet
   Her şablon:
   - behaviors: [{key, value, signals:[{text,type,evidence}]}]
   - contradictions: [{pair:[k1,k2], text:{tr,en}}]
   - repeated_signals: [{signal:{tr,en}, type, count, anchor:{tr,en}}]
   - card: {nickname, desc, emoji, color, top_behaviors:[6 key]}
   - comment: {observation:{tr,en}, reading:{tr,en}, mirror:{tr,en}}
   ============================================================ */

var DEMO_PROFILES = [

/* ---- 0: Beşiktaş Taraftarı ---- */
{
  behaviors: [
    { key: "taraftarlik", value: 92 },
    { key: "aidiyet", value: 88 },
    { key: "savunma", value: 85 },
    { key: "patlama", value: 83 },
    { key: "tutarlilik", value: 82 },
    { key: "ofke", value: 74 },
    { key: "hayal_kirikligi", value: 73 },
    { key: "sessizlik", value: 68 },
    { key: "nostalji", value: 62 },
    { key: "caps_lock", value: 69 },
    { key: "sabir", value: 21 },
    { key: "olay_tetikli", value: 86 },
    { key: "topluluk_dili", value: 77 }
  ],
  contradictions: [
    { pair: ["taraftarlik", "sabir"], text: { tr: "Sonuna kadar bağlısın ama 4 dakika bile bekleyemiyorsun.", en: "Loyal to the end but can't wait 4 minutes." } },
    { pair: ["sessizlik", "patlama"], text: { tr: "Susuyorsun ama sustukça birikiyor, biriktikçe patlıyor.", en: "You go silent, but the silence builds until it bursts." } }
  ],
  repeated_signals: [
    { signal: { tr: "Yenilgi sonrası ort. 35dk sessizlik, sonra 6+ tweet serisi — son 3 maçta aynı kalıp.", en: "Avg 35min silence after defeats, then 6+ tweet burst — same pattern in last 3 matches." }, type: "pattern", count: 3, anchor: { tr: "GS 3-1 BJK sonrası — 22:47 son tweet, 23:22'de 7 tweet", en: "GS 3-1 BJK — last tweet 22:47, 7-tweet burst at 23:22" } },
    { signal: { tr: "'Biz' zamiri 50 tweetin 23'ünde — ama sadece takım bağlamında, günlükte 'ben' kullanıyor.", en: "'We' pronoun in 23/50 tweets — only in team context, uses 'I' in daily life." }, type: "frequency", count: 23, anchor: { tr: "'Biz bunu hak etmiyoruz' vs 'Ben bugün yorgunum'", en: "'We don't deserve this' vs 'I'm tired today'" } },
    { signal: { tr: "Gol anında tweet süresi ort. 15 saniye — maç dışı tweetlerde ort. 2 saat düşünme süresi.", en: "Avg 15sec to tweet after a goal — avg 2hr gap for non-match tweets." }, type: "rhythm", count: 7, anchor: { tr: "78. dakika golünde 11 saniyede tweet", en: "Goal at 78th minute — tweet in 11 seconds" } }
  ],
  card: {
    nickname: { tr: "Tribün Sadığı", en: "The Faithful Stand" },
    desc: { tr: "Yenilgiyi sessizce taşıyan, galibiyeti haykıran.", en: "Carries defeat in silence, roars in victory." },
    emoji: "🦅",
    color: "#1B1B1B",
    top_behaviors: ["taraftarlik", "patlama", "tutarlilik", "hayal_kirikligi", "sessizlik", "sabir"]
  },
  comment: {
    observation: { tr: "Tweetlerinin neredeyse yarısı tek bir konu etrafında dönüyor. Yenilgi anında 35 dakika susuyorsun — sonra 6 tweet art arda geliyor.", en: "Almost half your tweets revolve around one topic. After a defeat you go silent for 35 minutes — then 6 tweets come firing." },
    reading: { tr: "Sabırsız bir taraftar gibi görünüyorsun ama o 35 dakikalık sessizlik başka bir şey söylüyor — patlama öncesi biriktirme. Duygunu ham haliyle vermiyorsun, önce içinde pişiriyorsun.", en: "You seem impatient, but that 35-minute silence says otherwise — you're building up before the burst. You don't serve emotions raw, you cook them first." },
    mirror: { tr: "Eleştiri geldiğinde 4 dakikada cevap veriyorsun — ama yenilgiye 35 dakika dayanıyorsun. Asıl sabrın takıma, sabırsızlığın insanlara. Takımına yenilmeyi veriyorsun ama kimsenin laf etmesine izin vermiyorsun.", en: "You reply to criticism in 4 minutes — but you endure defeat for 35. Your patience is for the team, your impatience is for people. You forgive losses but never let anyone talk." }
  }
},

/* ---- 1: Fenerbahçe Taraftarı ---- */
{
  behaviors: [
    { key: "adalet", value: 91 },
    { key: "tepki_hizi", value: 92 },
    { key: "rekabet", value: 88 },
    { key: "tartisma", value: 86 },
    { key: "son_soz", value: 85 },
    { key: "cesaret", value: 80 },
    { key: "kontrol", value: 72 },
    { key: "liderlik", value: 68 },
    { key: "taraftarlik", value: 82 },
    { key: "sabir", value: 22 },
    { key: "aidiyet", value: 76 },
    { key: "referans", value: 74 }
  ],
  contradictions: [
    { pair: ["adalet", "rekabet"], text: { tr: "Adalet diyorsun ama sadece kendi takımın aleyhine olunca.", en: "You demand justice — but only when the call goes against your team." } },
    { pair: ["kontrol", "sabir"], text: { tr: "İstatistiklerle konuşursun ama hakem kararında 8 saniyede patlarsın.", en: "You speak in stats but explode in 8 seconds after a ref call." } }
  ],
  repeated_signals: [
    { signal: { tr: "Hakem kararı sonrası tweet süresi ort. 8 saniye — pozisyon tekrarı gelmeden yazıyor.", en: "Avg 8sec tweet after ref decision — writes before the replay even shows." }, type: "trigger", count: 6, anchor: { tr: "Penaltı verilmedi — 6 saniye sonra: 'Bu ülkede futbol yok'", en: "No penalty given — 6 sec later: 'No football in this country'" } },
    { signal: { tr: "Reply zincirlerinde ort. 6 mesaj derinliğe iniyor — son mesaj her zaman kendisi.", en: "Goes 6 messages deep in reply chains — last message is always theirs." }, type: "pattern", count: 4, anchor: { tr: "GS taraftarıyla 14 mesajlık tartışma — son mesaj: 'İstatistik ortada.'", en: "14-message argument with GS fan — final message: 'The stats speak.'" } },
    { signal: { tr: "'Adalet' kelimesi veya türevleri 50 tweette 11 kez — futbolda 9, siyasette 2.", en: "'Justice' or derivatives appear 11 times in 50 tweets — 9 in football, 2 in politics." }, type: "frequency", count: 11, anchor: { tr: "'Adalet istiyoruz, başka bir şey değil'", en: "'We want justice, nothing else'" } }
  ],
  card: {
    nickname: { tr: "Adalet Nöbetçisi", en: "Justice Guard" },
    desc: { tr: "Kanıtları toplar, davayı asla bırakmaz.", en: "Collects evidence, never drops the case." },
    emoji: "⚖️",
    color: "#1A3A5C",
    top_behaviors: ["tepki_hizi", "tartisma", "son_soz", "adalet", "rekabet", "sabir"]
  },
  comment: {
    observation: { tr: "Paylaşımlarında futbol sadece bir spor değil, bir dava gibi işleniyor. Hakem kararlarına verdiğin tepki 8 saniye. Tartışmalarda her zaman son mesaj senin.", en: "Football isn't just sport in your feed — it's a case. You react to ref decisions in 8 seconds. The last message in arguments is always yours." },
    reading: { tr: "Fenerbahçe senin için tutku değil, pozisyon. Savunduğun bir dava var ve sürekli kanıt topluyorsun. Tartışmayı bırakmaman inatçılık değil — davayı bırakmak demek.", en: "Fenerbahçe isn't passion for you — it's a position. You have a case and you're always collecting evidence. You don't leave arguments out of stubbornness — leaving means dropping the case." },
    mirror: { tr: "Herkes seni kavgacı sanıyor ama sen kavga etmiyorsun — müdafaa ediyorsun. Galibiyet sonrası bile huzursuz oluyorsun — çünkü dava bitmedi. Belki bitmesini istemiyorsun.", en: "Everyone thinks you're combative but you're not fighting — you're defending. Even after a win you're restless — the case isn't closed. Maybe you don't want it to close." }
  }
},

/* ---- 2: Şair ---- */
{
  behaviors: [
    { key: "yaraticilik", value: 94 },
    { key: "gece_aktiflik", value: 87 },
    { key: "gizlilik", value: 83 },
    { key: "dikkat", value: 91 },
    { key: "kontrol", value: 78 },
    { key: "yalnizlik", value: 75 },
    { key: "ozlem", value: 80 },
    { key: "reply_orani", value: 15 },
    { key: "emoji_yogunlugu", value: 12 },
    { key: "ic_ses", value: 86 },
    { key: "gece_gunduz_fark", value: 72 },
    { key: "mesafe", value: 79 }
  ],
  contradictions: [
    { pair: ["gizlilik", "itiraf"], text: { tr: "Kişisel bilgi sıfır ama tweetlerin birine yazılmış mektup gibi.", en: "Zero personal info yet your tweets read like letters to someone." } },
    { pair: ["kontrol", "gece_gunduz_fark"], text: { tr: "Gündüz her kelimeyi ölçüyorsun, gece çatlaklar oluşuyor.", en: "By day you measure every word, by night the cracks appear." } }
  ],
  repeated_signals: [
    { signal: { tr: "50 tweetin 47'si orijinal — 3 reply, 0 RT, 0 QT. Monolog kuruyor.", en: "47/50 tweets are original — 3 replies, 0 RT, 0 QT. Pure monologue." }, type: "rhythm", count: 47, anchor: { tr: "Son reply 11 gün önce — tek kelime: 'Evet.'", en: "Last reply 11 days ago — one word: 'Yes.'" } },
    { signal: { tr: "'Pencere' 6 kez, 'sessizlik' 5 kez, 'rüzgâr' 4 kez — aynı imgelem dünyası.", en: "'Window' 6x, 'silence' 5x, 'wind' 4x — same imagery world." }, type: "frequency", count: 15, anchor: { tr: "'Pencereden bakan biri vardı, şimdi pencere boş.'", en: "'Someone used to watch from the window. The window is empty now.'" } },
    { signal: { tr: "Hiç etiketlemiyor ama tweetlerin %30'u ikinci tekil şahıs — 'sen', 'sana', 'bilmezsin'.", en: "Tags no one but 30% of tweets use second person — 'you', 'yours'." }, type: "pattern", count: 15, anchor: { tr: "'Giderken kapıyı kapatmadın, rüzgâr hâlâ giriyor.'", en: "'You didn't close the door when you left. The wind still gets in.'" } }
  ],
  card: {
    nickname: { tr: "Gece Kuyumcusu", en: "Night Jeweler" },
    desc: { tr: "Kelimeleri gece işler, gündüz kimseye göstermez.", en: "Crafts words at night, shows no one by day." },
    emoji: "🌑",
    color: "#2C2137",
    top_behaviors: ["yaraticilik", "dikkat", "gece_aktiflik", "ic_ses", "emoji_yogunlugu", "reply_orani"]
  },
  comment: {
    observation: { tr: "Hesabında konuşma yok, sahne var. Kimseyle etkileşime girmiyorsun ama tweetlerin birine yazılmış mektup gibi. Emoji yok, hashtag yok, filtre yok.", en: "No conversation on your feed — just a stage. You don't interact, yet your tweets read like letters to someone. No emoji, no hashtag, no filter." },
    reading: { tr: "Yalnızlığını yaşamıyorsun, işliyorsun. Her tweet bir damıtma: yaşadığın şeyi en saf haline indiriyorsun. Birine yazıyorsun ama etiketlemiyorsun. Belki cevap istemiyorsun.", en: "You don't live your loneliness — you process it. Each tweet is distillation: you reduce what you feel to its purest form. You write to someone but never tag them. Maybe you don't want a reply." },
    mirror: { tr: "Çok şey hisseden ama az gösteren birisin — ta ki yazmaya başlayana kadar. Gece tweetlerinde çatlaklar var. O kısa, kesik cümleler — senin filtresiz halin. Ve en güçlü halin.", en: "You feel deeply but show little — until you start writing. Your night tweets have cracks. Those short, broken lines — that's you unfiltered. And at your strongest." }
  }
},

/* ---- 3: Gece Düşünürü ---- */
{
  behaviors: [
    { key: "merak", value: 90 },
    { key: "gece_aktiflik", value: 93 },
    { key: "ic_ses", value: 88 },
    { key: "sorgulama", value: 84 },
    { key: "yalnizlik", value: 76 },
    { key: "ic_catisma", value: 72 },
    { key: "felsefe", value: 79 },
    { key: "gece_gunduz_fark", value: 81 },
    { key: "sessizlik", value: 70 },
    { key: "tutarlilik", value: 32 },
    { key: "reply_orani", value: 14 },
    { key: "derinlik", value: 75 }
  ],
  contradictions: [
    { pair: ["sorgulama", "reply_orani"], text: { tr: "Sürekli soru soruyor ama cevap gelince konuşmaya katılmıyor.", en: "Asks questions constantly but never joins the conversation when answers come." } },
    { pair: ["gece_aktiflik", "gece_gunduz_fark"], text: { tr: "Gece düşünür, gündüz susar — iki farklı kişi.", en: "Thinks at night, goes silent by day — two different people." } }
  ],
  repeated_signals: [
    { signal: { tr: "'Acaba' kelimesi 50 tweetin 14'ünde — cevabını hiç vermiyor.", en: "'I wonder' appears in 14/50 tweets — never answers the question." }, type: "frequency", count: 14, anchor: { tr: "'Acaba herkes bu kadar mı yorgun yoksa biz mi abartıyoruz'", en: "'I wonder if everyone is this tired or are we exaggerating'" } },
    { signal: { tr: "Tweetlerin %60'ı soruyla bitiyor ama sadece 2'si cevap almış — cevaplara hiç karşılık vermemiş.", en: "60% of tweets end with a question but only 2 got answers — and those answers were ignored." }, type: "pattern", count: 30, anchor: { tr: "12 soru tweeti, 0 reply", en: "12 question tweets, 0 replies back" } },
    { signal: { tr: "Thread'ler hep gece 01:00 sonrası ve hiçbiri sonuç cümlesiyle bitmiyor.", en: "Threads always start after 01:00 and none end with a conclusion." }, type: "pattern", count: 3, anchor: { tr: "4 mesajlık thread, son mesaj: '...bilmiyorum.'", en: "4-message thread, final message: '...I don't know.'" } }
  ],
  card: {
    nickname: { tr: "Yarım Soru", en: "Half Question" },
    desc: { tr: "Sorar ama cevap aramaz, gece düşünür gündüz susar.", en: "Asks but won't seek answers, thinks at night, silent by day." },
    emoji: "🌙",
    color: "#1A1A2E",
    top_behaviors: ["gece_aktiflik", "merak", "ic_ses", "sorgulama", "tutarlilik", "reply_orani"]
  },
  comment: {
    observation: { tr: "Gündüz hesabın neredeyse ölü. Gece canlanıyor — soru soruyorsun ama cevap aramıyorsun.", en: "Your feed is nearly dead by day. It wakes at night — you ask but don't seek answers." },
    reading: { tr: "Gece senin itiraf saatin. 'Acaba' senin en dürüst kelimen. Thread'lerini yarım bırakman sonuca ulaşmaktan korktuğunu gösteriyor — sonuç gelirse soru biter.", en: "Night is your confession hour. 'I wonder' is your most honest word. Leaving threads unfinished shows you fear the conclusion — if it arrives, the question dies." },
    mirror: { tr: "İki kişisin. Gündüz herkese benzeyen, gece kimseye benzemeyen. Belki sorularınla yaşamayı öğrendin ve cevaplar seni yalnız bırakacak.", en: "You're two people. By day you blend in, by night you're unlike anyone. Maybe you've learned to live with questions, and answers would leave you alone." }
  }
},

/* ---- 4: Ayrılık Yaşayan ---- */
{
  behaviors: [
    { key: "ozlem", value: 94 },
    { key: "duygu_yogunlugu", value: 92 },
    { key: "nostalji", value: 87 },
    { key: "silme", value: 85 },
    { key: "duygu_salinımı", value: 82 },
    { key: "ic_catisma", value: 88 },
    { key: "gece_aktiflik", value: 78 },
    { key: "muzik_paylasimi", value: 76 },
    { key: "itiraf", value: 71 },
    { key: "kirilganlik", value: 80 },
    { key: "tutarlilik", value: 24 },
    { key: "sabir", value: 26 }
  ],
  contradictions: [
    { pair: ["itiraf", "silme"], text: { tr: "Söylemek istiyorsun ama sonuçlarından korkuyorsun — yaz, sil, yaz, sil.", en: "You want to say it but fear the consequences — write, delete, write, delete." } },
    { pair: ["duygu_yogunlugu", "gizlilik"], text: { tr: "Her şeyi hissediyorsun ama isim hiç geçmiyor. 50 tweet, sıfır mention.", en: "You feel everything but never name anyone. 50 tweets, zero mentions." } }
  ],
  repeated_signals: [
    { signal: { tr: "'Neyse' kelimesi 50 tweetin 9'unda — her biri duygu cümlesinin hemen ardından.", en: "'Whatever' appears in 9/50 tweets — always right after an emotional sentence." }, type: "frequency", count: 9, anchor: { tr: "'Bazen insan karşısındakini kaybetmeyi hak ediyor. Neyse.'", en: "'Sometimes you deserve to lose them. Whatever.'" } },
    { signal: { tr: "Şarkı sözü paylaşımları sadece gece 00:00–03:00 — gündüz hiç yok.", en: "Song lyrics shared only between 00:00–03:00 — never during the day." }, type: "rhythm", count: 15, anchor: { tr: "02:14 — Sezen Aksu, 'Firuze' sözü", en: "02:14 — Sezen Aksu, 'Firuze' lyrics" } },
    { signal: { tr: "Son 2 haftada en az 5 tweet atılıp silinmiş — hepsi ikinci tekil şahıs.", en: "At least 5 tweets posted and deleted in 2 weeks — all in second person." }, type: "pattern", count: 5, anchor: { tr: "Silinmiş tweetten kalan iz: '@[kullanıcı] liked' ama tweet yok", en: "Trace of deleted tweet: '@[user] liked' but tweet is gone" } }
  ],
  card: {
    nickname: { tr: "Silinmiş Cümle", en: "Deleted Line" },
    desc: { tr: "Yazar, siler, yazar, siler — ama iz kalır.", en: "Writes, deletes, writes, deletes — but traces remain." },
    emoji: "🖤",
    color: "#4A0E2E",
    top_behaviors: ["ozlem", "duygu_yogunlugu", "silme", "ic_catisma", "nostalji", "tutarlilik"]
  },
  comment: {
    observation: { tr: "Son 2 haftada ritmin tamamen değişmiş. Şarkı sözleriyle konuşuyorsun. Birisi var ama adı hiçbir yerde geçmiyor.", en: "Your rhythm has completely changed in the last 2 weeks. You speak through lyrics. Someone exists but their name appears nowhere." },
    reading: { tr: "Tweet atıp silmen iki şeyi gösteriyor: söylemek istiyorsun ama sonuçlarından korkuyorsun. 'Neyse' senin kapattığın kapının sesi — ama 9 kez aynı kapıyı kapatman gerçekten kapatamadığını gösteriyor.", en: "Posting and deleting shows two things: you want to say it but fear the consequences. 'Whatever' is the sound of a door closing — but closing it 9 times proves it won't stay shut." },
    mirror: { tr: "Birini kaybettin — ya da kaybediyorsun. Kapatmak bitirmek demek ve sen henüz bitirmek istemiyorsun.", en: "You've lost someone — or you're losing them. Closing it means ending it, and you're not ready to end it yet." }
  }
},

/* ---- 5: Yazılımcı ---- */
{
  behaviors: [
    { key: "merak", value: 88 },
    { key: "thread", value: 81 },
    { key: "bilgi_paylasma", value: 79 },
    { key: "rutin", value: 76 },
    { key: "hafta_sonu_fark", value: 84 },
    { key: "ic_catisma", value: 62 },
    { key: "stres", value: 68 },
    { key: "mizah", value: 65 },
    { key: "konu_cesitliligi", value: 42 },
    { key: "performans", value: 58 },
    { key: "duygu_yogunlugu", value: 31 },
    { key: "gece_aktiflik", value: 72 }
  ],
  contradictions: [
    { pair: ["hafta_sonu_fark", "tutarlilik"], text: { tr: "Hafta içi makine, hafta sonu insan — bu iki kişi hiç konuşmuyor.", en: "Machine on weekdays, human on weekends — these two never talk." } },
    { pair: ["bilgi_paylasma", "duygu_yogunlugu"], text: { tr: "Her şeyi öğretirsin ama ne hissettiğini asla paylaşmazsın.", en: "You teach everything but never share what you feel." } }
  ],
  repeated_signals: [
    { signal: { tr: "Hafta içi %80 yazılım, hafta sonu %90 günlük hayat — iki ayrı hesap gibi.", en: "Weekdays 80% coding, weekends 90% daily life — like two separate accounts." }, type: "rhythm", count: 0, anchor: { tr: "Cuma 23:00: 'Deploy ettik' / Cumartesi 14:00: 'Bu dizinin finali berbattı'", en: "Fri 23:00: 'We deployed' / Sat 14:00: 'That show's finale was awful'" } },
    { signal: { tr: "'Öğrendiğim şeyler' thread formatı 4 kez — hep aynı yapı, farklı konular.", en: "'Things I learned' thread format used 4 times — same structure, different topics." }, type: "pattern", count: 4, anchor: { tr: "'Bu hafta Docker hakkında öğrendiğim 5 şey: Thread 🧵'", en: "'5 things I learned about Docker this week: Thread 🧵'" } },
    { signal: { tr: "Deploy/deadline tweetleri hep gece 22:00+ — yarı şaka yarı çığlık.", en: "Deploy/deadline tweets always after 22:00 — half joke, half cry for help." }, type: "rhythm", count: 7, anchor: { tr: "'Prod'a attık, dualar kabul. 🤲' — saat 23:47", en: "'Pushed to prod, prayers up. 🤲' — 23:47" } }
  ],
  card: {
    nickname: { tr: "İki Repo", en: "Two Repos" },
    desc: { tr: "Hafta içi makine, hafta sonu insan — merge edilmemiş.", en: "Machine on weekdays, human on weekends — unmerged." },
    emoji: "💻",
    color: "#24292E",
    top_behaviors: ["merak", "hafta_sonu_fark", "thread", "bilgi_paylasma", "duygu_yogunlugu", "stres"]
  },
  comment: {
    observation: { tr: "Hesabın hafta içi yazılımcı hesabı, hafta sonu insan hesabı. Deploy şakaların gece 11'den sonra geliyor.", en: "Your feed is a developer account on weekdays, a human account on weekends. Deploy jokes arrive after 11 PM." },
    reading: { tr: "Yazılım kimliğin seni hafta içi yutmuş. Deploy şakalarındaki gerilim gerçek: kodu seviyorsun ama koşulları sevmiyorsun. Thread'ler senin vitrinin.", en: "Your developer identity has consumed your weekdays. The tension in deploy jokes is real: you love code but hate the conditions. Threads are your storefront." },
    mirror: { tr: "Deploy gecelerindeki şakalar aslında yardım çağrısı, ama herkes gülüyor.", en: "Your deploy-night jokes are actually cries for help, but everyone laughs." }
  }
},

/* ---- 6: Siyasi Tartışmacı ---- */
{
  behaviors: [
    { key: "tartisma", value: 94 },
    { key: "son_soz", value: 91 },
    { key: "ofke", value: 86 },
    { key: "adalet", value: 88 },
    { key: "isyan", value: 82 },
    { key: "cesaret", value: 79 },
    { key: "provokasyon", value: 78 },
    { key: "sabir", value: 15 },
    { key: "reply_orani", value: 85 },
    { key: "genelleme", value: 74 },
    { key: "caps_lock", value: 71 },
    { key: "liderlik", value: 65 }
  ],
  contradictions: [
    { pair: ["tartisma", "sabir"], text: { tr: "11 mesajlık tartışma yaparsın ama son 3 mesaj hep aynı noktayı tekrarlıyor.", en: "You go 11 messages deep but the last 3 repeat the same point." } },
    { pair: ["cesaret", "genelleme"], text: { tr: "Cesaretinle düşünceni söylüyorsun ama 'bu ülkede' ile başlamak genellemeye dönüyor.", en: "You have the courage to speak but 'in this country' turns into generalization." } }
  ],
  repeated_signals: [
    { signal: { tr: "'Bu ülkede' ile başlayan tweet: 11/50 — hepsi farklı konu, aynı çaresizlik tonu.", en: "'In this country' starts 11/50 tweets — different topics, same helpless tone." }, type: "frequency", count: 11, anchor: { tr: "'Bu ülkede gazetecilik yapmak suç oldu artık'", en: "'In this country, journalism became a crime'" } },
    { signal: { tr: "Reply zincirlerinde ort. 8 mesaj — son 3 mesaj yeni argüman eklemiyor.", en: "Avg 8 messages in reply chains — last 3 add no new arguments." }, type: "pattern", count: 5, anchor: { tr: "11 mesajlık tartışma — 8. mesajdan sonra aynı cümlenin varyasyonları", en: "11-message debate — variations of the same sentence after message 8" } },
    { signal: { tr: "Haber paylaşırken her zaman kendi yorumunu ekliyor — hiç yorumsuz paylaşım yok.", en: "Always adds own commentary to news — zero posts without opinion." }, type: "rhythm", count: 50, anchor: { tr: "'Gördünüz mü? Buna da sessiz kalacaksınız herhalde.'", en: "'See this? I guess you'll stay silent on this too.'" } }
  ],
  card: {
    nickname: { tr: "Bitmez Dava", en: "Endless Case" },
    desc: { tr: "Her haberde bir dava, her reply'da bir savunma.", en: "A cause in every headline, a defense in every reply." },
    emoji: "🔥",
    color: "#8B0000",
    top_behaviors: ["tartisma", "son_soz", "adalet", "ofke", "reply_orani", "sabir"]
  },
  comment: {
    observation: { tr: "Tweetlerin yarısı reply, reply'ların çoğu tartışma. Hiç yorumsuz haber paylaşmıyorsun. Tartışmalarda aynı noktayı tekrarlıyorsun.", en: "Half your tweets are replies, most replies are arguments. You never share news without commentary. You repeat the same point in debates." },
    reading: { tr: "Siyaset senin varoluşsal alanın. Tartışmalarda son sözü bırakamaman ikna etmek için değil — bırakamamak için.", en: "Politics is your existential territory. Refusing to drop the last word isn't about persuasion — it's about inability to let go." },
    mirror: { tr: "Çok şey hissediyorsun ve muhtemelen doğru. Ama 11 mesajlık tartışmada karşı tarafı ikna ettiğin bir tane yok — çünkü ikna etmiyorsun, haklı olduğunu gösteriyorsun.", en: "You feel a lot and you're probably right. But in 11-message debates you've convinced no one — because you're not convincing, you're proving." }
  }
},

/* ---- 7: Mizah Hesabı ---- */
{
  behaviors: [
    { key: "mizah", value: 95 },
    { key: "espri_zamanlama", value: 92 },
    { key: "maske", value: 94 },
    { key: "caps_meme", value: 87 },
    { key: "viral_pesinde", value: 82 },
    { key: "performans", value: 89 },
    { key: "gizlilik", value: 91 },
    { key: "tepki_hizi", value: 80 },
    { key: "duygu_yogunlugu", value: 15 },
    { key: "oz_farkindalik", value: 26 },
    { key: "itiraf", value: 11 },
    { key: "reply_orani", value: 45 }
  ],
  contradictions: [
    { pair: ["mizah", "duygu_yogunlugu"], text: { tr: "Herkesi güldürüyorsun ama ne hissettiğini kimse bilmiyor.", en: "You make everyone laugh but no one knows what you feel." } },
    { pair: ["performans", "gizlilik"], text: { tr: "Sürekli sahnedesin ama perde arkasını kimse görmüyor.", en: "Always on stage but no one sees backstage." } }
  ],
  repeated_signals: [
    { signal: { tr: "50 tweette 0 kişisel bilgi — ne yediği, nerede olduğu, ne hissettiği yok.", en: "0 personal info in 50 tweets — no food, no location, no feelings." }, type: "absence", count: 0, anchor: { tr: "Bio bile espri formatında, gerçek bilgi yok", en: "Even the bio is a joke format — no real info" } },
    { signal: { tr: "Trending konulara ort. 25 dakikada espri — bu tweetler %70 en çok etkileşim alanlar.", en: "Avg 25min joke on trending topics — these get 70% of top engagement." }, type: "pattern", count: 8, anchor: { tr: "Deprem sonrası 18dk'da 'Türkiye'de en sağlam şey internet bağlantısı' — 4K RT", en: "18min after earthquake: 'Strongest thing in Turkey is the internet' — 4K RT" } },
    { signal: { tr: "Ciddi soru sorulduğunda bile espriyle geçiştirme — 50 tweet boyunca tek ciddi cümle yok.", en: "Even serious questions get a joke — not a single serious sentence in 50 tweets." }, type: "absence", count: 0, anchor: { tr: "'Gerçekten ne düşünüyorsun?' → '16 yıldır düşünmüyorum 😂'", en: "'What do you really think?' → 'Haven't thought in 16 years 😂'" } }
  ],
  card: {
    nickname: { tr: "Gülen Maske", en: "Laughing Mask" },
    desc: { tr: "Herkes gülerken kimse arkasını görmüyor.", en: "Everyone laughs, no one looks behind." },
    emoji: "🎪",
    color: "#FFB300",
    top_behaviors: ["mizah", "maske", "espri_zamanlama", "performans", "duygu_yogunlugu", "itiraf"]
  },
  comment: {
    observation: { tr: "50 tweet okudum ve seni tanıyamadım. Her tweet bir performans, her reply bir skeç.", en: "I read 50 tweets and couldn't get to know you. Every tweet is a performance, every reply a sketch." },
    reading: { tr: "Espri senin sığınağın. 50 tweette sıfır kişisel bilgi bilinçli bir karar. Herkes seni güldüren biri olarak tanıyor ama kimse seni tanımıyor.", en: "Humor is your shelter. Zero personal info in 50 tweets is a conscious choice. Everyone knows you as funny — no one actually knows you." },
    mirror: { tr: "Sana ciddi soru soran birine espriyle cevap vermen en çok şey anlatan sinyalin. Cevabı biliyorsun — sadece söylersen espri bozulacak.", en: "Answering a serious question with a joke is your most telling signal. You know the answer — you just don't want to break the act." }
  }
},

/* ---- 8: Kripto Yatırımcısı ---- */
{
  behaviors: [
    { key: "haber_hizi", value: 90 },
    { key: "risk_alma", value: 84 },
    { key: "spekulasyon", value: 82 },
    { key: "abarti", value: 77 },
    { key: "performans", value: 72 },
    { key: "rekabet", value: 70 },
    { key: "ic_catisma", value: 68 },
    { key: "gece_gunduz_fark", value: 74 },
    { key: "gundem_takibi", value: 80 },
    { key: "oz_farkindalik", value: 32 },
    { key: "sabir", value: 28 },
    { key: "cesaret", value: 76 }
  ],
  contradictions: [
    { pair: ["spekulasyon", "oz_farkindalik"], text: { tr: "Büyük iddialar atarsın ama yanıldığında konu değiştirirsin.", en: "You make bold claims but change the subject when proven wrong." } },
    { pair: ["gece_gunduz_fark", "tutarlilik"], text: { tr: "Sabah analist, gece kehanetçi — aynı kişi değil.", en: "Analyst by morning, prophet by night — not the same person." } }
  ],
  repeated_signals: [
    { signal: { tr: "Fiyat artışından 1-2 gün önce 'Demiştim' — düşüşlerde sessizlik veya konu değiştirme.", en: "'I told you so' 1-2 days before price rises — silence or topic change during drops." }, type: "pattern", count: 4, anchor: { tr: "BTC 60K tweet → 2 gün sonra 'Demiştim.' / BTC 45K'ya düşünce: ekonomi haberi RT", en: "BTC 60K tweet → 2 days later 'Told you.' / BTC drops to 45K: economy news RT" } },
    { signal: { tr: "'Herkes' kelimesi 8/50 tweette — hep 'herkes yanlış yapıyor' formatında.", en: "'Everyone' appears in 8/50 tweets — always in 'everyone is wrong' format." }, type: "frequency", count: 8, anchor: { tr: "'Herkes satarken almak lazım'", en: "'You should buy when everyone is selling'" } },
    { signal: { tr: "Sabah 07:00-08:00 tweetleri analiz/grafik, gece 23:00+ daha duygusal ve iddialı.", en: "Morning 07:00-08:00 tweets are charts/analysis, night 23:00+ are emotional and bold." }, type: "rhythm", count: 0, anchor: { tr: "07:22: 'BTC 4H chart, destek 57.200' / 23:45: 'Bu sene herkes ağlayacak'", en: "07:22: 'BTC 4H chart, support 57,200' / 23:45: 'Everyone will cry this year'" } }
  ],
  card: {
    nickname: { tr: "Grafik Kâhini", en: "Chart Prophet" },
    desc: { tr: "Sabah analiz, gece kehanet — haklı çıkmak kazanmaktan önemli.", en: "Analysis by morning, prophecy by night — being right matters more." },
    emoji: "📈",
    color: "#0D7C3E",
    top_behaviors: ["haber_hizi", "risk_alma", "spekulasyon", "abarti", "oz_farkindalik", "sabir"]
  },
  comment: {
    observation: { tr: "Hesabın iki modda çalışıyor: sabah analist, gece kehanetçi. Haklı çıktığında gösteriyorsun, yanıldığında konu değişiyor.", en: "Your feed runs in two modes: morning analyst, night prophet. You show wins, you hide losses." },
    reading: { tr: "Kripto senin için haklı çıkma oyunu. 'Demiştim' senin zafer narası. Ama yanıldığın zamanları saklaman değil — görmezden gelmen.", en: "Crypto is your being-right game. 'Told you' is your victory cry. But you don't hide your wrongs — you ignore them." },
    mirror: { tr: "Asıl motivasyonun para değil — görünürlük. Haklı çıkmak kazanmaktan önemli. Geceleri yaptığın iddialı tweetler sabahki grafiklerden daha çok seni yansıtıyor.", en: "Your real motivation isn't money — it's visibility. Being right matters more than winning. Your bold night tweets reflect you more than your morning charts." }
  }
},

/* ---- 9: Oyun Tutkunu ---- */
{
  behaviors: [
    { key: "patlama", value: 92 },
    { key: "gece_aktiflik", value: 88 },
    { key: "platform_bagimliligi", value: 90 },
    { key: "kacis", value: 78 },
    { key: "rekabet", value: 85 },
    { key: "sabir", value: 16 },
    { key: "caps_lock", value: 80 },
    { key: "ic_catisma", value: 64 },
    { key: "itiraf", value: 42 },
    { key: "yalnizlik", value: 58 },
    { key: "ofke", value: 74 },
    { key: "performans", value: 68 }
  ],
  contradictions: [
    { pair: ["patlama", "sabir"], text: { tr: "6 kez 'son kez oynuyorum' demiş, 6'sında da devam etmiş.", en: "Said 'last time playing' 6 times, continued all 6 times." } },
    { pair: ["performans", "yalnizlik"], text: { tr: "Zafer anında bağırıyor, gece 3'te 'sadece oynarken huzurluyum' diyor.", en: "Roars in victory, whispers 'I only feel peace when playing' at 3 AM." } }
  ],
  repeated_signals: [
    { signal: { tr: "'Son kez oynuyorum' → 6 kez demiş, 6'sında devam etmiş.", en: "'Last time playing' — said 6 times, continued all 6." }, type: "frequency", count: 6, anchor: { tr: "'Bu oyunu son kez açıyorum.' → 2 saat sonra: 'CLUTCH 1v4 BABYYY'", en: "'Opening this game for the last time.' → 2hr later: 'CLUTCH 1v4 BABYYY'" } },
    { signal: { tr: "Zafer tweetlerinde %100 caps, yenilgi tweetlerinde %0 caps — zafer bağırarak, yenilgi fısıldayarak.", en: "100% caps in victory tweets, 0% in defeat — victory by shouting, defeat by whispering." }, type: "pattern", count: 15, anchor: { tr: "'ACE CLUTCH LET'S GOOOO' vs 'takım kötüydü neyse'", en: "'ACE CLUTCH LET'S GOOOO' vs 'team was bad whatever'" } },
    { signal: { tr: "Gece 02:00-04:00 arası ton tamamen farklı — oyunla ilgisiz, dürüst.", en: "Tone completely shifts between 02:00-04:00 — unrelated to gaming, honest." }, type: "rhythm", count: 7, anchor: { tr: "02:47: 'Bazen sadece oynarken huzurlu hissediyorum'", en: "02:47: 'Sometimes I only feel at peace when playing'" } }
  ],
  card: {
    nickname: { tr: "Son Kez Tuşu", en: "Last Game Button" },
    desc: { tr: "Her gece bırakır, her gece döner.", en: "Quits every night, returns every night." },
    emoji: "🎮",
    color: "#7B1FA2",
    top_behaviors: ["patlama", "platform_bagimliligi", "gece_aktiflik", "rekabet", "sabir", "itiraf"]
  },
  comment: {
    observation: { tr: "6 kez 'son kez' demişsin, 6'sında devam etmişsin. Zafer anında bağırıyorsun, yenilgide sessizleşiyorsun. Gece 3'te oyunla ilgisiz, dürüst tweetler var.", en: "You said 'last time' 6 times, continued all 6. You shout in victory, go silent in defeat. At 3 AM there are honest tweets unrelated to gaming." },
    reading: { tr: "Oyun senin için savaş alanı. Kazanmak seni kanıtlıyor, kaybetmek yıkıyor — o yüzden bırakıyorsun ama geri geliyorsun. Oyun dışında bu kadar net bir hissiyat yok.", en: "Gaming is your battlefield. Winning proves you, losing breaks you — so you quit but return. Nothing else gives you such clear feelings." },
    mirror: { tr: "Oyun sana kaçış veriyor ama kaçtığın şeyi söylemiyorsun. 'Huzur' kelimesini oyun bağlamında kullanman gerçek hayatın huzursuz olduğunu farkında olmadan söylüyor.", en: "Gaming gives you escape but you never name what you're escaping. Using 'peace' in a gaming context accidentally reveals your real life isn't peaceful." }
  }
}

]; // end DEMO_PROFILES

/* ============================================================
   analyzeHandle — V2 (Davranış Merkez)
   Backward compatible: result.archetype + result.scores shimmed
   ============================================================ */

function analyzeHandle(rawHandle) {
  var handle = normHandle(rawHandle);
  var h = xhash(handle);
  var profile = DEMO_PROFILES[h % DEMO_PROFILES.length];
  var lang = (typeof getLang === "function") ? getLang() : "tr";

  var behaviors = [];
  for (var i = 0; i < profile.behaviors.length; i++) {
    var b = profile.behaviors[i];
    var shift = ((h >>> (i * 2)) % 11) - 5;
    var val = Math.max(5, Math.min(98, b.value + shift));
    var meta = BEHAVIOR_MAP[b.key];
    behaviors.push({
      key: b.key,
      cluster: meta ? meta.cluster : "unknown",
      value: val,
      label: meta ? meta.label : { tr: b.key, en: b.key }
    });
  }

  var topKeys = profile.card.top_behaviors;
  var topBehaviors = [];
  for (var ti = 0; ti < topKeys.length; ti++) {
    for (var bi = 0; bi < behaviors.length; bi++) {
      if (behaviors[bi].key === topKeys[ti]) {
        topBehaviors.push(behaviors[bi]);
        break;
      }
    }
  }

  var commentIdx = (h >>> 3) % 2;
  var nickname = profile.card.nickname;
  var desc = profile.card.desc;

  var result = {
    handle: handle,
    hash: h,
    source: "demo",

    behaviors: behaviors,

    contradictions: profile.contradictions,

    repeated_signals: profile.repeated_signals,

    comment: profile.comment,

    card: {
      nickname: nickname,
      desc: desc,
      emoji: profile.card.emoji,
      color: profile.card.color,
      top_behaviors: topBehaviors
    },

    meta: {
      source: "demo",
      model: null,
      total_behaviors_found: behaviors.length,
      tweet_count: 0,
      ts: new Date().toISOString()
    }
  };

  /* --- backward compat shim for card.js / match / profile --- */
  result.archetype = {
    id: "v2-" + (h % DEMO_PROFILES.length),
    emoji: profile.card.emoji,
    color: profile.card.color,
    name: nickname,
    desc: desc,
    comments: {
      tr: [profile.comment.mirror.tr],
      en: [profile.comment.mirror.en]
    }
  };
  result.ci = 0;
  result.scores = {};
  for (var si = 0; si < topBehaviors.length && si < 4; si++) {
    var scoreKeys = ["sc_viral", "sc_kaos", "sc_mizah", "sc_gece"];
    result.scores[scoreKeys[si]] = topBehaviors[si].value;
  }

  return result;
}

function archetypeById(id) {
  return {
    id: id, emoji: "🔍", color: "#0FAFAF",
    name: { tr: "XORA Profil", en: "XORA Profile" },
    desc: { tr: "Analiz tamamlandı.", en: "Analysis complete." },
    comments: { tr: [""], en: [""] }
  };
}

/* ============================================================
   SCORE_KEYS — backward compat for old card.js
   ============================================================ */

var SCORE_KEYS = ["sc_viral", "sc_kaos", "sc_mizah", "sc_gece"];

/* ============================================================
   match motoru — unchanged
   ============================================================ */

var MATCH_COMMENTS = {
  tr: [
    "{a} mesaj atar, {b} görüldü atar. Ama ikisi de gece 3'te birbirinin profiline bakar. Klasik.",
    "{a} ile {b} flörtü tweet beğenisiyle başlar, relationship drama ile biter. XORA popcorn hazırladı.",
    "{a} duygusal yazar, {b} ironiyle cevap verir. Bu gerilim ya aşka döner ya engele.",
    "{a} ve {b} birbirini stalklıyor ama takip etmiyor. Bu ne cesaret, ne korkaklık — saf kaos.",
    "{a} kalp atar, {b} alev atar. İkisi de ne istediğini bilmiyor ama kimya tartışılmaz.",
    "{a} plan yapar, {b} planı havaya uçurur. Tam bir romantik komedi senaryosu."
  ],
  en: [
    "{a} sends the text, {b} leaves it on read. But both stalk each other's profiles at 3 AM. Classic.",
    "{a} and {b}'s flirtation starts with a like, ends with relationship drama. XORA has the popcorn ready.",
    "{a} writes emotionally, {b} replies with irony. This tension either becomes love or a block.",
    "{a} and {b} stalk each other but won't follow. Not courage, not cowardice — pure chaos.",
    "{a} sends hearts, {b} sends fire. Neither knows what they want, but the chemistry is undeniable.",
    "{a} makes plans, {b} blows them up. A perfect romantic comedy script."
  ]
};

function matchHandles(rawA, rawB) {
  var a = normHandle(rawA);
  var b = normHandle(rawB);
  var pair = [a, b].slice().sort();
  var c = xhash(pair[0] + "•" + pair[1]);

  var flirt    = 38 + (c % 60);
  var vibe     = 35 + ((c >>> 4) % 63);
  var humor    = 30 + ((c >>> 7) % 68);
  var chaos    = 20 + ((c >>> 10) % 75);
  var romance  = 40 + ((c >>> 13) % 58);
  var overall  = Math.round((flirt + vibe + humor + romance) / 4 + ((c >>> 8) % 7) - 3);
  overall = Math.max(35, Math.min(99, overall));

  return {
    a: a, b: b,
    resA: analyzeHandle(a),
    resB: analyzeHandle(b),
    flirt: flirt,
    vibe: vibe,
    humor: humor,
    chaos: chaos,
    romance: romance,
    overall: overall,
    ci: (c >>> 6) % MATCH_COMMENTS.tr.length
  };
}

function matchComment(m, lang) {
  return MATCH_COMMENTS[lang][m.ci]
    .replace(/\{a\}/g, "@" + m.a)
    .replace(/\{b\}/g, "@" + m.b);
}

/* ============================================================
   düşünme ekranı — unchanged
   ============================================================ */

var THINKING = {
  mirror: {
    tr: [
      "Timeline'ının tozunu alıyorum...",
      "Gece 3 tweetlerini görmezden gelmeye çalışıyorum... olmuyor.",
      "Davranış kalıplarını tarıyorum...",
      "Çelişkilerini not ediyorum...",
      "Tekrar eden sinyalleri analiz ediyorum...",
      "XORA bazen fazla dürüst olabilir, hazır ol."
    ],
    en: [
      "Dusting off your timeline...",
      "Trying to ignore your 3 AM posts... I can't.",
      "Scanning behavior patterns...",
      "Noting your contradictions...",
      "Analyzing repeated signals...",
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

function playThinking(msgEl, mode, onDone) {
  var msgs = THINKING[mode][getLang()] || THINKING[mode].tr;
  var i = 0;
  msgEl.textContent = msgs[0];
  msgEl.classList.add("pop");
  var iv = setInterval(function () {
    i++;
    if (i >= 5) {
      clearInterval(iv);
      onDone();
      return;
    }
    msgEl.classList.remove("pop");
    void msgEl.offsetWidth;
    msgEl.textContent = msgs[i % msgs.length];
    msgEl.classList.add("pop");
  }, 900);
}
