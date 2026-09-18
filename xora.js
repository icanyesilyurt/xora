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
   DEMO PROFİL ŞABLONLARI — V3 (Profil Okuma Mimarisi)
   10 adet — nickname/archetype yok, saf davranış okuma
   Her şablon:
   - profile_summary: {tr, en}
   - topics: [{label:{tr,en}, weight, subtone:{tr,en}}]  max 3
   - behaviors: [{key, value}]
   - top_behaviors: [6 key string]
   - repeated_signals: [{text:{tr,en}, type}]  3-5 item
   - comment: {observation, reading, mirror, prediction}
   - card_color: hex
   ============================================================ */

var DEMO_PROFILES = [

/* ---- 0: Beşiktaş Taraftarı ---- */
{
  nickname: { tr: "Tribüncü", en: "Die-Hard Fan" },
  profile_emoji: "⚽",
  tagline: {
    tr: "Takım senin kimliğin, maç günü hesabın başka birine dönüşüyor.",
    en: "The team is your identity — your account becomes someone else on match day."
  },
  stalk_tagline: {
    tr: "Bu hesabın kimliği takımıyla iç içe, maç günü tamamen farklı bir profile dönüşüyor.",
    en: "This account's identity is inseparable from its team — match day triggers a full transformation."
  },
  profile_summary: {
    tr: "Hesabın maç günü başka bir kişiye dönüşüyor. Yenilgi sonrası 35 dakika sessizlik, sonra 6+ tweet serisi. 'Biz' zamiri 50 tweetin 23'ünde — sadece takım bağlamında. Takım senin kimliğin.",
    en: "Your account transforms on match day. 35 minutes of silence after defeat, then 6+ tweet bursts. 'We' appears in 23 of 50 tweets — only in team context. The team is your identity."
  },
  stalk_summary: {
    tr: "Bu hesap maç günü başka bir profile dönüşüyor. Yenilgi sonrası 35 dakika sessizlik, sonra 6+ tweet serisi. 'Biz' zamiri 50 tweetin 23'ünde — sadece takım bağlamında.",
    en: "This account transforms on match day. 35 minutes of silence after defeat, then 6+ tweet bursts. 'We' appears in 23 of 50 tweets — only in team context."
  },
  topics: [
    { label: { tr: "Futbol / Takım", en: "Football / Team" }, weight: 55, subtone: { tr: "Duygusal bağlılık", en: "Emotional devotion" } },
    { label: { tr: "Gündem", en: "Current Events" }, weight: 20, subtone: { tr: "Tepkisel", en: "Reactive" } },
    { label: { tr: "Kişisel", en: "Personal" }, weight: 15, subtone: { tr: "Nadir ama dürüst", en: "Rare but honest" } }
  ],
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
  top_behaviors: ["taraftarlik", "patlama", "tutarlilik", "hayal_kirikligi", "sessizlik", "sabir"],
  repeated_signals: [
    { text: { tr: "Yenilgi sonrası ort. 35dk sessizlik, sonra 6+ tweet serisi — son 3 maçta aynı kalıp.", en: "Avg 35min silence after defeats, then 6+ tweet burst — same pattern last 3 matches." }, type: "pattern" },
    { text: { tr: "'Biz' zamiri 50 tweetin 23'ünde — sadece takım bağlamında.", en: "'We' pronoun in 23/50 tweets — only in team context." }, type: "frequency" },
    { text: { tr: "Gol anında tweet süresi ort. 15sn — maç dışı tweetlerde ort. 2 saat.", en: "Avg 15sec tweet after goal — avg 2hr gap for non-match tweets." }, type: "rhythm" }
  ],
  comment: {
    observation: { tr: "Tweetlerinin neredeyse yarısı tek bir konu etrafında dönüyor. Yenilgi anında 35 dakika susuyorsun — sonra 6 tweet art arda geliyor.", en: "Almost half your tweets revolve around one topic. After a defeat you go silent for 35 minutes — then 6 tweets come firing." },
    reading: { tr: "Sabırsız bir taraftar gibi görünüyorsun ama o 35 dakikalık sessizlik başka bir şey söylüyor — patlama öncesi biriktirme. Duygunu ham haliyle vermiyorsun, önce içinde pişiriyorsun.", en: "You seem impatient, but that 35-minute silence says otherwise — you're building up before the burst. You don't serve emotions raw, you cook them first." },
    mirror: { tr: "Eleştiri geldiğinde 4 dakikada cevap veriyorsun — ama yenilgiye 35 dakika dayanıyorsun. Asıl sabrın takıma, sabırsızlığın insanlara.", en: "You reply to criticism in 4 minutes — but you endure defeat for 35. Your patience is for the team, your impatience is for people." },
    prediction: { tr: "Bir sonraki derbi kaybedilirse gece 2'ye kadar tweet atıp sabah hepsini sileceksin.", en: "If the next derby is lost, you'll tweet until 2 AM then delete them all by morning." }
  },
  stalk: {
    observation: { tr: "Bu hesabın tweetlerinin neredeyse yarısı tek bir konu etrafında dönüyor. Yenilgi anında 35 dakika sessizlik — sonra 6 tweet art arda.", en: "Almost half this account's tweets revolve around one topic. 35 minutes of silence after defeat — then 6 tweets firing." },
    reading: { tr: "Sabırsız bir taraftar gibi görünüyor ama o 35 dakikalık sessizlik başka bir şey söylüyor — patlama öncesi biriktirme. Duygularını ham haliyle vermiyor, önce içinde pişiriyor.", en: "Looks like an impatient fan, but that 35-minute silence says otherwise — building up before the burst. Emotions aren't served raw, they're cooked first." },
    mirror: { tr: "Eleştiriye 4 dakikada cevap veriyor ama yenilgiye 35 dakika dayanıyor. Asıl sabır takıma, sabırsızlık insanlara.", en: "Replies to criticism in 4 minutes but endures defeat for 35. Patience is for the team, impatience is for people." },
    prediction: { tr: "Bir sonraki derbi kaybedilirse gece 2'ye kadar tweet atıp sabah hepsini silecek.", en: "If the next derby is lost, this account will tweet until 2 AM then delete them all by morning." }
  },
  card_color: "#1B1B1B"
},

/* ---- 1: Fenerbahçe Taraftarı ---- */
{
  nickname: { tr: "Reply Savaşçısı", en: "Reply Warrior" },
  profile_emoji: "⚔️",
  tagline: {
    tr: "Futbol senin için spor değil, savunduğun bir dava.",
    en: "Football isn't sport for you — it's a case you're defending."
  },
  stalk_tagline: {
    tr: "Futbol bu profil için spor değil, savunulan bir dava.",
    en: "Football isn't sport for this profile — it's a case being defended."
  },
  profile_summary: {
    tr: "Timeline'ın bir mahkeme salonu gibi çalışıyor. Hakem kararına 8 saniyede cevap, reply zincirlerinde son söz hep sende. 'Adalet' kelimesi 50 tweette 11 kez geçiyor. Futbol senin için spor değil, savunduğun bir dava.",
    en: "Your timeline operates like a courtroom. 8-second response to ref calls, the last word in reply chains is always yours. 'Justice' appears 11 times in 50 tweets. Football isn't sport for you — it's a case you're defending."
  },
  stalk_summary: {
    tr: "Bu hesabın timeline'ı bir mahkeme salonu gibi çalışıyor. Hakem kararına 8 saniyede cevap, reply zincirlerinde son söz hep bu hesapta. 'Adalet' kelimesi 50 tweette 11 kez. Futbol bu profil için spor değil, savunulan bir dava.",
    en: "This account's timeline operates like a courtroom. 8-second response to ref calls, the last word in reply chains is always this account's. 'Justice' appears 11 times in 50 tweets. Football isn't sport here — it's a case being defended."
  },
  topics: [
    { label: { tr: "Futbol / Adalet", en: "Football / Justice" }, weight: 50, subtone: { tr: "Dava savunması", en: "Case defense" } },
    { label: { tr: "Siyaset", en: "Politics" }, weight: 25, subtone: { tr: "Adalet odaklı", en: "Justice-focused" } },
    { label: { tr: "Tartışma", en: "Debate" }, weight: 18, subtone: { tr: "Rekabetçi", en: "Competitive" } }
  ],
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
  top_behaviors: ["tepki_hizi", "tartisma", "son_soz", "adalet", "rekabet", "sabir"],
  repeated_signals: [
    { text: { tr: "Hakem kararı sonrası tweet süresi ort. 8sn — pozisyon tekrarı gelmeden yazıyor.", en: "Avg 8sec tweet after ref decisions — writes before the replay shows." }, type: "trigger" },
    { text: { tr: "Reply zincirlerinde ort. 6 mesaj derinliğe iniyor — son mesaj her zaman kendisi.", en: "Goes 6 messages deep in reply chains — last message is always theirs." }, type: "pattern" },
    { text: { tr: "'Adalet' kelimesi veya türevleri 50 tweette 11 kez — futbolda 9, siyasette 2.", en: "'Justice' or derivatives appear 11 times in 50 tweets — 9 in football, 2 in politics." }, type: "frequency" }
  ],
  comment: {
    observation: { tr: "Paylaşımlarında futbol sadece bir spor değil, bir dava gibi işleniyor. Hakem kararlarına verdiğin tepki 8 saniye. Tartışmalarda her zaman son mesaj senin.", en: "Football isn't just sport in your feed — it's a case. You react to ref decisions in 8 seconds. The last message in arguments is always yours." },
    reading: { tr: "Fenerbahçe senin için tutku değil, pozisyon. Savunduğun bir dava var ve sürekli kanıt topluyorsun. Tartışmayı bırakmaman inatçılık değil — davayı bırakmak demek.", en: "Fenerbahçe isn't passion for you — it's a position. You have a case and you're always collecting evidence. You don't leave arguments out of stubbornness — leaving means dropping the case." },
    mirror: { tr: "Herkes seni kavgacı sanıyor ama sen kavga etmiyorsun — müdafaa ediyorsun. Galibiyet sonrası bile huzursuz oluyorsun — çünkü dava bitmedi.", en: "Everyone thinks you're combative but you're not fighting — you're defending. Even after a win you're restless — the case isn't closed." },
    prediction: { tr: "Bir sonraki hakem tartışmasında yine ilk tweet atan sen olacaksın — ve reply zincirinden son çıkan da.", en: "In the next ref controversy, you'll be the first to tweet — and the last to leave the reply chain." }
  },
  stalk: {
    observation: { tr: "Bu hesabın paylaşımlarında futbol sadece bir spor değil, bir dava gibi işleniyor. Hakem kararlarına verilen tepki 8 saniye. Tartışmalarda her zaman son mesaj bu hesabın.", en: "Football isn't just sport on this feed — it's a case. Ref decisions get 8-second reactions. The last message in arguments always belongs to this account." },
    reading: { tr: "Fenerbahçe bu profil için tutku değil, pozisyon. Savunulan bir dava var ve sürekli kanıt toplanıyor. Tartışmayı bırakmaması inatçılık değil — davayı bırakmak demek.", en: "Fenerbahçe isn't passion for this profile — it's a position. There's a case and evidence is always being collected. Not leaving arguments isn't stubbornness — it's not dropping the case." },
    mirror: { tr: "Herkes bu hesabı kavgacı sanıyor ama kavga etmiyor — müdafaa ediyor. Galibiyet sonrası bile huzursuz — çünkü dava bitmedi.", en: "Everyone thinks this account is combative but it's not fighting — it's defending. Even after a win there's no rest — the case isn't closed." },
    prediction: { tr: "Bir sonraki hakem tartışmasında yine ilk tweet atan bu hesap olacak — ve reply zincirinden son çıkan da.", en: "In the next ref controversy, this account will be the first to tweet — and the last to leave the reply chain." }
  },
  card_color: "#1A3A5C"
},

/* ---- 2: Şair ---- */
{
  nickname: { tr: "Sessiz Gözlemci", en: "Silent Observer" },
  profile_emoji: "👁️",
  tagline: {
    tr: "Çok şey hisseden ama az gösteren birisin — ta ki yazmaya başlayana kadar.",
    en: "You feel deeply but show little — until you start writing."
  },
  stalk_tagline: {
    tr: "Çok şey hisseden ama az gösteren bir profil — ta ki yazmaya başlayana kadar.",
    en: "A profile that feels deeply but shows little — until writing starts."
  },
  profile_summary: {
    tr: "Hesabında konuşma yok, sahne var. 47/50 tweet orijinal, 0 RT, 0 QT. 'Pencere' 6 kez, 'sessizlik' 5 kez — aynı imgelem dünyası. Tweetlerin birine yazılmış mektup gibi ama etiketlediğin kimse yok.",
    en: "No conversation on your feed — just a stage. 47/50 tweets original, 0 RT, 0 QT. 'Window' 6 times, 'silence' 5 times — same imagery world. Your tweets read like letters to someone but you tag no one."
  },
  stalk_summary: {
    tr: "Bu hesapta konuşma yok, sahne var. 47/50 tweet orijinal, 0 RT, 0 QT. 'Pencere' 6 kez, 'sessizlik' 5 kez — aynı imgelem dünyası. Tweetler birine yazılmış mektup gibi ama etiketlenen kimse yok.",
    en: "No conversation on this feed — just a stage. 47/50 tweets original, 0 RT, 0 QT. 'Window' 6 times, 'silence' 5 times — same imagery world. Tweets read like letters to someone but no one is tagged."
  },
  topics: [
    { label: { tr: "Duygu / İçsel", en: "Emotion / Inner" }, weight: 50, subtone: { tr: "Damıtılmış", en: "Distilled" } },
    { label: { tr: "Edebiyat / İmge", en: "Literature / Imagery" }, weight: 30, subtone: { tr: "Tekrarlayan semboller", en: "Recurring symbols" } },
    { label: { tr: "Sessizlik", en: "Silence" }, weight: 12, subtone: { tr: "Bilinçli mesafe", en: "Deliberate distance" } }
  ],
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
  top_behaviors: ["yaraticilik", "dikkat", "gece_aktiflik", "ic_ses", "emoji_yogunlugu", "reply_orani"],
  repeated_signals: [
    { text: { tr: "50 tweetin 47'si orijinal — 3 reply, 0 RT, 0 QT. Tam bir monolog.", en: "47/50 tweets original — 3 replies, 0 RT, 0 QT. Pure monologue." }, type: "rhythm" },
    { text: { tr: "'Pencere' 6 kez, 'sessizlik' 5 kez, 'rüzgâr' 4 kez — aynı imgelem dünyası.", en: "'Window' 6x, 'silence' 5x, 'wind' 4x — same imagery world." }, type: "frequency" },
    { text: { tr: "Hiç etiketlemiyor ama tweetlerin %30'u ikinci tekil şahıs — 'sen', 'sana'.", en: "Tags no one but 30% of tweets use second person — 'you', 'yours'." }, type: "pattern" }
  ],
  comment: {
    observation: { tr: "Hesabında konuşma yok, sahne var. Kimseyle etkileşime girmiyorsun ama tweetlerin birine yazılmış mektup gibi. Emoji yok, hashtag yok, filtre yok.", en: "No conversation on your feed — just a stage. You don't interact, yet your tweets read like letters to someone. No emoji, no hashtag, no filter." },
    reading: { tr: "Yalnızlığını yaşamıyorsun, işliyorsun. Her tweet bir damıtma: yaşadığın şeyi en saf haline indiriyorsun. Birine yazıyorsun ama etiketlemiyorsun — belki cevap istemiyorsun.", en: "You don't live your loneliness — you process it. Each tweet is distillation: reducing what you feel to its purest form. You write to someone but never tag them — maybe you don't want a reply." },
    mirror: { tr: "Çok şey hisseden ama az gösteren birisin — ta ki yazmaya başlayana kadar. Gece tweetlerinde çatlaklar var. O kısa, kesik cümleler — senin filtresiz halin.", en: "You feel deeply but show little — until you start writing. Your night tweets have cracks. Those short, broken lines — that's you unfiltered." },
    prediction: { tr: "Yakında o 'sen'li tweetlerden birini sileceksin — çünkü fazla açık verdiğini hissedeceksin.", en: "Soon you'll delete one of those 'you' tweets — because you'll feel you revealed too much." }
  },
  stalk: {
    observation: { tr: "Bu hesapta konuşma yok, sahne var. Kimseyle etkileşime girmiyor ama tweetler birine yazılmış mektup gibi. Emoji yok, hashtag yok, filtre yok.", en: "No conversation on this feed — just a stage. No interaction, yet tweets read like letters to someone. No emoji, no hashtag, no filter." },
    reading: { tr: "Yalnızlığını yaşamıyor, işliyor. Her tweet bir damıtma: yaşadığı şeyi en saf haline indiriyor. Birine yazıyor ama etiketlemiyor — belki cevap istemiyor.", en: "This account doesn't live loneliness — it processes it. Each tweet is distillation: reducing experience to its purest form. Writing to someone but never tagging — maybe no reply is wanted." },
    mirror: { tr: "Çok şey hisseden ama az gösteren bir profil — ta ki yazmaya başlayana kadar. Gece tweetlerinde çatlaklar var. O kısa, kesik cümleler — filtresiz hali.", en: "A profile that feels deeply but shows little — until writing starts. Night tweets have cracks. Those short, broken lines — the unfiltered version." },
    prediction: { tr: "Yakında o 'sen'li tweetlerden birini silecek — çünkü fazla açık verdiğini hissedecek.", en: "Soon one of those 'you' tweets will be deleted — because it'll feel like too much was revealed." }
  },
  card_color: "#2C2137"
},

/* ---- 3: Gece Düşünürü ---- */
{
  nickname: { tr: "Gece Kuşu", en: "Night Owl" },
  profile_emoji: "🌙",
  tagline: {
    tr: "Gündüz herkese benzeyen, gece kimseye benzemeyen bir hesap.",
    en: "By day you blend in, by night you're unlike anyone."
  },
  stalk_tagline: {
    tr: "Gündüz herkese benzeyen, gece kimseye benzemeyen bir hesap.",
    en: "An account that blends in by day but becomes unlike anyone at night."
  },
  profile_summary: {
    tr: "Gündüz hesabın ölü, gece canlanıyor. 'Acaba' 50 tweetin 14'ünde geçiyor ama hiçbirinin cevabını vermiyorsun. Thread'lerin hep gece 1'den sonra başlıyor ve hiçbiri sonuç cümlesiyle bitmiyor.",
    en: "Dead feed by day, alive by night. 'I wonder' appears in 14 of 50 tweets but you never answer any. Your threads always start after 1 AM and none end with a conclusion."
  },
  stalk_summary: {
    tr: "Gündüz bu hesap neredeyse ölü, gece canlanıyor. 'Acaba' 50 tweetin 14'ünde geçiyor ama hiçbirinin cevabı yok. Thread'ler hep gece 1'den sonra başlıyor ve hiçbiri sonuç cümlesiyle bitmiyor.",
    en: "This account is nearly dead by day, comes alive at night. 'I wonder' appears in 14 of 50 tweets but none are answered. Threads always start after 1 AM and none end with a conclusion."
  },
  topics: [
    { label: { tr: "Varoluş / Sorgulama", en: "Existential / Questioning" }, weight: 45, subtone: { tr: "Cevapsız", en: "Unanswered" } },
    { label: { tr: "Gece Düşünceleri", en: "Night Thoughts" }, weight: 30, subtone: { tr: "Felsefik", en: "Philosophical" } },
    { label: { tr: "Günlük Hayat", en: "Daily Life" }, weight: 15, subtone: { tr: "Yüzeysel", en: "Surface-level" } }
  ],
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
  top_behaviors: ["gece_aktiflik", "merak", "ic_ses", "sorgulama", "tutarlilik", "reply_orani"],
  repeated_signals: [
    { text: { tr: "'Acaba' kelimesi 50 tweetin 14'ünde — cevabını hiç vermiyor.", en: "'I wonder' appears in 14/50 tweets — never answers the question." }, type: "frequency" },
    { text: { tr: "Tweetlerin %60'ı soruyla bitiyor — sadece 2'si cevap almış, onlara da karşılık yok.", en: "60% of tweets end with a question — only 2 got replies, both ignored." }, type: "pattern" },
    { text: { tr: "Thread'ler hep gece 01:00 sonrası, hiçbiri sonuç cümlesiyle bitmiyor.", en: "Threads always start after 01:00 and none end with a conclusion." }, type: "pattern" }
  ],
  comment: {
    observation: { tr: "Gündüz hesabın neredeyse ölü. Gece canlanıyor — soru soruyorsun ama cevap aramıyorsun.", en: "Your feed is nearly dead by day. It wakes at night — you ask but don't seek answers." },
    reading: { tr: "Gece senin itiraf saatin. 'Acaba' senin en dürüst kelimen. Thread'lerini yarım bırakman sonuca ulaşmaktan korktuğunu gösteriyor — sonuç gelirse soru biter.", en: "Night is your confession hour. 'I wonder' is your most honest word. Leaving threads unfinished shows you fear the conclusion — if it arrives, the question dies." },
    mirror: { tr: "İki kişisin. Gündüz herkese benzeyen, gece kimseye benzemeyen. Belki sorularınla yaşamayı öğrendin ve cevaplar seni yalnız bırakacak.", en: "You're two people. By day you blend in, by night you're unlike anyone. Maybe you've learned to live with questions, and answers would leave you alone." },
    prediction: { tr: "Bu gece yine 01:00'den sonra bir thread açacaksın — ve yine yarım bırakacaksın.", en: "Tonight you'll start another thread after 01:00 — and leave it unfinished again." }
  },
  stalk: {
    observation: { tr: "Gündüz bu hesap neredeyse ölü. Gece canlanıyor — sorular soruyor ama cevap aramıyor.", en: "This account is nearly dead by day. It wakes at night — asks but doesn't seek answers." },
    reading: { tr: "Gece bu hesabın itiraf saati. 'Acaba' en dürüst kelimesi. Thread'leri yarım bırakması sonuca ulaşmaktan korktuğunu gösteriyor — sonuç gelirse soru biter.", en: "Night is this account's confession hour. 'I wonder' is its most honest word. Leaving threads unfinished shows a fear of conclusion — if it arrives, the question dies." },
    mirror: { tr: "Bu hesap iki kişi. Gündüz herkese benzeyen, gece kimseye benzemeyen. Belki sorularıyla yaşamayı öğrenmiş ve cevaplar onu yalnız bırakacak.", en: "This account is two people. By day it blends in, by night it's unlike anyone. Maybe it learned to live with questions, and answers would leave it alone." },
    prediction: { tr: "Bu gece yine 01:00'den sonra bir thread açacak — ve yine yarım bırakacak.", en: "Tonight this account will start another thread after 01:00 — and leave it unfinished again." }
  },
  card_color: "#1A1A2E"
},

/* ---- 4: Ayrılık Yaşayan ---- */
{
  nickname: { tr: "Yaz-Silci", en: "Post-Deleter" },
  profile_emoji: "✍️",
  tagline: {
    tr: "Birini kaybettin ya da kaybediyorsun — ve bunu tweet atıp silerek işliyorsun.",
    en: "You've lost someone or you're losing them — and you process it by posting and deleting."
  },
  stalk_tagline: {
    tr: "Bu hesap birini kaybetmiş ya da kaybediyor — ve bunu tweet atıp silerek işliyor.",
    en: "This account has lost someone or is losing them — processing it by posting and deleting."
  },
  profile_summary: {
    tr: "Son 2 haftada ritmin tamamen değişmiş. Tweet atıp siliyorsun, şarkı sözleriyle konuşuyorsun. 'Neyse' 50 tweetin 9'unda — her biri duygu cümlesinin hemen ardından. Birisi var ama adı hiçbir yerde geçmiyor.",
    en: "Your rhythm completely changed in the last 2 weeks. You post and delete, speak through lyrics. 'Whatever' appears in 9 of 50 tweets — always right after an emotional sentence. Someone exists but their name appears nowhere."
  },
  stalk_summary: {
    tr: "Son 2 haftada bu hesabın ritmi tamamen değişmiş. Tweet atıp siliyor, şarkı sözleriyle konuşuyor. 'Neyse' 50 tweetin 9'unda — her biri duygu cümlesinin hemen ardından. Birisi var ama adı hiçbir yerde geçmiyor.",
    en: "This account's rhythm completely changed in the last 2 weeks. Posts and deletes, speaks through lyrics. 'Whatever' appears in 9 of 50 tweets — always right after an emotional sentence. Someone exists but their name appears nowhere."
  },
  topics: [
    { label: { tr: "İlişki / Kayıp", en: "Relationship / Loss" }, weight: 55, subtone: { tr: "İsimsiz özlem", en: "Unnamed longing" } },
    { label: { tr: "Müzik / Şarkı Sözleri", en: "Music / Lyrics" }, weight: 25, subtone: { tr: "Gece paylaşımları", en: "Night shares" } },
    { label: { tr: "İç Çatışma", en: "Inner Conflict" }, weight: 15, subtone: { tr: "Yaz-sil döngüsü", en: "Post-delete cycle" } }
  ],
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
  top_behaviors: ["ozlem", "duygu_yogunlugu", "silme", "ic_catisma", "nostalji", "tutarlilik"],
  repeated_signals: [
    { text: { tr: "'Neyse' kelimesi 50 tweetin 9'unda — her biri duygu cümlesinin hemen ardından.", en: "'Whatever' in 9/50 tweets — always right after an emotional sentence." }, type: "frequency" },
    { text: { tr: "Şarkı sözü paylaşımları sadece 00:00–03:00 arası — gündüz hiç yok.", en: "Song lyrics shared only between 00:00–03:00 — never during the day." }, type: "rhythm" },
    { text: { tr: "Son 2 haftada en az 5 tweet atılıp silinmiş — hepsi ikinci tekil şahıs.", en: "At least 5 tweets posted and deleted in 2 weeks — all in second person." }, type: "pattern" }
  ],
  comment: {
    observation: { tr: "Son 2 haftada ritmin tamamen değişmiş. Şarkı sözleriyle konuşuyorsun. Birisi var ama adı hiçbir yerde geçmiyor.", en: "Your rhythm has completely changed in the last 2 weeks. You speak through lyrics. Someone exists but their name appears nowhere." },
    reading: { tr: "Tweet atıp silmen iki şeyi gösteriyor: söylemek istiyorsun ama sonuçlarından korkuyorsun. 'Neyse' senin kapattığın kapının sesi — ama 9 kez aynı kapıyı kapatman gerçekten kapatamadığını gösteriyor.", en: "Posting and deleting shows two things: you want to say it but fear the consequences. 'Whatever' is the sound of a door closing — but closing it 9 times proves it won't stay shut." },
    mirror: { tr: "Birini kaybettin — ya da kaybediyorsun. Kapatmak bitirmek demek ve sen henüz bitirmek istemiyorsun.", en: "You've lost someone — or you're losing them. Closing it means ending it, and you're not ready to end it yet." },
    prediction: { tr: "Bu gece yine bir şarkı sözü paylaşacaksın. Ve yine sileceksin — ama like bildirimi kalacak.", en: "Tonight you'll share lyrics again. And delete them again — but the like notification will stay." }
  },
  stalk: {
    observation: { tr: "Son 2 haftada bu hesabın ritmi tamamen değişmiş. Şarkı sözleriyle konuşuyor. Birisi var ama adı hiçbir yerde geçmiyor.", en: "This account's rhythm has completely changed in the last 2 weeks. Speaks through lyrics. Someone exists but their name appears nowhere." },
    reading: { tr: "Tweet atıp silmesi iki şeyi gösteriyor: söylemek istiyor ama sonuçlarından korkuyor. 'Neyse' kapattığı kapının sesi — ama 9 kez aynı kapıyı kapatması gerçekten kapatamadığını gösteriyor.", en: "Posting and deleting shows two things: wants to say it but fears the consequences. 'Whatever' is the sound of a door closing — but closing it 9 times proves it won't stay shut." },
    mirror: { tr: "Birini kaybetmiş — ya da kaybediyor. Kapatmak bitirmek demek ve henüz bitirmek istemiyor.", en: "This person has lost someone — or is losing them. Closing it means ending it, and they're not ready to end it yet." },
    prediction: { tr: "Bu gece yine bir şarkı sözü paylaşacak. Ve yine silecek — ama like bildirimi kalacak.", en: "Tonight this account will share lyrics again. And delete them again — but the like notification will stay." }
  },
  card_color: "#4A0E2E"
},

/* ---- 5: Yazılımcı ---- */
{
  nickname: { tr: "Kod Makinesi", en: "Code Machine" },
  profile_emoji: "💻",
  tagline: {
    tr: "Hafta içi yazılımcı, hafta sonu insan — aynı hesap, iki farklı kişi.",
    en: "Developer on weekdays, human on weekends — same account, two different people."
  },
  stalk_tagline: {
    tr: "Hafta içi yazılımcı hesabı, hafta sonu insan hesabı — aynı profil, iki farklı kişi.",
    en: "Developer account on weekdays, human account on weekends — same profile, two different people."
  },
  profile_summary: {
    tr: "Hafta içi %80 yazılım, hafta sonu %90 günlük hayat — iki ayrı hesap gibi. Deploy şakaların gece 11'den sonra, yarı şaka yarı çığlık. 'Öğrendiğim şeyler' thread formatı 4 kez tekrarlanmış.",
    en: "80% coding on weekdays, 90% daily life on weekends — like two accounts. Deploy jokes after 11 PM, half humor half cry for help. 'Things I learned' thread format used 4 times."
  },
  stalk_summary: {
    tr: "Hafta içi %80 yazılım, hafta sonu %90 günlük hayat — iki ayrı hesap gibi. Deploy şakaları gece 11'den sonra, yarı şaka yarı çığlık. 'Öğrendiğim şeyler' thread formatı 4 kez tekrarlanmış.",
    en: "80% coding on weekdays, 90% daily life on weekends — like two accounts. Deploy jokes after 11 PM, half humor half cry for help. 'Things I learned' thread format used 4 times."
  },
  topics: [
    { label: { tr: "Yazılım / Tech", en: "Software / Tech" }, weight: 50, subtone: { tr: "Öğretici", en: "Educational" } },
    { label: { tr: "Günlük Hayat", en: "Daily Life" }, weight: 25, subtone: { tr: "Hafta sonu modu", en: "Weekend mode" } },
    { label: { tr: "İş Stresi", en: "Work Stress" }, weight: 18, subtone: { tr: "Gece deploy şakaları", en: "Late-night deploy jokes" } }
  ],
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
  top_behaviors: ["merak", "hafta_sonu_fark", "thread", "bilgi_paylasma", "duygu_yogunlugu", "stres"],
  repeated_signals: [
    { text: { tr: "Hafta içi %80 yazılım, hafta sonu %90 günlük hayat — iki ayrı hesap gibi.", en: "Weekdays 80% coding, weekends 90% daily life — like two accounts." }, type: "rhythm" },
    { text: { tr: "'Öğrendiğim şeyler' thread formatı 4 kez — hep aynı yapı, farklı konular.", en: "'Things I learned' thread format 4 times — same structure, different topics." }, type: "pattern" },
    { text: { tr: "Deploy/deadline tweetleri hep gece 22:00+ — yarı şaka yarı çığlık.", en: "Deploy/deadline tweets always after 22:00 — half joke half cry." }, type: "rhythm" }
  ],
  comment: {
    observation: { tr: "Hesabın hafta içi yazılımcı hesabı, hafta sonu insan hesabı. Deploy şakaların gece 11'den sonra geliyor.", en: "Your feed is a developer account on weekdays, a human account on weekends. Deploy jokes arrive after 11 PM." },
    reading: { tr: "Yazılım kimliğin seni hafta içi yutmuş. Deploy şakalarındaki gerilim gerçek: kodu seviyorsun ama koşulları sevmiyorsun. Thread'ler senin vitrinin.", en: "Your developer identity has consumed your weekdays. The tension in deploy jokes is real: you love code but hate the conditions. Threads are your storefront." },
    mirror: { tr: "Deploy gecelerindeki şakalar aslında yardım çağrısı — ama herkes gülüyor.", en: "Your deploy-night jokes are actually cries for help — but everyone laughs." },
    prediction: { tr: "Bu hafta yine bir 'öğrendiğim şeyler' thread'i açacaksın — ama cuma gece deploy tweeti daha çok seni anlatacak.", en: "This week you'll start another 'things I learned' thread — but the Friday night deploy tweet will say more about you." }
  },
  stalk: {
    observation: { tr: "Bu hesap hafta içi yazılımcı hesabı, hafta sonu insan hesabı. Deploy şakaları gece 11'den sonra geliyor.", en: "This feed is a developer account on weekdays, a human account on weekends. Deploy jokes arrive after 11 PM." },
    reading: { tr: "Yazılım kimliği bu profili hafta içi yutmuş. Deploy şakalarındaki gerilim gerçek: kodu seviyor ama koşulları sevmiyor. Thread'ler vitrini.", en: "The developer identity has consumed this profile's weekdays. The tension in deploy jokes is real: loves code but hates the conditions. Threads are the storefront." },
    mirror: { tr: "Deploy gecelerindeki şakalar aslında yardım çağrısı — ama herkes gülüyor.", en: "Deploy-night jokes are actually cries for help — but everyone laughs." },
    prediction: { tr: "Bu hafta yine bir 'öğrendiğim şeyler' thread'i açacak — ama cuma gece deploy tweeti daha çok kendisini anlatacak.", en: "This week another 'things I learned' thread will start — but the Friday night deploy tweet will say more about this person." }
  },
  card_color: "#24292E"
},

/* ---- 6: Siyasi Tartışmacı ---- */
{
  nickname: { tr: "Modern Filozof", en: "Armchair Activist" },
  profile_emoji: "🧠",
  tagline: {
    tr: "Çok şey hissediyorsun ve muhtemelen haklısın — ama ikna etmiyorsun, kanıtlıyorsun.",
    en: "You feel a lot and you're probably right — but you're not convincing, you're proving."
  },
  stalk_tagline: {
    tr: "Çok şey hisseden ve muhtemelen haklı olan bir profil — ama ikna etmiyor, kanıtlıyor.",
    en: "A profile that feels a lot and is probably right — but doesn't convince, just proves."
  },
  profile_summary: {
    tr: "Tweetlerin yarısı reply, reply'ların çoğu tartışma. 'Bu ülkede' ile başlayan 11 tweet var — farklı konular, aynı çaresizlik tonu. 11 mesajlık tartışmalarda son 3 mesaj yeni argüman eklemiyor.",
    en: "Half your tweets are replies, most replies are arguments. 'In this country' starts 11 tweets — different topics, same helpless tone. In 11-message debates the last 3 add nothing new."
  },
  stalk_summary: {
    tr: "Bu hesabın tweetlerinin yarısı reply, reply'ların çoğu tartışma. 'Bu ülkede' ile başlayan 11 tweet var — farklı konular, aynı çaresizlik tonu. 11 mesajlık tartışmalarda son 3 mesaj yeni argüman eklemiyor.",
    en: "Half this account's tweets are replies, most replies are arguments. 'In this country' starts 11 tweets — different topics, same helpless tone. In 11-message debates the last 3 add nothing new."
  },
  topics: [
    { label: { tr: "Siyaset / Gündem", en: "Politics / News" }, weight: 55, subtone: { tr: "Öfkeli adalet", en: "Angry justice" } },
    { label: { tr: "Tartışma", en: "Debate" }, weight: 30, subtone: { tr: "Son söz takıntısı", en: "Last-word fixation" } },
    { label: { tr: "Toplumsal Eleştiri", en: "Social Critique" }, weight: 12, subtone: { tr: "Çaresizlik", en: "Helplessness" } }
  ],
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
  top_behaviors: ["tartisma", "son_soz", "adalet", "ofke", "reply_orani", "sabir"],
  repeated_signals: [
    { text: { tr: "'Bu ülkede' ile başlayan tweet: 11/50 — farklı konular, aynı çaresizlik tonu.", en: "'In this country' starts 11/50 tweets — different topics, same helpless tone." }, type: "frequency" },
    { text: { tr: "Reply zincirlerinde ort. 8 mesaj — son 3'ü yeni argüman eklemiyor.", en: "Avg 8 messages in reply chains — last 3 add no new arguments." }, type: "pattern" },
    { text: { tr: "Haber paylaşırken her zaman kendi yorumunu ekliyor — yorumsuz paylaşım sıfır.", en: "Always adds own commentary to news — zero posts without opinion." }, type: "pattern" }
  ],
  comment: {
    observation: { tr: "Tweetlerin yarısı reply, reply'ların çoğu tartışma. Hiç yorumsuz haber paylaşmıyorsun. Tartışmalarda aynı noktayı tekrarlıyorsun.", en: "Half your tweets are replies, most replies are arguments. You never share news without commentary. You repeat the same point in debates." },
    reading: { tr: "Siyaset senin varoluşsal alanın. Tartışmalarda son sözü bırakamaman ikna etmek için değil — bırakamamak için.", en: "Politics is your existential territory. Refusing to drop the last word isn't about persuasion — it's about inability to let go." },
    mirror: { tr: "Çok şey hissediyorsun ve muhtemelen doğru. Ama 11 mesajlık tartışmada karşı tarafı ikna ettiğin bir tane yok — çünkü ikna etmiyorsun, haklı olduğunu gösteriyorsun.", en: "You feel a lot and you're probably right. But in 11-message debates you've convinced no one — because you're not convincing, you're proving." },
    prediction: { tr: "Yarınki habere ilk tepki veren sen olacaksın — ve yine 8 mesajlık bir reply zincirinden son çıkan da.", en: "You'll be first to react to tomorrow's news — and last to leave the 8-message reply chain." }
  },
  stalk: {
    observation: { tr: "Bu hesabın tweetlerinin yarısı reply, reply'ların çoğu tartışma. Hiç yorumsuz haber paylaşmıyor. Tartışmalarda aynı noktayı tekrarlıyor.", en: "Half this account's tweets are replies, most replies are arguments. Never shares news without commentary. Repeats the same point in debates." },
    reading: { tr: "Siyaset bu hesabın varoluşsal alanı. Tartışmalarda son sözü bırakamaması ikna etmek için değil — bırakamamak için.", en: "Politics is this account's existential territory. Refusing to drop the last word isn't about persuasion — it's about inability to let go." },
    mirror: { tr: "Çok şey hisseden ve muhtemelen haklı olan bir profil. Ama 11 mesajlık tartışmada karşı tarafı ikna ettiği bir tane yok — çünkü ikna etmiyor, haklı olduğunu gösteriyor.", en: "A profile that feels a lot and is probably right. But in 11-message debates, no one is convinced — because the goal isn't convincing, it's proving." },
    prediction: { tr: "Yarınki habere ilk tepki veren bu hesap olacak — ve yine 8 mesajlık reply zincirinden son çıkan da.", en: "This account will be first to react to tomorrow's news — and last to leave the 8-message reply chain." }
  },
  card_color: "#8B0000"
},

/* ---- 7: Mizah Hesabı ---- */
{
  nickname: { tr: "Mizahşör", en: "The Comedian" },
  profile_emoji: "🎭",
  tagline: {
    tr: "Bu hesap ciddi kalmayı değil, her şeyi şakaya çevirmeyi seçiyor.",
    en: "This account chooses humor over sincerity — every time."
  },
  stalk_tagline: {
    tr: "Bu profil ciddi kalmayı değil, her şeyi şakaya çevirmeyi seçiyor.",
    en: "This profile chooses humor over sincerity — every time."
  },
  profile_summary: {
    tr: "50 tweet okudum ve seni tanıyamadım. 50 tweette sıfır kişisel bilgi — ne yediğin, nerede olduğun, ne hissettiğin yok. Trending konulara 25 dakikada espri, her ciddi soruya şakayla cevap. Sahne hiç kapanmıyor.",
    en: "I read 50 tweets and couldn't get to know you. Zero personal info in 50 tweets — no food, no location, no feelings. 25-min jokes on trending topics, every serious question gets humor. The show never closes."
  },
  stalk_summary: {
    tr: "50 tweet okundu ve bu hesap tanınamadı. 50 tweette sıfır kişisel bilgi — ne yediği, nerede olduğu, ne hissettiği yok. Trending konulara 25 dakikada espri, her ciddi soruya şakayla cevap. Sahne hiç kapanmıyor.",
    en: "50 tweets read and this account remains unknown. Zero personal info in 50 tweets — no food, no location, no feelings. 25-min jokes on trending topics, every serious question gets humor. The show never closes."
  },
  topics: [
    { label: { tr: "Mizah / Gündem", en: "Humor / Trending" }, weight: 60, subtone: { tr: "Performans odaklı", en: "Performance-driven" } },
    { label: { tr: "Pop Kültür", en: "Pop Culture" }, weight: 25, subtone: { tr: "Espri malzemesi", en: "Comedy material" } },
    { label: { tr: "???", en: "???" }, weight: 0, subtone: { tr: "Kişisel alan tamamen kapalı", en: "Personal space completely shut" } }
  ],
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
  top_behaviors: ["mizah", "maske", "espri_zamanlama", "performans", "duygu_yogunlugu", "itiraf"],
  repeated_signals: [
    { text: { tr: "50 tweette 0 kişisel bilgi — ne yediği, nerede olduğu, ne hissettiği yok.", en: "0 personal info in 50 tweets — no food, no location, no feelings." }, type: "absence" },
    { text: { tr: "Trending konulara ort. 25dk'da espri — bu tweetler etkileşimin %70'ini alıyor.", en: "Avg 25min joke on trending topics — these get 70% of engagement." }, type: "pattern" },
    { text: { tr: "Ciddi soru sorulduğunda bile espriyle geçiştirme — 50 tweet boyunca tek ciddi cümle yok.", en: "Even serious questions get a joke — not one serious sentence in 50 tweets." }, type: "absence" }
  ],
  comment: {
    observation: { tr: "50 tweet okudum ve seni tanıyamadım. Her tweet bir performans, her reply bir skeç.", en: "I read 50 tweets and couldn't get to know you. Every tweet is a performance, every reply a sketch." },
    reading: { tr: "Espri senin sığınağın. 50 tweette sıfır kişisel bilgi bilinçli bir karar. Herkes seni güldüren biri olarak tanıyor ama kimse seni tanımıyor.", en: "Humor is your shelter. Zero personal info in 50 tweets is a conscious choice. Everyone knows you as funny — no one actually knows you." },
    mirror: { tr: "Sana ciddi soru soran birine espriyle cevap vermen en çok şey anlatan sinyalin. Cevabı biliyorsun — sadece söylersen espri bozulacak.", en: "Answering a serious question with a joke is your most telling signal. You know the answer — you just don't want to break the act." },
    prediction: { tr: "Bir gün ciddi bir tweet atacaksın — ve o tweet en az etkileşim alan ama en çok seni anlatan tweet olacak.", en: "One day you'll post a serious tweet — and it'll be the least engaged but most revealing thing you've ever written." }
  },
  stalk: {
    observation: { tr: "50 tweet okundu ve bu hesap tanınamadı. Her tweet bir performans, her reply bir skeç.", en: "50 tweets read and this account remains unknown. Every tweet is a performance, every reply a sketch." },
    reading: { tr: "Espri bu hesabın sığınağı. 50 tweette sıfır kişisel bilgi bilinçli bir karar. Herkes onu güldüren biri olarak tanıyor ama kimse gerçekten tanımıyor.", en: "Humor is this account's shelter. Zero personal info in 50 tweets is a conscious choice. Everyone knows it as funny — no one actually knows it." },
    mirror: { tr: "Ciddi soru soran birine espriyle cevap vermesi en çok şey anlatan sinyal. Cevabı biliyor — sadece söylerse espri bozulacak.", en: "Answering a serious question with a joke is the most telling signal. The answer is known — but saying it would break the act." },
    prediction: { tr: "Bir gün ciddi bir tweet atacak — ve o tweet en az etkileşim alan ama en çok kendisini anlatan tweet olacak.", en: "One day a serious tweet will come — and it'll be the least engaged but most revealing thing ever posted on this account." }
  },
  card_color: "#FFB300"
},

/* ---- 8: Kripto Yatırımcısı ---- */
{
  nickname: { tr: "Kripto Meraklısı", en: "Crypto Bro" },
  profile_emoji: "📈",
  tagline: {
    tr: "Asıl motivasyonun para değil — haklı çıkmak.",
    en: "Your real motivation isn't money — it's being right."
  },
  stalk_tagline: {
    tr: "Bu hesabın asıl motivasyonu para değil — haklı çıkmak.",
    en: "This account's real motivation isn't money — it's being right."
  },
  profile_summary: {
    tr: "Sabah analist, gece kehanetçi — aynı kişi değil. 'Herkes' kelimesi 8/50 tweette — hep 'herkes yanlış yapıyor' formatında. Haklı çıktığında 'demiştim', yanıldığında konu değişiyor.",
    en: "Analyst by morning, prophet by night — not the same person. 'Everyone' in 8 of 50 tweets — always 'everyone is doing it wrong.' 'Told you so' when right, topic change when wrong."
  },
  stalk_summary: {
    tr: "Sabah analist, gece kehanetçi — aynı kişi değil. 'Herkes' kelimesi 8/50 tweette — hep 'herkes yanlış yapıyor' formatında. Haklı çıktığında 'demiştim', yanıldığında konu değişiyor.",
    en: "Analyst by morning, prophet by night — not the same person. 'Everyone' in 8 of 50 tweets — always 'everyone is doing it wrong.' 'Told you so' when right, topic change when wrong."
  },
  topics: [
    { label: { tr: "Kripto / Finans", en: "Crypto / Finance" }, weight: 55, subtone: { tr: "Haklı çıkma odaklı", en: "Being-right focused" } },
    { label: { tr: "Ekonomi / Piyasa", en: "Economy / Markets" }, weight: 25, subtone: { tr: "Sabah analiz modu", en: "Morning analysis mode" } },
    { label: { tr: "Kehanet", en: "Predictions" }, weight: 15, subtone: { tr: "Gece iddialı", en: "Bold at night" } }
  ],
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
  top_behaviors: ["haber_hizi", "risk_alma", "spekulasyon", "abarti", "oz_farkindalik", "sabir"],
  repeated_signals: [
    { text: { tr: "Fiyat artışında 'demiştim' — düşüşlerde sessizlik veya konu değiştirme.", en: "'Told you so' on price rises — silence or topic change during drops." }, type: "pattern" },
    { text: { tr: "'Herkes' kelimesi 8/50 tweette — hep 'herkes yanlış yapıyor' formatında.", en: "'Everyone' in 8/50 tweets — always 'everyone is doing it wrong' format." }, type: "frequency" },
    { text: { tr: "Sabah 07-08 tweetleri grafik/analiz, gece 23:00+ duygusal ve iddialı.", en: "Morning 07-08 tweets are charts, night 23:00+ are emotional and bold." }, type: "rhythm" }
  ],
  comment: {
    observation: { tr: "Hesabın iki modda çalışıyor: sabah analist, gece kehanetçi. Haklı çıktığında gösteriyorsun, yanıldığında konu değişiyor.", en: "Your feed runs in two modes: morning analyst, night prophet. You show wins, you hide losses." },
    reading: { tr: "Kripto senin için haklı çıkma oyunu. 'Demiştim' senin zafer narası. Yanıldığın zamanları saklamıyorsun — görmezden geliyorsun.", en: "Crypto is your being-right game. 'Told you' is your victory cry. You don't hide your wrongs — you ignore them." },
    mirror: { tr: "Asıl motivasyonun para değil — görünürlük. Haklı çıkmak kazanmaktan önemli. Geceleri yaptığın iddialı tweetler sabahki grafiklerden daha çok seni yansıtıyor.", en: "Your real motivation isn't money — it's visibility. Being right matters more than winning. Your bold night tweets reflect you more than your morning charts." },
    prediction: { tr: "Bir sonraki düşüşte yine sessizleşeceksin — ve yükseliş geldiğinde ilk 'demiştim' tweeti senin olacak.", en: "In the next dip you'll go silent again — and when the rise comes, the first 'told you so' will be yours." }
  },
  stalk: {
    observation: { tr: "Bu hesap iki modda çalışıyor: sabah analist, gece kehanetçi. Haklı çıktığında gösteriyor, yanıldığında konu değişiyor.", en: "This feed runs in two modes: morning analyst, night prophet. Shows wins, hides losses." },
    reading: { tr: "Kripto bu profil için haklı çıkma oyunu. 'Demiştim' zafer narası. Yanıldığı zamanları saklamıyor — görmezden geliyor.", en: "Crypto is this profile's being-right game. 'Told you' is the victory cry. Wrongs aren't hidden — they're ignored." },
    mirror: { tr: "Asıl motivasyon para değil — görünürlük. Haklı çıkmak kazanmaktan önemli. Geceleri yapılan iddialı tweetler sabahki grafiklerden daha çok bu profili yansıtıyor.", en: "The real motivation isn't money — it's visibility. Being right matters more than winning. Bold night tweets reflect this profile more than morning charts." },
    prediction: { tr: "Bir sonraki düşüşte yine sessizleşecek — ve yükseliş geldiğinde ilk 'demiştim' tweeti bu hesaptan gelecek.", en: "In the next dip this account will go silent again — and when the rise comes, the first 'told you so' will be theirs." }
  },
  card_color: "#0D7C3E"
},

/* ---- 9: Oyun Tutkunu ---- */
{
  nickname: { tr: "Gamer", en: "Gamer" },
  profile_emoji: "🎮",
  tagline: {
    tr: "Oyun sana kaçış veriyor ama kaçtığın şeyi hiç söylemiyorsun.",
    en: "Gaming gives you escape but you never name what you're escaping."
  },
  stalk_tagline: {
    tr: "Oyun bu profile kaçış veriyor ama kaçılan şeyi hiç söylemiyor.",
    en: "Gaming gives this profile escape but what's being escaped is never named."
  },
  profile_summary: {
    tr: "6 kez 'son kez oynuyorum' demişsin, 6'sında devam etmişsin. Zafer tweetlerinde %100 caps, yenilgide %0. Gece 2-4 arası oyunla ilgisiz, dürüst tweetler var — asıl sen orada.",
    en: "You said 'last time playing' 6 times, continued all 6. 100% caps in victory tweets, 0% in defeat. Between 2-4 AM there are honest tweets unrelated to gaming — the real you lives there."
  },
  stalk_summary: {
    tr: "6 kez 'son kez oynuyorum' demiş, 6'sında devam etmiş. Zafer tweetlerinde %100 caps, yenilgide %0. Gece 2-4 arası oyunla ilgisiz, dürüst tweetler var — asıl kişi orada.",
    en: "Said 'last time playing' 6 times, continued all 6. 100% caps in victory tweets, 0% in defeat. Between 2-4 AM there are honest tweets unrelated to gaming — the real person lives there."
  },
  topics: [
    { label: { tr: "Oyun / E-Spor", en: "Gaming / E-Sports" }, weight: 55, subtone: { tr: "Rekabetçi performans", en: "Competitive performance" } },
    { label: { tr: "Kaçış / Huzur", en: "Escape / Peace" }, weight: 20, subtone: { tr: "Gece itirafları", en: "Night confessions" } },
    { label: { tr: "Günlük Hayat", en: "Daily Life" }, weight: 15, subtone: { tr: "Stresli", en: "Stressed" } }
  ],
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
  top_behaviors: ["patlama", "platform_bagimliligi", "gece_aktiflik", "rekabet", "sabir", "itiraf"],
  repeated_signals: [
    { text: { tr: "'Son kez oynuyorum' → 6 kez, 6'sında devam etmiş.", en: "'Last time playing' — said 6 times, continued all 6." }, type: "frequency" },
    { text: { tr: "Zafer tweetlerinde %100 caps, yenilgide %0 — zafer bağırarak, yenilgi fısıldayarak.", en: "100% caps in victory, 0% in defeat — victory by shouting, defeat by whispering." }, type: "pattern" },
    { text: { tr: "Gece 02:00-04:00 arası ton tamamen farklı — oyunla ilgisiz, dürüst.", en: "Tone shifts completely 02:00-04:00 — unrelated to gaming, honest." }, type: "rhythm" }
  ],
  comment: {
    observation: { tr: "6 kez 'son kez' demişsin, 6'sında devam etmişsin. Zafer anında bağırıyorsun, yenilgide sessizleşiyorsun. Gece 3'te oyunla ilgisiz, dürüst tweetler var.", en: "You said 'last time' 6 times, continued all 6. You shout in victory, go silent in defeat. At 3 AM there are honest tweets unrelated to gaming." },
    reading: { tr: "Oyun senin için savaş alanı. Kazanmak seni kanıtlıyor, kaybetmek yıkıyor — o yüzden bırakıyorsun ama geri geliyorsun. Oyun dışında bu kadar net bir hissiyat yok.", en: "Gaming is your battlefield. Winning proves you, losing breaks you — so you quit but return. Nothing else gives you such clear feelings." },
    mirror: { tr: "Oyun sana kaçış veriyor ama kaçtığın şeyi söylemiyorsun. 'Huzur' kelimesini oyun bağlamında kullanman gerçek hayatın huzursuz olduğunu farkında olmadan söylüyor.", en: "Gaming gives you escape but you never name what you're escaping. Using 'peace' in a gaming context accidentally reveals your real life isn't peaceful." },
    prediction: { tr: "Bu gece yine 'son kez' diyeceksin. Ve yine devam edeceksin — çünkü bırakacağın şey oyun değil, huzur.", en: "Tonight you'll say 'last time' again. And continue again — because what you'd quit isn't the game, it's the peace." }
  },
  stalk: {
    observation: { tr: "6 kez 'son kez' demiş, 6'sında devam etmiş. Zafer anında bağırıyor, yenilgide sessizleşiyor. Gece 3'te oyunla ilgisiz, dürüst tweetler var.", en: "Said 'last time' 6 times, continued all 6. Shouts in victory, goes silent in defeat. At 3 AM there are honest tweets unrelated to gaming." },
    reading: { tr: "Oyun bu profil için savaş alanı. Kazanmak kanıtlıyor, kaybetmek yıkıyor — o yüzden bırakıyor ama geri geliyor. Oyun dışında bu kadar net bir hissiyat yok.", en: "Gaming is this profile's battlefield. Winning proves, losing breaks — so quitting happens but return follows. Nothing else gives such clear feelings." },
    mirror: { tr: "Oyun kaçış veriyor ama kaçılan şeyi söylemiyor. 'Huzur' kelimesini oyun bağlamında kullanması gerçek hayatın huzursuz olduğunu farkında olmadan söylüyor.", en: "Gaming gives escape but what's being escaped is never named. Using 'peace' in a gaming context accidentally reveals real life isn't peaceful." },
    prediction: { tr: "Bu gece yine 'son kez' diyecek. Ve yine devam edecek — çünkü bırakacağı şey oyun değil, huzur.", en: "Tonight 'last time' will be said again. And the game will continue — because what would be quit isn't the game, it's the peace." }
  },
  card_color: "#7B1FA2"
}

]; // end DEMO_PROFILES

