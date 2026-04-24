import type { Locale } from '@/i18n';

export type AboutStat = { value: string; label: string };
export type AboutValue = { title: string; description: string };

export type AboutPageContent = {
  hero_title: string;
  hero_sub: string;
  stats: AboutStat[];
  values: AboutValue[];
  story_title: string;
  story_p1: string;
  story_p2: string;
  values_section_title: string;
  founder_kicker: string;
  founder_h2: string;
  founder_p1: string;
  founder_p2: string;
  founder_p3: string;
  founder_p4: string;
  founder_p5: string;
  founder_list_title: string;
  founder_activities: string[];
  founder_closing: string;
  founder_disclaimer?: string;
};

const EN: AboutPageContent = {
  hero_title: 'About GetTrainMate',
  hero_sub: 'Built solo by Max Kantor — for real people.',
  stats: [
    { value: 'Solo', label: 'Built by Max' },
    { value: 'Live', label: 'Production product' },
    { value: 'Full-stack', label: 'End-to-end platform' },
    { value: 'Global', label: 'For every sport' },
  ],
  values: [
    {
      title: 'Solo-built product',
      description: 'Built end-to-end by Max Kantor: product, UX, frontend, backend, cloud, CRM, credits, payments, and deployment.',
    },
    {
      title: 'Software leadership',
      description: 'Created by a Software Development Leader with experience building production-grade software and leading engineering teams.',
    },
    {
      title: 'Real-world connection',
      description: 'Activity, energy, and shared interests make meeting people feel more natural than random swiping.',
    },
    {
      title: 'Every sport, every team',
      description: 'GetTrainMate is built for every sport, every team, and every person looking for real-world connection.',
    },
  ],
  story_title: 'Built solo by Max Kantor — for real people',
  story_p1:
    'GetTrainMate was created and built solo by Max Kantor, a Software Development Leader with years of experience building production-grade software, leading engineering teams, and shipping real products.',
  story_p2:
    'The idea is simple: help people find the right people to train, play, meet, vibe, watch sports, or date — in real life.',
  values_section_title: 'What makes it different',
  founder_kicker: 'About GetTrainMate',
  founder_h2: 'Built solo by Max Kantor — for real people',
  founder_p1: 'Dating apps can feel random. Fitness apps can feel transactional. GetTrainMate is different: it starts with activity, energy, and shared interests.',
  founder_p2:
    'As a software leader, I built this platform end-to-end — from product idea and UX flow to frontend, backend, cloud infrastructure, admin CRM, credits, payments, and production deployment.',
  founder_p3:
    'And yes — I’m also a huge Chelsea FC supporter 💙. But GetTrainMate is built for every sport, every team, and every person looking for real-world connection.',
  founder_p4: 'Train. Play. Meet. Vibe. Date.',
  founder_p5: 'Real-world connection — built, shipped, and owned by Max Kantor.',
  founder_list_title: 'GetTrainMate helps people:',
  founder_activities: ['Train', 'Play', 'Meet', 'Vibe', 'Watch sports', 'Date'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate is independent and not affiliated with or endorsed by any club, league, federation, or event organizer.',
};

const ES: AboutPageContent = {
  hero_title: 'Sobre GetTrainMate',
  hero_sub: 'Creado en solitario por Max Kantor — para personas reales.',
  stats: [
    { value: 'Solo', label: 'Creado por Max' },
    { value: 'Live', label: 'Producto en producción' },
    { value: 'Full-stack', label: 'Plataforma completa' },
    { value: 'Global', label: 'Para todos los deportes' },
  ],
  values: [
    {
      title: 'Producto creado en solitario',
      description: 'Construido de punta a punta por Max Kantor: producto, UX, frontend, backend, cloud, CRM, créditos, pagos y despliegue.',
    },
    {
      title: 'Liderazgo de software',
      description: 'Creado por un Software Development Leader con experiencia construyendo software de producción y liderando equipos de ingeniería.',
    },
    {
      title: 'Conexión en la vida real',
      description: 'La actividad, la energía y los intereses compartidos hacen que conocer gente sea más natural que deslizar perfiles al azar.',
    },
    {
      title: 'Cada deporte, cada equipo',
      description: 'GetTrainMate está hecho para cada deporte, cada equipo y cada persona que busca conexión real.',
    },
  ],
  story_title: 'Creado en solitario por Max Kantor — para personas reales',
  story_p1:
    'GetTrainMate fue creado y construido en solitario por Max Kantor, Software Development Leader con años de experiencia creando software de producción, liderando equipos de ingeniería y lanzando productos reales.',
  story_p2:
    'La idea es simple: ayudar a las personas a encontrar a quienes encajan para entrenar, jugar, conocer, conectar, ver deportes o tener citas — en la vida real.',
  values_section_title: 'Qué lo hace diferente',
  founder_kicker: 'Sobre GetTrainMate',
  founder_h2: 'Creado en solitario por Max Kantor — para personas reales',
  founder_p1: 'Las apps de citas pueden sentirse aleatorias. Las apps de fitness pueden sentirse transaccionales. GetTrainMate es diferente: empieza con actividad, energía e intereses compartidos.',
  founder_p2:
    'Como líder de software, construí esta plataforma de punta a punta — desde la idea de producto y el flujo UX hasta frontend, backend, infraestructura cloud, CRM admin, créditos, pagos y despliegue en producción.',
  founder_p3:
    'Y sí — también soy un gran seguidor del Chelsea FC 💙. Pero GetTrainMate está hecho para cada deporte, cada equipo y cada persona que busca conexión real.',
  founder_p4: 'Entrena. Juega. Conoce. Vibra. Cita.',
  founder_p5: 'Conexión en la vida real — creada, lanzada y propiedad de Max Kantor.',
  founder_list_title: 'GetTrainMate ayuda a las personas a:',
  founder_activities: ['Entrenar', 'Jugar', 'Conocer', 'Vibrar', 'Ver deportes', 'Tener citas'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate es independiente y no está afiliado ni respaldado por ningún club, liga, federación u organizador de eventos.',
};

const RU: AboutPageContent = {
  hero_title: 'О GetTrainMate',
  hero_sub: 'Создано Максом Кантором в одиночку — для реальных людей.',
  stats: [
    { value: 'Solo', label: 'Создано Максом' },
    { value: 'Live', label: 'Продукт в продакшене' },
    { value: 'Full-stack', label: 'Платформа end-to-end' },
    { value: 'Глобально', label: 'Для любого спорта' },
  ],
  values: [
    {
      title: 'Продукт, созданный в одиночку',
      description: 'Макс Кантор построил всё end-to-end: продукт, UX, frontend, backend, cloud, CRM, кредиты, платежи и деплой.',
    },
    {
      title: 'Software leadership',
      description: 'Создано Software Development Leader с опытом разработки production-grade software и руководства инженерными командами.',
    },
    {
      title: 'Связь в реальном мире',
      description: 'Активность, энергия и общие интересы делают знакомство естественнее, чем случайные свайпы.',
    },
    {
      title: 'Любой спорт, любая команда',
      description: 'GetTrainMate создан для любого спорта, любой команды и каждого, кто ищет реальную связь.',
    },
  ],
  story_title: 'Создано Максом Кантором в одиночку — для реальных людей',
  story_p1:
    'GetTrainMate был создан и построен в одиночку Максом Кантором, Software Development Leader с многолетним опытом создания production-grade software, руководства инженерными командами и запуска реальных продуктов.',
  story_p2:
    'Идея простая: помочь людям находить подходящих людей для тренировок, игр, встреч, общения, просмотра спорта или свиданий — в реальной жизни.',
  values_section_title: 'Чем GetTrainMate отличается',
  founder_kicker: 'О GetTrainMate',
  founder_h2: 'Создано Максом Кантором в одиночку — для реальных людей',
  founder_p1: 'Приложения для знакомств могут казаться случайными. Фитнес-приложения могут быть слишком транзакционными. GetTrainMate другой: он начинается с активности, энергии и общих интересов.',
  founder_p2:
    'Как software leader, я построил эту платформу end-to-end — от идеи продукта и UX-флоу до frontend, backend, cloud-инфраструктуры, admin CRM, кредитов, платежей и production deployment.',
  founder_p3:
    'И да — я большой болельщик Chelsea FC 💙. Но GetTrainMate создан для любого спорта, любой команды и каждого, кто ищет связь в реальном мире.',
  founder_p4: 'Тренируйся. Играй. Встречайся. Вайб. Дейт.',
  founder_p5: 'Связь в реальном мире — построена, запущена и принадлежит Максу Кантору.',
  founder_list_title: 'GetTrainMate помогает людям:',
  founder_activities: ['Тренироваться', 'Играть', 'Встречаться', 'Общаться', 'Смотреть спорт', 'Ходить на свидания'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate — независимая платформа и не связана с клубами, лигами, федерациями или организаторами событий.',
};

const UA: AboutPageContent = {
  hero_title: 'Про GetTrainMate',
  hero_sub: 'Створено Максом Кантором самостійно — для реальних людей.',
  stats: [
    { value: 'Solo', label: 'Створено Максом' },
    { value: 'Live', label: 'Продукт у продакшені' },
    { value: 'Full-stack', label: 'Платформа end-to-end' },
    { value: 'Глобально', label: 'Для кожного спорту' },
  ],
  values: [
    {
      title: 'Самостійно створений продукт',
      description: 'Макс Кантор побудував усе end-to-end: продукт, UX, frontend, backend, cloud, CRM, кредити, платежі та деплой.',
    },
    {
      title: 'Software leadership',
      description: 'Створено Software Development Leader з досвідом production-grade software та керування інженерними командами.',
    },
    {
      title: 'Звʼязок у реальному світі',
      description: 'Активність, енергія та спільні інтереси роблять знайомство природнішим за випадкові свайпи.',
    },
    {
      title: 'Кожен спорт, кожна команда',
      description: 'GetTrainMate створено для кожного спорту, кожної команди і кожної людини, яка шукає реальний звʼязок.',
    },
  ],
  story_title: 'Створено Максом Кантором самостійно — для реальних людей',
  story_p1:
    'GetTrainMate створив і побудував самостійно Макс Кантор, Software Development Leader з багаторічним досвідом створення production-grade software, керування інженерними командами та запуску реальних продуктів.',
  story_p2:
    'Ідея проста: допомогти людям знаходити правильних людей для тренувань, гри, зустрічей, спілкування, перегляду спорту або побачень — у реальному житті.',
  values_section_title: 'Чим GetTrainMate відрізняється',
  founder_kicker: 'Про GetTrainMate',
  founder_h2: 'Створено Максом Кантором самостійно — для реальних людей',
  founder_p1: 'Додатки для знайомств можуть здаватися випадковими. Фітнес-додатки можуть бути надто транзакційними. GetTrainMate інший: він починається з активності, енергії та спільних інтересів.',
  founder_p2:
    'Як software leader, я побудував цю платформу end-to-end — від ідеї продукту та UX-флоу до frontend, backend, cloud-інфраструктури, admin CRM, кредитів, платежів і production deployment.',
  founder_p3:
    'І так — я великий прихильник Chelsea FC 💙. Але GetTrainMate створено для кожного спорту, кожної команди і кожної людини, яка шукає реальний звʼязок.',
  founder_p4: 'Тренуйся. Грай. Зустрічайся. Вайб. Дейт.',
  founder_p5: 'Звʼязок у реальному світі — побудований, запущений і належить Максу Кантору.',
  founder_list_title: 'GetTrainMate допомагає людям:',
  founder_activities: ['Тренуватися', 'Грати', 'Зустрічатися', 'Спілкуватися', 'Дивитися спорт', 'Ходити на побачення'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate є незалежною платформою і не афілійований та не підтримується жодним клубом, лігою, федерацією чи організатором подій.',
};

const HI: AboutPageContent = {
  hero_title: 'GetTrainMate के बारे में',
  hero_sub: 'Max Kantor द्वारा अकेले बनाया गया — असली लोगों के लिए।',
  stats: [
    { value: 'Solo', label: 'Max द्वारा निर्मित' },
    { value: 'Live', label: 'प्रोडक्शन प्रोडक्ट' },
    { value: 'Full-stack', label: 'End-to-end प्लेटफॉर्म' },
    { value: 'वैश्विक', label: 'हर खेल के लिए' },
  ],
  values: [
    {
      title: 'अकेले बनाया गया प्रोडक्ट',
      description: 'Max Kantor ने इसे end-to-end बनाया: product, UX, frontend, backend, cloud, CRM, credits, payments और deployment.',
    },
    {
      title: 'Software leadership',
      description: 'एक Software Development Leader द्वारा बनाया गया, जिन्हें production-grade software बनाने और engineering teams lead करने का अनुभव है।',
    },
    {
      title: 'रियल-वर्ल्ड कनेक्शन',
      description: 'Activity, energy और shared interests लोगों से मिलना random swiping से ज्यादा natural बनाते हैं।',
    },
    {
      title: 'हर खेल, हर टीम',
      description: 'GetTrainMate हर sport, हर team और real-world connection खोजने वाले हर व्यक्ति के लिए बना है।',
    },
  ],
  story_title: 'Max Kantor द्वारा अकेले बनाया गया — असली लोगों के लिए',
  story_p1:
    'GetTrainMate को Max Kantor ने अकेले बनाया और launch किया — एक Software Development Leader जिनके पास production-grade software बनाने, engineering teams lead करने और real products ship करने का वर्षों का अनुभव है।',
  story_p2:
    'विचार सरल है: लोगों को सही लोगों से मिलाना ताकि वे train, play, meet, vibe, watch sports या date कर सकें — real life में।',
  values_section_title: 'यह अलग क्यों है',
  founder_kicker: 'GetTrainMate के बारे में',
  founder_h2: 'Max Kantor द्वारा अकेले बनाया गया — असली लोगों के लिए',
  founder_p1: 'Dating apps random लग सकते हैं। Fitness apps transactional लग सकते हैं। GetTrainMate अलग है: इसकी शुरुआत activity, energy और shared interests से होती है।',
  founder_p2:
    'एक software leader के रूप में, मैंने यह platform end-to-end बनाया — product idea और UX flow से लेकर frontend, backend, cloud infrastructure, admin CRM, credits, payments और production deployment तक।',
  founder_p3:
    'और हाँ — मैं Chelsea FC का बड़ा supporter भी हूँ 💙। लेकिन GetTrainMate हर sport, हर team और real-world connection खोजने वाले हर व्यक्ति के लिए बना है।',
  founder_p4: 'Train. Play. Meet. Vibe. Date.',
  founder_p5: 'Real-world connection — Max Kantor द्वारा built, shipped और owned.',
  founder_list_title: 'GetTrainMate लोगों की मदद करता है:',
  founder_activities: ['Train', 'Play', 'Meet', 'Vibe', 'Watch sports', 'Date'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate स्वतंत्र है और किसी क्लब, लीग, फेडरेशन या इवेंट आयोजक से संबद्ध या समर्थित नहीं है।',
};

const ZH: AboutPageContent = {
  hero_title: '关于 GetTrainMate',
  hero_sub: '由 Max Kantor 独立打造 — 为真实的人而建。',
  stats: [
    { value: 'Solo', label: '由 Max 打造' },
    { value: 'Live', label: '线上生产产品' },
    { value: 'Full-stack', label: '端到端平台' },
    { value: '全球', label: '面向所有运动' },
  ],
  values: [
    {
      title: '独立打造的产品',
      description: '由 Max Kantor 端到端构建：产品、UX、前端、后端、云基础设施、CRM、积分、支付和生产部署。',
    },
    {
      title: '软件领导力',
      description: '由一位 Software Development Leader 创建，拥有构建生产级软件和带领工程团队的经验。',
    },
    {
      title: '真实世界连接',
      description: '活动、能量和共同兴趣，让认识新朋友比随机滑动更自然。',
    },
    {
      title: '每项运动，每支球队',
      description: 'GetTrainMate 为每项运动、每支球队，以及每个寻找真实连接的人而建。',
    },
  ],
  story_title: '由 Max Kantor 独立打造 — 为真实的人而建',
  story_p1:
    'GetTrainMate 由 Max Kantor 独立创建和构建。Max 是一名 Software Development Leader，拥有多年构建生产级软件、带领工程团队和交付真实产品的经验。',
  story_p2:
    '想法很简单：帮助人们在现实生活中找到合适的人，一起训练、比赛、见面、同频、看体育或约会。',
  values_section_title: '它为什么不同',
  founder_kicker: '关于 GetTrainMate',
  founder_h2: '由 Max Kantor 独立打造 — 为真实的人而建',
  founder_p1: '约会应用可能让人觉得随机。健身应用可能让人觉得工具化。GetTrainMate 不同：它从活动、能量和共同兴趣开始。',
  founder_p2:
    '作为一名 software leader，我端到端构建了这个平台 — 从产品想法和 UX 流程，到前端、后端、云基础设施、admin CRM、积分、支付和生产部署。',
  founder_p3:
    '当然，我也是 Chelsea FC 的忠实支持者 💙。但 GetTrainMate 是为每项运动、每支球队，以及每个寻找真实连接的人而建。',
  founder_p4: '训练。比赛。见面。同频。约会。',
  founder_p5: '真实世界的连接 — 由 Max Kantor 构建、交付并拥有。',
  founder_list_title: 'GetTrainMate 帮助人们：',
  founder_activities: ['训练', '比赛', '见面', '同频', '看体育', '约会'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate 是独立平台，与任何俱乐部、联赛、协会或赛事组织者均无隶属或背书关系。',
};

const BY_LOCALE: Record<Locale, AboutPageContent> = {
  en: EN,
  es: ES,
  ru: RU,
  ua: UA,
  hi: HI,
  zh: ZH,
};

export function getAboutPage(locale: Locale): AboutPageContent {
  return BY_LOCALE[locale] ?? BY_LOCALE.en;
}
