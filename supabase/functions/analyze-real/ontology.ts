// XORA REAL ontology v1 — FROZEN at 150 traits + 48 persistent-interest topics.
// The AI may only return ids from these lists; visible labels come from here, never from the AI.
// Labels are Turkish only for v1; localization follows after validation on saved real accounts.
//
// basis: V   = only the account's own words (original, reply, quote commentary) count as evidence
//        V/S = own words first; reposts may support but never be the only evidence
//        B   = deterministic behaviour ratios, confirmed by own words
// K in a definition = knowledge dimension: scored on demonstrated depth, not on how often the topic appears.

export const ONTOLOGY_VERSION = "real-1.0";

export type TraitBasis = "V" | "V/S" | "B";
export type TraitCategory =
  | "temperament" | "communication" | "humor" | "emotional" | "relational" | "language" | "creativity" | "intellect" | "social"
  | "sports" | "economy" | "politics" | "history" | "science" | "technology" | "literature" | "screen" | "music" | "gaming" | "travel" | "food" | "lifestyle";
export type Trait = { id: string; category: TraitCategory; group: "character" | "interest"; basis: TraitBasis; label: string; definition: string };
export type InterestTopic = { id: string; label: string; traits: string[] };

// Categories A–I describe the person (character/style); J–V describe interests and knowledge.
export const CHARACTER_CATEGORIES: readonly TraitCategory[] = ["temperament","communication","humor","emotional","relational","language","creativity","intellect","social"];

