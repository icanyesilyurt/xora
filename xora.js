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

function analyzeHandle(rawHandle, mode) {
  var handle = normHandle(rawHandle);
  var h = xhash(handle);
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
