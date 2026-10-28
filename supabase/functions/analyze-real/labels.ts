// Trait labels shown on the card, per output language. Turkish labels live in ontology.ts.
// One row per trait id: en | es | pt | ar | fr | de | it | ja | ko | zh (Traditional) | ru | id | th.
// Short, card-sized names in the tone of each language's X culture; never AI-generated.
import { TRAITS } from "./ontology.ts";

export const LABEL_LOCALES = ["en","es","pt","ar","fr","de","it","ja","ko","zh","ru","id","th"] as const;
export type LabelLocale = "tr" | typeof LABEL_LOCALES[number];

const LABEL_ROWS = `
confidence|Confidence|Seguridad|Confiança|الثقة بالنفس|Assurance|Selbstsicherheit|Sicurezza|自信|자신감|自信|Уверенность|Percaya Diri|ความมั่นใจ
calmness|Calm|Calma|Calma|الهدوء|Calme|Gelassenheit|Calma|落ち着き|침착함|沉穩|Спокойствие|Ketenangan|ความใจเย็น
impulsiveness|Hair Trigger|Reflejo Rápido|Reação Instantânea|ردة الفعل السريعة|Réflexe Immédiat|Schneller Abzug|Reazione Istantanea|即レス反射|즉각 반응|秒回反射|Мгновенная реакция|Refleks Kilat|ปฏิกิริยาฉับไว
optimism|Optimism|Optimismo|Otimismo|التفاؤل|Optimisme|Optimismus|Ottimismo|楽観|낙관|樂觀|Оптимизм|Optimisme|การมองโลกแง่ดี
pessimism|Glass Half Empty|Vaso Medio Vacío|Copo Meio Vazio|النظرة المتشائمة|Verre à Moitié Vide|Halb leeres Glas|Bicchiere Mezzo Vuoto|悲観モード|비관 모드|悲觀視角|Стакан наполовину пуст|Gelas Setengah Kosong|มองโลกแง่ร้าย
cynicism|Side-Eye|Mirada Escéptica|Olhar Desconfiado|النظرة المرتابة|Regard Sceptique|Skeptischer Blick|Sguardo Scettico|疑いの目|의심의 눈초리|懷疑眼光|Скепсис|Tatapan Curiga|สายตาจับผิด
competitiveness|Competitive Streak|Espíritu Competitivo|Espírito Competitivo|الروح التنافسية|Esprit de Compétition|Ehrgeiz|Spirito Competitivo|負けず嫌い|승부욕|好勝心|Соревновательность|Jiwa Kompetitif|ความเป็นนักแข่ง
independence|Own Path|Criterio Propio|Opinião Própria|الاستقلالية|Indépendance|Eigener Kopf|Testa Propria|我が道を行く|소신|特立獨行|Своё мнение|Pendirian Sendiri|มีจุดยืนของตัวเอง
main_character|Main Character|Protagonista|Protagonista|الشخصية الرئيسية|Personnage Principal|Hauptfigur|Protagonista|主人公感|주인공 에너지|主角光環|Главный герой|Tokoh Utama|ตัวเอกของเรื่อง
chaos|Chaos Factor|Factor Caos|Fator Caos|عامل الفوضى|Facteur Chaos|Chaosfaktor|Fattore Caos|カオス度|카오스 지수|混亂指數|Фактор хаоса|Faktor Kekacauan|ปัจจัยความวุ่นวาย
seriousness|Serious Mode|Seriedad|Seriedade|الجدية|Sérieux|Ernsthaftigkeit|Serietà|真面目さ|진지함|認真|Серьёзность|Keseriusan|ความจริงจัง
consistency|Consistency|Coherencia|Coerência|الثبات|Constance|Beständigkeit|Coerenza|一貫性|일관성|一致性|Последовательность|Konsistensi|ความคงเส้นคงวา
directness|Straight Talk|Franqueza|Franqueza|الصراحة|Franc-parler|Direktheit|Schiettezza|ズバッと言う力|직설|直來直往|Прямолинейность|Blak-blakan|ความตรงไปตรงมา
argumentativeness|Debate Mode|Modo Debate|Modo Debate|روح الجدال|Mode Débat|Debattierlust|Modalità Dibattito|議論好き|토론 본능|愛辯論|Спорщик|Mode Debat|โหมดถกเถียง
diplomacy|Diplomacy|Diplomacia|Diplomacia|الدبلوماسية|Diplomatie|Diplomatie|Diplomazia|大人の対応|외교력|圓融|Дипломатичность|Diplomasi|ความเป็นนักการทูต
sharp_tongue|Sharp Tongue|Lengua Afilada|Língua Afiada|اللسان اللاذع|Langue Acérée|Spitze Zunge|Lingua Tagliente|毒舌|독설|毒舌|Острый язык|Lidah Tajam|ปากจัด
persuasiveness|Persuasion|Persuasión|Persuasão|قوة الإقناع|Persuasion|Überzeugungskraft|Persuasione|説得力|설득력|說服力|Убедительность|Daya Bujuk|พลังโน้มน้าว
brevity|Short and Sharp|Al Grano|Direto ao Ponto|الإيجاز|Concision|Kurz und Knapp|Sintesi|簡潔さ|간결함|言簡意賅|Краткость|Singkat Padat|สั้นกระชับ
detail_orientation|Detail Mode|Detallismo|Detalhismo|الدقة في التفاصيل|Souci du Détail|Detailverliebt|Precisione|こだわり派|디테일 장인|細節控|Дотошность|Detail Banget|ช่างรายละเอียด
questioning|Question Master|Maestro de Preguntas|Mestre das Perguntas|فن السؤال|Art de la Question|Fragenmeister|Maestro delle Domande|質問力|질문 장인|提問高手|Мастер вопросов|Jago Bertanya|เจ้าแห่งคำถาม
storytelling|Storytelling|Narración|Contação de Histórias|فن الحكي|Art du Récit|Erzähltalent|Narrazione|ストーリーテリング|스토리텔링|說故事能力|Рассказчик|Jago Bercerita|ศิลปะการเล่าเรื่อง
provocativeness|Stirring the Pot|Agitar el Avispero|Botar Lenha na Fogueira|إثارة الجدل|Mettre le Feu|Unruhestifter|Mettere Zizzania|炎上誘発|판 흔들기|帶風向|Провокатор|Bikin Heboh|ปั่นกระแส
politeness|Politeness|Cortesía|Educação|اللباقة|Politesse|Höflichkeit|Cortesia|礼儀正しさ|예의|禮貌|Вежливость|Kesopanan|ความสุภาพ
reply_danger|Reply Fire|Fuego en Respuestas|Fogo nas Respostas|نار الردود|Réponses Incendiaires|Antwort-Feuer|Fuoco nelle Risposte|リプ炎上力|답글 화력|回覆火力|Огонь в ответах|Balasan Pedas|รีพลายเดือด
opinionatedness|Hot Takes|Opiniones Fuertes|Opiniões Fortes|إبداء الرأي|Avis Tranchés|Meinungsstark|Opinioni Forti|一言居士|소신 발언|有話直說|Своё мнение обо всём|Opini Tegas|มีความเห็นทุกเรื่อง
humor|Humour|Humor|Humor|خفة الدم|Humour|Humor|Umorismo|ユーモア|유머|幽默|Юмор|Humor|อารมณ์ขัน
irony|Irony|Ironía|Ironia|السخرية الخفية|Ironie|Ironie|Ironia|皮肉|아이러니|反諷|Ирония|Ironi|การประชด
sarcasm|Sarcasm|Sarcasmo|Sarcasmo|التهكم|Sarcasme|Sarkasmus|Sarcasmo|毒っ気|비꼬기|酸言酸語|Сарказм|Sarkasme|ความเสียดสี
trolling|Troll Spirit|Alma Trol|Espírito Troll|روح الترول|Âme de Troll|Trollgeist|Spirito Troll|煽り魂|어그로 본능|酸民魂|Тролль внутри|Jiwa Troll|วิญญาณเกรียน
absurd_humor|Absurd Humour|Humor Absurdo|Humor Absurdo|الكوميديا العبثية|Humour Absurde|Absurder Humor|Umorismo Assurdo|シュールな笑い|병맛 유머|無厘頭|Абсурдный юмор|Humor Absurd|มุกแอบเซิร์ด
dry_humor|Deadpan|Humor Seco|Humor Seco|الكوميديا الجافة|Pince-sans-rire|Trockener Humor|Umorismo Secco|真顔ギャグ|무표정 유머|冷面笑匠|Невозмутимый юмор|Humor Datar|มุกหน้าตาย
self_deprecation|Self-Roast|Autoburla|Autozoeira|السخرية من الذات|Autodérision|Selbstironie|Autoironia|自虐ネタ|자학 개그|自嘲|Самоирония|Menertawakan Diri|ล้อเลียนตัวเอง
wordplay|Wordplay|Juegos de Palabras|Trocadilhos|التلاعب بالألفاظ|Jeux de Mots|Wortspiele|Giochi di Parole|言葉遊び|말장난|文字遊戲|Игра слов|Plesetan Kata|เล่นคำ
meme_fluency|Meme Fluency|Dominio del Meme|Fluência em Memes|إتقان الميمز|Culture Mème|Meme-Kompetenz|Padronanza dei Meme|ネタ画像力|밈 능력|迷因力|Мемная грамотность|Fasih Meme|เซียนมีม
observational_humor|Observational Humour|Humor de Observación|Humor de Observação|كوميديا الملاحظة|Humour d'Observation|Beobachtungshumor|Umorismo d'Osservazione|あるあるネタ|관찰 유머|觀察式幽默|Юмор наблюдений|Humor Observasi|มุกจากชีวิตจริง
quick_wit|Quick Wit|Ingenio Rápido|Respostas Afiadas|سرعة البديهة|Repartie|Schlagfertigkeit|Battuta Pronta|切り返し力|순발력|反應快|Находчивость|Cepat Tanggap|ปฏิภาณไหวพริบ
emotionality|Heart on Sleeve|Emotividad|Emotividade|العاطفية|Sensibilité|Gefühlsbetontheit|Emotività|感情豊か|감성|感性|Эмоциональность|Emosional|ความอ่อนไหว
emotional_intensity|Emotional Intensity|Intensidad Emocional|Intensidade Emocional|الحدة العاطفية|Intensité Émotionnelle|Gefühlsintensität|Intensità Emotiva|感情の振れ幅|감정 진폭|情緒張力|Эмоциональный накал|Emosi Meledak|อารมณ์เข้มข้น
empathy|Empathy|Empatía|Empatia|التعاطف|Empathie|Empathie|Empatia|共感力|공감력|同理心|Эмпатия|Empati|ความเห็นอกเห็นใจ
melancholy|Melancholy|Melancolía|Melancolia|الحزن الشفيف|Mélancolie|Melancholie|Malinconia|メランコリー|멜랑콜리|憂鬱氣質|Меланхолия|Melankolis|ความเศร้าลึก
enthusiasm|Hype Energy|Entusiasmo|Empolgação|الحماس|Enthousiasme|Begeisterung|Entusiasmo|テンション|텐션|熱情|Энтузиазм|Antusias|ความกระตือรือร้น
anger_expression|Short Fuse|Mecha Corta|Pavio Curto|سرعة الغضب|Sang Chaud|Kurze Zündschnur|Miccia Corta|怒りの導火線|분노 버튼|易燃體質|Вспыльчивость|Sumbu Pendek|ขี้โมโห
vulnerability|Open Heart|Corazón Abierto|Coração Aberto|البوح|Cœur Ouvert|Offenes Herz|Cuore Aperto|弱さを見せる力|솔직한 고백|真情流露|Открытое сердце|Hati Terbuka|เปิดใจ
nostalgia|Nostalgia|Nostalgia|Nostalgia|الحنين|Nostalgie|Nostalgie|Nostalgia|懐かしさ|추억 소환|懷舊|Ностальгия|Nostalgia|โหยหาอดีต
warmth|Warmth|Calidez|Calor Humano|الدفء|Chaleur|Herzlichkeit|Calore|温かさ|따뜻함|溫暖|Теплота|Kehangatan|ความอบอุ่น
emotional_restraint|Cool Head|Sangre Fría|Sangue-Frio|برودة الأعصاب|Sang-Froid|Kühler Kopf|Sangue Freddo|クールさ|쿨함|冷靜|Хладнокровие|Kepala Dingin|ความเยือกเย็น
romantic_tone|Romantic Tone|Tono Romántico|Tom Romântico|النبرة الرومانسية|Ton Romantique|Romantik|Tono Romantico|ロマンチスト|로맨틱|浪漫|Романтика|Romantis|โรแมนติก
platonic_tone|Platonic Crush|Amor Platónico|Amor Platônico|الحب من طرف واحد|Amour Platonique|Platonische Liebe|Amore Platonico|片想い|짝사랑|暗戀|Платоническая любовь|Cinta Bertepuk Sebelah Tangan|รักข้างเดียว
flirtatiousness|Flirt Mode|Modo Coqueto|Modo Flerte|روح المغازلة|Mode Séducteur|Flirtmodus|Modalità Flirt|口説きモード|플러팅|撩人模式|Флирт|Mode Gombal|โหมดจีบ
heartbreak|Heartbreak|Corazón Roto|Coração Partido|القلب المكسور|Cœur Brisé|Herzschmerz|Cuore Spezzato|失恋|이별 감성|心碎|Разбитое сердце|Patah Hati|อกหัก
relationship_commentary|Relationship Takes|Opinólogo del Amor|Comentarista do Amor|التعليق على العلاقات|Analyste du Couple|Beziehungskommentar|Esperto di Coppia|恋愛評論|연애 평론|感情評論|Комментатор отношений|Pengamat Asmara|นักวิจารณ์ความรัก
friendship_emphasis|Ride or Die|Amistad Ante Todo|Amizade Acima de Tudo|الوفاء للأصدقاء|Amitié Avant Tout|Freundschaft zuerst|Amicizia Prima di Tutto|友情第一|우정 우선|友情至上|Дружба прежде всего|Setia Kawan|เพื่อนต้องมาก่อน
family_emphasis|Family First|La Familia Primero|Família em Primeiro|العائلة أولاً|Famille d'Abord|Familie zuerst|Famiglia Prima di Tutto|家族思い|가족 사랑|家庭第一|Семья прежде всего|Keluarga Nomor Satu|ครอบครัวมาก่อน
love_philosophy|Love Philosophy|Filosofía del Amor|Filosofia do Amor|فلسفة الحب|Philosophie de l'Amour|Liebesphilosophie|Filosofia dell'Amore|恋愛哲学|연애 철학|愛情哲學|Философия любви|Filosofi Cinta|ปรัชญาความรัก
dating_humor|Dating Humour|Humor de Citas|Humor de Paquera|كوميديا المواعدة|Humour de Drague|Dating-Humor|Umorismo da Appuntamenti|恋愛あるある|연애 개그|約會幽默|Юмор о свиданиях|Humor Jomblo|มุกคนโสด
loyalty_emphasis|Loyalty|Lealtad|Lealdade|الوفاء|Loyauté|Treue|Lealtà|義理堅さ|의리|講義氣|Верность|Kesetiaan|ความภักดี
poetic_language|Poetic Voice|Voz Poética|Voz Poética|اللغة الشعرية|Plume Poétique|Poetische Ader|Vena Poetica|詩的表現|시적 감성|詩意文字|Поэтичность|Bahasa Puitis|ภาษากวี
literary_language|Literary Prose|Prosa Literaria|Prosa Literária|الأسلوب الأدبي|Style Littéraire|Literarischer Stil|Prosa Letteraria|文学的文章|문학적 문체|文學筆觸|Литературный слог|Gaya Sastra|สำนวนวรรณกรรม
vocabulary_richness|Rich Vocabulary|Vocabulario Rico|Vocabulário Rico|ثراء المفردات|Vocabulaire Riche|Wortschatz|Lessico Ricco|語彙力|어휘력|詞彙量|Богатый словарь|Kosakata Kaya|คลังคำศัพท์
formal_register|Formal Tone|Tono Formal|Tom Formal|اللغة الرسمية|Ton Soutenu|Förmlicher Ton|Tono Formale|かしこまり口調|격식체|正式語氣|Официальный тон|Bahasa Formal|ภาษาทางการ
colloquial_register|Street Talk|Lenguaje de Calle|Papo Reto|لغة الشارع|Langage de Rue|Straßenslang|Linguaggio di Strada|くだけた口調|찰진 말투|接地氣口吻|Уличный сленг|Bahasa Gaul|ภาษาวัยรุ่น
aphoristic_style|One-Liners|Frases Lapidarias|Frases de Efeito|الحِكم القصيرة|Formules Choc|Sprüche|Aforismi|名言風|명언 스타일|金句體|Афоризмы|Kata Mutiara|คำคม
spelling_care|Grammar Care|Cuidado Ortográfico|Capricho na Escrita|العناية بالإملاء|Orthographe Soignée|Rechtschreibung|Cura Ortografica|文章の丁寧さ|맞춤법 정확도|用字講究|Грамотность|Rapi Ejaan|ความถูกต้องของภาษา
emoji_expression|Emoji Language|Lenguaje Emoji|Linguagem Emoji|لغة الإيموجي|Langage Emoji|Emoji-Sprache|Linguaggio Emoji|絵文字力|이모지 활용|表情符號派|Язык эмодзи|Bahasa Emoji|ภาษาอีโมจิ
code_switching|Bilingual Flow|Flujo Bilingüe|Fluxo Bilíngue|خلط اللغات|Mélange de Langues|Sprachmix|Mix Linguistico|多言語ミックス|언어 섞기|中英夾雜|Смешение языков|Campur Bahasa|ภาษาปนกัน
clarity|Clarity|Claridad|Clareza|وضوح التعبير|Clarté|Klarheit|Chiarezza|わかりやすさ|명료함|表達清晰|Ясность|Kejelasan|ความชัดเจน
creativity|Creativity|Creatividad|Criatividade|الإبداع|Créativité|Kreativität|Creatività|創造力|창의력|創意|Креативность|Kreativitas|ความคิดสร้างสรรค์
originality|Originality|Originalidad|Originalidade|الأصالة|Originalité|Originalität|Originalità|独自性|독창성|原創性|Оригинальность|Orisinalitas|ความเป็นต้นฉบับ
imagination|Imagination|Imaginación|Imaginação|الخيال|Imagination|Fantasie|Immaginazione|想像力|상상력|想像力|Воображение|Imajinasi|จินตนาการ
aesthetic_sense|Aesthetic Eye|Ojo Estético|Olhar Estético|الحس الجمالي|Sens Esthétique|Ästhetik|Senso Estetico|美的センス|미적 감각|美感|Чувство стиля|Selera Estetik|เซนส์ความงาม
content_creation|Content Creator|Creador de Contenido|Criador de Conteúdo|صناعة المحتوى|Créateur de Contenu|Content Creator|Creatore di Contenuti|コンテンツ力|콘텐츠 제작력|內容創作|Контент-мейкер|Kreator Konten|ครีเอเตอร์
artistic_production|Artist at Work|Artista Activo|Artista em Ação|الإنتاج الفني|Création Artistique|Künstlerisches Schaffen|Produzione Artistica|作品発信|창작 활동|藝術創作|Творчество|Berkarya Seni|ผลงานศิลปะ
curiosity|Curiosity|Curiosidad|Curiosidade|الفضول|Curiosité|Neugier|Curiosità|好奇心|호기심|好奇心|Любопытство|Rasa Ingin Tahu|ความอยากรู้
analytical_thinking|Analytical Mind|Mente Analítica|Mente Analítica|التفكير التحليلي|Esprit Analytique|Analytisches Denken|Mente Analitica|分析力|분석력|分析思維|Аналитический ум|Pikiran Analitis|คิดเชิงวิเคราะห์
critical_thinking|Critical Thinking|Pensamiento Crítico|Pensamento Crítico|التفكير النقدي|Esprit Critique|Kritisches Denken|Pensiero Critico|批判的思考|비판적 사고|批判思考|Критическое мышление|Berpikir Kritis|คิดเชิงวิพากษ์
philosophical_tendency|Philosopher Mode|Modo Filósofo|Modo Filósofo|النزعة الفلسفية|Âme de Philosophe|Philosophische Ader|Vena Filosofica|哲学モード|철학 모드|哲學腦|Философский склад|Mode Filsuf|โหมดนักปรัชญา
observation|Sharp Eye|Ojo Observador|Olhar Atento|قوة الملاحظة|Sens de l'Observation|Beobachtungsgabe|Occhio Attento|観察眼|관찰력|觀察力|Наблюдательность|Jeli Mengamati|ช่างสังเกต
contrarianism|Contrarian|Llevar la Contraria|Do Contra|مخالفة السائد|Esprit Contradicteur|Gegen den Strom|Bastian Contrario|逆張り|반대 의견러|唱反調|Против течения|Beda Sendiri|ทวนกระแส
intellectual_depth|Intellectual Depth|Profundidad Intelectual|Profundidade Intelectual|العمق الفكري|Profondeur Intellectuelle|Intellektuelle Tiefe|Profondità Intellettuale|知的深み|지적 깊이|思想深度|Интеллектуальная глубина|Kedalaman Intelektual|ความลึกทางความคิด
big_picture|Big-Picture View|Visión Global|Visão do Todo|النظرة الشاملة|Vue d'Ensemble|Blick fürs Ganze|Visione d'Insieme|俯瞰力|큰 그림 보기|大局觀|Взгляд на картину целиком|Lihat Gambaran Besar|มองภาพใหญ่
strategic_thinking|Strategist|Estratega|Estrategista|التفكير الاستراتيجي|Stratège|Stratege|Stratega|戦略脳|전략가 기질|策略腦|Стратег|Pemikir Strategis|นักวางแผน
pragmatism|Pragmatism|Pragmatismo|Pragmatismo|البراغماتية|Pragmatisme|Pragmatismus|Pragmatismo|現実主義|실용주의|務實|Прагматизм|Pragmatis|ความเป็นนักปฏิบัติ
teaching|Teacher Energy|Alma de Profe|Alma de Professor|روح المعلم|Âme de Prof|Lehrer-Gen|Anima da Prof|先生気質|선생님 기질|老師魂|Учитель в душе|Jiwa Guru|สายแนะนำ
general_knowledge|General Knowledge|Cultura General|Cultura Geral|الثقافة العامة|Culture Générale|Allgemeinwissen|Cultura Generale|雑学力|상식|常識廣博|Эрудиция|Wawasan Umum|ความรู้รอบตัว
social_energy|Social Energy|Energía Social|Energia Social|الطاقة الاجتماعية|Énergie Sociale|Soziale Energie|Energia Sociale|社交エネルギー|사교 에너지|社交能量|Общительность|Energi Sosial|พลังโซเชียล
community_bond|Squad Loyalty|Fiel a su Grupo|Fiel à Galera|الانتماء للمجموعة|Esprit de Bande|Clique-Treue|Fedeltà al Gruppo|身内ノリ|찐친 바이브|圈內人|Своя тусовка|Setia Geng|สายแก๊ง
silent_observer|Lurker|Observador Silencioso|Observador Silencioso|المراقب الصامت|Observateur Discret|Stiller Mitleser|Osservatore Silenzioso|ROM専|눈팅족|潛水員|Тихий наблюдатель|Silent Reader|สายส่อง
visibility_seeking|Engagement Hunter|Cazador de Interacción|Caçador de Engajamento|صياد التفاعل|Chasseur d'Engagement|Reichweiten-Jäger|Cacciatore di Like|バズ狙い|관심 사냥꾼|流量獵人|Охотник за охватами|Pemburu Engagement|นักล่าเอนเกจ
trend_reflex|Trend Reflex|Reflejo de Tendencia|Reflexo de Trending|ملاحقة الترند|Réflexe Tendance|Trend-Reflex|Riflesso Trend|トレンド反射|트렌드 반사신경|追熱點|Реакция на тренды|Refleks Trending|ตามกระแสไว
supportiveness|Hype Person|Animador Oficial|Apoiador Oficial|الداعم|Supporter Fidèle|Unterstützer|Sostenitore|応援団|응원단장|啦啦隊|Поддержка|Pendukung Setia|กองเชียร์
curation|Curator|Curador|Curador|انتقاء المحتوى|Curateur|Kurator|Curatore|キュレーター|큐레이터|策展人|Куратор контента|Kurator Konten|นักคัดสรร
advocacy|Advocate|Activismo|Ativismo|المناصرة|Militantisme|Engagement|Attivismo|アドボカシー|대변인 기질|倡議|Активизм|Advokasi|นักรณรงค์
personal_disclosure|Open Book|Libro Abierto|Livro Aberto|كتاب مفتوح|Livre Ouvert|Offenes Buch|Libro Aperto|オープンな日常|일상 공유|生活分享|Открытая книга|Buku Terbuka|ชีวิตเปิดเผย
conversation_starter|Conversation Starter|Iniciador de Charlas|Puxador de Papo|فاتح الحوارات|Lanceur de Débats|Gesprächsstarter|Rompighiaccio|話題振り|대화 시동꾼|話題製造機|Заводила бесед|Pemantik Obrolan|คนเปิดประเด็น
sports_enthusiasm|Sports Fan|Fanático del Deporte|Fã de Esportes|عشق الرياضة|Fan de Sport|Sportfan|Sportivo|スポーツ好き|스포츠 덕후|運動迷|Любитель спорта|Penggemar Olahraga|คอกีฬา
football_fandom|Terrace Soul|Alma de Grada|Alma de Arquibancada|روح المدرجات|Âme de Tribune|Kurven-Seele|Anima da Curva|ゴール裏魂|서포터 혼|看台魂|Душа трибуны|Jiwa Tribun|จิตวิญญาณกองเชียร์
football_knowledge|Football IQ|Saber Futbolero|Saber Boleiro|الثقافة الكروية|Science du Foot|Fußballwissen|Cultura Calcistica|サッカー知識|축구 지식|足球知識|Футбольная эрудиция|Wawasan Sepak Bola|ความรู้ฟุตบอล
basketball_interest|Basketball|Baloncesto|Basquete|كرة السلة|Basket|Basketball|Basket|バスケ好き|농구 사랑|籃球迷|Баскетбол|Basket|บาสเกตบอล
motorsport_interest|Motorsport|Motor|Automobilismo|رياضة المحركات|Sport Auto|Motorsport|Motorsport|モータースポーツ|모터스포츠|賽車迷|Автоспорт|Balap|มอเตอร์สปอร์ต
combat_sports_interest|Combat Sports|Deportes de Combate|Esportes de Luta|رياضات القتال|Sports de Combat|Kampfsport|Sport da Combattimento|格闘技|격투기|格鬥運動|Единоборства|Olahraga Tarung|กีฬาต่อสู้
other_sports_interest|Multi-Sport|Polideportivo|Multiesportes|رياضات متنوعة|Multisport|Vielseitiger Sport|Multisport|色んなスポーツ|여러 종목|多元運動|Разные виды спорта|Aneka Olahraga|กีฬาหลากหลาย
fitness_interest|Fitness|Fitness|Fitness|اللياقة البدنية|Fitness|Fitness|Fitness|筋トレ|운동 루틴|健身|Фитнес|Fitness|ฟิตเนส
economics_knowledge|Economics IQ|Saber Económico|Saber Econômico|الثقافة الاقتصادية|Culture Économique|Wirtschaftswissen|Cultura Economica|経済リテラシー|경제 지식|經濟知識|Экономическая грамотность|Wawasan Ekonomi|ความรู้เศรษฐกิจ
economy_commentary|Economy Talk|Comentario Económico|Papo de Economia|التعليق الاقتصادي|Chroniqueur Éco|Wirtschaftskommentar|Commento Economico|家計目線の経済トーク|경제 수다|經濟評論|Экономика на кухне|Obrolan Ekonomi|คุยเรื่องเศรษฐกิจ
personal_finance|Money Smarts|Finanzas Personales|Finanças Pessoais|المال الشخصي|Finances Perso|Persönliche Finanzen|Finanza Personale|マネー術|재테크|理財|Личные финансы|Keuangan Pribadi|การเงินส่วนตัว
finance_interest|Markets|Mercados|Mercados|الأسواق المالية|Marchés Financiers|Börse|Mercati|投資・マーケット|투자·시장|投資市場|Рынки|Pasar Saham|ตลาดการเงิน
crypto_interest|Crypto|Cripto|Cripto|العملات الرقمية|Crypto|Krypto|Cripto|暗号資産|코인|加密貨幣|Крипта|Kripto|คริปโต
entrepreneurship|Founder Mode|Modo Emprendedor|Modo Empreendedor|روح ريادة الأعمال|Esprit Entrepreneur|Gründergeist|Spirito Imprenditoriale|起業家精神|창업가 기질|創業魂|Предприниматель|Jiwa Wirausaha|โหมดผู้ประกอบการ
career_focus|Career Focus|Enfoque Profesional|Foco na Carreira|التركيز المهني|Focus Carrière|Karrierefokus|Focus sulla Carriera|仕事モード|커리어 집중|職涯導向|Карьерный фокус|Fokus Karier|โฟกัสงาน
political_interest|Politics|Política|Política|الاهتمام بالسياسة|Politique|Politik|Politica|政治ウォッチ|정치 관심|政治關注|Политика|Politik|การเมือง
political_knowledge|Politics IQ|Saber Político|Saber Político|الثقافة السياسية|Culture Politique|Politikwissen|Cultura Politica|政治リテラシー|정치 지식|政治知識|Политическая грамотность|Wawasan Politik|ความรู้การเมือง
current_affairs|News Radar|Radar de Noticias|Radar de Notícias|متابعة الأخبار|Radar Actu|Nachrichtenradar|Radar Notizie|ニュース感度|뉴스 레이더|新聞雷達|Новостной радар|Radar Berita|เรดาร์ข่าว
geopolitics|Geopolitics|Geopolítica|Geopolítica|الجغرافيا السياسية|Géopolitique|Geopolitik|Geopolitica|地政学|지정학|地緣政治|Геополитика|Geopolitik|ภูมิรัฐศาสตร์
law_justice|Law and Justice|Derecho|Direito|القانون والعدالة|Droit et Justice|Recht|Diritto|法律・司法|법과 정의|法律|Право|Hukum|กฎหมาย
media_criticism|Media Critic|Crítico de Medios|Crítico da Mídia|نقد الإعلام|Critique des Médias|Medienkritik|Critico dei Media|メディア批評|언론 비평|媒體批判|Критик СМИ|Kritik Media|นักวิจารณ์สื่อ
history_storytelling|History Storyteller|Narrador de Historia|Contador de História|راوي التاريخ|Conteur d'Histoire|Geschichtenerzähler|Narratore di Storia|歴史語り|역사 이야기꾼|歷史說書人|Рассказчик истории|Pendongeng Sejarah|นักเล่าประวัติศาสตร์
historical_parallels|Lessons from History|Lecciones de la Historia|Lições da História|دروس التاريخ|Leçons de l'Histoire|Lehren der Geschichte|Lezioni della Storia|歴史に学ぶ|역사에서 배우기|以史為鑑|Уроки истории|Belajar dari Sejarah|บทเรียนจากอดีต
history_interest|History|Historia|História|التاريخ|Histoire|Geschichte|Storia|歴史好き|역사 덕후|歷史迷|История|Sejarah|ประวัติศาสตร์
history_knowledge|History IQ|Saber Histórico|Saber Histórico|الثقافة التاريخية|Culture Historique|Geschichtswissen|Cultura Storica|歴史知識|역사 지식|歷史知識|Историческая эрудиция|Wawasan Sejarah|ความรู้ประวัติศาสตร์
philosophy_interest|Philosophy|Filosofía|Filosofia|الفلسفة|Philosophie|Philosophie|Filosofia|哲学好き|철학 덕후|哲學迷|Философия|Filsafat|ปรัชญา
philosophy_knowledge|Philosophy IQ|Saber Filosófico|Saber Filosófico|الثقافة الفلسفية|Culture Philosophique|Philosophiewissen|Cultura Filosofica|哲学知識|철학 지식|哲學知識|Философская эрудиция|Wawasan Filsafat|ความรู้ปรัชญา
ethics_debate|Moral Debater|Debate Moral|Debate Moral|الجدل الأخلاقي|Débat Moral|Moraldebatte|Dibattito Etico|倫理トーク|윤리 논쟁|道德辯論|Моральные споры|Debat Moral|ถกเรื่องศีลธรรม
science_interest|Science|Ciencia|Ciência|العلوم|Science|Wissenschaft|Scienza|サイエンス好き|과학 덕후|科學迷|Наука|Sains|วิทยาศาสตร์
scientific_literacy|Science IQ|Rigor Científico|Rigor Científico|الثقافة العلمية|Rigueur Scientifique|Wissenschaftlichkeit|Rigore Scientifico|科学リテラシー|과학적 사고|科學素養|Научная грамотность|Literasi Sains|ความรู้วิทยาศาสตร์
space_astronomy|Space|Espacio|Espaço|الفضاء والفلك|Espace|Weltraum|Spazio|宇宙好き|우주 덕후|太空迷|Космос|Antariksa|อวกาศ
health_medicine_interest|Health and Medicine|Salud|Saúde|الصحة والطب|Santé|Gesundheit|Salute|健康・医療|건강·의학|健康醫療|Здоровье и медицина|Kesehatan|สุขภาพ
psychology_interest|Psychology|Psicología|Psicologia|علم النفس|Psychologie|Psychologie|Psicologia|心理学|심리학|心理學|Психология|Psikologi|จิตวิทยา
nature_environment|Nature|Naturaleza|Natureza|الطبيعة والبيئة|Nature|Natur und Umwelt|Natura|自然・環境|자연·환경|自然環境|Природа|Alam|ธรรมชาติ
science_communication|Science Explainer|Divulgador Científico|Divulgador Científico|مبسّط العلوم|Vulgarisateur|Wissenschaftserklärer|Divulgatore Scientifico|科学解説|과학 해설가|科普達人|Популяризатор науки|Penjelas Sains|นักย่อยวิทยาศาสตร์
fun_facts|Fun Facts Hunter|Cazador de Curiosidades|Caçador de Curiosidades|صياد المعلومات الغريبة|Chasseur d'Anecdotes|Fun-Fact-Jäger|Cacciatore di Curiosità|トリビア好き|잡학 수집가|冷知識獵人|Охотник за фактами|Pemburu Fakta Unik|นักล่าเกร็ดความรู้
tech_interest|Tech|Tecnología|Tecnologia|التقنية|Tech|Technik|Tecnologia|テック好き|테크 덕후|科技迷|Технологии|Teknologi|เทคโนโลยี
tech_knowledge|Tech IQ|Saber Técnico|Saber Técnico|الثقافة التقنية|Culture Tech|Technikwissen|Cultura Tech|テック知識|기술 지식|科技知識|Техническая эрудиция|Wawasan Teknologi|ความรู้เทค
software_culture|Dev Life|Vida Dev|Vida Dev|ثقافة البرمجة|Vie de Dev|Entwickler-Leben|Vita da Dev|エンジニア魂|개발자 감성|工程師魂|Жизнь разработчика|Dunia Developer|ชีวิตโปรแกรมเมอร์
ai_interest|AI|IA|IA|الذكاء الاصطناعي|IA|KI|IA|AI好き|AI 덕후|AI迷|ИИ|AI|เอไอ
gadgets|Gadgets|Gadgets|Gadgets|الأجهزة|Gadgets|Gadgets|Gadget|ガジェット|가젯|3C控|Гаджеты|Gadget|แก็ดเจ็ต
internet_culture|Internet Culture|Cultura de Internet|Cultura da Internet|ثقافة الإنترنت|Culture Web|Netzkultur|Cultura del Web|ネット文化|인터넷 문화|網路文化|Интернет-культура|Budaya Internet|วัฒนธรรมออนไลน์
literature_interest|Literature|Literatura|Literatura|الأدب|Littérature|Literatur|Letteratura|文学好き|문학 덕후|文學迷|Литература|Sastra|วรรณกรรม
literary_knowledge|Literary IQ|Saber Literario|Saber Literário|الثقافة الأدبية|Culture Littéraire|Literaturwissen|Cultura Letteraria|文学知識|문학 지식|文學知識|Литературная эрудиция|Wawasan Sastra|ความรู้วรรณกรรม
reading_habit|Bookworm|Ratón de Biblioteca|Rato de Biblioteca|دودة الكتب|Rat de Bibliothèque|Bücherwurm|Topo di Biblioteca|読書家|책벌레|書蟲|Книжный червь|Kutu Buku|หนอนหนังสือ
poetry_interest|Poetry|Poesía|Poesia|الشعر|Poésie|Lyrik|Poesia|詩が好き|시 사랑|詩歌|Поэзия|Puisi|บทกวี
book_recommendations|Book Recommender|Recomendador de Libros|Indicador de Livros|مرشح الكتب|Conseiller Lecture|Buchtipp-Geber|Consiglia Libri|本の推し活|책 추천러|書單推手|Советчик по книгам|Rekomendasi Buku|นักป้ายยาหนังสือ
quote_sharing|Quote Sharer|Citas Célebres|Citações|مشاركة الاقتباسات|Partage de Citations|Zitate-Teiler|Citazioni|名言シェア|명언 공유|金句分享|Цитаты|Berbagi Kutipan|แชร์คำคม
cinema_culture|Film Buff|Cinéfilo|Cinéfilo|ثقافة السينما|Cinéphile|Cineast|Cinefilo|映画通|영화광|影癡|Киноман|Pecinta Film|คอหนัง
tv_series_interest|Series Binger|Seriéfilo|Maratonista de Séries|عشق المسلسلات|Accro aux Séries|Serienjunkie|Seriale-dipendente|ドラマ沼|드라마 덕후|追劇族|Сериаломан|Maniak Serial|สายบิงจ์ซีรีส์
anime_manga|Anime and Manga|Anime y Manga|Anime e Mangá|الأنمي والمانغا|Anime et Manga|Anime und Manga|Anime e Manga|アニメ・漫画|애니·만화|動漫|Аниме и манга|Anime dan Manga|อนิเมะและมังงะ
pop_culture|Pop Culture|Cultura Pop|Cultura Pop|الثقافة الشعبية|Culture Pop|Popkultur|Cultura Pop|芸能・ポップカルチャー|연예·팝컬처|流行文化|Поп-культура|Budaya Pop|ป๊อปคัลเจอร์
music_interest|Music|Música|Música|الموسيقى|Musique|Musik|Musica|音楽好き|음악 사랑|音樂迷|Музыка|Musik|ดนตรี
music_knowledge|Music IQ|Cultura Musical|Cultura Musical|الثقافة الموسيقية|Culture Musicale|Musikwissen|Cultura Musicale|音楽通|음악 지식|音樂知識|Музыкальная эрудиция|Wawasan Musik|ความรู้ดนตรี
live_music_culture|Live Music|Música en Vivo|Música ao Vivo|الحفلات الحية|Concerts Live|Live-Musik|Musica dal Vivo|ライブ遠征|공연 덕후|現場派|Живая музыка|Musik Live|สายคอนเสิร์ต
musicianship|Musician|Músico|Músico|العزف والتأليف|Musicien|Musiker|Musicista|演奏・作曲|뮤지션|音樂人|Музыкант|Musisi|นักดนตรี
gaming_culture|Gamer|Gamer|Gamer|ثقافة الألعاب|Gamer|Gamer|Gamer|ゲーマー|게이머|遊戲玩家|Геймер|Gamer|เกมเมอร์
esports_interest|Esports|eSports|eSports|الرياضات الإلكترونية|Esport|E-Sport|Esport|eスポーツ|e스포츠|電競|Киберспорт|Esports|อีสปอร์ต
travel_curiosity|Wanderlust|Ganas de Viajar|Vontade de Viajar|حب السفر|Envie d'Ailleurs|Fernweh|Voglia di Viaggiare|旅好き|여행 욕구|旅遊魂|Тяга к путешествиям|Hobi Jalan-jalan|สายเที่ยว
city_culture|City Life|Vida Urbana|Vida Urbana|حياة المدينة|Vie Urbaine|Stadtleben|Vita in Città|街歩き|도시 감성|城市生活|Городская жизнь|Kehidupan Kota|ชีวิตในเมือง
outdoor_adventure|Outdoors|Aire Libre|Ao Ar Livre|المغامرات في الطبيعة|Plein Air|Draußen unterwegs|Outdoor|アウトドア|아웃도어|戶外派|Активный отдых|Petualangan Alam|สายเอาท์ดอร์
food_interest|Foodie|Foodie|Foodie|عشق الأكل|Gourmand|Foodie|Buongustaio|グルメ|미식가|吃貨|Гурман|Pecinta Kuliner|สายกิน
cooking|Home Chef|Chef Casero|Chef Caseiro|الطبخ|Chef Maison|Hobbykoch|Chef di Casa|料理好き|요리 덕후|廚藝|Домашний шеф|Jago Masak|เชฟที่บ้าน
fashion_style|Style|Moda|Moda|الموضة|Mode|Mode|Moda|ファッション|패션|時尚|Мода|Fesyen|แฟชั่น
beauty_care|Beauty and Care|Belleza|Beleza|الجمال والعناية|Beauté|Beauty|Bellezza|美容|뷰티|美妝保養|Красота и уход|Kecantikan|ความงาม
visual_arts|Visual Arts|Artes Visuales|Artes Visuais|الفنون البصرية|Arts Visuels|Bildende Kunst|Arti Visive|アート|미술|視覺藝術|Изобразительное искусство|Seni Rupa|ทัศนศิลป์
design_architecture|Design and Architecture|Diseño y Arquitectura|Design e Arquitetura|التصميم والعمارة|Design et Architecture|Design und Architektur|Design e Architettura|デザイン・建築|디자인·건축|設計建築|Дизайн и архитектура|Desain dan Arsitektur|ดีไซน์และสถาปัตย์
photography|Photographer's Eye|Ojo Fotográfico|Olhar Fotográfico|عين المصور|Œil de Photographe|Fotografenblick|Occhio Fotografico|写真好き|사진 감성|攝影魂|Фотограф|Mata Fotografer|สายถ่ายภาพ
performing_arts|Stage Arts|Artes Escénicas|Artes Cênicas|فنون المسرح|Arts de la Scène|Bühnenkunst|Arti Sceniche|舞台芸術|무대 예술|表演藝術|Сценическое искусство|Seni Pertunjukan|ศิลปะการแสดง
animal_love|Animal Lover|Amante de los Animales|Amante dos Animais|حب الحيوانات|Ami des Animaux|Tierfreund|Amante degli Animali|動物好き|동물 사랑|動物控|Любитель животных|Pecinta Hewan|ทาสสัตว์
automotive|Car Lover|Motor y Coches|Carros|عشق السيارات|Passion Auto|Autoliebe|Motori|クルマ好き|자동차 덕후|車迷|Автолюбитель|Otomotif|คอรถยนต์
astrology|Astrology|Astrología|Astrologia|الأبراج|Astrologie|Astrologie|Astrologia|星占い|별자리|星座|Астрология|Zodiak|โหราศาสตร์
self_improvement|Self-Improvement|Superación Personal|Desenvolvimento Pessoal|تطوير الذات|Développement Perso|Selbstoptimierung|Crescita Personale|自己啓発|자기계발|自我成長|Саморазвитие|Pengembangan Diri|พัฒนาตัวเอง
academia|Academia|Vida Académica|Vida Acadêmica|الحياة الأكاديمية|Vie Académique|Wissenschaftsbetrieb|Vita Accademica|研究・学問|학계 생활|學術圈|Академическая среда|Akademisi|ชีวิตวิชาการ
`;

export const TRAIT_LABELS: ReadonlyMap<string, Readonly<Record<LabelLocale, string>>> = new Map(
  LABEL_ROWS.trim().split("\n").map(line => {
    const [id, ...names] = line.split("|");
    const tr = TRAITS.find(t => t.id === id)?.label ?? id;
    return [id, Object.freeze({ tr, ...Object.fromEntries(LABEL_LOCALES.map((l, i) => [l, names[i]])) }) as Record<LabelLocale, string>];
  }));

// The label for a trait in the result language; English when a language has no row, never an id.
export function traitLabel(id: string, locale: string): string {
  const row = TRAIT_LABELS.get(id);
  if (!row) return TRAITS.find(t => t.id === id)?.label ?? id;
  return (row as Record<string, string>)[locale] ?? row.en;
}