type Row = [id: string, basis: TraitBasis, label: string, definition: string];
const ROWS: Record<TraitCategory, Row[]> = {
  temperament: [
    ["confidence","V","Özgüven","States views plainly, without hedging or seeking approval; self-assured tone."],
    ["calmness","V","Sakinlik","Keeps a measured, even tone, including on heated topics."],
    ["impulsiveness","V","Dürtüsellik","Posts read as instant, unfiltered reactions; quick escalation."],
    ["optimism","V","İyimserlik","Frames events hopefully; expects things to work out."],
    ["pessimism","V","Karamsarlık","Frames events negatively; expects bad outcomes; resignation."],
    ["cynicism","V","Sinizm","Assumes bad faith in people and institutions; distrust with a mocking edge."],
    ["competitiveness","V","Rekabetçilik","Driven to win arguments, rank, compare and be proven right."],
    ["independence","V","Bağımsız Duruş","Holds own positions regardless of crowd or trend; does not echo consensus."],
    ["main_character","V","Kişisel Anlatı Odağı","Places self at the centre; turns own life and opinions into the narrative."],
    ["chaos","V/S","Öngörülemezlik","Unpredictable jumps in topic, tone and register."],
    ["seriousness","V","Ciddiyet","Treats subjects gravely; little room for jokes."],
    ["consistency","V/S","Tutarlılık","Stable tone, topics and stances across posts."],
  ],
  communication: [
    ["directness","V","Direktlik","Says things plainly, without softening or going around the point."],
    ["argumentativeness","B","Tartışmacılık","Engages opposing views; starts and sustains debates, mostly in replies."],
    ["diplomacy","V","Diplomatiklik","Softens disagreement, seeks common ground, de-escalates."],
    ["sharp_tongue","V","Keskin Dil","Cutting, biting, pointed wording."],
    ["persuasiveness","V","İkna Gücü","Builds arguments with reasons and examples to convince the reader."],
    ["brevity","B","Özlü Anlatım","Packs the point into very few words."],
    ["detail_orientation","B","Detaycılık","Long, explanatory posts full of specifics."],
    ["questioning","B","Soru Odaklı Üslup","Frequently asks questions of others or of the audience."],
    ["storytelling","V","Hikâye Anlatıcılığı","Tells anecdotes with a setup and a payoff."],
    ["provocativeness","V","Provokatif Üslup","Deliberately provocative framing that invites reactions."],
    ["politeness","V","Nezaket","Respectful address; thanks, apologises, courteous tone."],
    ["reply_danger","B","Yanıt Sertliği","Replies that are harsh toward the other person: dismissive, cutting or confrontational."],
    ["opinionatedness","V","Görüş Bildirme","Frequently states explicit opinions on events and topics."],
  ],
  humor: [
    ["humor","V","Mizah Gücü","Produces jokes that actually land; scored on quality and hit rate, not frequency."],
    ["irony","V","İroni","Means the opposite of what is literally said."],
    ["sarcasm","V","Sarkazm","Targeted, belittling mockery."],
    ["trolling","V","Troll Eğilimi","Deliberately provokes for reactions; refuses to be taken seriously."],
    ["absurd_humor","V","Absürt Mizah","Humour built on nonsense, surreal turns and the unexpected."],
    ["dry_humor","V","Kuru Mizah","Deadpan jokes delivered in a flat tone, without emoji or signalling."],
    ["self_deprecation","V","Öz İroni","Makes self the target of the joke."],
    ["wordplay","V","Kelime Oyunu","Puns, twisted idioms, language-based jokes."],
    ["meme_fluency","V/S","İnternet Mizahı","Fluent use of internet joke formats, templates and meme references."],
    ["observational_humor","V","Gözlem Mizahı","Finds humour in everyday situations and human behaviour."],
  ],
  emotional: [
    ["emotionality","V","Duygusallık","Openly and frequently expresses feelings."],
    ["emotional_intensity","V","Duygusal Yoğunluk","Strong, amplified emotion with visible swings."],
    ["empathy","V","Empati","Understands others' situations; supportive and consoling language."],
    ["melancholy","V","Melankoli","Wistful, sad tone; themes of loss and longing."],
    ["enthusiasm","V","Coşku","Excited, joyful, exclamatory expression."],
    ["anger_expression","V","Öfke İfadesi","Openly voices irritation and anger."],
    ["vulnerability","V","Kırılganlık","Openly shares weaknesses, loneliness and worries."],
    ["nostalgia","V/S","Nostalji","Looks back fondly at earlier times and eras."],
    ["warmth","V","Sıcak Üslup","Sincere, intimate, friendly tone that builds closeness."],
    ["emotional_restraint","V","Duygusal Mesafe","Shows little emotion; factual, detached expression."],
  ],
  relational: [
    ["romantic_tone","V","Romantik Ton","Writing about love, affection and longing for someone."],
    ["platonic_tone","V","Platonik Ton","Unrequited or distant love; longing for someone out of reach."],
    ["flirtatiousness","V","Flörtöz Üslup","Playful, teasing, flirtatious expression."],
    ["heartbreak","V","Ayrılık ve Kırgınlık Teması","Recurring themes of breakup, disappointment and being left."],
    ["relationship_commentary","V","İlişki Yorumculuğu","General observations and advice about dating and relationship dynamics."],
    ["friendship_emphasis","V","Dostluk Vurgusu","Frequent references to friends, loyalty and close circles."],
    ["family_emphasis","V","Aile Vurgusu","Frequent references to family and home life (only what the account itself states)."],
  ],
  language: [
    ["poetic_language","V","Şiirsel Dil","Imagery, rhythm and metaphor-heavy phrasing."],
    ["literary_language","V","Edebi Dil","Carefully built sentences and polished prose."],
    ["vocabulary_richness","V","Kelime Zenginliği","Varied and uncommon vocabulary."],
    ["formal_register","V","Resmî Dil","Correct, formal, institutional tone."],
    ["colloquial_register","V","Gündelik ve Argo Dil","Spoken-style language, slang, casual swearing."],
    ["aphoristic_style","V","Aforistik Anlatım","One-line, quotable, generalising statements."],
    ["spelling_care","V","Yazım Özeni","Attention to spelling, punctuation and grammar."],
    ["emoji_expression","B","Emoji Kullanımı","Carries meaning through emoji and visual markers."],
    ["code_switching","V","Dil Karıştırma","Mixes languages, e.g. Turkish with English phrases."],
    ["clarity","V","Açık Anlatım","Explains complex ideas in an understandable, orderly way."],
  ],
  creativity: [
    ["creativity","V","Yaratıcılık","New ideas and unexpected connections."],
    ["originality","V","Özgünlük","Writes in an own voice rather than stock internet templates."],
    ["imagination","V","Hayal Gücü","Hypotheticals, fictional scenarios, 'what if' thinking."],
    ["aesthetic_sense","V/S","Estetik Duyarlılık","Sensitivity to beauty, atmosphere, design and visual quality."],
    ["content_creation","B","İçerik Üreticiliği","Planned, formatted content: threads, series, recurring formats."],
    ["artistic_production","V","Sanatsal Üretim","Shares own art: drawing, writing, music, photography."],
  ],
  intellect: [
    ["curiosity","V/S","Merak","Seeks out new subjects; wants to learn and explore."],
    ["analytical_thinking","V","Analitik Düşünce","Breaks topics into parts; reasons with data and logic."],
    ["critical_thinking","V","Eleştirel Düşünce","Questions claims; looks for sources and consistency."],
    ["philosophical_tendency","V","Felsefi Eğilim","Drawn to abstract questions of meaning, ethics and existence."],
    ["observation","V","Gözlemcilik","Sharp, accurate observations about people and situations."],
    ["contrarianism","V","Aykırı Görüş","Tends to argue against the prevailing view."],
    ["intellectual_depth","V","Entelektüel Derinlik","Layered content with references that show accumulated knowledge."],
    ["strategic_thinking","V","Stratejik Düşünce","Thinks in long-term consequences, plans and scenarios."],
    ["pragmatism","V","Pragmatizm","Focuses on concrete, workable solutions."],
    ["teaching","V","Öğreticilik","Explains, guides and shares tips so others learn."],
    ["general_knowledge","V","Genel Kültür","K: accurate facts and references across many fields."],
  ],
  social: [
    ["social_energy","B","Sosyal Enerji","High volume of interaction, replies and conversation."],
    ["community_bond","B","Topluluk Bağlılığı","Keeps interacting with a specific circle; in-jokes."],
    ["silent_observer","B","Gözlem Ağırlığı","Writes little in own words; mostly follows, reposts and shares."],
    ["visibility_seeking","V/S","Etkileşim Odaklılık","Posts shaped to attract attention, engagement and followers."],
    ["trend_reflex","V/S","Gündem Refleksi","Reacts quickly to whatever is on the agenda."],
    ["supportiveness","V","Destekçilik","Congratulates, encourages and promotes others."],
    ["curation","B","İçerik Küratörlüğü","Deliberately spreads others' content, sources and links."],
    ["advocacy","V","Savunuculuk","Consistently champions a cause and raises awareness; the cause itself is never recorded."],
    ["personal_disclosure","V","Kişisel Açıklık","Openly shares slices of daily life and mood."],
    ["conversation_starter","B","Sohbet Başlatma","Opens discussions: polls, 'what do you think' posts, prompts to followers."],
  ],
  sports: [
    ["sports_enthusiasm","V/S","Sporseverlik","Follows sport broadly, across more than one branch."],
    ["football_fandom","V/S","Futbol Fanlığı","Emotional attachment to football: team passion, match excitement, supporter language."],
    ["football_knowledge","V","Futbol Bilgisi","K: tactics, transfers, statistics and player knowledge in commentary."],
    ["basketball_interest","V/S","Basketbol İlgisi","Recurring basketball content."],
    ["motorsport_interest","V/S","Motor Sporları İlgisi","F1, MotoGP and similar."],
    ["combat_sports_interest","V/S","Dövüş Sporları İlgisi","Boxing, MMA, wrestling."],
    ["other_sports_interest","V/S","Diğer Spor Branşları İlgisi","Volleyball, tennis, athletics and similar."],
    ["fitness_interest","V","Fitness İlgisi","Own training, gym, running."],
  ],
  economy: [
    ["economics_knowledge","V","Ekonomi Bilgisi","K: uses inflation, interest rates, FX and macro concepts correctly."],
    ["finance_interest","V/S","Finans İlgisi","Follows stocks, investing, funds and markets."],
    ["crypto_interest","V/S","Kripto İlgisi","Recurring crypto and web3 content."],
    ["entrepreneurship","V/S","Girişimcilik","Business building, startups, product and sales."],
    ["career_focus","V","Kariyer Odaklılık","Work life, professional growth, productivity."],
  ],
  politics: [
    ["political_interest","V/S","Siyasi İlgi","Frequently follows and comments on the political agenda. Side or ideology is never recorded."],
    ["political_knowledge","V","Siyaset Bilgisi","K: accurate knowledge of institutions, processes, actors and precedent. Side or ideology is never recorded."],
    ["current_affairs","V/S","Gündem Takibi","Follows general news, including non-political news."],
    ["geopolitics","V/S","Jeopolitik İlgisi","International relations, conflicts, diplomacy."],
    ["law_justice","V/S","Hukuk İlgisi","Law, courts, rights."],
    ["media_criticism","V","Medya Eleştirisi","Comments on news framing, distortion and misinformation."],
  ],
  history: [
    ["history_interest","V/S","Tarih İlgisi","Shares historical content; curious about the past (depth not required)."],
    ["history_knowledge","V","Tarih Bilgisi","K: uses historical events, periods and figures accurately and in context."],
  ],
  science: [
    ["science_interest","V/S","Bilim İlgisi","Recurring science content."],
    ["scientific_literacy","V","Bilimsel Okuryazarlık","K: uses evidence, studies and method correctly."],
    ["space_astronomy","V/S","Astronomi İlgisi","Space, astronomy, cosmology."],
    ["health_medicine_interest","V/S","Sağlık ve Tıp İlgisi","Health and medicine as a topic; never the person's own health."],
    ["psychology_interest","V/S","Psikoloji İlgisi","Psychology concepts and discussions of behaviour."],
    ["nature_environment","V/S","Doğa ve Çevre İlgisi","Nature, climate, environment."],
  ],
  technology: [
    ["tech_interest","V/S","Teknoloji İlgisi","Recurring technology content."],
    ["tech_knowledge","V","Teknoloji Bilgisi","K: technical depth and correct terminology."],
    ["software_culture","V/S","Yazılım Kültürü","Developer life, coding, tools."],
    ["ai_interest","V/S","Yapay Zekâ İlgisi","AI tools, models, debates."],
    ["gadgets","V/S","Cihaz ve Donanım İlgisi","Phones, computers, equipment."],
    ["internet_culture","V/S","İnternet Kültürü","Platform dynamics, viral moments, commentary about X itself."],
  ],
  literature: [
    ["literature_interest","V/S","Edebiyat İlgisi","Recurring literature content."],
    ["literary_knowledge","V","Edebiyat Bilgisi","K: knowledge of authors, movements and works."],
    ["reading_habit","V","Okurluk","Shares what they read: quotes, reading lists."],
    ["poetry_interest","V/S","Şiir İlgisi","Shares and discusses others' poetry (own poetic writing is poetic_language)."],
  ],
  screen: [
    ["cinema_culture","V","Sinema Kültürü","Film literacy: directors, genres, classics."],
    ["tv_series_interest","V/S","Dizi İlgisi","Recurring TV-series content."],
    ["anime_manga","V/S","Anime ve Manga İlgisi","Anime, manga and related culture."],
    ["pop_culture","V/S","Popüler Kültür İlgisi","Celebrities, gossip, reality TV."],
  ],
  music: [
    ["music_interest","V/S","Müzik İlgisi","Recurring music sharing and discussion."],
    ["music_knowledge","V","Müzik Kültürü","K: depth on genres, eras, albums and artists."],
    ["live_music_culture","V/S","Canlı Müzik İlgisi","Regularly follows and attends concerts and festivals."],
    ["musicianship","V","Müzisyenlik","Plays an instrument or produces music."],
  ],
  gaming: [
    ["gaming_culture","V/S","Oyun Kültürü","Video games, gamer language, game references."],
    ["esports_interest","V/S","E-Spor İlgisi","Competitive gaming, teams, tournaments."],
  ],
  travel: [
    ["travel_curiosity","V/S","Seyahat Merakı","Travel, places, wanting to go."],
    ["city_culture","V","Şehir Kültürü","Neighbourhoods, venues, observations of city life."],
    ["outdoor_adventure","V","Doğa Aktiviteleri İlgisi","Camping, trekking, mountains, outdoors."],
  ],
  food: [
    ["food_interest","V/S","Yemek İlgisi","Food, drink, venues, flavours."],
    ["cooking","V","Mutfak İlgisi","Cooks and shares recipes."],
  ],
  lifestyle: [
    ["fashion_style","V/S","Moda İlgisi","Clothing, style, trends."],
    ["beauty_care","V/S","Güzellik ve Bakım İlgisi","Skincare, makeup, grooming."],
    ["visual_arts","V/S","Görsel Sanatlar İlgisi","Painting, museums, photography."],
    ["design_architecture","V/S","Tasarım ve Mimari İlgisi","Design, architecture, interiors."],
    ["animal_love","V/S","Hayvan Sevgisi","Pets, strays, animals."],
    ["automotive","V/S","Otomobil İlgisi","Cars, motorcycles, driving."],
    ["astrology","V/S","Astroloji İlgisi","Zodiac signs and astrology references."],
    ["self_improvement","V/S","Kişisel Gelişim İlgisi","Habits, discipline, motivation."],
    ["academia","V","Akademik İlgi","Academic life, research, teaching, exams."],
  ],
};