/* ============================================================
   analyzeHandle — V3 (Profil Okuma)
   Backward compatible: result.archetype + result.scores + result.card shimmed
   ============================================================ */

function analyzeHandle(rawHandle, mode, seedKey) {
  var handle = normHandle(rawHandle);
  var h = xhash(seedKey || handle);
  var profile = DEMO_PROFILES[h % DEMO_PROFILES.length];
  mode = mode || "mirror";

  var behaviors = [];
  for (var i = 0; i < profile.behaviors.length; i++) {
    var b = profile.behaviors[i];
    var shift = ((h >>> (i * 2)) % 11) - 5;
    var val = Math.max(5, Math.min(98, b.value + shift));
    var meta = BEHAVIOR_MAP[b.key];
    behaviors.push({
      key: b.key,
      label: meta ? meta.label : { tr: b.key, en: b.key },
      value: val
    });
  }

  var topKeys = profile.top_behaviors;
  var topBehaviors = [];
  for (var ti = 0; ti < topKeys.length; ti++) {
    for (var bi = 0; bi < behaviors.length; bi++) {
      if (behaviors[bi].key === topKeys[ti]) {
        topBehaviors.push(behaviors[bi]);
        break;
      }
    }
  }

  var useStalked = (mode === "stalk");
  var summary = (useStalked && profile.stalk_summary) ? profile.stalk_summary : profile.profile_summary;
  var comment = (useStalked && profile.stalk) ? profile.stalk : profile.comment;
  var tagline = (useStalked && profile.stalk_tagline) ? profile.stalk_tagline : profile.tagline;

  var result = {
    mode: mode,
    handle: handle,
    hash: h,
    source: "demo",

    nickname: profile.nickname,
    profile_emoji: profile.profile_emoji || "🪞",
    tagline: tagline,
    profile_summary: summary,
    topics: profile.topics,
    behaviors: behaviors,
    top_behaviors: topBehaviors,
    repeated_signals: profile.repeated_signals,
    comment: comment,

    meta: {
      version: "mirror_v3",
      source: "demo",
      ts: new Date().toISOString()
    }
  };

  /* --- backward compat shim for card.js V2/V1, match, profile --- */
  var nickTr = profile.nickname ? profile.nickname.tr : "@" + handle;
  var nickEn = profile.nickname ? profile.nickname.en : "@" + handle;
  var summaryTr = profile.profile_summary.tr;
  var summaryEn = profile.profile_summary.en;
  var shortTr = summaryTr.length > 60 ? summaryTr.substring(0, 57) + "..." : summaryTr;
  var shortEn = summaryEn.length > 60 ? summaryEn.substring(0, 57) + "..." : summaryEn;

  result.archetype = {
    id: "v3-" + (h % DEMO_PROFILES.length),
    emoji: profile.profile_emoji || "🪞",
    color: profile.card_color,
    name: { tr: nickTr, en: nickEn },
    desc: { tr: shortTr, en: shortEn },
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
  result.card = {
    nickname: { tr: nickTr, en: nickEn },
    desc: { tr: shortTr, en: shortEn },
    emoji: profile.profile_emoji || "🪞",
    color: profile.card_color,
    top_behaviors: topBehaviors
  };

  return result;
}


// IDs describe behavior, never translated display names. Keep order stable for seeded draws.
// Every supported locale needs independently curated copy; do not synthesize translations.
// legacy_names exist only to read cards saved before canonical IDs were introduced.
var FUN_PERSONAS = [
  {
    "id": "quiet_instigator",
    "semantic": "Quietly challenges expectations with understated mischief.",
    "emoji": "🫥",
    "color": "#19B8B8",
    "traits": { "humor": "ironic", "reply": "teasing", "timeline": "opens_topics" },
    "legacy_names": [
      "Sessiz Kaos",
      "Quiet Chaos"
    ],
    "locales": {
      "tr": {
        "nickname": "Sessiz Muzip",
        "tagline": "Sakin görünüşünün altında küçük bir muziplik var.",
        "comment": "Herkes aynı fikirdeyken küçük bir itirazla sohbetin yönünü değiştiriyorsun. Bunu öyle sakin söylüyorsun ki ilk anda şaka mı ciddi mi olduğun anlaşılmıyor. En çok da seni anlayan biriyle sessizce gülüşmek hoşuna gidiyor."
      },
      "en": {
        "nickname": "Quiet Instigator",
        "tagline": "You ask the question everyone else was avoiding.",
        "comment": "You can get a whole table talking with one casually delivered question. You seem perfectly content to listen while everyone works out what they think. The fun is in the tiny grin you share with whoever caught on first."
      },
      "es": {
        "nickname": "Travieso Discreto",
        "tagline": "Bajo esa calma se esconde una pizca de travesura.",
        "comment": "Cuando todos están de acuerdo, sueltas una pregunta que cambia la conversación entera. Lo dices con tanta calma que nadie sabe si hablas en serio o en broma. Tu parte favorita es esa sonrisa cómplice con quien lo notó primero."
      },
      "pt": {
        "nickname": "Arteiro de Mansinho",
        "tagline": "Por trás da calma, sempre tem uma travessura guardada.",
        "comment": "Quando todo mundo concorda, você solta uma pergunta que muda o rumo da conversa. Fala com tanta calma que ninguém sabe se é sério ou brincadeira. O melhor é a risadinha cúmplice com quem percebeu primeiro."
      },
      "ar": {
        "nickname": "المشاغب الهادئ",
        "tagline": "وراء هدوئك شقاوة صغيرة لا تهدأ.",
        "comment": "حين يتفق الجميع، تطرح سؤالًا صغيرًا يغير اتجاه الحديث كله. تقوله بهدوء شديد حتى لا يعرف أحد إن كنت جادًا أو تمزح. وأجمل ما في الأمر تلك الابتسامة المتبادلة مع أول من فهم قصدك."
      },
      "fr": {
        "nickname": "L'Air de Rien",
        "tagline": "Sous ton calme se cache toujours une petite malice.",
        "comment": "Quand tout le monde est d'accord, tu glisses une question qui change le cours de la conversation. Tu le fais avec un tel calme qu'on ne sait jamais si tu plaisantes. Le meilleur moment, c'est le sourire complice avec la première personne qui a compris."
      },
      "de": {
        "nickname": "Auf leisen Sohlen",
        "tagline": "Hinter deiner Ruhe steckt immer ein kleiner Schalk.",
        "comment": "Wenn sich alle einig sind, wirfst du eine Frage ein, die das ganze Gespräch dreht. Das sagst du so gelassen, dass niemand weiß, ob du es ernst meinst. Das Beste daran ist das verschmitzte Grinsen mit der Person, die es zuerst gemerkt hat."
      },
      "it": {
        "nickname": "Il Sornione",
        "tagline": "Dietro la tua calma c'è sempre un pizzico di malizia.",
        "comment": "Quando tutti sono d'accordo, butti lì una domanda che cambia il corso della conversazione. Lo dici con una calma tale che nessuno capisce se scherzi o fai sul serio. La parte migliore è il sorriso complice con chi se n'è accorto per primo."
      },
      "ja": {
        "nickname": "さりげない策士",
        "tagline": "穏やかに見えて、ちょっとしたいたずら心がある。",
        "comment": "みんなの意見がそろったところで、話の流れを変える質問をさらっと投げかける。あまりに落ち着いて言うので、本気なのか冗談なのか誰にもわからない。いちばん楽しいのは、最初に気づいた人と目を合わせて笑う瞬間だ。"
      },
      "ko": {
        "nickname": "은근한 장난꾼",
        "tagline": "차분해 보이지만 속에는 장난기가 있어요.",
        "comment": "다들 같은 말을 하고 있을 때 흐름을 바꾸는 질문을 슬쩍 던져요. 너무 태연하게 말해서 진담인지 농담인지 아무도 확신하지 못하죠. 제일 즐거운 순간은 눈치챈 사람과 눈이 마주쳐 함께 웃을 때예요."
      },
      "zh": {
        "nickname": "安靜的搗蛋鬼",
        "tagline": "看起來很溫和，其實藏著一點調皮。",
        "comment": "大家意見一致的時候，你會輕輕丟出一個讓話題轉彎的問題。語氣太平靜了，沒有人分得出你是認真還是在開玩笑。最開心的一刻，是跟第一個聽懂的人對上眼一起笑出來。"
      },
      "ru": {
        "nickname": "Тихий провокатор",
        "tagline": "Выглядишь спокойно, а внутри есть немного озорства.",
        "comment": "Когда все уже согласились друг с другом, ты вбрасываешь вопрос, который разворачивает разговор. Говоришь это так ровно, что никто не понимает, всерьёз ты или шутишь. Самое приятное — поймать взгляд того, кто понял первым, и вместе засмеяться."
      }
    }
  },
  {
    "id": "ironic_observer",
    "semantic": "Notices contradictions and expresses them through gentle irony.",
    "emoji": "🎭",
    "color": "#7C4DFF",
    "traits": { "humor": "dry", "reply": "selective", "timeline": "drops_one_liners" },
    "legacy_names": [
      "İroni Müdürü",
      "Head of Irony"
    ],
    "locales": {
      "tr": {
        "nickname": "İnce Alaycı",
        "tagline": "Ciddiyeti bozmadan cümlenin anlamını değiştiriyorsun.",
        "comment": "Fazla iddialı bir söz duyunca içindeki küçük çelişkiyi fark ediyorsun. Uzun bir itiraz yerine kısa, hafif alaylı bir karşılık vermek sana daha cazip geliyor. Şakayı açıklamak yerine anlayanların gülümsemesini bekliyorsun."
      },
      "en": {
        "nickname": "Tongue in Cheek",
        "tagline": "Almost serious, but never quite.",
        "comment": "You enjoy saying something almost sincerely and letting the last few words give you away. A grand announcement is usually an invitation for a gentle tease. You would rather earn a knowing smile than explain why you were funny."
      },
      "es": {
        "nickname": "Casi en Serio",
        "tagline": "Suenas serio, pero solo hasta la última palabra.",
        "comment": "Te gusta decir algo casi con sinceridad y dejar que el final de la frase te delate. Un anuncio demasiado solemne es, para ti, una invitación a una broma suave. Prefieres ganarte una sonrisa cómplice antes que explicar el chiste."
      },
      "pt": {
        "nickname": "Ironia Fina",
        "tagline": "Você muda o sentido da frase sem perder a pose.",
        "comment": "Basta alguém fazer um anúncio solene demais para você notar a contradição escondida nele. Em vez de discutir, prefere uma resposta curta e levemente irônica. Explicar a piada nunca é opção; o sorriso de quem entendeu já basta."
      },
      "ar": {
        "nickname": "سخرية لطيفة",
        "tagline": "تقول الجملة بجدية، ثم تقلب معناها في آخر كلمة.",
        "comment": "يكفي أن يعلن أحدهم شيئًا بثقة مبالغ فيها حتى تلتقط التناقض المختبئ فيه. بدل الجدال الطويل، تفضل ردًا قصيرًا بنبرة ساخرة خفيفة. ولا تشرح النكتة أبدًا؛ تكفيك ابتسامة من فهمها."
      },
      "fr": {
        "nickname": "Second Degré",
        "tagline": "Tu dis les choses sérieusement… enfin, presque.",
        "comment": "Il suffit d'une annonce un peu trop solennelle pour que tu repères la contradiction cachée dedans. Plutôt qu'un long débat, tu préfères une réponse courte, faussement naïve et volontairement ambiguë. Expliquer la blague ? Jamais : le sourire de ceux qui ont compris suffit."
      },
      "de": {
        "nickname": "Mit Augenzwinkern",
        "tagline": "Du meinst es fast ernst – bis zum letzten Wort.",
        "comment": "Eine zu feierliche Ankündigung reicht, und schon fällt dir der Widerspruch darin auf. Statt lange zu diskutieren, antwortest du lieber kurz und mit einem leisen Seitenhieb. Den Witz erklärst du nie; das Lächeln der anderen genügt dir."
      },
      "it": {
        "nickname": "Ironia Sottile",
        "tagline": "Il tono è serio, fino all'ultima parola.",
        "comment": "Basta un annuncio un po' troppo solenne e tu noti subito la contraddizione nascosta. Invece di lunghe discussioni, preferisci una risposta breve con un filo d'ironia. Non spieghi mai la battuta: ti basta il sorriso di chi l'ha capita."
      },
      "ja": {
        "nickname": "ツッコミ上手",
        "tagline": "真顔のまま、最後のひと言でひっくり返す。",
        "comment": "大げさな発表を聞くと、その中の矛盾にすぐ気づいてしまう。長々と反論するより、軽く皮肉を効かせた短いひと言を選ぶ。ネタの説明はしない。わかった人がくすっと笑えば、それで十分だ。"
      },
      "ko": {
        "nickname": "촌철살인",
        "tagline": "표정 하나 안 바꾸고 마지막 한마디로 뒤집어요.",
        "comment": "거창한 이야기를 들으면 그 안의 모순이 먼저 눈에 들어와요. 길게 반박하는 대신 짧고 가볍게 비트는 한마디를 고르죠. 무슨 뜻인지 굳이 설명하지는 않아요. 알아들은 사람이 피식 웃으면 그걸로 충분하니까요."
      },
      "zh": {
        "nickname": "一句話收尾",
        "tagline": "面不改色，最後一句直接翻盤。",
        "comment": "聽到誇張的說法時，你第一眼看到的是裡面的矛盾。比起長篇反駁，你更習慣挑一句輕輕帶過的話。你不會解釋笑點在哪裡。聽懂的人笑一下，這樣就夠了。"
      },
      "ru": {
        "nickname": "Последнее слово",
        "tagline": "Лицо каменное, а одна фраза переворачивает всё.",
        "comment": "Когда слышишь громкое заявление, первым делом замечаешь в нём противоречие. Вместо длинного спора выбираешь короткую фразу с лёгкой иронией. Объяснять шутку ты не станешь. Если кто-то тихо усмехнулся, этого достаточно."
      }
    }
  },
  {
    "id": "topic_explorer",
    "semantic": "Enjoys exploring many topics without needing to settle on one.",
    "emoji": "🧃",
    "color": "#FF7A45",
    "traits": { "humor": "playful", "reply": "curious", "timeline": "opens_topics" },
    "legacy_names": [
      "Gündem Turisti",
      "Timeline Tourist"
    ],
    "locales": {
      "tr": {
        "nickname": "Her Konuya Meraklı",
        "tagline": "Bir konu bitmeden ötekini merak etmeye başlıyorsun.",
        "comment": "Bilmediğin bir konu açılınca susmak yerine soru soruyorsun. Sohbet ilerledikçe öğrenmek istediğin başka şeyler de çıkıyor. Her konuda uzman olmaktan çok, yeni bir şey duymak hoşuna gidiyor."
      },
      "en": {
        "nickname": "Endlessly Curious",
        "tagline": "There is always something else worth asking about.",
        "comment": "You are happy to be the person who asks how something works. One interesting answer tends to lead to another question, even when the subject is completely new to you. Knowing a little more than you did an hour ago feels like a good afternoon."
      },
      "es": {
        "nickname": "Curiosidad Infinita",
        "tagline": "Siempre hay algo más que vale la pena preguntar.",
        "comment": "No te da vergüenza ser quien pregunta cómo funciona algo. Una respuesta interesante te lleva a otra pregunta, aunque el tema sea completamente nuevo para ti. Saber un poco más que hace una hora ya te parece una buena tarde."
      },
      "pt": {
        "nickname": "Curioso de Carteirinha",
        "tagline": "Mal termina um assunto, já quer saber do próximo.",
        "comment": "Quando surge um tema que você não conhece, em vez de ficar quieto, você pergunta. Uma resposta interessante puxa outra pergunta, e assim a conversa vai longe. Sair sabendo um pouco mais do que antes já faz o dia valer a pena."
      },
      "ar": {
        "nickname": "يسأل عن كل شيء",
        "tagline": "لا ينتهي موضوع حتى يبدأ فضولك بالموضوع التالي.",
        "comment": "إذا طرح أحدهم موضوعًا لا تعرفه، لا تصمت بل تسأل. كل إجابة مثيرة تفتح لك سؤالًا جديدًا، فيطول الحديث دون أن تشعر. يكفيك أن تخرج من الجلسة وأنت تعرف أكثر مما كنت تعرف."
      },
      "fr": {
        "nickname": "Curieux de Tout",
        "tagline": "Un sujet se termine à peine que tu penses déjà au suivant.",
        "comment": "Quand un sujet t'est inconnu, tu ne te tais pas : tu poses des questions. Chaque réponse intéressante en appelle une autre et, tôt ou tard, la discussion va très loin. Repartir en en sachant un peu plus qu'avant suffit à rendre la journée réussie."
      },
      "de": {
        "nickname": "Will alles wissen",
        "tagline": "Kaum ist ein Thema durch, interessiert dich schon das nächste.",
        "comment": "Wenn ein Thema neu für dich ist, schweigst du nicht, sondern fragst nach. Jede spannende Antwort bringt dich auf die nächste Frage, und das Gespräch wird immer länger. Ein bisschen schlauer nach Hause zu gehen, reicht dir für einen guten Tag."
      },
      "it": {
        "nickname": "Mille Domande",
        "tagline": "Un argomento non è ancora finito e pensi già al prossimo.",
        "comment": "Quando un tema ti è nuovo, non resti in silenzio: fai domande. Ogni risposta interessante ne porta un'altra, e la chiacchierata si allunga senza che te ne accorga. Tornare a casa sapendo qualcosa in più ti basta per una bella giornata."
      },
      "ja": {
        "nickname": "知りたがり",
        "tagline": "ひとつの話が終わる前に、もう次の話題が気になっている。",
        "comment": "知らない話題が出ると、黙っているより質問したくなる。面白い答えがひとつ返ってくると、また次の疑問がわいてくる。少しでも詳しくなって帰れたら、それだけでいい一日になる。"
      },
      "ko": {
        "nickname": "호기심 대장",
        "tagline": "한 이야기가 끝나기도 전에 다음 주제가 궁금해져요.",
        "comment": "모르는 이야기가 나오면 가만히 있기보다 질문부터 하게 돼요. 재미있는 답이 하나 돌아오면 곧바로 다음 궁금증이 생기죠. 조금이라도 더 알고 돌아가는 날은 그것만으로 괜찮은 하루가 됩니다."
      },
      "zh": {
        "nickname": "什麼都想問",
        "tagline": "一個話題還沒結束，你已經好奇下一個了。",
        "comment": "遇到不熟的話題，比起安靜聽著，你更想直接開口問。只要得到一個有趣的答案，下一個疑問馬上就冒出來。哪天能多知道一點什麼，那天就算過得不錯。"
      },
      "ru": {
        "nickname": "Вечно любопытный",
        "tagline": "Одна тема ещё не закончилась, а тебе уже интересна следующая.",
        "comment": "Если разговор уходит в незнакомую область, ты скорее спросишь, чем промолчишь. Один интересный ответ — и сразу появляется следующий вопрос. День, после которого знаешь чуть больше, уже считается неплохим."
      }
    }
  },
  {
    "id": "deadpan_humor",
    "semantic": "Delivers understated humor with a straight face and patient timing.",
    "emoji": "🧊",
    "color": "#2F80ED",
    "traits": { "humor": "deadpan", "reply": "quick", "timeline": "drops_one_liners" },
    "legacy_names": [
      "Soğuk Mizah",
      "Dry Humor Unit"
    ],
    "locales": {
      "tr": {
        "nickname": "Soğuk Mizah",
        "tagline": "Şakanın anlaşılması için acele etmiyorsun.",
        "comment": "En absürt cümleyi sıradan bir şey söylüyormuş gibi söyleyip susuyorsun. Karşındaki şakayı yakalayana kadar yüzünden tek bir ipucu çıkmıyor. Kahkaha gecikince açıklama yapmıyorsun; o küçük sessizlik de esprinin bir parçası."
      },
      "en": {
        "nickname": "Dry Wit",
        "tagline": "The straight face is part of the joke.",
        "comment": "You deliver a ridiculous observation with the same composure as a perfectly ordinary remark. Someone usually has to check whether you meant it. You let them take their time, because the pause makes it better."
      },
      "es": {
        "nickname": "Cara de Póker",
        "tagline": "La cara seria es parte del chiste.",
        "comment": "Dices la frase más absurda con el mismo tono con el que pedirías un café. Nadie encuentra en tu cara una sola pista hasta que cae en la broma. Si la risa tarda, no explicas nada; ese pequeño silencio también es parte del chiste."
      },
      "pt": {
        "nickname": "Cara de Paisagem",
        "tagline": "Ninguém percebe a piada até você deixar.",
        "comment": "Você conta a observação mais absurda com a maior naturalidade do mundo. Ninguém acha uma pista no seu rosto até a ficha cair. Se a risada demora, você nem se mexe; a pausa deixa tudo ainda mais engraçado."
      },
      "ar": {
        "nickname": "مزاح بوجه جاد",
        "tagline": "لا أحد يكتشف النكتة إلا حين تسمح له.",
        "comment": "تقول أغرب ملاحظة بالنبرة نفسها التي تطلب بها فنجان قهوة. لا يظهر على وجهك أي تلميح حتى يفهم الآخرون المقصود. وإذا تأخرت الضحكة لا تشرح شيئًا؛ فذلك الصمت القصير جزء من الطرافة."
      },
      "fr": {
        "nickname": "Humour Pince-sans-rire",
        "tagline": "Personne ne voit venir la blague avant que tu le décides.",
        "comment": "Tu lâches la remarque la plus absurde sur le ton de quelqu'un qui commande un café. Ton visage ne trahit rien jusqu'à ce que les autres comprennent enfin. Si le rire tarde, tu n'expliques rien : ce petit silence fait partie du numéro."
      },
      "de": {
        "nickname": "Staubtrockener Humor",
        "tagline": "Den Witz merkt man erst, wenn du es zulässt.",
        "comment": "Du sagst die absurdeste Bemerkung im selben Ton, in dem du einen Kaffee bestellst. Dein Gesicht verrät nichts, bis die anderen endlich verstehen. Kommt das Lachen spät, erklärst du nichts; die kleine Pause gehört zur Pointe."
      },
      "it": {
        "nickname": "Faccia Impassibile",
        "tagline": "Nessuno capisce la battuta finché non lo decidi tu.",
        "comment": "Dici la frase più assurda con lo stesso tono con cui ordineresti un caffè. Dalla tua faccia non trapela niente, finché gli altri non ci arrivano da soli. Se la risata tarda, non spieghi nulla: quella piccola pausa fa parte della battuta."
      },
      "ja": {
        "nickname": "真顔でボケる人",
        "tagline": "笑いどころは、あなたが決めたときにやってくる。",
        "comment": "とんでもないことを、コーヒーを注文するのと同じ調子でさらっと言う。周りが気づくまで、表情にはまったく出さない。笑いが遅れても説明はしない。その少しの間も、笑いの一部だからだ。"
      },
      "ko": {
        "nickname": "무표정 개그",
        "tagline": "웃을 타이밍은 당신이 정하는 대로 찾아와요.",
        "comment": "말도 안 되는 이야기를 커피 주문하듯 담담하게 꺼내요. 주변이 알아챌 때까지 표정은 전혀 흔들리지 않죠. 웃음이 늦게 터져도 굳이 설명하지 않아요. 그 잠깐의 정적까지가 농담의 일부니까요."
      },
      "zh": {
        "nickname": "正經講笑話",
        "tagline": "笑點什麼時候來，完全由你決定。",
        "comment": "再離譜的話，你都能用點咖啡的語氣講出來。在別人反應過來之前，表情完全沒有變化。就算笑聲來得慢，你也不會多做解釋。中間那段安靜，本來就是笑話的一部分。"
      },
      "ru": {
        "nickname": "Шутит с серьёзным лицом",
        "tagline": "Когда тут смеяться, решаешь только ты.",
        "comment": "Самую нелепую вещь ты произносишь тем же тоном, каким заказываешь кофе. Пока вокруг не сообразят, лицо не выдаёт ничего. Даже если смех приходит с опозданием, ты ничего не объясняешь. Эта пауза — часть шутки."
      }
    }
  },
  {
    "id": "armchair_thinker",
    "semantic": "Enjoys developing personal theories through relaxed discussion.",
    "emoji": "🛋️",
    "color": "#5C6270",
    "traits": { "humor": "witty", "reply": "measured", "timeline": "goes_deep" },
    "legacy_names": [
      "Koltuk Filozofu",
      "Sofa Philosopher"
    ],
    "locales": {
      "tr": {
        "nickname": "Koltuk Filozofu",
        "tagline": "Sıradan bir sorunun uzun bir cevabı olabilir.",
        "comment": "Sıradan bir sohbet sende beklenmedik bir hayat teorisine dönüşebiliyor. Çayın soğusa da fikrini biraz daha düşünmeden konuyu kapatmıyorsun. Birinin itiraz etmesi keyfini kaçırmıyor; asıl o zaman konuşacak yeni bir şey çıkıyor."
      },
      "en": {
        "nickname": "Armchair Philosopher",
        "tagline": "A casual chat rarely stays casual for long.",
        "comment": "You can turn a passing question into a surprisingly thoughtful conversation. You enjoy trying out an idea before deciding whether you believe it. A good objection is a reason to stay and talk, especially if everyone is comfortable."
      },
      "es": {
        "nickname": "Filósofo de Sofá",
        "tagline": "Una charla casual nunca se queda casual mucho rato.",
        "comment": "Puedes convertir una pregunta cualquiera en una teoría inesperada sobre la vida. Aunque el café se enfríe, no cierras el tema sin darle una vuelta más. Que alguien te lleve la contraria no te molesta; justo ahí empieza lo bueno."
      },
      "pt": {
        "nickname": "Filósofo de Boteco",
        "tagline": "Uma conversa à toa nunca fica à toa por muito tempo.",
        "comment": "Com você, uma pergunta qualquer pode virar uma teoria inesperada sobre a vida. Mesmo com o café esfriando, você não encerra o assunto sem dar mais uma volta na ideia. Se alguém discorda, melhor ainda: é aí que a conversa fica boa."
      },
      "ar": {
        "nickname": "فيلسوف المقهى",
        "tagline": "الحديث العابر معك لا يبقى عابرًا طويلًا.",
        "comment": "قد يتحول معك سؤال عادي إلى نظرية غير متوقعة عن الحياة. حتى لو بردت القهوة، لا تغلق الموضوع قبل أن تقلب الفكرة مرة أخرى. وإن اعترض أحدهم فهذا أفضل؛ فهنا يبدأ النقاش الممتع."
      },
      "fr": {
        "nickname": "Philosophe du Dimanche",
        "tagline": "Avec toi, une discussion légère ne le reste jamais très longtemps.",
        "comment": "Avec toi, une question anodine peut vite devenir une théorie inattendue sur la vie. Même quand le café refroidit, tu ne lâches pas le sujet avant d'avoir retourné l'idée une dernière fois. Et si quelqu'un n'est pas d'accord, tant mieux : c'est là que ça devient intéressant."
      },
      "de": {
        "nickname": "Philosoph am Küchentisch",
        "tagline": "Ein lockeres Gespräch bleibt bei dir selten locker.",
        "comment": "Aus einer beiläufigen Frage wird bei dir schnell eine überraschende Theorie über das Leben. Selbst wenn der Kaffee kalt wird, lässt du das Thema nicht los, bevor du den Gedanken noch einmal gewendet hast. Widerspricht jemand, umso besser: Genau dann wird es spannend."
      },
      "it": {
        "nickname": "Filosofo da Bar",
        "tagline": "Con te una chiacchierata leggera non resta leggera a lungo.",
        "comment": "Con te, una domanda qualsiasi può trasformarsi in una teoria inaspettata sulla vita. Anche se il caffè si raffredda, non molli l'argomento prima di aver girato l'idea un'altra volta. E se qualcuno non è d'accordo, tanto meglio: è lì che diventa interessante."
      },
      "ja": {
        "nickname": "自称哲学者",
        "tagline": "気軽な雑談が、いつの間にか深い話になっている。",
        "comment": "何気ない質問が、いつの間にか人生についての意外な持論に変わる。コーヒーが冷めても、もう一度考えを転がしてみるまで話を終わらせない。誰かが反論してくれたら、むしろ面白くなるのはそこからだ。"
      },
      "ko": {
        "nickname": "자칭 철학자",
        "tagline": "가벼운 잡담이 어느새 깊은 이야기가 돼요.",
        "comment": "별생각 없이 던진 질문이 어느새 인생에 대한 의외의 지론으로 바뀝니다. 커피가 식어도 생각을 한 번 더 굴려보기 전에는 이야기를 끝내지 않아요. 누군가 반박해 주면 오히려 그때부터 더 재미있어집니다."
      },
      "zh": {
        "nickname": "自封哲學家",
        "tagline": "隨口閒聊，不知不覺就聊到很深。",
        "comment": "一個隨口的問題，常常變成一套關於人生的奇怪見解。咖啡涼了也沒關係，想法沒有再翻一次，你是不會收尾的。要是有人願意反駁，反而從那裡開始更有意思。"
      },
      "ru": {
        "nickname": "Домашний философ",
        "tagline": "Лёгкая болтовня незаметно уходит вглубь.",
        "comment": "Случайный вопрос превращается в неожиданную теорию о жизни. Кофе успевает остыть, но ты не закончишь, пока не повернёшь мысль ещё раз. А если кто-то начнёт спорить, самое интересное только начинается."
      }
    }
  },
  {
    "id": "socially_attuned",
    "semantic": "Pays attention to conversational timing and others comfort.",
    "emoji": "📡",
    "color": "#0FAFAF",
    "traits": { "humor": "warm", "reply": "supportive", "timeline": "gets_everyone_in" },
    "legacy_names": [
      "Vibe Radarı",
      "Vibe Radar"
    ],
    "locales": {
      "tr": {
        "nickname": "Ortamı Okuyan",
        "tagline": "Ne söyleyeceğin kadar ne zaman söyleyeceğini de önemsiyorsun.",
        "comment": "Bir sohbette yalnız söylenenlere değil, kimin söze giremediğine de dikkat ediyorsun. Bazen bir soru sormanın, bazen de konuyu değiştirmenin daha iyi geldiğini düşünüyorsun. Herkes rahatça konuşabildiğinde sen de daha çok keyif alıyorsun."
      },
      "en": {
        "nickname": "Reads the Room",
        "tagline": "You know when a change of subject would help.",
        "comment": "You notice when someone has been trying to join in and make a little space for them. You are just as happy to change the subject when a joke has run its course. A good conversation, to you, is one where nobody has to fight to be heard."
      },
      "es": {
        "nickname": "Lector del Ambiente",
        "tagline": "Sabes cuándo un cambio de tema le hace bien a todos.",
        "comment": "En una conversación no solo escuchas lo que se dice: también notas quién no ha podido hablar. A veces haces una pregunta y a veces cambias de tema, según lo que pida el momento. Disfrutas más cuando nadie tiene que pelear por ser escuchado."
      },
      "pt": {
        "nickname": "Sente o Clima",
        "tagline": "Você sabe a hora certa de mudar de assunto.",
        "comment": "Numa conversa, você repara não só no que é dito, mas em quem ainda não conseguiu falar. Às vezes faz uma pergunta, às vezes muda de assunto, conforme o momento pede. Você aproveita mais quando ninguém precisa disputar espaço para ser ouvido."
      },
      "ar": {
        "nickname": "يعرف متى يتكلم",
        "tagline": "يهمك متى تقول الشيء بقدر ما يهمك ماذا تقول.",
        "comment": "في أي حديث لا تنتبه لما يقال فقط، بل لمن لم يجد فرصة ليتكلم. أحيانًا تطرح سؤالًا، وأحيانًا تغير الموضوع، بحسب ما تحتاجه اللحظة. وتستمتع أكثر حين لا يضطر أحد إلى المنافسة ليسمعه الآخرون."
      },
      "fr": {
        "nickname": "Parle au Bon Moment",
        "tagline": "Savoir quand parler compte autant que savoir quoi dire.",
        "comment": "Dans une conversation, tu remarques non seulement ce qui se dit, mais aussi qui n'a pas encore pu parler. Parfois tu poses une question, parfois tu changes de sujet, selon ce que le moment demande. Tu t'amuses davantage quand personne n'a besoin de se battre pour être entendu."
      },
      "de": {
        "nickname": "Gespür für den Moment",
        "tagline": "Wann du etwas sagst, ist dir so wichtig wie das Was.",
        "comment": "Im Gespräch achtest du nicht nur darauf, was gesagt wird, sondern auch darauf, wer noch nicht zu Wort gekommen ist. Mal stellst du eine Frage, mal wechselst du das Thema, je nachdem, was der Moment braucht. Am meisten Spaß hast du, wenn niemand um Aufmerksamkeit kämpfen muss."
      },
      "it": {
        "nickname": "Tempismo Perfetto",
        "tagline": "Sai quando parlare, non solo cosa dire.",
        "comment": "In una conversazione noti non solo quello che si dice, ma anche chi non è ancora riuscito a parlare. A volte fai una domanda, a volte cambi argomento, a seconda dell'atmosfera del momento. Ti diverti di più quando nessuno deve lottare per farsi ascoltare."
      },
      "ja": {
        "nickname": "空気が読める人",
        "tagline": "何を言うかと同じくらい、いつ言うかを大事にしている。",
        "comment": "会話では、話している内容だけでなく、まだ話せていない人にも目を向けている。質問を振ったり話題を変えたり、その場に合わせて動ける。誰もが無理せず話せる空気になると、自分もいちばん楽しめる。"
      },
      "ko": {
        "nickname": "눈치 백단",
        "tagline": "무엇을 말하는지만큼 언제 말하는지를 중요하게 생각해요.",
        "comment": "대화에서는 오가는 말뿐 아니라 아직 말하지 못한 사람도 함께 살펴요. 질문을 건네거나 화제를 돌리며 그 자리에 맞게 움직이죠. 누구나 부담 없이 말할 수 있는 분위기가 되면 스스로도 가장 즐거워집니다."
      },
      "zh": {
        "nickname": "很會看氣氛",
        "tagline": "說什麼重要，什麼時候說也一樣重要。",
        "comment": "聊天的時候，你注意的不只是說出口的話，還有那個一直沒開口的人。你會遞一個問題，或把話題帶開，看場合調整。當每個人都能自在說話，你自己也最放鬆。"
      },
      "ru": {
        "nickname": "Чувствует момент",
        "tagline": "Что сказать — важно, но когда сказать, не менее важно.",
        "comment": "В разговоре ты замечаешь не только сказанное, но и того, кто ещё молчит. Можешь задать вопрос или перевести тему — смотришь по обстановке. Когда всем легко говорить, тебе самому становится интереснее."
      }
    }
  },
  {
    "id": "conversation_mediator",
    "semantic": "Helps people understand differing views without escalating disagreement.",
    "emoji": "🧯",
    "color": "#FF6B57",
    "traits": { "humor": "warm", "reply": "measured", "timeline": "calms_threads" },
    "legacy_names": [
      "Drama İtfaiyesi",
      "Drama Fire Crew"
    ],
    "locales": {
      "tr": {
        "nickname": "Masadaki Hakem",
        "tagline": "Haklı çıkmaktan önce anlaşmayı önemsiyorsun.",
        "comment": "İki kişi birbirini dinlemeyi bırakınca önce ne demek istediklerini anlamaya çalışıyorsun. Birine hak vermek için ötekini susturmak gerektiğini düşünmüyorsun. Tartışma sonunda herkes biraz daha sakin konuşabiliyorsa senin için iyi bir sonuç."
      },
      "en": {
        "nickname": "Voice of Reason",
        "tagline": "You can disagree without making it personal.",
        "comment": "When a disagreement gets heated, you try to separate the actual point from the irritation. You can acknowledge a fair argument without choosing a side in everything. You are happiest when people leave understanding each other a little better."
      },
      "es": {
        "nickname": "La Voz Sensata",
        "tagline": "Puedes estar en desacuerdo sin convertirlo en algo personal.",
        "comment": "Cuando una discusión se calienta, separas el argumento real del enfado. Puedes reconocer un buen punto sin casarte con ningún bando. Para ti, el mejor final es que todos se vayan entendiéndose un poco mejor."
      },
      "pt": {
        "nickname": "Bom Senso em Pessoa",
        "tagline": "Dá para discordar sem levar para o lado pessoal.",
        "comment": "Quando a discussão esquenta, você separa o argumento de verdade da irritação do momento. Consegue reconhecer um bom ponto sem precisar escolher um lado em tudo. Para você, o melhor final é todo mundo saindo se entendendo um pouco melhor."
      },
      "ar": {
        "nickname": "حكيم المجلس",
        "tagline": "تختلف مع الآخرين دون أن تجعل الأمر شخصيًا.",
        "comment": "حين يحتد النقاش، تفصل الفكرة الحقيقية عن الانفعال اللحظي. تستطيع أن تعترف بالرأي الصائب دون أن تنحاز لطرف في كل شيء. وأفضل نهاية عندك أن يخرج الجميع وقد فهموا بعضهم أكثر."
      },
      "fr": {
        "nickname": "Garde la Tête Froide",
        "tagline": "Tu peux être en désaccord sans en faire une affaire personnelle.",
        "comment": "Quand le ton monte, tu sépares le vrai argument de l'agacement du moment. Tu sais reconnaître un bon point sans devoir choisir un camp sur tout. Pour toi, la meilleure fin, c'est quand chacun repart en se comprenant un peu mieux."
      },
      "de": {
        "nickname": "Ruhepol der Runde",
        "tagline": "Du kannst widersprechen, ohne es persönlich zu machen.",
        "comment": "Wenn eine Diskussion hitzig wird, trennst du das eigentliche Argument vom Ärger des Moments. Du erkennst einen guten Punkt an, ohne dich überall auf eine Seite schlagen zu müssen. Am liebsten ist es dir, wenn am Ende alle einander ein bisschen besser verstehen."
      },
      "it": {
        "nickname": "Mette Tutti d'Accordo",
        "tagline": "Puoi non essere d'accordo senza farne una questione personale.",
        "comment": "Quando la discussione si scalda, separi l'argomento vero dal nervosismo del momento. Sai riconoscere un buon punto senza dover per forza schierarti su tutto. Per te il finale migliore è quando ognuno se ne va capendo un po' meglio gli altri."
      },
      "ja": {
        "nickname": "まとめ役",
        "tagline": "意見が違っても、けんかにはしない。",
        "comment": "議論が熱くなってきたら、本当の論点とその場の苛立ちを切り分ける。どちらかの味方をしなくても、筋の通った意見はちゃんと認められる。最後にみんなが少しでもわかり合えたら、それがいちばんの結末だ。"
      },
      "ko": {
        "nickname": "중재 담당",
        "tagline": "의견이 달라도 싸움으로는 가지 않아요.",
        "comment": "논쟁이 뜨거워지면 진짜 쟁점과 그 자리의 짜증을 먼저 갈라놓아요. 어느 한쪽 편을 들지 않아도 말이 되는 의견은 제대로 인정해 주죠. 마지막에 모두가 조금이라도 서로를 이해하게 되면 그게 가장 좋은 결말입니다."
      },
      "zh": {
        "nickname": "負責打圓場",
        "tagline": "意見不同，也不會真的吵起來。",
        "comment": "討論一熱起來，你會先把真正的爭點跟當下的情緒分開。不站任何一邊，也能好好承認講得有道理的那句話。最後大家能多懂彼此一點，就是最好的結局。"
      },
      "ru": {
        "nickname": "Сглаживает углы",
        "tagline": "Разные мнения — ещё не повод для ссоры.",
        "comment": "Когда спор накаляется, ты первым делом отделяешь суть от раздражения. Не вставая ни на чью сторону, ты умеешь признать разумный аргумент. Если в конце все стали понимать друг друга чуть лучше, это лучший финал."
      }
    }
  },
  {
    "id": "deliberate_overthinker",
    "semantic": "Reconsiders small choices and rehearses possible interpretations.",
    "emoji": "🧠",
    "color": "#7C4DFF",
    "traits": { "humor": "dry", "reply": "measured", "timeline": "reads_first" },
    "legacy_names": [
      "Fazla Düşünen",
      "Certified Overthinker"
    ],
    "locales": {
      "tr": {
        "nickname": "Fazla Düşünen",
        "tagline": "Göndermeden önce bir kez daha okuyorsun.",
        "comment": "Kısa bir mesaj yazarken noktanın fazla ciddi, ünlemin fazla hevesli olduğuna karar verebiliyorsun. Göndermeden önce karşındakinin nasıl okuyacağını birkaç kez düşünüyorsun. Sonunda ilk yazdığını seçince kendine biraz gülüyorsun."
      },
      "en": {
        "nickname": "Second Guesser",
        "tagline": "Even a short reply deserves another look.",
        "comment": "You can have a perfectly good reply ready and still wonder whether it sounds right. A different word seems worth considering, then perhaps the original was better. Sending the first version after all that is a familiar little victory."
      },
      "es": {
        "nickname": "Lo Piensa Dos Veces",
        "tagline": "Hasta una respuesta corta merece otra lectura.",
        "comment": "Escribes un mensaje corto y decides que el punto suena demasiado serio y el signo de exclamación demasiado entusiasta. Antes de enviarlo, imaginas varias veces cómo lo leerá la otra persona. Cuando al final eliges tu primera versión, te ríes un poco de ti."
      },
      "pt": {
        "nickname": "Relê Antes de Mandar",
        "tagline": "Toda mensagem passa por uma revisão antes de sair.",
        "comment": "Você escreve uma mensagem curta e acha que o ponto final ficou sério demais e a exclamação animada demais. Antes de enviar, imagina várias vezes como a outra pessoa vai ler. No fim, quando manda a primeira versão, acaba rindo da própria indecisão."
      },
      "ar": {
        "nickname": "يقرأ رسالته مرتين",
        "tagline": "حتى الرد القصير يستحق مراجعة أخيرة.",
        "comment": "تكتب رسالة قصيرة ثم تشعر أن النقطة جادة أكثر من اللازم وعلامة التعجب متحمسة أكثر من اللازم. قبل الإرسال تتخيل مرات عدة كيف سيقرؤها الطرف الآخر. وفي النهاية ترسل النسخة الأولى وتضحك قليلًا من ترددك."
      },
      "fr": {
        "nickname": "Jamais Sans Relire",
        "tagline": "Aucun message ne part sans un dernier coup d'œil.",
        "comment": "Tu écris un message tout court, puis tu trouves le point trop sec et le point d'exclamation trop enthousiaste. Avant d'envoyer, tu imagines plusieurs fois comment l'autre va le lire. Au final, tu envoies la première version et tu ris un peu de ton hésitation."
      },
      "de": {
        "nickname": "Liest lieber nochmal",
        "tagline": "Keine Nachricht geht raus ohne einen letzten Blick.",
        "comment": "Du schreibst eine ganz kurze Nachricht und findest den Punkt plötzlich zu streng und das Ausrufezeichen zu begeistert. Vor dem Absenden stellst du dir mehrmals vor, wie die andere Person sie liest. Am Ende schickst du doch die erste Version und musst ein bisschen über dich selbst lachen."
      },
      "it": {
        "nickname": "Rilegge Sempre",
        "tagline": "Nessun messaggio parte senza un'ultima occhiata.",
        "comment": "Scrivi un messaggio brevissimo e all'improvviso il punto ti sembra troppo freddo e il punto esclamativo troppo entusiasta. Prima di inviarlo immagini più volte come lo leggerà l'altra persona. Alla fine mandi la prima versione e ridi un po' della tua indecisione."
      },
      "ja": {
        "nickname": "読み返し派",
        "tagline": "短い返事でも、送る前にもう一度見直す。",
        "comment": "ほんの短いメッセージでも、句点は冷たすぎるかな、ビックリマークは元気すぎるかなと考えてしまう。送る前に、相手がどう読むかを何度も想像する。結局いちばん最初の文を送って、自分の迷いにちょっと笑ってしまう。"
      },
      "ko": {
        "nickname": "다시 읽는 사람",
        "tagline": "짧은 답장도 보내기 전에 한 번 더 확인해요.",
        "comment": "아주 짧은 메시지에도 마침표는 너무 차가운가 느낌표는 너무 들뜬가를 고민하게 돼요. 보내기 전에 상대가 어떻게 읽을지를 몇 번이나 그려봅니다. 결국 맨 처음 쓴 문장을 보내고 혼자 고민한 게 웃겨서 피식 웃어요."
      },
      "zh": {
        "nickname": "送出前再看一次",
        "tagline": "再短的回覆，送出前都要再確認一次。",
        "comment": "就算只是一句短訊息，你也會想句號會不會太冷、驚嘆號會不會太興奮。送出之前，你在腦中排練過對方會怎麼讀。最後還是送出最早寫好的那一句，然後笑自己想太多。"
      },
      "ru": {
        "nickname": "Перечитывает перед отправкой",
        "tagline": "Даже короткий ответ проверяешь ещё раз.",
        "comment": "Даже в одной строке думаешь, не слишком ли холодно выглядит точка и не слишком ли громко звучит восклицательный знак. Перед отправкой прокручиваешь в голове, как это прочитают. В итоге отправляешь первый вариант и смеёшься над собой."
      }
    }
  },
  {
    "id": "understated_presence",
    "semantic": "Leaves a memorable impression without seeking attention.",
    "emoji": "🕶️",
    "color": "#2D3445",
    "traits": { "humor": "dry", "reply": "selective", "timeline": "reads_first" },
    "legacy_names": [
      "Gizli Başrol",
      "Lowkey Main Character"
    ],
    "locales": {
      "tr": {
        "nickname": "Gizli Başrol",
        "tagline": "Çok konuşmadan da akılda kalabiliyorsun.",
        "comment": "Kalabalıkta her boşluğu konuşarak doldurma ihtiyacı duymuyorsun. Söze girdiğinde kısa ama akılda kalan bir şey söylemek sana daha yakın geliyor. Buluşma bittikten sonra birinin senin sözünü hatırlaması hoşuna gidiyor."
      },
      "en": {
        "nickname": "Quiet Charmer",
        "tagline": "You do not need to be the loudest person there.",
        "comment": "You are comfortable listening while other people take their turn. When you do speak, a thoughtful remark or a well-timed joke is usually enough. People tend to remember how easy it felt to talk to you."
      },
      "es": {
        "nickname": "Encanto Discreto",
        "tagline": "No necesitas ser la persona más ruidosa del lugar.",
        "comment": "No sientes la necesidad de llenar cada silencio con palabras. Cuando hablas, prefieres decir algo corto que se quede en la memoria. Te gusta que, al terminar la reunión, alguien recuerde justo esa frase tuya."
      },
      "pt": {
        "nickname": "De Poucas Palavras",
        "tagline": "Você não precisa ser a voz mais alta da sala.",
        "comment": "Você não sente necessidade de preencher cada silêncio. Quando fala, prefere dizer algo curto que fica na cabeça das pessoas. Gosta quando, depois do encontro, alguém lembra justamente aquela sua frase."
      },
      "ar": {
        "nickname": "حضور بلا ضجيج",
        "tagline": "لا تحتاج أن تكون الصوت الأعلى في المكان.",
        "comment": "لا تشعر بحاجة إلى ملء كل لحظة صمت بالكلام. وحين تتحدث، تفضل جملة قصيرة تبقى في ذاكرة الآخرين. ويسعدك أن يتذكر أحدهم عبارتك تلك بعد انتهاء اللقاء."
      },
      "fr": {
        "nickname": "Discret mais Marquant",
        "tagline": "Pas besoin d'être la voix la plus forte de la pièce.",
        "comment": "Tu n'éprouves pas le besoin de remplir chaque silence. Quand tu prends la parole, tu préfères une phrase courte qui reste en tête. Ça te plaît quand, après la soirée, quelqu'un se souvient justement de ta remarque."
      },
      "de": {
        "nickname": "Leise und einprägsam",
        "tagline": "Du musst nicht die lauteste Stimme im Raum sein.",
        "comment": "Du hast nicht das Bedürfnis, jede Stille mit Worten zu füllen. Wenn du etwas sagst, dann lieber einen kurzen Satz, der hängen bleibt. Es freut dich, wenn sich nach dem Treffen jemand genau an diese Bemerkung erinnert."
      },
      "it": {
        "nickname": "Presenza Discreta",
        "tagline": "Non serve essere la voce più forte della stanza.",
        "comment": "Non senti il bisogno di riempire ogni silenzio. Quando parli, preferisci una frase breve che resta in testa. Ti fa piacere quando, dopo la serata, qualcuno si ricorda proprio quella tua battuta."
      },
      "ja": {
        "nickname": "静かな存在感",
        "tagline": "いちばん声が大きくなくても、ちゃんと印象に残る。",
        "comment": "沈黙をすべて言葉で埋めなくても平気だ。話すときは、短くても心に残るひと言を選ぶ。集まりが終わったあと、誰かがそのひと言を覚えていてくれるとうれしい。"
      },
      "ko": {
        "nickname": "조용한 존재감",
        "tagline": "가장 목소리가 크지 않아도 기억에는 남아요.",
        "comment": "침묵을 전부 말로 채우지 않아도 괜찮아요. 입을 열 때는 짧아도 마음에 남는 한마디를 고릅니다. 모임이 끝난 뒤 누군가 그 한마디를 기억해 주면 그걸로 기쁘죠."
      },
      "zh": {
        "nickname": "安靜的存在感",
        "tagline": "聲音不是最大的，卻讓人記得住。",
        "comment": "你不需要把每一段沉默都用話填滿。真的開口時，就算只有一句，也會留在別人心裡。聚會散場以後，有人還記得那句話，你就覺得值得了。"
      },
      "ru": {
        "nickname": "Тихое присутствие",
        "tagline": "Голос не самый громкий, но запоминается.",
        "comment": "Тебе не нужно заполнять словами каждую паузу. Когда говоришь, выбираешь короткую фразу, которая остаётся. Если после встречи кто-то её вспомнит, этого уже достаточно."
      }
    }
  },
  {
    "id": "social_catalyst",
    "semantic": "Encourages participation and adds energy to social gatherings.",
    "emoji": "🪩",
    "color": "#E75DAA",
    "traits": { "humor": "playful", "reply": "quick", "timeline": "gets_everyone_in" },
    "legacy_names": [
      "Ortam Güncellemesi",
      "Room Update"
    ],
    "locales": {
      "tr": {
        "nickname": "Ortamı Canlandıran",
        "tagline": "Birlikte iyi vakit geçirmek için ilk adımı atıyorsun.",
        "comment": "Buluşma durgunlaşınca küçük bir oyun ya da herkesin katılabileceği bir konu öneriyorsun. İnsanları zorlamadan sohbete dahil etmek hoşuna gidiyor. Planın kusursuz olmasından çok, kimsenin sıkılmamasını önemsiyorsun."
      },
      "en": {
        "nickname": "Life of the Party",
        "tagline": "You make joining in feel easy.",
        "comment": "You are often the first to suggest something everyone can join in with. You enjoy getting people laughing together without putting anyone on the spot. The plan can change completely as long as people are having a good time."
      },
      "es": {
        "nickname": "Alma de la Fiesta",
        "tagline": "Haces que unirse al plan sea fácil.",
        "comment": "Cuando la reunión se apaga, propones un juego o un tema en el que todos pueden entrar. Te gusta sumar a la gente a la conversación sin poner a nadie en aprietos. El plan puede cambiar mil veces mientras nadie se aburra."
      },
      "pt": {
        "nickname": "Anima Qualquer Roda",
        "tagline": "Com você, entrar na brincadeira fica fácil.",
        "comment": "Quando o encontro esfria, você sugere um jogo ou um assunto em que todo mundo pode entrar. Gosta de incluir as pessoas na conversa sem deixar ninguém sem graça. O plano pode mudar mil vezes, desde que ninguém fique entediado."
      },
      "ar": {
        "nickname": "روح الجلسة",
        "tagline": "معك يصبح الانضمام إلى المرح سهلًا.",
        "comment": "إذا فترت الجلسة، تقترح لعبة أو موضوعًا يستطيع الجميع أن يشاركوا فيه. تحب أن تدخل الناس في الحديث دون أن تحرج أحدًا. وقد تتغير الخطة ألف مرة، المهم ألا يشعر أحد بالملل."
      },
      "fr": {
        "nickname": "Vrai Boute-en-train",
        "tagline": "Avec toi, rejoindre le mouvement devient facile.",
        "comment": "Quand l'ambiance retombe, tu proposes un jeu ou un sujet où tout le monde peut participer. Tu aimes inclure les gens dans la conversation sans mettre personne mal à l'aise. Le programme peut changer mille fois, tant que personne ne s'ennuie."
      },
      "de": {
        "nickname": "Sorgt für Stimmung",
        "tagline": "Überall, wo du auftauchst, kommt Stimmung auf.",
        "comment": "Wenn die Stimmung abflacht, schlägst du ein Spiel oder ein Thema vor, bei dem alle mitreden können. Du holst Leute ins Gespräch, ohne jemanden in Verlegenheit zu bringen. Der Plan darf sich tausendmal ändern, solange sich niemand langweilt."
      },
      "it": {
        "nickname": "Porta il Buonumore",
        "tagline": "Con te unirsi al gruppo diventa facilissimo.",
        "comment": "Quando l'atmosfera si spegne, proponi un gioco o un argomento in cui tutti possono dire la loro. Ti piace coinvolgere le persone senza mettere nessuno in imbarazzo. Il programma può cambiare mille volte, purché nessuno si annoi."
      },
      "ja": {
        "nickname": "盛り上げ役",
        "tagline": "あなたがいると、輪に入るのが簡単になる。",
        "comment": "場が静かになってきたら、みんなが参加できるゲームや話題を持ち出す。誰かに気まずい思いをさせずに、自然と会話に巻き込むのが得意だ。予定が何度変わっても、誰も退屈していなければそれでいい。"
      },
      "ko": {
        "nickname": "흥 담당",
        "tagline": "당신이 있으면 사람들 사이에 끼기가 쉬워져요.",
        "comment": "자리가 조용해지면 다 같이 할 수 있는 이야기나 놀이를 꺼내요. 누구도 어색하지 않게 자연스럽게 대화로 끌어들이는 데 익숙하죠. 계획이 몇 번 바뀌어도 아무도 지루하지 않으면 그걸로 충분합니다."
      },
      "zh": {
        "nickname": "炒熱氣氛的人",
        "tagline": "有你在，大家比較容易加入話題。",
        "comment": "場面一安靜下來，你就會拿出大家都能一起玩的話題或遊戲。你很會把人自然帶進對話，又不會讓誰覺得尷尬。就算計畫改了好幾次，只要沒有人無聊，那就夠了。"
      },
      "ru": {
        "nickname": "Заводит компанию",
        "tagline": "С тобой проще влиться в общий разговор.",
        "comment": "Как только становится тихо, ты достаёшь тему или игру, в которую могут включиться все. У тебя получается втянуть человека в разговор, не поставив его в неловкое положение. Планы могут поменяться трижды — лишь бы никому не было скучно."
      }
    }
  },
  {
    "id": "curious_listener",
    "semantic": "Uses sincere follow-up questions to invite richer conversations.",
    "emoji": "🧲",
    "color": "#FF7A45",
    "traits": { "humor": "warm", "reply": "curious", "timeline": "goes_deep" },
    "legacy_names": [
      "Konu Mıknatısı",
      "Topic Magnet"
    ],
    "locales": {
      "tr": {
        "nickname": "Lafı Açan",
        "tagline": "İyi bir soruyla sohbeti derinleştiriyorsun.",
        "comment": "Birine gününün nasıl geçtiğini sorunca cevabı gerçekten dinlemek istiyorsun. Küçük bir ayrıntı ilgini çekiyor ve onu biraz daha anlatmasını istiyorsun. Seninle kısa bir kahvenin uzaması çoğu zaman bu yüzden."
      },
      "en": {
        "nickname": "Good Listener",
        "tagline": "You remember to ask what happened next.",
        "comment": "You do not ask a question just to wait for your own turn to speak. A small detail catches your interest and you want to hear the rest. People often find themselves telling you a story they had not planned to share."
      },
      "es": {
        "nickname": "Sabe Escuchar",
        "tagline": "Siempre recuerdas preguntar cómo terminó la historia.",
        "comment": "Cuando preguntas cómo le fue el día a alguien, de verdad quieres escuchar la respuesta. Un pequeño detalle te llama la atención y pides que te lo cuenten mejor. Por eso un café corto contigo casi siempre se alarga."
      },
      "pt": {
        "nickname": "Escuta de Verdade",
        "tagline": "Com você, até um detalhe pequeno vira conversa.",
        "comment": "Quando pergunta como foi o dia de alguém, você quer mesmo ouvir a resposta. Um detalhe pequeno chama sua atenção e você pede para contarem mais. Por isso um cafezinho rápido com você quase sempre vira uma conversa longa."
      },
      "ar": {
        "nickname": "أذن صاغية",
        "tagline": "التفاصيل الصغيرة تتحول معك إلى حديث طويل.",
        "comment": "حين تسأل أحدهم عن يومه، فأنت تريد فعلًا أن تسمع الجواب. تلفت انتباهك تفصيلة صغيرة فتطلب أن يحكي لك المزيد. لهذا يتحول فنجان قهوة سريع معك غالبًا إلى حديث طويل."
      },
      "fr": {
        "nickname": "Toujours à l'Écoute",
        "tagline": "Avec toi, le moindre détail devient une vraie conversation.",
        "comment": "Quand tu demandes à quelqu'un comment s'est passée sa journée, tu veux vraiment entendre la réponse. Un petit détail attire ton attention et tu demandes à en savoir plus. C'est pour ça qu'un café rapide avec toi finit souvent en longue discussion."
      },
      "de": {
        "nickname": "Ganz Ohr",
        "tagline": "Öfter als gedacht wird aus einer Kleinigkeit ein langes Gespräch.",
        "comment": "Wenn du jemanden fragst, wie der Tag war, willst du die Antwort wirklich hören. Ein kleines Detail weckt dein Interesse, und du bittest darum, mehr zu erzählen. Deshalb wird aus einem schnellen Kaffee mit dir oft ein ausgedehnter Plausch."
      },
      "it": {
        "nickname": "Sempre Tutt'Orecchi",
        "tagline": "Con te anche un piccolo dettaglio diventa una bella chiacchierata.",
        "comment": "Quando chiedi a qualcuno com'è andata la giornata, vuoi davvero sentire la risposta. Un piccolo dettaglio attira la tua attenzione e chiedi di raccontarti il resto. Per questo un caffè veloce con te spesso diventa una lunga chiacchierata."
      },
      "ja": {
        "nickname": "聞き上手",
        "tagline": "小さな話も、あなたと話すと長い会話になる。",
        "comment": "誰かに今日どうだったかを聞くとき、本当にその答えを聞きたいと思っている。ちょっとした話に興味を引かれて、「それで？」と続きを聞いてしまう。だから、あなたとのちょっとしたお茶は、たいてい長話になる。"
      },
      "ko": {
        "nickname": "잘 듣는 사람",
        "tagline": "사소한 이야기도 당신과 하면 길어져요.",
        "comment": "오늘 어땠냐고 물을 때 정말로 그 대답이 궁금해서 물어요. 작은 이야기에도 관심이 생겨서 ‘그래서요?’ 하고 다음을 듣게 되죠. 그래서 당신과의 짧은 차 한잔은 대개 긴 수다가 됩니다."
      },
      "zh": {
        "nickname": "很會聽人說話",
        "tagline": "再小的事，跟你講都會變成長篇。",
        "comment": "你問別人今天過得怎麼樣的時候，是真的想聽那個答案。一件小事也能讓你有興趣，接著問一句「然後呢？」。所以跟你喝杯茶，通常都會變成一場長談。"
      },
      "ru": {
        "nickname": "Умеет слушать",
        "tagline": "Даже мелочь в разговоре с тобой становится историей.",
        "comment": "Когда спрашиваешь, как прошёл день, тебе правда интересен ответ. Маленькая деталь цепляет, и ты спрашиваешь: «И что дальше?». Поэтому короткая чашка чая с тобой обычно превращается в долгий разговор."
      }
    }
  },
  {
    "id": "playful_storyteller",
    "semantic": "Enjoys expressive storytelling and well-timed wordplay.",
    "emoji": "🪄",
    "color": "#19B8B8",
    "traits": { "humor": "witty", "reply": "teasing", "timeline": "tells_stories" },
    "legacy_names": [
      "Cümle Cambazı",
      "Sentence Acrobat"
    ],
    "locales": {
      "tr": {
        "nickname": "Nüktedan Anlatıcı",
        "tagline": "Bir olayı anlatış biçimin de hikâyenin parçası.",
        "comment": "Sıradan bir olayı anlatırken en komik ayrıntıyı sona saklamayı seviyorsun. Aynı hikâyeyi başka biri anlatsa senin seçtiğin kelimeler eksik kalırmış gibi geliyor. İnsanların yalnız olaya değil, anlatışına da gülmesi hoşuna gidiyor."
      },
      "en": {
        "nickname": "Way with Words",
        "tagline": "You know which detail makes the story.",
        "comment": "You know when to leave a detail out and when to bring it back at exactly the right moment. An ordinary mishap becomes worth retelling once you have found the right phrasing. Half the pleasure is hearing someone repeat your best line later."
      },
      "es": {
        "nickname": "Narrador Nato",
        "tagline": "Sabes qué detalle hace buena la historia.",
        "comment": "Sabes cuándo guardarte un detalle y cuándo soltarlo en el momento exacto. Un tropiezo cualquiera se vuelve digno de contar cuando encuentras la frase justa. La mitad del gusto es oír a alguien repetir tu mejor línea después."
      },
      "pt": {
        "nickname": "Bom de Papo",
        "tagline": "Você sabe qual detalhe faz a história funcionar.",
        "comment": "Você guarda o detalhe mais engraçado para o final e sabe exatamente quando soltá-lo. Um contratempo qualquer vira uma história que todo mundo quer ouvir de novo. O melhor é quando alguém repete sua frase na conversa seguinte."
      },
      "ar": {
        "nickname": "يجيد رواية القصص",
        "tagline": "تعرف أي تفصيل يجعل القصة ممتعة.",
        "comment": "تحتفظ بأطرف تفصيلة للنهاية وتعرف تمامًا متى تكشفها. موقف عادي يتحول معك إلى قصة يريد الجميع سماعها مرة أخرى. وأجمل ما في الأمر أن تسمع أحدهم يكرر جملتك في جلسة أخرى."
      },
      "fr": {
        "nickname": "Sens de la Formule",
        "tagline": "Tu sais quel détail rend une histoire vraiment drôle.",
        "comment": "Tu gardes le détail le plus drôle pour la fin et tu sais exactement quand le sortir. Avec ton goût pour les mots justes, une mésaventure banale devient une histoire qu'on redemande. Le meilleur, c'est d'entendre quelqu'un répéter ta phrase à la soirée suivante."
      },
      "de": {
        "nickname": "Erzählt mit Pointe",
        "tagline": "Du weißt, welches Detail eine Geschichte lustig macht.",
        "comment": "Das lustigste Detail hebst du dir für den Schluss auf und weißt genau, wann du es bringst. Mit den richtigen Worten wird aus einem kleinen Missgeschick eine Geschichte, die alle noch einmal hören wollen. Am schönsten ist es, wenn später jemand deinen besten Satz wiederholt."
      },
      "it": {
        "nickname": "Sa Raccontarla",
        "tagline": "Sai quale dettaglio rende divertente una storia.",
        "comment": "Tieni il dettaglio più divertente per la fine e sai esattamente quando tirarlo fuori. Con le parole giuste, un piccolo inconveniente diventa una storia che tutti vogliono risentire. Il bello è sentire qualcuno ripetere la tua battuta migliore la sera dopo."
      },
      "ja": {
        "nickname": "オチ担当",
        "tagline": "どこを話せば面白くなるか、ちゃんとわかっている。",
        "comment": "いちばん面白いところは最後まで取っておき、出すタイミングを心得ている。ありふれた失敗談も、言葉選びひとつで何度でも聞きたい話になる。あとで誰かがあなたの『決めゼリフ』をまねしていたら、それが最高のほめ言葉だ。"
      },
      "ko": {
        "nickname": "이야기꾼",
        "tagline": "어디서 풀어야 재미있는지 정확히 알아요.",
        "comment": "가장 재미있는 부분은 끝까지 아껴 두고 꺼낼 타이밍을 압니다. 흔한 실패담도 단어 하나만 바꾸면 몇 번이고 다시 듣고 싶은 이야기가 되죠. 나중에 누군가 당신의 ‘그 대사’를 따라 하고 있다면 그게 최고의 칭찬이에요."
      },
      "zh": {
        "nickname": "很會說故事",
        "tagline": "哪裡講出來最好笑，你抓得很準。",
        "comment": "最有趣的部分你會留到最後，也知道什麼時候丟出來。再普通的糗事，換個說法就變成想再聽一次的故事。哪天有人開始學你的那句台詞，那就是最高的稱讚。"
      },
      "ru": {
        "nickname": "Хороший рассказчик",
        "tagline": "Точно знаешь, где история становится смешной.",
        "comment": "Самое интересное ты приберегаешь напоследок и хорошо чувствуешь момент. Обычная неловкая история от одного удачного слова становится той, что просят повторить. Если потом кто-то начинает цитировать твою фразу, это лучшая похвала."
      }
    }
  }
];

// Compatibility view for the existing result/card contract.
var FUN_CARD_POOL = FUN_PERSONAS.map(function(persona) {
  var card = { id:persona.id, emoji:persona.emoji, color:persona.color, nickname:{}, desc:{}, comments:{} };
  Object.keys(persona.locales).forEach(function(lang) {
    card.nickname[lang]=persona.locales[lang].nickname;
    card.desc[lang]=persona.locales[lang].tagline;
    card.comments[lang]=persona.locales[lang].comment;
  });
  return card;
});

function funModeComment(card, mode, lang) {
  return card.comments[lang] || "";
}

function funIdentityPersona(res) {
  var id=res.persona_id || (res.card && res.card.persona_id);
  if (id) return FUN_CARD_POOL.find(function(card) { return card.id===id; });
  var nickname=res.nickname || (res.card && res.card.nickname) || (res.archetype && res.archetype.name);
  var names=typeof nickname==="string" ? [nickname] : Object.values(nickname || {});
  var persona=FUN_PERSONAS.find(function(entry) {
    var known=entry.legacy_names.concat(Object.values(entry.locales).map(function(copy) { return copy.nickname; }));
    return names.some(function(name) { return known.indexOf(name)>=0; });
  });
  return persona && FUN_CARD_POOL.find(function(card) { return card.id===persona.id; });
}

function funIdentityComment(res, lang) {
  var card=funIdentityPersona(res);
  return card ? funModeComment(card,res.mode,lang) : "";
}

function analyzeFunHandle(rawHandle, mode, rerollNonce) {
  var handle = normHandle(rawHandle);
  var actualMode = mode || "mirror";
  var nonce = Number(rerollNonce || 0);
  var seed = xhash("fun•" + actualMode + "•" + handle + "•" + nonce);
  var card = FUN_CARD_POOL[seed % FUN_CARD_POOL.length];
  var comment = {
    mirror: { tr: funModeComment(card, "mirror", "tr"), en: funModeComment(card, "mirror", "en"), es: funModeComment(card, "mirror", "es"), pt: funModeComment(card, "mirror", "pt"), ar: funModeComment(card, "mirror", "ar"), fr: funModeComment(card, "mirror", "fr"), de: funModeComment(card, "mirror", "de"), it: funModeComment(card, "mirror", "it"), ja: funModeComment(card, "mirror", "ja"), ko: funModeComment(card, "mirror", "ko"), zh: funModeComment(card, "mirror", "zh"), ru: funModeComment(card, "mirror", "ru") },
    stalk: { tr: funModeComment(card, "stalk", "tr"), en: funModeComment(card, "stalk", "en"), es: funModeComment(card, "stalk", "es"), pt: funModeComment(card, "stalk", "pt"), ar: funModeComment(card, "stalk", "ar"), fr: funModeComment(card, "stalk", "fr"), de: funModeComment(card, "stalk", "de"), it: funModeComment(card, "stalk", "it"), ja: funModeComment(card, "stalk", "ja"), ko: funModeComment(card, "stalk", "ko"), zh: funModeComment(card, "stalk", "zh"), ru: funModeComment(card, "stalk", "ru") }
  };
  return {
    mode: actualMode,
    handle: handle,
    handles: [handle],
    hash: seed,
    source: "fun",
    persona_id: card.id,
    nickname: card.nickname,
    tagline: card.desc,
    profile_emoji: card.emoji,
    comment: comment,
    card: { persona_id: card.id, nickname: card.nickname, desc: card.desc, emoji: card.emoji, color: card.color, top_behaviors: [] },
    archetype: { id: "fun", emoji: card.emoji, color: card.color, name: card.nickname, desc: card.desc, comments: { tr:[comment[actualMode].tr], en:[comment[actualMode].en], es:[comment[actualMode].es], pt:[comment[actualMode].pt], ar:[comment[actualMode].ar], fr:[comment[actualMode].fr], de:[comment[actualMode].de], it:[comment[actualMode].it], ja:[comment[actualMode].ja], ko:[comment[actualMode].ko], zh:[comment[actualMode].zh], ru:[comment[actualMode].ru] } },
    ci: 0,
    meta: { version:"xora_fun_v2", source:"fun", tier:"fun", reroll:nonce, ts:new Date().toISOString() }
  };
}

var FUN_MATCH_COMMENTS = {
  tr: [
    "XORA'nın tamamen bilim dışı laboratuvarı bu ikiliyi fazla eğlenceli buldu.",
    "Bu yüzde hiçbir şeyi kanıtlamıyor. Ama grup sohbetinde tartışma çıkarmaya yeter.",
    "Kart eğlence amaçlı. Yüzde ise gereksiz derecede ciddi görünüyor.",
    "Aynı masada ya efsane ikili olurlar ya da biri bildirimleri kapatır.",
    "XORA bu eşleşmeye güveniyor. XORA'nın neden bu kadar özgüvenli olduğunu bilmiyoruz.",
    "Bilim insanları bu hesabı reddetti. Biz yine de yüzde verdik."
  ],
  en: [
    "XORA's completely unscientific lab finds this pairing suspiciously entertaining.",
    "This percentage proves absolutely nothing. It can still start a group-chat argument.",
    "The card is for fun. The percentage looks unnecessarily official.",
    "At the same table they are either iconic or somebody mutes the chat.",
    "XORA believes in this match. Nobody knows why XORA is this confident.",
    "Science rejected the case. We gave it a percentage anyway."
  ],
  es: [
    "El laboratorio nada científico de XORA encontró a este dúo sospechosamente entretenido.",
    "Este porcentaje no demuestra absolutamente nada. Aun así puede encender el chat del grupo.",
    "La tarjeta es de broma. El porcentaje, en cambio, se ve innecesariamente oficial.",
    "En la misma mesa, o se vuelven un dúo legendario o alguien silencia el chat.",
    "XORA confía en esta pareja. Nadie sabe de dónde saca tanta seguridad.",
    "La ciencia rechazó el caso. Nosotros igual le pusimos un porcentaje."
  ],
  pt: [
    "O laboratório nada científico da XORA achou essa dupla suspeitamente divertida.",
    "Essa porcentagem não prova absolutamente nada. Mesmo assim, dá para começar uma discussão no grupo.",
    "O cartão é só brincadeira. Já a porcentagem parece oficial demais.",
    "Na mesma mesa, ou viram uma dupla lendária ou alguém silencia o grupo.",
    "A XORA acredita nessa dupla. Ninguém sabe de onde vem tanta confiança.",
    "A ciência recusou o caso. A gente deu uma porcentagem mesmo assim."
  ],
  ar: [
    "مختبر XORA البعيد تمامًا عن العلم وجد هذا الثنائي ممتعًا على نحو مريب.",
    "هذه النسبة لا تثبت شيئًا على الإطلاق. لكنها تكفي لإشعال نقاش في مجموعة الأصدقاء.",
    "البطاقة للمرح. أما النسبة فتبدو رسمية أكثر من اللازم.",
    "على الطاولة نفسها، إما أن يصبحا ثنائيًا أسطوريًا أو يكتم أحدهما المحادثة.",
    "XORA واثقة من هذا الثنائي. ولا أحد يعرف مصدر هذه الثقة.",
    "رفض العلم هذه القضية. ومع ذلك أعطيناها نسبة."
  ],
  fr: [
    "Le laboratoire pas du tout scientifique de XORA trouve ce duo étrangement divertissant.",
    "Ce pourcentage ne prouve absolument rien. Il suffit quand même à lancer un débat dans le groupe.",
    "La carte, c'est pour rire. Le pourcentage, lui, a l'air beaucoup trop officiel.",
    "À la même table, soit ils forment un duo culte, soit quelqu'un coupe les notifications.",
    "XORA croit en ce duo. Personne ne sait d'où lui vient une telle assurance.",
    "La science a refusé le dossier. On a quand même donné un pourcentage."
  ],
  de: [
    "Das völlig unwissenschaftliche Labor von XORA findet dieses Duo verdächtig unterhaltsam.",
    "Dieser Prozentwert beweist absolut nichts. Für eine Diskussion im Gruppenchat reicht er trotzdem.",
    "Die Karte ist nur zum Spaß. Der Prozentwert sieht dagegen viel zu offiziell aus.",
    "Am selben Tisch sind die beiden entweder ein legendäres Duo, oder jemand schaltet den Chat stumm.",
    "XORA glaubt an dieses Duo. Niemand weiß, woher XORA so viel Selbstvertrauen nimmt.",
    "Die Wissenschaft hat den Fall abgelehnt. Wir haben trotzdem einen Prozentwert vergeben."
  ],
  it: [
    "Il laboratorio per niente scientifico di XORA trova questa coppia sospettosamente divertente.",
    "Questa percentuale non dimostra assolutamente nulla. Però basta per scatenare una discussione nel gruppo.",
    "La carta è per ridere. La percentuale, invece, sembra fin troppo ufficiale.",
    "Allo stesso tavolo, o diventano una coppia leggendaria o qualcuno silenzia la chat.",
    "XORA crede in questa coppia. Nessuno sa da dove le venga tutta questa sicurezza.",
    "La scienza ha respinto il caso. Noi una percentuale l'abbiamo data lo stesso."
  ],
  ja: [
    "XORAのまったく科学的じゃない研究所は、この2人をやけに面白い組み合わせだと判定しました。",
    "このパーセンテージは何の証明にもなりません。それでもグループチャットを盛り上げるには十分です。",
    "カードは遊びです。なのにパーセンテージだけは妙に本格的に見えます。",
    "同じテーブルに座れば、伝説のコンビになるか、どちらかが通知を切るかのどちらかです。",
    "XORAはこの組み合わせを信じています。その自信がどこから来るのかは誰にもわかりません。",
    "科学には相手にされませんでした。それでもパーセンテージは出しておきました。"
  ],
  ko: [
    "XORA의 전혀 과학적이지 않은 연구소는 이 두 사람을 유난히 재미있는 조합으로 판정했습니다.",
    "이 수치는 아무것도 증명하지 못해요. 그래도 단체 대화방을 달구기에는 충분합니다.",
    "카드는 장난인데 퍼센트만 이상하게 진지해 보이네요.",
    "같은 자리에 앉으면 전설의 콤비가 되거나 한쪽이 알림을 끄거나 둘 중 하나예요.",
    "XORA는 이 조합을 믿습니다. 그 자신감이 어디서 왔는지는 아무도 모르지만요.",
    "과학은 이 건을 반려했어요. 그래도 퍼센트는 내드렸습니다."
  ],
  zh: [
    "XORA 那間完全不科學的實驗室判定，這兩個人是個意外有趣的組合。",
    "這個百分比證明不了什麼。不過拿去群組聊天炒氣氛已經夠用了。",
    "卡片只是玩玩，偏偏百分比看起來特別認真。",
    "坐在同一桌，不是變成傳說中的搭檔，就是有一方把通知關掉。",
    "XORA 相信這個組合。至於這份自信從哪裡來，沒有人知道。",
    "科學那邊把案子退回來了。百分比我們還是算給你了。"
  ],
  ru: [
    "Совершенно ненаучная лаборатория XORA постановила, что эта пара — неожиданно интересное сочетание.",
    "Этот процент ничего не доказывает. Но чтобы оживить общий чат, его вполне достаточно.",
    "Карточка — это игра, а процент почему-то выглядит подозрительно серьёзно.",
    "За одним столом эти двое либо станут легендарным дуэтом, либо кто-то отключит уведомления.",
    "XORA верит в это сочетание. Откуда у неё такая уверенность, не знает никто.",
    "Наука вернула дело без рассмотрения. Процент мы всё равно посчитали."
  ]
};

function matchFunHandles(rawA, rawB, rerollNonce) {
  var a = normHandle(rawA);
  var b = normHandle(rawB);
  var nonce = Number(rerollNonce || 0);
  var seedText = "fun•match•" + [a, b].slice().sort().join("•") + "•" + nonce;
  var c = xhash(seedText);
  var overall = Math.min(99, 35 + (c % 65));
  var commentIndex = c % FUN_MATCH_COMMENTS.tr.length;
  return {
    a: a, b: b, handles:[a,b],
    resA: analyzeFunHandle(a, "mirror", nonce),
    resB: analyzeFunHandle(b, "mirror", nonce + 1),
    flirt: 30 + ((c >>> 2) % 70),
    vibe: 30 + ((c >>> 5) % 70),
    humor: 30 + ((c >>> 8) % 70),
    chaos: 30 + ((c >>> 11) % 70),
    romance: 30 + ((c >>> 14) % 70),
    overall: overall,
    ci: commentIndex,
    source: "fun",
    fun_comment: { tr:FUN_MATCH_COMMENTS.tr[commentIndex], en:FUN_MATCH_COMMENTS.en[commentIndex], es:FUN_MATCH_COMMENTS.es[commentIndex], pt:FUN_MATCH_COMMENTS.pt[commentIndex], ar:FUN_MATCH_COMMENTS.ar[commentIndex], fr:FUN_MATCH_COMMENTS.fr[commentIndex], de:FUN_MATCH_COMMENTS.de[commentIndex], it:FUN_MATCH_COMMENTS.it[commentIndex], ja:FUN_MATCH_COMMENTS.ja[commentIndex], ko:FUN_MATCH_COMMENTS.ko[commentIndex], zh:FUN_MATCH_COMMENTS.zh[commentIndex], ru:FUN_MATCH_COMMENTS.ru[commentIndex] },
    meta: { tier:"fun", source:"fun", reroll:nonce, version:"match_fun_v1", ts:new Date().toISOString() }
  };
}

function archetypeById(id) {
  return {
    id: id, emoji: "🔍", color: "#0FAFAF",
    name: { tr: "XORA Profil", en: "XORA Profile", es: "Perfil XORA", pt: "Perfil XORA", ar: "ملف XORA", fr: "Profil XORA", de: "XORA-Profil", it: "Profilo XORA", ja: "XORAプロフィール", ko: "XORA 프로필", zh: "XORA 檔案", ru: "Профиль XORA" },
    desc: { tr: "Analiz tamamlandı.", en: "Analysis complete.", es: "Análisis completado.", pt: "Análise concluída.", ar: "اكتمل التحليل.", fr: "Analyse terminée.", de: "Analyse abgeschlossen.", it: "Analisi completata.", ja: "分析が完了しました。", ko: "분석이 끝났습니다.", zh: "分析完成了。", ru: "Разбор завершён." },
    comments: { tr: [""], en: [""], es: [""], pt: [""], ar: [""], fr: [""], de: [""], it: [""], ja: [""], ko: [""], zh: [""], ru: [""] }
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
    "{a} mesaj atar, {b} görüldü atar. Ama bu iki profil gece 3'te birbirinin sayfasında. Klasik.",
    "Bu iki hesap arasındaki flört tweet beğenisiyle başlar, drama ile biter. XORA popcorn hazırladı.",
    "{a} duygusal yazar, {b} ironiyle cevap verir. Bu iki profil arasındaki gerilim ya aşka döner ya engele.",
    "{a} ve {b} birbirini stalklıyor ama takip etmiyor. Bu eşleşmede ne cesaret var ne korkaklık — saf kaos.",
    "{a} kalp atar, {b} alev atar. Bu iki hesap da ne istediğini bilmiyor ama kimya tartışılmaz.",
    "{a} plan yapar, {b} planı havaya uçurur. Bu ikili tam bir romantik komedi senaryosu."
  ],
  en: [
    "{a} sends the text, {b} leaves it on read. But these two profiles stalk each other at 3 AM. Classic.",
    "The flirtation between these two accounts starts with a like, ends with drama. XORA has the popcorn ready.",
    "{a} writes emotionally, {b} replies with irony. The tension between these two profiles either becomes love or a block.",
    "{a} and {b} stalk each other but won't follow. This match has no courage, no cowardice — pure chaos.",
    "{a} sends hearts, {b} sends fire. Neither account knows what it wants, but the chemistry is undeniable.",
    "{a} makes plans, {b} blows them up. These two are a perfect romantic comedy script."
  ],
  es: [
    "{a} manda el mensaje, {b} lo deja en visto. Pero estos dos perfiles se revisan a las 3 de la mañana. Un clásico.",
    "El coqueteo entre estas dos cuentas empieza con un like y termina en drama. XORA ya tiene las palomitas listas.",
    "{a} escribe con el corazón, {b} responde con ironía. Esta tensión termina en amor o en bloqueo.",
    "{a} y {b} se vigilan pero no se siguen. Aquí no hay valentía ni cobardía: caos puro.",
    "{a} manda corazones, {b} manda fuego. Ninguna de las dos cuentas sabe lo que quiere, pero la química es innegable.",
    "{a} hace planes, {b} los vuela por los aires. Estos dos son un guion de comedia romántica."
  ],
  pt: [
    "{a} manda mensagem, {b} deixa no visto. Mas esses dois perfis se espiam às 3 da manhã. Clássico.",
    "O flerte entre essas duas contas começa com uma curtida e termina em drama. A XORA já preparou a pipoca.",
    "{a} escreve com o coração, {b} responde com ironia. Essa tensão termina em amor ou em bloqueio.",
    "{a} e {b} se vigiam, mas não se seguem. Aqui não tem coragem nem covardia: é caos puro.",
    "{a} manda corações, {b} manda fogo. Nenhuma das duas contas sabe o que quer, mas a química é inegável.",
    "{a} faz planos, {b} explode todos eles. Esses dois dariam um roteiro de comédia romântica."
  ],
  ar: [
    "{a} يرسل الرسالة، بينما يتركها {b} دون رد. لكن الحسابين يتفقدان بعضهما في الثالثة فجرًا. مشهد مألوف.",
    "الإعجاب بين هذين الحسابين يبدأ بنقرة إعجاب وينتهي بدراما. XORA جهزت الفشار.",
    "{a} يكتب بعاطفة، بينما يرد {b} بسخرية. هذا التوتر ينتهي إما بالحب أو بالحظر.",
    "{a} يراقب {b} بصمت، والعكس صحيح، دون أي متابعة. لا شجاعة هنا ولا تردد، بل فوضى خالصة.",
    "{a} يرسل القلوب، بينما يرسل {b} النار. لا أحد منهما يعرف ما يريد، لكن الانسجام واضح.",
    "{a} يخطط، ثم يأتي {b} ليقلب الخطط رأسًا على عقب. هذان الاثنان قصة كوميديا رومانسية جاهزة."
  ],
  fr: [
    "{a} envoie le message, {b} le laisse en vu. Pourtant, ces deux profils se regardent à 3 h du matin. Un classique.",
    "Le flirt entre ces deux comptes commence par un cœur et finit en drame. XORA a déjà sorti le pop-corn.",
    "{a} écrit avec le cœur, {b} répond avec ironie. Cette tension finira en histoire d'amour ou en blocage.",
    "{a} et {b} s'observent sans jamais se suivre. Ni courage ni lâcheté ici\u00a0: du chaos à l'état pur.",
    "{a} envoie des cœurs, {b} envoie du feu. Aucun des deux ne sait ce qu'il veut, mais l'alchimie est évidente.",
    "{a} fait des plans, {b} les fait voler en éclats. Ces deux-là, c'est une comédie romantique toute prête."
  ],
  de: [
    "{a} schreibt die Nachricht, {b} lässt sie ungelesen liegen. Trotzdem schauen sich diese beiden Profile um 3 Uhr nachts gegenseitig an. Ein Klassiker.",
    "Der Flirt zwischen diesen beiden Konten beginnt mit einem Herz und endet im Drama. XORA hat das Popcorn schon bereit.",
    "{a} schreibt mit Gefühl, {b} antwortet mit Ironie. Diese Spannung endet entweder in Liebe oder in einer Blockierung.",
    "{a} und {b} beobachten sich, folgen sich aber nicht. Hier gibt es weder Mut noch Feigheit, nur reines Chaos.",
    "{a} schickt Herzen, {b} schickt Feuer. Keiner von beiden weiß, was er will, aber die Chemie ist unübersehbar.",
    "{a} macht Pläne, {b} wirft sie über den Haufen. Die zwei sind eine fertige romantische Komödie."
  ],
  it: [
    "{a} manda il messaggio, {b} lo visualizza e non risponde. Eppure questi due profili si controllano a vicenda alle 3 di notte. Un classico.",
    "Il flirt tra questi due account inizia con un cuore e finisce in dramma. XORA ha già preparato i popcorn.",
    "{a} scrive col cuore, {b} risponde con ironia. Questa tensione finirà in amore o in un blocco.",
    "{a} e {b} si osservano ma non si seguono. Né coraggio né codardia: solo caos allo stato puro.",
    "{a} manda cuori, {b} manda fuoco. Nessuno dei due sa cosa vuole, ma la chimica è innegabile.",
    "{a} fa piani, {b} li manda all'aria. Questi due sono una commedia romantica già scritta."
  ],
  ja: [
    "{a}がメッセージを送り、{b}は既読のまま。なのに2人とも深夜3時にお互いのプロフィールを見ている。よくある話。",
    "このふたつのアカウントの恋は、いいねで始まってドラマで終わる。XORAはもうポップコーンを用意済み。",
    "{a}は気持ちを込めて書き、{b}は皮肉で返す。この緊張感は、恋に変わるかブロックで終わるかのどちらか。",
    "{a}と{b}はお互いをチェックしているのに、フォローはしていない。勇気も臆病さもなく、ただのカオス。",
    "{a}はハートを送り、{b}は炎を送る。どちらも自分が何をしたいのかわかっていないけれど、相性は抜群。",
    "{a}が計画を立て、{b}がそれをひっくり返す。この2人はそのままラブコメになる。"
  ],
  ko: [
    "{a}가 메시지를 보내고 {b}는 읽고도 답이 없어요. 그런데 둘 다 새벽 3시에 서로의 프로필을 보고 있죠. 흔한 이야기입니다.",
    "이 두 계정의 연애는 좋아요로 시작해서 드라마로 끝나요. XORA는 이미 팝콘을 준비했습니다.",
    "{a}는 진심을 담아 쓰고 {b}는 농담으로 받아쳐요. 이 긴장감은 연애가 되거나 차단으로 끝나거나 둘 중 하나입니다.",
    "{a}와 {b}는 서로를 확인하면서도 팔로우는 하지 않아요. 용기도 소심함도 아니고 그냥 혼돈입니다.",
    "{a}는 하트를 보내고 {b}는 불을 보내요. 둘 다 자기가 뭘 원하는지 모르지만 합은 확실히 좋습니다.",
    "{a}가 계획을 세우면 {b}가 뒤엎어요. 이 둘은 그대로 로맨틱 코미디가 됩니다."
  ],
  zh: [
    "{a} 傳了訊息，{b} 已讀不回。可是兩個人都在凌晨三點看對方的個人檔案。很常見的故事。",
    "這兩個帳號的戀愛會從一個讚開始，用一齣戲收尾。XORA 的爆米花已經準備好了。",
    "{a} 認真打字，{b} 用玩笑回。這種張力不是變成戀愛，就是以封鎖收場。",
    "{a} 和 {b} 互相看對方的動態，卻沒有真的追蹤對方。不是勇敢也不是膽小，就是純粹的混亂。",
    "{a} 傳愛心，{b} 傳火。兩個人都不知道自己想要什麼，但頻率確實很合。",
    "{a} 訂好計畫，{b} 全部推翻。這兩個人根本可以直接拍成愛情喜劇。"
  ],
  ru: [
    "{a} пишет, {b} читает и молчит. При этом оба в три часа ночи изучают профиль друг друга. Знакомая история.",
    "Роман этих двух аккаунтов начнётся с лайка и закончится драмой. Попкорн у XORA уже готов.",
    "{a} пишет искренне, {b} отвечает шуткой. Это напряжение либо превратится в роман, либо закончится блокировкой.",
    "{a} и {b} следят за лентами друг друга, но не подписаны. Это не смелость и не робость, а чистый хаос.",
    "{a} шлёт сердечки, {b} шлёт огонь. Оба не знают, чего хотят, но совпадение налицо.",
    "{a} строит планы, {b} их переворачивает. Из этих двоих получилась бы готовая романтическая комедия."
  ]
};

function matchHandles(rawA, rawB, seedKey) {
  var a = normHandle(rawA);
  var b = normHandle(rawB);
  var pair = [a, b].slice().sort();
  var c = xhash(seedKey || (pair[0] + "•" + pair[1]));

  var flirt    = 38 + (c % 60);
  var vibe     = 35 + ((c >>> 4) % 63);
  var humor    = 30 + ((c >>> 7) % 68);
  var chaos    = 20 + ((c >>> 10) % 75);
  var romance  = 40 + ((c >>> 13) % 58);
  var overall  = Math.round((flirt + vibe + humor + romance) / 4 + ((c >>> 8) % 7) - 3);
  overall = Math.max(35, Math.min(99, overall));

  return {
    a: a, b: b,
    resA: analyzeHandle(a, "mirror", seedKey ? (seedKey + "•a") : null),
    resB: analyzeHandle(b, "mirror", seedKey ? (seedKey + "•b") : null),
    flirt: flirt,
    vibe: vibe,
    humor: humor,
    chaos: chaos,
    romance: romance,
    overall: overall,
    ci: (c >>> 6) % MATCH_COMMENTS.tr.length
  };
}

function isRtlLang(lang) {
  return typeof langDir === "function" ? langDir(lang) === "rtl" : lang === "ar";
}

function matchComment(m, lang) {
  if (m && m.fun_comment && m.fun_comment[lang]) return m.fun_comment[lang];
  if (m && m.ai_comment && m.ai_comment[lang]) return m.ai_comment[lang];
  // Inside RTL sentences a bare "@name" is reordered to "name@"; isolate handles as LTR.
  function handle(h) { return isRtlLang(lang) ? "\u2066@" + h + "\u2069" : "@" + h; }
  return MATCH_COMMENTS[lang][m.ci]
    .replace(/\{a\}/g, handle(m.a))
    .replace(/\{b\}/g, handle(m.b));
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
    ],
    es: [
      "Quitándole el polvo a tu timeline...",
      "Intentando ignorar tus posts de las 3 de la mañana... no puedo.",
      "Escaneando patrones de comportamiento...",
      "Tomando nota de tus contradicciones...",
      "Analizando señales repetidas...",
      "XORA a veces es demasiado honesto. Prepárate."
    ],
    pt: [
      "Tirando o pó da sua timeline...",
      "Tentando ignorar seus posts das 3 da manhã... não consigo.",
      "Analisando padrões de comportamento...",
      "Anotando suas contradições...",
      "Analisando sinais que se repetem...",
      "A XORA às vezes é sincera demais. Prepare-se."
    ],
    ar: [
      "أنفض الغبار عن خطك الزمني...",
      "أحاول تجاهل منشوراتك في الثالثة فجرًا... لا أستطيع.",
      "أحلل أنماط السلوك...",
      "أدون تناقضاتك...",
      "أحلل الإشارات المتكررة...",
      "XORA صريحة أكثر من اللازم أحيانًا. استعد."
    ],
    fr: [
      "Je dépoussière ton fil d'actualité...",
      "J'essaie d'ignorer tes publications de 3 h du matin... impossible.",
      "Analyse des schémas de comportement...",
      "Je note tes contradictions...",
      "Analyse des signaux qui se répètent...",
      "XORA est parfois un peu trop franche. Prépare-toi."
    ],
    de: [
      "Ich sehe mir deine Beiträge an...",
      "Ich versuche, deine Beiträge von 3 Uhr nachts zu ignorieren... klappt nicht.",
      "Ich scanne Verhaltensmuster...",
      "Ich notiere deine Widersprüche...",
      "Ich analysiere wiederkehrende Signale...",
      "XORA ist manchmal etwas zu ehrlich. Mach dich bereit."
    ],
    it: [
      "Sto sfogliando i tuoi post...",
      "Provo a ignorare i tuoi post delle 3 di notte... non ci riesco.",
      "Analizzo gli schemi di comportamento...",
      "Prendo nota delle tue contraddizioni...",
      "Analizzo i segnali che si ripetono...",
      "XORA a volte è un po' troppo sincera. Preparati."
    ],
    ja: [
      "タイムラインのほこりを払っています...",
      "深夜3時の投稿は見なかったことに...できませんでした。",
      "行動パターンをスキャン中...",
      "矛盾点をメモしています...",
      "くり返し出てくるサインを分析中...",
      "XORAはちょっと正直すぎることがあります。心の準備を。"
    ],
    ko: [
      "타임라인의 먼지를 털고 있어요...",
      "새벽 3시 게시글은 못 본 척하려고 했는데... 실패했어요.",
      "행동 패턴을 살펴보는 중...",
      "모순되는 부분을 적어두고 있어요...",
      "반복해서 나타나는 신호를 분석 중...",
      "XORA는 가끔 너무 솔직해요. 마음의 준비를 하세요."
    ],
    zh: [
      "正在撥開時間軸上的灰塵…",
      "凌晨三點的貼文我本來想當作沒看到…結果沒辦法。",
      "掃描行為模式中…",
      "把你的矛盾記下來…",
      "分析一直重複出現的訊號…",
      "XORA 有時候太誠實了。做好心理準備。"
    ],
    ru: [
      "Стряхиваю пыль с твоей ленты…",
      "Хотела не заметить записи в три часа ночи… не получилось.",
      "Сканирую поведение…",
      "Записываю твои противоречия…",
      "Разбираю сигналы, которые повторяются…",
      "XORA иногда слишком честна. Приготовься."
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
    ],
    es: [
      "Entrando al perfil sin hacer ruido...",
      "No dejo huellas, tranquilo.",
      "Mmm. Interesante historial de likes.",
      "Esto no te lo dije yo...",
      "También revisé a quién sigue. Dice mucho.",
      "Lo que encuentre te lo cuento solo a ti."
    ],
    pt: [
      "Entrando no perfil sem fazer barulho...",
      "Não deixo rastro, fique tranquilo.",
      "Hmm. Histórico de curtidas interessante.",
      "Você não ouviu isso de mim...",
      "Também olhei quem essa conta segue. Diz muita coisa.",
      "O que eu encontrar, conto só para você."
    ],
    ar: [
      "أدخل الحساب بهدوء...",
      "لا أترك أثرًا، اطمئن.",
      "همم. سجل إعجابات مثير للاهتمام.",
      "لم تسمع هذا مني...",
      "نظرت أيضًا إلى من يتابعهم هذا الحساب. الأمر يقول الكثير.",
      "ما أجده سأخبرك به وحدك."
    ],
    fr: [
      "J'entre discrètement sur le profil...",
      "Je ne laisse aucune trace, ne t'inquiète pas.",
      "Hmm. Un historique de j'aime intéressant.",
      "Tu ne tiens pas ça de moi...",
      "J'ai aussi regardé qui ce compte suit. Ça en dit long.",
      "Ce que je trouve, je ne le dis qu'à toi."
    ],
    de: [
      "Ich betrete das Profil ganz leise...",
      "Ich hinterlasse keine Spuren, keine Sorge.",
      "Hmm. Interessant, was hier alles mit Herzen markiert wurde.",
      "Das hast du nicht von mir...",
      "Ich habe mir auch angesehen, wem dieses Konto folgt. Das sagt viel.",
      "Was ich finde, erzähle ich nur dir."
    ],
    it: [
      "Entro nel profilo in punta di piedi...",
      "Non lascio tracce, niente paura.",
      "Mmm. Interessanti i cuori che ha messo.",
      "Non l'hai sentito da me...",
      "Ho guardato anche chi segue questo account. Dice molto.",
      "Quello che trovo lo dico solo a te."
    ],
    ja: [
      "こっそりプロフィールに入ります...",
      "足あとは残しません。ご安心を。",
      "ふむ。いいねの履歴が興味深いですね。",
      "これは私から聞いたって言わないでくださいね...",
      "フォローしている相手も見ました。いろいろわかります。",
      "見つけたことは、あなたにだけ教えます。"
    ],
    ko: [
      "조용히 프로필에 들어갑니다...",
      "발자국은 남기지 않아요. 안심하세요.",
      "음. 좋아요 기록이 흥미롭네요.",
      "저한테 들었다고 하면 안 돼요...",
      "팔로우하는 계정도 봤어요. 꽤 많은 게 보이네요.",
      "찾아낸 건 당신에게만 알려드릴게요."
    ],
    zh: [
      "悄悄進入個人檔案…",
      "不會留下足跡，放心。",
      "嗯。按讚的紀錄很有意思。",
      "這件事不要說是我講的…",
      "我也看了他追蹤的帳號。看得出不少東西。",
      "找到的東西，我只告訴你。"
    ],
    ru: [
      "Тихонько захожу в профиль…",
      "Следов не оставлю, не переживай.",
      "Так. История лайков довольно любопытная.",
      "Только не говори, что это от меня…",
      "Посмотрела и на подписки. Многое становится понятно.",
      "Что нашла, расскажу только тебе."
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
    ],
    es: [
      "Poniendo los dos timelines lado a lado...",
      "Escaneando likes en común... interesante.",
      "Una cuenta es diurna, la otra nocturna. Anotado.",
      "Tensión detectada en el historial de respuestas.",
      "Calculando la química. Bata de laboratorio puesta.",
      "El resultado puede doler a alguno de los dos. Allá voy."
    ],
    pt: [
      "Colocando as duas timelines lado a lado...",
      "Procurando curtidas em comum... interessante.",
      "Uma conta é diurna, a outra é noturna. Anotado.",
      "Tensão detectada no histórico de respostas.",
      "Calculando a química. Jaleco vestido.",
      "O resultado pode chatear um de vocês. Lá vai."
    ],
    ar: [
      "أضع الخطين الزمنيين جنبًا إلى جنب...",
      "أبحث عن الإعجابات المشتركة... مثير للاهتمام.",
      "حساب نهاري وآخر ليلي. تم التدوين.",
      "رصدت توترًا في سجل الردود.",
      "أحسب درجة الانسجام. ارتديت معطف المختبر.",
      "قد تزعج النتيجة أحدكما. ها هي."
    ],
    fr: [
      "Je place les deux fils côte à côte...",
      "Recherche des j'aime en commun... intéressant.",
      "Un compte vit le jour, l'autre la nuit. C'est noté.",
      "Tension détectée dans l'historique des réponses.",
      "Calcul de l'alchimie en cours. Blouse de labo enfilée.",
      "Le résultat pourrait vexer l'un de vous. C'est parti."
    ],
    de: [
      "Ich lege die beiden Profile nebeneinander...",
      "Ich suche nach gemeinsamen Herzen... interessant.",
      "Ein Konto ist tagsüber aktiv, das andere nachts. Notiert.",
      "Spannung im Antwortverlauf entdeckt.",
      "Ich berechne die Chemie. Laborkittel ist an.",
      "Das Ergebnis könnte einen von euch ärgern. Jetzt kommt es."
    ],
    it: [
      "Metto i due profili uno accanto all'altro...",
      "Cerco i cuori in comune... interessante.",
      "Un account vive di giorno, l'altro di notte. Annotato.",
      "Rilevata tensione nella cronologia delle risposte.",
      "Calcolo della chimica in corso. Camice da laboratorio indossato.",
      "Il risultato potrebbe dispiacere a uno di voi. Eccolo."
    ],
    ja: [
      "2つのタイムラインを並べています...",
      "共通のいいねを探しています...興味深い。",
      "片方は昼型、もう片方は夜型。メモしました。",
      "リプライ履歴に緊張感を検出。",
      "相性を計算中。白衣を着ました。",
      "結果にどちらかががっかりするかも。発表します。"
    ],
    ko: [
      "두 타임라인을 나란히 놓는 중...",
      "겹치는 좋아요를 찾고 있어요... 흥미롭네요.",
      "한쪽은 낮형, 다른 쪽은 밤형. 적어뒀습니다.",
      "답글 기록에서 긴장감이 감지됐어요.",
      "궁합 계산 중. 가운도 챙겨 입었습니다.",
      "결과에 둘 중 하나는 실망할 수도 있어요. 발표합니다."
    ],
    zh: [
      "把兩條時間軸並排放好…",
      "正在找重疊的讚…有意思。",
      "一個白天出沒，一個晚上出沒。記下來了。",
      "在回覆紀錄裡偵測到張力。",
      "計算速配中。白袍已經穿上。",
      "結果可能會讓其中一個人失望。公布了。"
    ],
    ru: [
      "Ставлю две ленты рядом…",
      "Ищу общие лайки… любопытно.",
      "Один живёт днём, другой ночью. Записала.",
      "В переписке замечено напряжение.",
      "Считаю совместимость. Халат уже надет.",
      "Результат может расстроить кого-то из вас. Объявляю."
    ]
  }
};

function startThinkingLoop(msgEl, mode) {
  var msgs = THINKING[mode][getLang()] || THINKING[mode].tr;
  var i = 0;
  if (msgEl) {
    msgEl.textContent = msgs[0];
    msgEl.classList.add("pop");
  }
  var iv = setInterval(function () {
    i = (i + 1) % msgs.length;
    if (!msgEl) return;
    msgEl.classList.remove("pop");
    void msgEl.offsetWidth;
    msgEl.textContent = msgs[i];
    msgEl.classList.add("pop");
  }, 900);
  return function stopThinkingLoop() { clearInterval(iv); };
}

function playThinking(msgEl, mode, onDone) {
  var msgs = THINKING[mode][getLang()] || THINKING[mode].tr;
  var i = 0;
  msgEl.textContent = msgs[0];
  msgEl.classList.add("pop");
  var iv = setInterval(function () {
    i++;
    if (i >= 2) {
      clearInterval(iv);
      onDone();
      return;
    }
    msgEl.classList.remove("pop");
    void msgEl.offsetWidth;
    msgEl.textContent = msgs[i % msgs.length];
    msgEl.classList.add("pop");
  }, 650);
}
