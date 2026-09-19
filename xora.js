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
        "tagline": "Masum görünen tek bir reply ile yorumları hareketlendirebilirsin.",
        "comment": "Herkes aynı fikirde görünürken yorumlara küçük bir soru bırakıp kenara çekiliyorsun. Öyle sakin yazıyorsun ki şaka mı ciddi mi olduğu ilk anda anlaşılmıyor. Asıl keyif, espriyi ilk yakalayanın reply'ını görmek."
      },
      "en": {
        "nickname": "Quiet Instigator",
        "tagline": "One innocent-looking reply and the whole thread wakes up.",
        "comment": "When everyone in the replies seems to agree, you drop one small question and step back. You phrase it so calmly that nobody can tell whether you are joking. The best part is watching who catches on first."
      },
      "es": {
        "nickname": "Travieso Discreto",
        "tagline": "Una respuesta que parece inocente y el hilo entero se despierta.",
        "comment": "Cuando en las respuestas todos parecen estar de acuerdo, dejas caer una pregunta pequeña y te retiras. La escribes con tanta calma que nadie sabe si vas en serio o en broma. Lo mejor es ver quién lo entiende primero."
      },
      "pt": {
        "nickname": "Arteiro de Mansinho",
        "tagline": "Uma resposta com jeito inocente e a thread inteira acorda.",
        "comment": "Quando todo mundo nas respostas parece concordar, você solta uma perguntinha e sai de fininho. Escreve com tanta calma que ninguém sabe se é sério ou brincadeira. O melhor é ver quem entende primeiro."
      },
      "ar": {
        "nickname": "المشاغب الهادئ",
        "tagline": "رد واحد يبدو بريئًا يكفي ليوقظ السلسلة كلها.",
        "comment": "حين يبدو أن الجميع في الردود متفقون، تترك سؤالًا صغيرًا ثم تنسحب بهدوء. تكتبه بهدوء شديد لا يعرف معه أحد إن كنت جادًا أم تمزح. أمتع ما في الأمر أن ترى من يلتقط الفكرة أولًا."
      },
      "fr": {
        "nickname": "L'Air de Rien",
        "tagline": "Une réponse l'air de rien, et tout le fil se réveille.",
        "comment": "Quand tout le monde semble d'accord dans les réponses, tu lâches une petite question faussement naïve et tu t'éclipses. Tu l'écris avec tant de calme que personne ne sait si tu plaisantes. Le meilleur moment, c'est de voir qui a compris en premier."
      },
      "de": {
        "nickname": "Auf leisen Sohlen",
        "tagline": "Eine harmlos wirkende Antwort, und der ganze Thread wacht auf.",
        "comment": "Wenn in den Antworten alle einer Meinung scheinen, setzt du eine kleine Frage ab und ziehst dich zurück. Du schreibst sie so ruhig, dass niemand weiß, ob du scherzt. Am schönsten ist es zu sehen, wer es zuerst kapiert."
      },
      "it": {
        "nickname": "Il Sornione",
        "tagline": "Una risposta dall'aria innocente e tutto il thread si sveglia.",
        "comment": "Quando nelle risposte sembrano tutti d'accordo, lasci cadere una piccola domanda e ti fai da parte. La scrivi con una calma tale che nessuno capisce se stai scherzando. Il bello è vedere chi ci arriva per primo."
      },
      "ja": {
        "nickname": "さりげない策士",
        "tagline": "無邪気に見えるリプひとつで、スレッド全体が動き出す。",
        "comment": "リプ欄がみんな同じ意見でまとまりかけたころ、小さな質問をひとつ置いてそっと離れる。あまりに落ち着いた書き方なので、本気なのか冗談なのか誰にもわからない。いちばん楽しいのは、最初に気づいた人のリプを見る瞬間だ。"
      },
      "ko": {
        "nickname": "은근한 장난꾼",
        "tagline": "순진해 보이는 답글 하나로 스레드 전체를 깨워요.",
        "comment": "답글 창의 모두가 같은 의견으로 모일 즈음, 작은 질문 하나를 남기고 슬쩍 빠져요. 너무 태연하게 써서 진담인지 농담인지 아무도 확신하지 못하죠. 제일 즐거운 순간은 처음 눈치챈 사람의 답글을 볼 때예요."
      },
      "zh": {
        "nickname": "安靜的搗蛋鬼",
        "tagline": "一則看似無辜的回覆，就能讓整串討論醒過來。",
        "comment": "留言區大家的意見快要一致的時候，你輕輕丟下一個小問題就悄悄離開。你寫得太平靜了，沒有人分得出你是認真還是在開玩笑。最開心的一刻，是看到第一個聽懂的人留言。"
      },
      "ru": {
        "nickname": "Тихий провокатор",
        "tagline": "Один невинный ответ, и весь тред оживает.",
        "comment": "Когда в ответах все вроде бы согласны, ты оставляешь маленький вопрос и тихо уходишь. Пишешь так спокойно, что никто не понимает, всерьёз ты или шутишь. Самое приятное — увидеть, кто догадался первым."
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
        "tagline": "Ciddi görünen bir cümlenin sonuna küçük bir ironi saklıyorsun.",
        "comment": "Timeline'da fazla iddialı bir post görünce içindeki küçük çelişki hemen dikkatini çekiyor. Uzun bir thread yerine tek satırlık, hafif alaylı bir alıntı seçiyorsun. Espriyi açıklamak yerine anlayanların beğenmesini bekliyorsun."
      },
      "en": {
        "nickname": "Tongue in Cheek",
        "tagline": "Almost serious, but never quite.",
        "comment": "A very confident post on your timeline is basically an invitation. Instead of a long rebuttal thread, you reach for a one-line quote with a gentle twist. You never explain the joke; the right people will like it."
      },
      "es": {
        "nickname": "Casi en Serio",
        "tagline": "Tus frases parecen serias hasta la última palabra.",
        "comment": "Una publicación demasiado segura de sí misma en tu timeline es casi una invitación. En lugar de un hilo larguísimo para rebatirla, eliges una cita de una sola línea con un giro sutil. Nunca explicas el chiste: quien lo entiende, le da me gusta."
      },
      "pt": {
        "nickname": "Ironia Fina",
        "tagline": "Suas frases parecem sérias até a última palavra.",
        "comment": "Um post confiante demais na sua timeline é praticamente um convite. Em vez de uma thread enorme para rebater, você escolhe um quote de uma linha com uma virada sutil. Você nunca explica a piada: quem entendeu, curte."
      },
      "ar": {
        "nickname": "سخرية لطيفة",
        "tagline": "جملك تبدو جادة حتى آخر كلمة.",
        "comment": "المنشور الواثق أكثر من اللازم على خطك الزمني يكاد يكون دعوة مفتوحة. بدل سلسلة طويلة للرد، تختار اقتباسًا من سطر واحد فيه لمسة ساخرة خفيفة. لا تشرح النكتة أبدًا، فمن فهمها سيضغط على الإعجاب."
      },
      "fr": {
        "nickname": "Second Degré",
        "tagline": "Tes phrases ont l'air sérieuses jusqu'au dernier mot.",
        "comment": "Un post trop sûr de lui dans ta timeline, c'est presque une invitation. Plutôt qu'un long fil pour répondre, tu choisis une citation d'une ligne, volontairement ambiguë. Tu n'expliques jamais la blague\u00a0: ceux qui l'ont comprise mettront un j'aime."
      },
      "de": {
        "nickname": "Mit Augenzwinkern",
        "tagline": "Deine Sätze wirken ernst bis zum letzten Wort.",
        "comment": "Ein allzu selbstsicherer Post in deiner Timeline ist fast schon eine Einladung. Statt eines langen Gegen-Threads wählst du ein einzeiliges Zitat mit einem kleinen Dreh. Du erklärst den Witz nie; wer ihn versteht, lässt ein Like da."
      },
      "it": {
        "nickname": "Ironia Sottile",
        "tagline": "Le tue frasi sembrano serie fino all'ultima parola.",
        "comment": "Un post troppo sicuro di sé nella tua timeline è quasi un invito. Invece di un lungo thread di risposta, scegli una citazione di una riga con un piccolo colpo di scena. Non spieghi mai la battuta: chi l'ha capita metterà un like."
      },
      "ja": {
        "nickname": "ツッコミ上手",
        "tagline": "真面目に見える文の最後に、小さな皮肉を隠している。",
        "comment": "自信満々すぎるポストがタイムラインに流れてくると、つい小さな矛盾が気になってしまう。長い反論スレッドより、ひと言だけの引用でさらっとひねるほうが好きだ。ネタの説明はしない。わかる人がいいねを押してくれれば十分だ。"
      },
      "ko": {
        "nickname": "촌철살인",
        "tagline": "진지해 보이는 문장 끝에 작은 반전을 숨겨 둬요.",
        "comment": "타임라인에 지나치게 자신만만한 게시물이 올라오면 그 안의 모순이 먼저 보여요. 길게 반박하는 스레드 대신 한 줄짜리 인용으로 가볍게 비틀죠. 무슨 뜻인지 굳이 설명하지는 않아요. 알아들은 사람이 좋아요를 누르면 그걸로 충분하니까요."
      },
      "zh": {
        "nickname": "一句話收尾",
        "tagline": "看似認真的句子，最後一個字才露出反諷。",
        "comment": "時間軸上出現太過自信的貼文時，你總會先注意到裡面的矛盾。比起長篇反駁的串文，你更習慣用一句話的引用輕輕帶過。你不會解釋笑點在哪裡。看懂的人按個讚，這樣就夠了。"
      },
      "ru": {
        "nickname": "Последнее слово",
        "tagline": "Твои фразы кажутся серьёзными до последнего слова.",
        "comment": "Слишком самоуверенный пост в ленте для тебя почти приглашение. Вместо длинного треда с возражениями ты выбираешь цитату в одну строку с лёгким подвохом. Шутку ты не объясняешь. Кто понял, тот поставит лайк."
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
        "tagline": "Bir thread bitmeden aklın bir sonraki soruya gidiyor.",
        "comment": "Bilmediğin bir konu timeline'a düşünce susmak yerine reply'a soru bırakıyorsun. Gelen her ilginç cevap yeni bir merak açıyor ve sekmeler çoğalıyor. Her konuda uzman olmaktan çok, bugün yeni bir şey öğrenmiş olmak hoşuna gidiyor."
      },
      "en": {
        "nickname": "Endlessly Curious",
        "tagline": "There is always one more question to drop in the replies.",
        "comment": "When a topic you know nothing about hits your timeline, you ask instead of scrolling past. Every good answer opens another tab and another question. Being an expert matters less to you than ending the day having learned something new."
      },
      "es": {
        "nickname": "Curiosidad Infinita",
        "tagline": "Siempre queda una pregunta más para dejar en las respuestas.",
        "comment": "Cuando aparece en tu timeline un tema que no conoces, preguntas en lugar de seguir de largo. Cada buena respuesta te abre otra pestaña y otra duda. Te importa menos ser experto que terminar el día sabiendo algo nuevo."
      },
      "pt": {
        "nickname": "Curioso de Carteirinha",
        "tagline": "Sempre sobra mais uma pergunta para deixar nas respostas.",
        "comment": "Quando um assunto que você não conhece aparece na timeline, você pergunta em vez de rolar a tela. Cada boa resposta abre outra aba e outra dúvida. Ser especialista importa menos do que terminar o dia sabendo algo novo."
      },
      "ar": {
        "nickname": "يسأل عن كل شيء",
        "tagline": "هناك دائمًا سؤال آخر تتركه في الردود.",
        "comment": "حين يظهر على خطك الزمني موضوع لا تعرفه، تسأل بدل أن تمرّ عليه. كل إجابة جيدة تفتح لك تبويبًا جديدًا وسؤالًا جديدًا. لا يهمك أن تكون خبيرًا بقدر ما يهمك أن تنهي يومك وقد عرفت شيئًا جديدًا."
      },
      "fr": {
        "nickname": "Curieux de Tout",
        "tagline": "Il reste toujours une question à glisser dans les réponses.",
        "comment": "Quand un sujet que tu ne connais pas passe dans ta timeline, tu poses la question au lieu de faire défiler. Chaque bonne réponse ouvre un nouvel onglet et une nouvelle question. Être expert compte moins pour toi que finir la journée en ayant appris quelque chose."
      },
      "de": {
        "nickname": "Will alles wissen",
        "tagline": "Es gibt immer noch eine Frage für die Antworten.",
        "comment": "Taucht in deiner Timeline ein Thema auf, von dem du keine Ahnung hast, fragst du nach, statt weiterzuscrollen. Jede gute Antwort öffnet einen neuen Tab und eine neue Frage. Experte zu sein ist dir weniger wichtig, als den Tag mit etwas Neuem zu beenden."
      },
      "it": {
        "nickname": "Mille Domande",
        "tagline": "C'è sempre un'altra domanda da lasciare nelle risposte.",
        "comment": "Quando nella tua timeline compare un argomento che non conosci, fai una domanda invece di scorrere oltre. Ogni buona risposta apre una nuova scheda e un nuovo dubbio. Essere esperto ti importa meno che finire la giornata sapendo qualcosa di nuovo."
      },
      "ja": {
        "nickname": "知りたがり",
        "tagline": "スレッドが終わる前に、もう次の疑問が浮かんでいる。",
        "comment": "知らない話題がタイムラインに流れてくると、スルーせずにリプで質問してしまう。面白い答えがひとつ返ってくるたびに、新しいタブと新しい疑問が増えていく。何かの専門家になるより、今日ひとつ新しいことを知れたらそれでいい。"
      },
      "ko": {
        "nickname": "호기심 대장",
        "tagline": "스레드가 끝나기도 전에 다음 질문이 떠올라요.",
        "comment": "모르는 주제가 타임라인에 뜨면 그냥 넘기지 않고 답글로 질문부터 남겨요. 재미있는 답이 하나 돌아올 때마다 새 탭과 새 궁금증이 늘어나죠. 모든 분야의 전문가가 되기보다 오늘 새로운 걸 하나 알게 되는 게 더 좋아요."
      },
      "zh": {
        "nickname": "什麼都想問",
        "tagline": "一串討論還沒結束，你已經想到下一個問題。",
        "comment": "遇到不熟的話題出現在時間軸上，你不會直接滑過，而是先在留言裡發問。每得到一個有趣的答案，就多開一個分頁、多冒出一個疑問。比起成為什麼專家，今天多學到一點新東西更讓你開心。"
      },
      "ru": {
        "nickname": "Вечно любопытный",
        "tagline": "Тред ещё не закончился, а у тебя уже новый вопрос.",
        "comment": "Если в ленте всплывает незнакомая тема, ты не пролистываешь, а задаёшь вопрос в ответах. Каждый интересный ответ открывает новую вкладку и новый вопрос. Быть экспертом тебе важно меньше, чем закончить день, узнав что-то новое."
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
        "tagline": "En absürt cümleyi tamamen ciddiymiş gibi yazıyorsun.",
        "comment": "Saçma bir fikri, sıradan bir duyuru paylaşır gibi tek satırda paylaşıyorsun. Emoji yok, açıklama yok; ciddi olup olmadığını anlamak reply'lara kalıyor. Birinin sonunda espriyi fark ettiği an, senin için en iyi etkileşim."
      },
      "en": {
        "nickname": "Dry Wit",
        "tagline": "You post the absurd as if it were breaking news.",
        "comment": "You share a ridiculous thought in the same flat style as a service announcement. No emoji, no clarification, so the replies have to work out whether you meant it. The moment someone finally gets it is your favorite kind of engagement."
      },
      "es": {
        "nickname": "Cara de Póker",
        "tagline": "Publicas lo absurdo como si fuera una noticia de última hora.",
        "comment": "Compartes una idea ridícula con el mismo estilo seco de un comunicado oficial. Sin emojis ni aclaraciones, así que las respuestas tienen que averiguar si iba en serio. El momento en que alguien por fin lo entiende es tu interacción favorita."
      },
      "pt": {
        "nickname": "Cara de Paisagem",
        "tagline": "Você posta o absurdo como se fosse notícia urgente.",
        "comment": "Você compartilha uma ideia ridícula no mesmo estilo seco de um comunicado oficial. Sem emoji e sem aviso, então as respostas precisam descobrir se era sério. O momento em que alguém finalmente entende é a sua interação favorita."
      },
      "ar": {
        "nickname": "مزاح بوجه جاد",
        "tagline": "تنشر العبث كأنه خبر عاجل.",
        "comment": "تشارك فكرة سخيفة بالأسلوب الجاف نفسه الذي يُكتب به بيان رسمي. بلا رموز تعبيرية ولا توضيح، فتضطر الردود إلى معرفة إن كنت تقصدها فعلًا. اللحظة التي يفهم فيها أحدهم النكتة أخيرًا هي تفاعلك المفضل."
      },
      "fr": {
        "nickname": "Humour Pince-sans-rire",
        "tagline": "Tu publies l'absurde comme une information de dernière minute.",
        "comment": "Tu partages une idée absurde avec le même style sec qu'un communiqué officiel. Pas d'émoji, pas de précision, alors les réponses doivent deviner si c'était sérieux. Le moment où quelqu'un comprend enfin, c'est ton interaction préférée."
      },
      "de": {
        "nickname": "Staubtrockener Humor",
        "tagline": "Du postest Absurdes, als wäre es eine Eilmeldung.",
        "comment": "Du teilst eine völlig absurde Idee im gleichen nüchternen Stil wie eine offizielle Mitteilung. Kein Emoji, kein Hinweis, also müssen die Antworten herausfinden, ob du es ernst meinst. Der Moment, in dem es endlich jemand versteht, ist deine liebste Interaktion."
      },
      "it": {
        "nickname": "Faccia Impassibile",
        "tagline": "Pubblichi l'assurdo come se fosse un'ultima ora.",
        "comment": "Condividi un'idea assurda con lo stesso stile asciutto di un comunicato ufficiale. Niente emoji, nessuna precisazione, così le risposte devono capire se facevi sul serio. Il momento in cui qualcuno finalmente capisce è la tua interazione preferita."
      },
      "ja": {
        "nickname": "真顔でボケる人",
        "tagline": "どんなに変なことも、ニュース速報のようにポストする。",
        "comment": "突拍子もない思いつきを、公式のお知らせのような淡々とした文でポストする。絵文字もなく補足もないので、本気かどうかはリプ欄が考えるしかない。誰かがやっと気づいた瞬間が、いちばん好きな反応だ。"
      },
      "ko": {
        "nickname": "무표정 개그",
        "tagline": "아무리 엉뚱한 말도 속보처럼 올려요.",
        "comment": "말도 안 되는 생각을 공식 공지처럼 담담한 문장으로 올려요. 이모지도 부연 설명도 없으니 진심인지는 답글들이 알아내야 하죠. 누군가 마침내 알아챈 그 순간이 가장 좋아하는 반응이에요."
      },
      "zh": {
        "nickname": "正經講笑話",
        "tagline": "再離譜的事，你都能寫得像快訊一樣。",
        "comment": "你把荒謬的想法，用公告一樣平淡的文字發成貼文。沒有表情符號，也沒有補充說明，是不是認真只能交給留言區去猜。有人終於看懂的那一刻，就是你最喜歡的互動。"
      },
      "ru": {
        "nickname": "Шутит с серьёзным лицом",
        "tagline": "Любую нелепость ты постишь как срочную новость.",
        "comment": "Абсурдную мысль ты публикуешь тем же сухим стилем, что и официальное объявление. Ни эмодзи, ни пояснений, так что ответам приходится гадать, всерьёз ли это. Момент, когда кто-то наконец понимает шутку, — твоя любимая реакция."
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
      "Sofa Philosopher",
      "Filósofo de Boteco",
      "فيلسوف المقهى",
      "Philosoph am Küchentisch",
      "Filosofo da Bar"
    ],
    "locales": {
      "tr": {
        "nickname": "Koltuk Filozofu",
        "tagline": "Sıradan bir soru sende uzun bir thread'e dönüşebiliyor.",
        "comment": "Gelip geçen bir soruya cevap yazarken kendini beklenmedik bir hayat teorisinin içinde buluyorsun. Taslakta birkaç kez düzenlemeden fikri paylaşmıyorsun. Biri reply'da itiraz edince keyfin kaçmıyor; asıl sohbet orada başlıyor."
      },
      "en": {
        "nickname": "Armchair Philosopher",
        "tagline": "A casual question can turn into a very long thread.",
        "comment": "You start answering a passing question and end up with an unexpected theory about life. You edit the draft a few times before letting the idea go live. A good objection in the replies does not bother you; that is where the real conversation starts."
      },
      "es": {
        "nickname": "Filósofo de Sofá",
        "tagline": "Una pregunta casual puede convertirse en un hilo larguísimo.",
        "comment": "Empiezas respondiendo a una pregunta de paso y terminas con una teoría inesperada sobre la vida. Editas el borrador varias veces antes de publicar la idea. Una buena objeción en las respuestas no te molesta: ahí empieza la conversación de verdad."
      },
      "pt": {
        "nickname": "Filósofo de Timeline",
        "tagline": "Uma pergunta casual pode virar uma thread enorme.",
        "comment": "Você começa respondendo a uma pergunta qualquer e termina com uma teoria inesperada sobre a vida. Edita o rascunho algumas vezes antes de publicar a ideia. Uma boa objeção nas respostas não te incomoda: é ali que a conversa de verdade começa."
      },
      "ar": {
        "nickname": "فيلسوف الخط الزمني",
        "tagline": "سؤال عابر قد يتحول عندك إلى سلسلة طويلة.",
        "comment": "تبدأ بالرد على سؤال عابر فتنتهي بنظرية غير متوقعة عن الحياة. تعدّل المسودة أكثر من مرة قبل أن تنشر الفكرة. الاعتراض الجيد في الردود لا يزعجك، فمن هناك يبدأ النقاش الحقيقي."
      },
      "fr": {
        "nickname": "Philosophe du Dimanche",
        "tagline": "Une question en passant peut devenir un très long fil.",
        "comment": "Tu commences par répondre à une question anodine et tu finis avec une théorie inattendue sur la vie. Tu retravailles le brouillon plusieurs fois avant de publier l'idée. Une bonne objection dans les réponses ne te dérange pas\u00a0: c'est là que la vraie discussion commence."
      },
      "de": {
        "nickname": "Philosoph der Timeline",
        "tagline": "Aus einer beiläufigen Frage kann ein sehr langer Thread werden.",
        "comment": "Du beginnst mit der Antwort auf eine beiläufige Frage und landest bei einer überraschenden Theorie über das Leben. Den Entwurf überarbeitest du mehrmals, bevor die Idee online geht. Ein guter Einwand in den Antworten stört dich nicht, denn dort fängt die echte Diskussion an."
      },
      "it": {
        "nickname": "Filosofo da Timeline",
        "tagline": "Una domanda buttata lì può diventare un thread lunghissimo.",
        "comment": "Inizi rispondendo a una domanda qualunque e finisci con una teoria inaspettata sulla vita. Ritocchi la bozza più volte prima di pubblicare l'idea. Un'obiezione ben fatta nelle risposte non ti dà fastidio: è lì che comincia la vera discussione."
      },
      "ja": {
        "nickname": "自称哲学者",
        "tagline": "何気ない質問が、いつの間にか長いスレッドになっている。",
        "comment": "何気ない質問にリプしているうちに、人生についての意外な持論ができあがっている。投稿する前に、下書きを何度も手直ししてしまう。リプで反論されても気にならない。むしろ本当の議論はそこから始まる。"
      },
      "ko": {
        "nickname": "자칭 철학자",
        "tagline": "가벼운 질문이 어느새 긴 스레드가 돼요.",
        "comment": "지나가는 질문에 답글을 달다 보면 어느새 인생에 대한 의외의 지론이 완성돼요. 올리기 전에 임시저장한 글을 몇 번이나 고치죠. 답글에서 누가 반박해도 괜찮아요. 진짜 토론은 오히려 거기서 시작되니까요."
      },
      "zh": {
        "nickname": "自封哲學家",
        "tagline": "一個隨口的問題，常常變成一長串討論。",
        "comment": "回覆一個隨口的問題，寫著寫著就變成一套關於人生的奇怪見解。發文前，你會把草稿改上好幾次。有人在留言裡反駁也沒關係，真正的討論反而從那裡開始。"
      },
      "ru": {
        "nickname": "Домашний философ",
        "tagline": "Случайный вопрос легко превращается в длинный тред.",
        "comment": "Начинаешь с ответа на мимолётный вопрос, а заканчиваешь неожиданной теорией о жизни. Перед публикацией ты несколько раз правишь черновик. Хорошее возражение в ответах тебя не смущает, ведь настоящий спор начинается именно там."
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
      "Vibe Radar",
      "Reads the Room"
    ],
    "locales": {
      "tr": {
        "nickname": "Ortamı Okuyan",
        "tagline": "Ne yazacağın kadar ne zaman yazacağını da önemsiyorsun.",
        "comment": "Bir yorum zincirinde yalnız en çok beğenilen cevaplara değil, söze karışamayan hesaplara da dikkat ediyorsun. Gerginleşen bir tartışmada bazen bir soru, bazen de iyi seçilmiş bir gif her şeyi yumuşatıyor. Herkesin rahatça yazabildiği bir timeline sana daha keyifli geliyor."
      },
      "en": {
        "nickname": "Reads the Timeline",
        "tagline": "You know when a reply helps and when it is better to wait.",
        "comment": "In a busy thread you notice not just the top replies but the accounts that cannot get a word in. Sometimes a question helps, sometimes a well-chosen gif cools everything down. You enjoy the timeline most when everyone feels comfortable posting."
      },
      "es": {
        "nickname": "Lector del Ambiente",
        "tagline": "Sabes cuándo una respuesta ayuda y cuándo es mejor esperar.",
        "comment": "En un hilo con mucho movimiento no solo miras las respuestas más populares, también a quien no consigue meter baza. A veces ayuda una pregunta; otras, un gif bien elegido lo calma todo. Disfrutas más el timeline cuando todo el mundo se siente cómodo publicando."
      },
      "pt": {
        "nickname": "Sente o Clima",
        "tagline": "Você sabe quando uma resposta ajuda e quando é melhor esperar.",
        "comment": "Numa thread movimentada, você presta atenção não só nas respostas mais curtidas, mas também em quem não consegue entrar na conversa. Às vezes uma pergunta ajuda; às vezes um gif bem escolhido acalma tudo. A timeline fica mais divertida para você quando todo mundo se sente à vontade para postar."
      },
      "ar": {
        "nickname": "يعرف متى يتكلم",
        "tagline": "تعرف متى يفيد الرد ومتى يكون الانتظار أفضل.",
        "comment": "في سلسلة مزدحمة لا تنتبه إلى الردود الأكثر إعجابًا فقط، بل إلى الحسابات التي لا تجد مكانًا في النقاش أيضًا. أحيانًا يفيد سؤال، وأحيانًا تهدّئ صورة متحركة مختارة بعناية كل شيء. يصبح الخط الزمني أمتع لك حين يشعر الجميع بالراحة في النشر."
      },
      "fr": {
        "nickname": "Parle au Bon Moment",
        "tagline": "Tu sais quand une réponse aide et quand il vaut mieux attendre.",
        "comment": "Dans un fil animé, tu remarques les réponses les plus aimées, mais aussi les comptes qui n'arrivent pas à placer un mot. Parfois une question aide, parfois un gif bien choisi calme tout le monde. Tu profites davantage de la timeline quand chacun se sent à l'aise pour publier."
      },
      "de": {
        "nickname": "Gespür für den Moment",
        "tagline": "Du weißt, wann eine Antwort hilft und wann Warten besser ist.",
        "comment": "In einem vollen Thread siehst du nicht nur die meistgelikten Antworten, sondern auch die Accounts, die nicht zu Wort kommen. Manchmal hilft eine Frage, manchmal beruhigt ein gut gewähltes GIF alles. Die Timeline macht dir am meisten Spaß, wenn sich alle trauen zu posten."
      },
      "it": {
        "nickname": "Tempismo Perfetto",
        "tagline": "Sai quando una risposta aiuta e quando è meglio aspettare.",
        "comment": "In un thread affollato noti non solo le risposte con più like, ma anche gli account che non riescono a dire la loro. A volte serve una domanda, a volte una gif scelta bene calma tutti. La timeline ti piace di più quando tutti si sentono a loro agio a pubblicare."
      },
      "ja": {
        "nickname": "空気が読める人",
        "tagline": "リプすべきときと、待つべきときがわかっている。",
        "comment": "にぎやかなスレッドでは、いいねの多いリプだけでなく、なかなか会話に入れないアカウントにも気づく。質問ひとつが効くときもあれば、ぴったりの画像ひとつでスレッド全体が落ち着くこともある。みんなが気楽にポストできるタイムラインがいちばん楽しい。"
      },
      "ko": {
        "nickname": "눈치 백단",
        "tagline": "답글이 필요한 때와 기다려야 할 때를 알아요.",
        "comment": "북적이는 스레드에서는 좋아요가 많은 답글뿐 아니라 좀처럼 대화에 끼지 못하는 계정도 놓치지 않아요. 질문 하나가 통할 때도 있고, 딱 맞는 움짤 하나가 분위기를 가라앉힐 때도 있죠. 누구나 편하게 글을 올릴 수 있는 타임라인이 제일 즐거워요."
      },
      "zh": {
        "nickname": "很會看氣氛",
        "tagline": "你知道什麼時候該回覆，什麼時候該等一等。",
        "comment": "在熱鬧的討論串裡，你注意的不只是讚最多的留言，還有一直插不上話的帳號。有時一個問題就夠了，有時一張選對的動圖就能讓整串冷靜下來。當每個人都能自在發文，這條時間軸對你來說最有趣。"
      },
      "ru": {
        "nickname": "Чувствует момент",
        "tagline": "Ты знаешь, когда ответ поможет, а когда лучше подождать.",
        "comment": "В оживлённом треде ты замечаешь не только самые залайканные ответы, но и аккаунты, которым никак не удаётся вставить слово. Иногда помогает вопрос, иногда удачная гифка успокаивает всех. Лента тебе нравится больше всего, когда каждый может спокойно постить."
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
      "Drama Fire Crew",
      "Masadaki Hakem",
      "حكيم المجلس",
      "Ruhepol der Runde"
    ],
    "locales": {
      "tr": {
        "nickname": "Tartışma Hakemi",
        "tagline": "Haklı çıkmaktan önce tartışmanın düzgün ilerlemesini önemsiyorsun.",
        "comment": "Reply'lar karşılıklı atışmaya dönünce önce iki tarafın aslında ne demek istediğini anlamaya çalışıyorsun. Birine hak vermek için ötekini ekran görüntüsüyle köşeye sıkıştırmak gerekmiyor. Thread'in sonunda herkes biraz daha sakin yazıyorsa bu senin için iyi bir sonuç."
      },
      "en": {
        "nickname": "Voice of Reason",
        "tagline": "You can disagree in the replies without making it personal.",
        "comment": "When the replies turn into a back-and-forth, you try to figure out what each side actually means. You do not need a screenshot war to agree with someone. If the thread ends with people posting a little more calmly, that counts as a win."
      },
      "es": {
        "nickname": "La Voz Sensata",
        "tagline": "Puedes discrepar en las respuestas sin llevarlo a lo personal.",
        "comment": "Cuando las respuestas se convierten en un ida y vuelta, intentas entender qué quiere decir cada parte. No hace falta una guerra de capturas de pantalla para darle la razón a alguien. Si el hilo termina con la gente escribiendo un poco más tranquila, para ti es una victoria."
      },
      "pt": {
        "nickname": "Bom Senso em Pessoa",
        "tagline": "Você discorda nas respostas sem levar para o lado pessoal.",
        "comment": "Quando as respostas viram um bate-boca, você tenta entender o que cada lado quer dizer de verdade. Não precisa de guerra de print para dar razão a alguém. Se a thread termina com todo mundo escrevendo um pouco mais calmo, isso já é uma vitória."
      },
      "ar": {
        "nickname": "حكيم النقاشات",
        "tagline": "تستطيع أن تختلف في الردود دون أن تجعل الأمر شخصيًا.",
        "comment": "حين تتحول الردود إلى تراشق، تحاول أن تفهم ما يقصده كل طرف فعلًا. لا تحتاج إلى حرب لقطات شاشة كي تنصف أحدًا. إذا انتهت السلسلة والجميع يكتب بهدوء أكبر، فهذا انتصار بالنسبة إليك."
      },
      "fr": {
        "nickname": "Garde la Tête Froide",
        "tagline": "Tu peux être en désaccord dans les réponses sans que ça devienne personnel.",
        "comment": "Quand les réponses tournent au ping-pong, tu essaies de comprendre ce que chaque camp veut vraiment dire. Pas besoin d'une guerre de captures d'écran pour donner raison à quelqu'un. Si le fil se termine avec des messages un peu plus calmes, c'est une victoire pour toi."
      },
      "de": {
        "nickname": "Ruhepol im Thread",
        "tagline": "Du kannst in den Antworten widersprechen, ohne persönlich zu werden.",
        "comment": "Wenn die Antworten zum Schlagabtausch werden, versuchst du zu verstehen, was jede Seite eigentlich meint. Du brauchst keinen Screenshot-Krieg, um jemandem recht zu geben. Endet der Thread mit etwas ruhigeren Posts, ist das für dich ein Erfolg."
      },
      "it": {
        "nickname": "Mette Tutti d'Accordo",
        "tagline": "Sai non essere d'accordo nelle risposte senza farne una questione personale.",
        "comment": "Quando le risposte diventano un botta e risposta, provi a capire cosa intende davvero ciascuna parte. Non serve una guerra di screenshot per dare ragione a qualcuno. Se il thread finisce con messaggi un po' più calmi, per te è una vittoria."
      },
      "ja": {
        "nickname": "まとめ役",
        "tagline": "意見が違っても、リプ欄をけんか腰にはしない。",
        "comment": "リプの応酬が始まると、まずそれぞれが本当は何を言いたいのかを理解しようとする。誰かに賛成するのに、スクショ合戦はいらない。スレッドの最後にみんなが少し落ち着いて書けていたら、それで勝ちだ。"
      },
      "ko": {
        "nickname": "중재 담당",
        "tagline": "의견이 달라도 답글 창을 싸움판으로 만들지 않아요.",
        "comment": "답글이 말싸움으로 번지면 먼저 각자가 정말 하고 싶은 말이 뭔지 파악하려고 해요. 누군가의 편을 들기 위해 캡처 전쟁까지 할 필요는 없죠. 스레드가 끝날 때 모두가 조금 더 차분하게 글을 쓰고 있다면 그걸로 성공이에요."
      },
      "zh": {
        "nickname": "負責打圓場",
        "tagline": "意見不同，也不會讓留言區吵成一團。",
        "comment": "留言變成你來我往的互嗆時，你會先弄清楚每一方真正想說什麼。要支持某個人，不需要打一場截圖大戰。如果整串討論最後大家都寫得平靜一點，對你來說就是贏了。"
      },
      "ru": {
        "nickname": "Сглаживает углы",
        "tagline": "Ты можешь спорить в ответах, не переходя на личности.",
        "comment": "Когда ответы превращаются в перепалку, ты сначала пытаешься понять, что на самом деле хочет сказать каждая сторона. Чтобы с кем-то согласиться, не нужна война скриншотов. Если тред заканчивается чуть более спокойными сообщениями, для тебя это победа."
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
        "tagline": "Göndermeden önce taslağı bir kez daha okuyorsun.",
        "comment": "Kısa bir reply yazarken bile noktanın fazla ciddi, ünlemin fazla hevesli durup durmadığını düşünüyorsun. Bir emoji ekleyip siliyor, kelimeyi değiştirip geri alıyorsun. Sonunda ilk yazdığını gönderince kendine biraz gülüyorsun."
      },
      "en": {
        "nickname": "Second Guesser",
        "tagline": "Even a short reply deserves another look.",
        "comment": "Even a two-word reply gets checked for whether the period sounds too cold or the exclamation mark too eager. You add an emoji, delete it, swap a word and swap it back. Sending the first version after all that is a familiar little victory."
      },
      "es": {
        "nickname": "Lo Piensa Dos Veces",
        "tagline": "Hasta una respuesta corta merece otra lectura.",
        "comment": "Incluso una respuesta de dos palabras pasa por la duda de si el punto suena demasiado frío o la exclamación demasiado entusiasta. Añades un emoji, lo borras, cambias una palabra y la vuelves a poner. Enviar la primera versión después de todo eso es una pequeña victoria conocida."
      },
      "pt": {
        "nickname": "Relê Antes de Mandar",
        "tagline": "Até uma resposta curta merece mais uma lida.",
        "comment": "Até uma resposta de duas palavras passa pela dúvida se o ponto final soa frio demais ou a exclamação animada demais. Você coloca um emoji, apaga, troca uma palavra e destroca. Mandar a primeira versão depois disso tudo é uma pequena vitória conhecida."
      },
      "ar": {
        "nickname": "يقرأ رسالته مرتين",
        "tagline": "حتى الرد القصير يستحق نظرة أخرى.",
        "comment": "حتى الرد المكوّن من كلمتين يمر عندك بسؤال إن كانت النقطة باردة أكثر من اللازم أو علامة التعجب متحمسة أكثر من اللازم. تضيف رمزًا تعبيريًا ثم تحذفه، وتغيّر كلمة ثم تعيدها. إرسال النسخة الأولى بعد كل ذلك انتصار صغير مألوف."
      },
      "fr": {
        "nickname": "Jamais Sans Relire",
        "tagline": "Même une réponse courte mérite une relecture.",
        "comment": "Même une réponse de deux mots passe par la question de savoir si le point est trop froid ou le point d'exclamation trop enthousiaste. Tu ajoutes un émoji, tu l'effaces, tu changes un mot puis tu le remets. Envoyer la première version après tout ça, c'est une petite victoire bien connue."
      },
      "de": {
        "nickname": "Liest lieber nochmal",
        "tagline": "Selbst eine kurze Antwort verdient einen zweiten Blick.",
        "comment": "Selbst bei einer Antwort aus zwei Wörtern fragst du dich, ob der Punkt zu kühl oder das Ausrufezeichen zu begeistert wirkt. Du fügst ein Emoji ein, löschst es, tauschst ein Wort und tauschst es zurück. Danach doch die erste Version abzuschicken, ist ein vertrauter kleiner Sieg."
      },
      "it": {
        "nickname": "Rilegge Sempre",
        "tagline": "Anche una risposta breve merita una seconda lettura.",
        "comment": "Anche una risposta di due parole passa per il dubbio se il punto sia troppo freddo o il punto esclamativo troppo entusiasta. Aggiungi un'emoji, la cancelli, cambi una parola e poi la rimetti. Mandare la prima versione dopo tutto questo è una piccola vittoria che conosci bene."
      },
      "ja": {
        "nickname": "読み返し派",
        "tagline": "短いリプでも、送る前にもう一度読み返す。",
        "comment": "ほんの二語のリプでも、句点は冷たすぎないか、びっくりマークははしゃぎすぎないかと考えてしまう。絵文字を足しては消し、言葉を変えてはまた戻す。結局最初の文を送信して、自分の迷いにちょっと笑ってしまう。"
      },
      "ko": {
        "nickname": "다시 읽는 사람",
        "tagline": "짧은 답글도 보내기 전에 한 번 더 읽어요.",
        "comment": "두 단어짜리 답글에도 마침표가 너무 차가운지, 느낌표가 너무 들뜬지 고민하게 돼요. 이모지를 넣었다 지우고, 단어를 바꿨다 다시 돌려놓죠. 결국 처음 쓴 문장을 보내고 혼자 고민한 게 웃겨서 피식 웃어요."
      },
      "zh": {
        "nickname": "送出前再看一次",
        "tagline": "再短的回覆，送出前都要再讀一次。",
        "comment": "就算只是兩個字的回覆，你也會想句號會不會太冷、驚嘆號會不會太興奮。加了表情符號又刪掉，換了詞又換回來。最後還是送出最早寫好的那一句，然後笑自己想太多。"
      },
      "ru": {
        "nickname": "Перечитывает перед отправкой",
        "tagline": "Даже короткий ответ ты перечитываешь ещё раз.",
        "comment": "Даже в ответе из двух слов думаешь, не слишком ли холодно выглядит точка и не слишком ли бодро — восклицательный знак. Добавляешь эмодзи, удаляешь, меняешь слово и возвращаешь обратно. В итоге отправляешь первый вариант и смеёшься над собой."
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
        "tagline": "Az paylaşsan da akılda kalan bir cümlen hep oluyor.",
        "comment": "Timeline'daki her boşluğu doldurma ihtiyacı duymuyorsun; çoğu zaman sessizce okuyup geçiyorsun. Paylaştığında kısa ama akılda kalan bir cümle seçiyorsun. Birinin o cümleyi günler sonra alıntılaması hoşuna gidiyor."
      },
      "en": {
        "nickname": "Quiet Charmer",
        "tagline": "You post rarely, but people remember the ones you do.",
        "comment": "You do not feel the need to fill every gap in the timeline; most days you just read and scroll. When you do post, it is short and it sticks. It is quietly satisfying when someone quotes that line days later."
      },
      "es": {
        "nickname": "Encanto Discreto",
        "tagline": "Publicas poco, pero lo que publicas se recuerda.",
        "comment": "No sientes la necesidad de llenar cada hueco del timeline; muchos días solo lees y sigues bajando. Cuando publicas, es breve y se queda. Te gusta en silencio que alguien cite esa frase días después."
      },
      "pt": {
        "nickname": "De Poucas Palavras",
        "tagline": "Você posta pouco, mas o que posta fica na memória.",
        "comment": "Você não sente necessidade de preencher cada espaço da timeline; na maioria dos dias só lê e segue rolando. Quando posta, é curto e marca. É uma alegria discreta ver alguém citar aquela frase dias depois."
      },
      "ar": {
        "nickname": "حضور بلا ضجيج",
        "tagline": "تنشر قليلًا، لكن ما تنشره يبقى في الذاكرة.",
        "comment": "لا تشعر بالحاجة إلى ملء كل فراغ في الخط الزمني، ففي أغلب الأيام تقرأ وتواصل التمرير. وحين تنشر يكون ما تكتبه قصيرًا ويبقى. يسعدك بهدوء أن يقتبس أحدهم تلك الجملة بعد أيام."
      },
      "fr": {
        "nickname": "Discret mais Marquant",
        "tagline": "Tu publies peu, mais ce que tu publies marque.",
        "comment": "Tu n'éprouves pas le besoin de remplir chaque silence de la timeline\u00a0; la plupart du temps, tu lis et tu fais défiler. Quand tu publies, c'est court et ça reste. Ça te fait discrètement plaisir quand quelqu'un cite cette phrase quelques jours plus tard."
      },
      "de": {
        "nickname": "Leise und einprägsam",
        "tagline": "Du postest selten, aber was du postest, bleibt hängen.",
        "comment": "Du musst nicht jede Lücke in der Timeline füllen; an den meisten Tagen liest du nur mit und scrollst weiter. Wenn du postest, ist es kurz und bleibt hängen. Es freut dich still, wenn jemand diesen Satz Tage später zitiert."
      },
      "it": {
        "nickname": "Presenza Discreta",
        "tagline": "Pubblichi poco, ma quello che pubblichi resta.",
        "comment": "Non senti il bisogno di riempire ogni vuoto della timeline; quasi sempre leggi e scorri. Quando pubblichi, è breve e lascia il segno. Ti fa piacere, in silenzio, quando qualcuno cita quella frase giorni dopo."
      },
      "ja": {
        "nickname": "静かな存在感",
        "tagline": "ポストは少なくても、なぜか覚えられている。",
        "comment": "タイムラインのすきまを全部埋めようとは思わない。ほとんどの日は読んでスクロールするだけだ。ポストするときは短いけれど、ちゃんと残る。何日かあとに誰かがその一文を引用してくれると、ひそかにうれしい。"
      },
      "ko": {
        "nickname": "조용한 존재감",
        "tagline": "자주 올리지 않아도 올린 글은 기억에 남아요.",
        "comment": "타임라인의 빈틈을 전부 채울 필요는 없다고 생각해요. 대부분은 읽고 스크롤만 하죠. 글을 올릴 때는 짧지만 오래 남는 한 문장을 골라요. 며칠 뒤 누군가 그 문장을 인용하면 조용히 기뻐요."
      },
      "zh": {
        "nickname": "安靜的存在感",
        "tagline": "你很少發文，但發過的總讓人記得。",
        "comment": "你不覺得需要把時間軸的每個空檔都填滿，大多數日子只是看看、往下滑。真的發文時，句子很短卻會留下來。幾天後有人引用那句話，你就會暗自開心。"
      },
      "ru": {
        "nickname": "Тихое присутствие",
        "tagline": "Постишь редко, но твои посты запоминаются.",
        "comment": "Тебе не нужно заполнять каждую паузу в ленте; чаще всего ты просто читаешь и листаешь дальше. Когда ты постишь, это коротко и остаётся в памяти. Тебе тихо приятно, когда кто-то цитирует эту фразу через несколько дней."
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
      "Room Update",
      "Life of the Party",
      "Alma de la Fiesta",
      "Anima Qualquer Roda",
      "روح الجلسة"
    ],
    "locales": {
      "tr": {
        "nickname": "Ortamı Canlandıran",
        "tagline": "Sessizleşen bir thread'i ilk hareketlendiren sen oluyorsun.",
        "comment": "Yorumlar durgunlaşınca herkesin katılabileceği bir soru ya da mini bir anket açıyorsun. Kimseyi etiketleyip zorlamadan insanları sohbete çekmek hoşuna gidiyor. Konu tamamen başka bir yere gitse de kimse sıkılmıyorsa senin için sorun yok."
      },
      "en": {
        "nickname": "Life of the Thread",
        "tagline": "You are the one who wakes up a quiet thread.",
        "comment": "When the replies go quiet, you start a question or a quick poll everyone can join. You like pulling people into the conversation without tagging anyone on the spot. The topic can drift somewhere completely different as long as nobody is bored."
      },
      "es": {
        "nickname": "Alma del Hilo",
        "tagline": "Eres quien despierta un hilo que se había quedado callado.",
        "comment": "Cuando las respuestas se apagan, lanzas una pregunta o una encuesta rápida en la que todos puedan participar. Te gusta sumar gente a la conversación sin etiquetar a nadie para ponerlo en aprietos. El tema puede terminar en otro sitio siempre que nadie se aburra."
      },
      "pt": {
        "nickname": "Anima Qualquer Conversa",
        "tagline": "Você é quem acorda uma thread que tinha ficado parada.",
        "comment": "Quando as respostas esfriam, você lança uma pergunta ou uma enquete rápida em que todo mundo pode entrar. Gosta de puxar gente para a conversa sem marcar ninguém para colocar em saia justa. O assunto pode ir parar em outro lugar, desde que ninguém fique entediado."
      },
      "ar": {
        "nickname": "روح النقاش",
        "tagline": "أنت من يوقظ سلسلة هدأت فيها الردود.",
        "comment": "حين تهدأ الردود تطرح سؤالًا أو استطلاعًا سريعًا يستطيع الجميع الانضمام إليه. يعجبك أن تجذب الناس إلى النقاش دون أن تضع أحدًا في موقف محرج بالإشارة إليه. قد ينتقل الموضوع إلى مكان آخر تمامًا، والمهم ألا يملّ أحد."
      },
      "fr": {
        "nickname": "Vrai Boute-en-train",
        "tagline": "C'est toi qui réveilles un fil resté silencieux.",
        "comment": "Quand les réponses s'essoufflent, tu lances une question ou un sondage rapide auquel tout le monde peut participer. Tu aimes embarquer les gens dans la discussion sans identifier personne pour le mettre mal à l'aise. Le sujet peut dériver complètement, tant que personne ne s'ennuie."
      },
      "de": {
        "nickname": "Sorgt für Stimmung",
        "tagline": "Du bist es, der einen stillen Thread wieder aufweckt.",
        "comment": "Wenn die Antworten abflauen, startest du eine Frage oder eine schnelle Umfrage, bei der alle mitmachen können. Du holst Leute gern ins Gespräch, ohne jemanden per Markierung bloßzustellen. Das Thema darf komplett abdriften, solange sich niemand langweilt."
      },
      "it": {
        "nickname": "Porta il Buonumore",
        "tagline": "Sei tu a risvegliare un thread rimasto in silenzio.",
        "comment": "Quando le risposte si spengono, lanci una domanda o un sondaggio veloce a cui tutti possono partecipare. Ti piace coinvolgere le persone senza taggare nessuno per metterlo in imbarazzo. L'argomento può finire altrove, purché nessuno si annoi."
      },
      "ja": {
        "nickname": "盛り上げ役",
        "tagline": "静かになったスレッドを、最初に動かすのはあなただ。",
        "comment": "リプ欄が静かになってきたら、誰でも参加できる質問や手軽なアンケートを出す。誰かをメンションして困らせることなく、自然に会話へ巻き込むのが得意だ。話題がまったく別の方向へ流れても、誰も退屈していなければそれでいい。"
      },
      "ko": {
        "nickname": "흥 담당",
        "tagline": "조용해진 스레드를 제일 먼저 깨우는 사람이에요.",
        "comment": "답글이 잠잠해지면 누구나 참여할 수 있는 질문이나 간단한 투표를 올려요. 누군가를 태그해서 곤란하게 만들지 않고도 자연스럽게 대화로 끌어들이는 데 익숙하죠. 주제가 완전히 딴 데로 흘러가도 아무도 지루하지 않으면 그걸로 충분해요."
      },
      "zh": {
        "nickname": "炒熱氣氛的人",
        "tagline": "安靜下來的討論串，總是你先讓它熱起來。",
        "comment": "留言一冷下來，你就會丟出一個大家都能參與的問題或小投票。你很會把人自然拉進對話，又不會因為標記誰而讓人尷尬。就算話題完全跑偏，只要沒有人無聊，那就夠了。"
      },
      "ru": {
        "nickname": "Заводит компанию",
        "tagline": "Затихший тред первым оживляешь именно ты.",
        "comment": "Когда ответы затихают, ты запускаешь вопрос или быстрый опрос, в котором может поучаствовать каждый. Тебе нравится втягивать людей в разговор, никого не отмечая, чтобы не ставить в неловкое положение. Тема может уйти совсем в другую сторону, лишь бы никому не было скучно."
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
        "tagline": "İyi bir soruyla sıradan bir reply'ı sohbete çeviriyorsun.",
        "comment": "Biri gününden bahsettiğinde 'sonra ne oldu' diye sormadan duramıyorsun. Küçük bir ayrıntı ilgini çekiyor ve thread'in devamını istiyorsun. Seninle başlayan kısa bir DM'in uzaması çoğu zaman bu yüzden."
      },
      "en": {
        "nickname": "Good Listener",
        "tagline": "One good question turns a reply into a real conversation.",
        "comment": "When someone mentions their day in a post, you cannot resist asking what happened next. A small detail catches your interest and you want the rest of the thread. That is usually why a quick DM with you turns into a long one."
      },
      "es": {
        "nickname": "Sabe Escuchar",
        "tagline": "Una buena pregunta convierte una respuesta en una conversación.",
        "comment": "Cuando alguien cuenta su día en una publicación, no puedes evitar preguntar qué pasó después. Un detalle pequeño te llama la atención y quieres el resto del hilo. Por eso un mensaje directo rápido contigo suele acabar siendo largo."
      },
      "pt": {
        "nickname": "Escuta de Verdade",
        "tagline": "Uma boa pergunta transforma uma resposta em conversa.",
        "comment": "Quando alguém conta do dia num post, você não resiste a perguntar o que aconteceu depois. Um detalhe pequeno chama sua atenção e você quer o resto da thread. Por isso uma DM rápida com você costuma virar uma conversa longa."
      },
      "ar": {
        "nickname": "أذن صاغية",
        "tagline": "سؤال جيد واحد يحوّل الرد إلى محادثة حقيقية.",
        "comment": "حين يكتب أحدهم منشورًا عن يومه، لا تستطيع ألا تسأله عما حدث بعد ذلك. تلفت انتباهك تفصيلة صغيرة فتريد بقية السلسلة. لهذا غالبًا ما تطول أي رسالة خاصة سريعة معك."
      },
      "fr": {
        "nickname": "Toujours à l'Écoute",
        "tagline": "Une bonne question transforme une réponse en vraie conversation.",
        "comment": "Quand quelqu'un raconte sa journée dans un post, tu ne peux pas t'empêcher de demander la suite. Un petit détail t'intrigue et tu veux le reste du fil. C'est souvent pour ça qu'un MP rapide avec toi finit par durer."
      },
      "de": {
        "nickname": "Ganz Ohr",
        "tagline": "Eine gute Frage macht aus einer Antwort ein echtes Gespräch.",
        "comment": "Wenn jemand in einem Post von seinem Tag erzählt, musst du einfach fragen, wie es weiterging. Ein kleines Detail macht dich neugierig, und du willst den Rest des Threads. Deshalb wird aus einer kurzen DM mit dir oft eine lange."
      },
      "it": {
        "nickname": "Sempre Tutt'Orecchi",
        "tagline": "Una buona domanda trasforma una risposta in una vera conversazione.",
        "comment": "Quando qualcuno racconta la sua giornata in un post, non resisti a chiedere come è andata a finire. Un piccolo dettaglio ti incuriosisce e vuoi il resto del thread. Per questo un DM veloce con te di solito diventa lungo."
      },
      "ja": {
        "nickname": "聞き上手",
        "tagline": "いい質問ひとつで、リプを本当の会話に変えていく。",
        "comment": "誰かがその日の出来事をポストすると、その後どうなったのか聞かずにはいられない。小さなディテールが気になって、スレッドの続きが読みたくなる。だから、あなたとの短いメッセージのやりとりは、たいてい長くなる。"
      },
      "ko": {
        "nickname": "잘 듣는 사람",
        "tagline": "좋은 질문 하나로 답글을 진짜 대화로 바꿔요.",
        "comment": "누군가 하루 이야기를 게시물로 올리면 그다음에 어떻게 됐는지 묻지 않고는 못 배겨요. 작은 디테일이 궁금해져서 스레드의 다음 이야기가 읽고 싶어지죠. 그래서 당신과의 짧은 메시지는 대개 길어져요."
      },
      "zh": {
        "nickname": "很會聽人說話",
        "tagline": "一個好問題，就能把回覆變成真正的對話。",
        "comment": "有人發文說起今天發生的事，你總忍不住問接下來怎麼了。一個小細節就讓你好奇，想看整串的後續。所以跟你的私訊，通常一聊就停不下來。"
      },
      "ru": {
        "nickname": "Умеет слушать",
        "tagline": "Один хороший вопрос превращает ответ в настоящий разговор.",
        "comment": "Когда кто-то пишет пост о своём дне, ты не можешь не спросить, что было дальше. Маленькая деталь цепляет, и тебе хочется прочитать продолжение треда. Поэтому короткая переписка в личке с тобой обычно затягивается."
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
        "tagline": "Bir olayı anlatış biçimin de thread'in bir parçası.",
        "comment": "Sıradan bir olayı thread'e dökerken en komik ayrıntıyı son post'a saklıyorsun. Aynı hikâyeyi başkası yazsa senin seçtiğin kelimeler eksik kalırmış gibi geliyor. En güzel kısmı, en iyi cümlenin reply'larda alıntılandığını görmek."
      },
      "en": {
        "nickname": "Way with Words",
        "tagline": "You know which detail makes the thread.",
        "comment": "When you turn a small mishap into a thread, you save the funniest detail for the last post. The same story told by anyone else would miss your exact wording. Half the fun is seeing your best line quoted back in the replies."
      },
      "es": {
        "nickname": "Narrador Nato",
        "tagline": "Sabes qué detalle hace funcionar un hilo.",
        "comment": "Cuando conviertes un pequeño desastre en un hilo, guardas el detalle más gracioso para la última publicación. La misma historia contada por otra persona perdería tus palabras exactas. La mitad de la gracia es ver tu mejor frase citada en las respuestas."
      },
      "pt": {
        "nickname": "Bom de Papo",
        "tagline": "Você sabe qual detalhe faz uma thread funcionar.",
        "comment": "Quando você transforma um pequeno perrengue numa thread, guarda o detalhe mais engraçado para o último post. A mesma história contada por outra pessoa perderia as suas palavras exatas. Metade da graça é ver sua melhor frase citada nas respostas."
      },
      "ar": {
        "nickname": "يجيد رواية القصص",
        "tagline": "تعرف أي تفصيلة تصنع السلسلة.",
        "comment": "حين تحوّل موقفًا صغيرًا إلى سلسلة، تحتفظ بأطرف تفصيلة للمنشور الأخير. القصة نفسها لو كتبها غيرك لفقدت كلماتك الدقيقة. نصف المتعة أن ترى أفضل جملة لك مقتبسة في الردود."
      },
      "fr": {
        "nickname": "Sens de la Formule",
        "tagline": "Tu sais quel détail fait tenir un fil.",
        "comment": "Quand tu transformes une petite mésaventure en fil, tu gardes le détail le plus drôle pour le dernier post. La même histoire racontée par quelqu'un d'autre perdrait tes mots exacts. La moitié du plaisir, c'est de voir ta meilleure phrase citée dans les réponses."
      },
      "de": {
        "nickname": "Erzählt mit Pointe",
        "tagline": "Du weißt, welches Detail einen Thread trägt.",
        "comment": "Wenn du ein kleines Missgeschick in einen Thread verwandelst, hebst du das lustigste Detail für den letzten Post auf. Dieselbe Geschichte, von jemand anderem erzählt, hätte nicht deine genauen Worte. Die halbe Freude ist, deinen besten Satz später in den Antworten zitiert zu sehen."
      },
      "it": {
        "nickname": "Sa Raccontarla",
        "tagline": "Sai quale dettaglio fa funzionare un thread.",
        "comment": "Quando trasformi un piccolo disastro in un thread, tieni il dettaglio più divertente per l'ultimo post. La stessa storia raccontata da qualcun altro perderebbe le tue parole esatte. Metà del divertimento è vedere la tua frase migliore citata nelle risposte."
      },
      "ja": {
        "nickname": "オチ担当",
        "tagline": "どの一文がスレッドを面白くするか、ちゃんとわかっている。",
        "comment": "ちょっとした失敗談をスレッドにするとき、いちばん笑えるところは最後のポストまで取っておく。同じ話を別の人が書いたら、あなたの言葉選びが足りなく感じるはずだ。自分の決めゼリフがリプで引用されているのを見るのが、楽しみの半分だ。"
      },
      "ko": {
        "nickname": "이야기꾼",
        "tagline": "어떤 한 줄이 스레드를 살리는지 정확히 알아요.",
        "comment": "작은 실수담을 스레드로 풀 때 가장 웃긴 부분은 마지막 게시물까지 아껴 둬요. 같은 이야기를 다른 사람이 쓰면 당신의 단어 선택이 빠진 것처럼 느껴질 거예요. 나중에 당신의 명대사가 답글에서 인용되는 걸 보는 게 즐거움의 절반이에요."
      },
      "zh": {
        "nickname": "很會說故事",
        "tagline": "哪一句能讓整串變好笑，你抓得很準。",
        "comment": "把一件小糗事寫成串文時，你會把最好笑的細節留到最後一則。同樣的故事換別人來寫，就少了你挑的那些字。看到你的那句經典台詞在留言裡被引用，就是一半的樂趣。"
      },
      "ru": {
        "nickname": "Хороший рассказчик",
        "tagline": "Ты точно знаешь, какая деталь делает тред смешным.",
        "comment": "Превращая мелкую неудачу в тред, ты приберегаешь самую смешную деталь для последнего поста. Та же история от кого-то другого лишилась бы твоих точных слов. Половина удовольствия — увидеть свою лучшую фразу процитированной в ответах."
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
    "Aynı thread'de ya efsane bir ikili olurlar ya da biri bildirimleri kapatır.",
    "XORA bu eşleşmeye güveniyor. XORA'nın neden bu kadar özgüvenli olduğunu bilmiyoruz.",
    "Bilim insanları bu hesabı reddetti. Biz yine de yüzde verdik."
  ],
  en: [
    "XORA's completely unscientific lab finds this pairing suspiciously entertaining.",
    "This percentage proves absolutely nothing. It can still start a group-chat argument.",
    "The card is for fun. The percentage looks unnecessarily official.",
    "In the same thread they are either iconic or somebody mutes the conversation.",
    "XORA believes in this match. Nobody knows why XORA is this confident.",
    "Science rejected the case. We gave it a percentage anyway."
  ],
  es: [
    "El laboratorio nada científico de XORA encontró a este dúo sospechosamente entretenido.",
    "Este porcentaje no demuestra absolutamente nada. Aun así puede encender el chat del grupo.",
    "La tarjeta es de broma. El porcentaje, en cambio, se ve innecesariamente oficial.",
    "En el mismo hilo, o se vuelven un dúo legendario o alguien silencia la conversación.",
    "XORA confía en esta pareja. Nadie sabe de dónde saca tanta seguridad.",
    "La ciencia rechazó el caso. Nosotros igual le pusimos un porcentaje."
  ],
  pt: [
    "O laboratório nada científico da XORA achou essa dupla suspeitamente divertida.",
    "Essa porcentagem não prova absolutamente nada. Mesmo assim, dá para começar uma discussão no grupo.",
    "O cartão é só brincadeira. Já a porcentagem parece oficial demais.",
    "Na mesma thread, ou viram uma dupla lendária ou alguém silencia a conversa.",
    "A XORA acredita nessa dupla. Ninguém sabe de onde vem tanta confiança.",
    "A ciência recusou o caso. A gente deu uma porcentagem mesmo assim."
  ],
  ar: [
    "مختبر XORA البعيد تمامًا عن العلم وجد هذا الثنائي ممتعًا على نحو مريب.",
    "هذه النسبة لا تثبت شيئًا على الإطلاق. لكنها تكفي لإشعال نقاش في مجموعة الأصدقاء.",
    "البطاقة للمرح. أما النسبة فتبدو رسمية أكثر من اللازم.",
    "في السلسلة نفسها، إما أن يصبحا ثنائيًا أسطوريًا أو يكتم أحدهما المحادثة.",
    "XORA واثقة من هذا الثنائي. ولا أحد يعرف مصدر هذه الثقة.",
    "رفض العلم هذه القضية. ومع ذلك أعطيناها نسبة."
  ],
  fr: [
    "Le laboratoire pas du tout scientifique de XORA trouve ce duo étrangement divertissant.",
    "Ce pourcentage ne prouve absolument rien. Il suffit quand même à lancer un débat dans le groupe.",
    "La carte, c'est pour rire. Le pourcentage, lui, a l'air beaucoup trop officiel.",
    "Dans le même fil, soit ils forment un duo culte, soit quelqu'un coupe les notifications.",
    "XORA croit en ce duo. Personne ne sait d'où lui vient une telle assurance.",
    "La science a refusé le dossier. On a quand même donné un pourcentage."
  ],
  de: [
    "Das völlig unwissenschaftliche Labor von XORA findet dieses Duo verdächtig unterhaltsam.",
    "Dieser Prozentwert beweist absolut nichts. Für eine Diskussion im Gruppenchat reicht er trotzdem.",
    "Die Karte ist nur zum Spaß. Der Prozentwert sieht dagegen viel zu offiziell aus.",
    "Im selben Thread sind die beiden entweder ein legendäres Duo, oder jemand schaltet den Chat stumm.",
    "XORA glaubt an dieses Duo. Niemand weiß, woher XORA so viel Selbstvertrauen nimmt.",
    "Die Wissenschaft hat den Fall abgelehnt. Wir haben trotzdem einen Prozentwert vergeben."
  ],
  it: [
    "Il laboratorio per niente scientifico di XORA trova questa coppia sospettosamente divertente.",
    "Questa percentuale non dimostra assolutamente nulla. Però basta per scatenare una discussione nel gruppo.",
    "La carta è per ridere. La percentuale, invece, sembra fin troppo ufficiale.",
    "Nello stesso thread, o diventano una coppia leggendaria o qualcuno silenzia la chat.",
    "XORA crede in questa coppia. Nessuno sa da dove le venga tutta questa sicurezza.",
    "La scienza ha respinto il caso. Noi una percentuale l'abbiamo data lo stesso."
  ],
  ja: [
    "XORAのまったく科学的じゃない研究所は、この2人をやけに面白い組み合わせだと判定しました。",
    "このパーセンテージは何の証明にもなりません。それでもグループチャットを盛り上げるには十分です。",
    "カードは遊びです。なのにパーセンテージだけは妙に本格的に見えます。",
    "同じスレッドにいれば、伝説のコンビになるか、どちらかが通知を切るかのどちらかです。",
    "XORAはこの組み合わせを信じています。その自信がどこから来るのかは誰にもわかりません。",
    "科学には相手にされませんでした。それでもパーセンテージは出しておきました。"
  ],
  ko: [
    "XORA의 전혀 과학적이지 않은 연구소는 이 두 사람을 유난히 재미있는 조합으로 판정했습니다.",
    "이 수치는 아무것도 증명하지 못해요. 그래도 단체 대화방을 달구기에는 충분합니다.",
    "카드는 장난인데 퍼센트만 이상하게 진지해 보이네요.",
    "같은 스레드에 있으면 전설의 콤비가 되거나 한쪽이 알림을 끄거나 둘 중 하나예요.",
    "XORA는 이 조합을 믿습니다. 그 자신감이 어디서 왔는지는 아무도 모르지만요.",
    "과학은 이 건을 반려했어요. 그래도 퍼센트는 내드렸습니다."
  ],
  zh: [
    "XORA 那間完全不科學的實驗室判定，這兩個人是個意外有趣的組合。",
    "這個百分比證明不了什麼。不過拿去群組聊天炒氣氛已經夠用了。",
    "卡片只是玩玩，偏偏百分比看起來特別認真。",
    "在同一串討論裡，不是變成傳說中的搭檔，就是有一方把通知關掉。",
    "XORA 相信這個組合。至於這份自信從哪裡來，沒有人知道。",
    "科學那邊把案子退回來了。百分比我們還是算給你了。"
  ],
  ru: [
    "Совершенно ненаучная лаборатория XORA постановила, что эта пара — неожиданно интересное сочетание.",
    "Этот процент ничего не доказывает. Но чтобы оживить общий чат, его вполне достаточно.",
    "Карточка — это игра, а процент почему-то выглядит подозрительно серьёзно.",
    "В одном треде эти двое либо станут легендарным дуэтом, либо кто-то отключит уведомления.",
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