export const TRAITS: readonly Trait[] = Object.entries(ROWS).flatMap(([category, rows]) =>
  rows.map(([id, basis, label, definition]) => ({
    id, basis, label, definition, category: category as TraitCategory,
    group: CHARACTER_CATEGORIES.includes(category as TraitCategory) ? "character" as const : "interest" as const,
  })));
export const TRAIT_BY_ID: ReadonlyMap<string, Trait> = new Map(TRAITS.map(t => [t.id, t]));

export const INTEREST_TOPICS: readonly InterestTopic[] = ([
  ["football","Futbol",["football_fandom","football_knowledge","sports_enthusiasm"]],
  ["basketball","Basketbol",["basketball_interest","sports_enthusiasm"]],
  ["motorsport","Motor Sporları",["motorsport_interest","sports_enthusiasm"]],
  ["combat_sports","Dövüş Sporları",["combat_sports_interest","sports_enthusiasm"]],
  ["other_sports","Diğer Sporlar",["other_sports_interest","sports_enthusiasm"]],
  ["fitness","Fitness",["fitness_interest"]],
  ["economy","Ekonomi",["economics_knowledge"]],
  ["markets_investing","Piyasalar ve Yatırım",["finance_interest"]],
  ["crypto","Kripto",["crypto_interest"]],
  ["business_startups","İş ve Girişim",["entrepreneurship"]],
  ["work_career","İş Hayatı",["career_focus"]],
  ["politics","Siyaset",["political_interest","political_knowledge"]],
  ["geopolitics","Jeopolitik",["geopolitics"]],
  ["law_justice","Hukuk",["law_justice"]],
  ["news_media","Haber ve Medya",["current_affairs","media_criticism"]],
  ["history","Tarih",["history_interest","history_knowledge"]],
  ["science","Bilim",["science_interest","scientific_literacy"]],
  ["space","Uzay",["space_astronomy"]],
  ["health_medicine","Sağlık",["health_medicine_interest"]],
  ["psychology","Psikoloji",["psychology_interest"]],
  ["nature_environment","Doğa ve Çevre",["nature_environment","outdoor_adventure"]],
  ["technology","Teknoloji",["tech_interest","tech_knowledge"]],
  ["software","Yazılım",["software_culture"]],
  ["artificial_intelligence","Yapay Zekâ",["ai_interest"]],
  ["gadgets","Cihazlar",["gadgets"]],
  ["internet_culture","İnternet Kültürü",["internet_culture"]],
  ["literature","Edebiyat",["literature_interest","literary_knowledge","reading_habit"]],
  ["poetry","Şiir",["poetry_interest"]],
  ["cinema","Sinema",["cinema_culture"]],
  ["tv_series","Diziler",["tv_series_interest"]],
  ["anime_manga","Anime ve Manga",["anime_manga"]],
  ["celebrity_pop","Popüler Kültür",["pop_culture"]],
  ["music","Müzik",["music_interest","music_knowledge","musicianship"]],
  ["live_music","Konser ve Festival",["live_music_culture"]],
  ["gaming","Oyun",["gaming_culture"]],
  ["esports","E-Spor",["esports_interest"]],
  ["travel","Seyahat",["travel_curiosity"]],
  ["city_life","Şehir Hayatı",["city_culture"]],
  ["food_drink","Yeme-İçme",["food_interest","cooking"]],
  ["fashion_beauty","Moda ve Güzellik",["fashion_style","beauty_care"]],
  ["art_design","Sanat ve Tasarım",["visual_arts","design_architecture"]],
  ["animals","Hayvanlar",["animal_love"]],
  ["automotive","Otomobil",["automotive"]],
  ["astrology","Astroloji",["astrology"]],
  ["self_improvement","Kişisel Gelişim",["self_improvement"]],
  ["education_academia","Eğitim ve Akademi",["academia"]],
  ["relationships_dating","İlişkiler ve Flört",[]],
  ["family_home","Aile ve Ev Hayatı",[]],
] as Array<[string, string, string[]]>).map(([id, label, traits]) => ({ id, label, traits }));
export const TOPIC_BY_ID: ReadonlyMap<string, InterestTopic> = new Map(INTEREST_TOPICS.map(t => [t.id, t]));

// Never selected together: the lower score is dropped.
export const CONTRADICTORY_PAIRS: ReadonlyArray<[string, string]> = [
  ["optimism","pessimism"], ["calmness","anger_expression"], ["emotionality","emotional_restraint"],
  ["brevity","detail_orientation"], ["diplomacy","reply_danger"],
];
// Both kept only when both score >= 70 and cite different posts; otherwise the lower one is dropped.
export const NEAR_DUPLICATE_PAIRS: ReadonlyArray<[string, string]> = [
  ["humor","observational_humor"], ["irony","sarcasm"], ["poetic_language","literary_language"],
  ["curiosity","questioning"], ["sports_enthusiasm","football_fandom"], ["football_fandom","football_knowledge"],
];
