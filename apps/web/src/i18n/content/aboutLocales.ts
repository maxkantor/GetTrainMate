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
  hero_sub: 'Train, vibe, or date — with people who match your energy.',
  stats: [
    { value: '1', label: 'Builder' },
    { value: 'Solo', label: 'Indie product' },
    { value: 'Global', label: 'Made for everywhere' },
    { value: 'Tasteful', label: 'Modern + safe' },
  ],
  values: [
    {
      title: 'Real connection',
      description: 'Train, vibe, or date — with people who match your energy.',
    },
    {
      title: 'Fitness-first',
      description: 'Movement is the common ground. It makes meeting people feel natural.',
    },
    {
      title: 'Safety & trust',
      description: 'Verified profiles and secure messaging so you can connect with confidence.',
    },
    {
      title: 'Designed with intent',
      description: 'Clear modes (Train, Vibe, Date) so you can choose what you’re here for.',
    },
  ],
  story_title: 'Why this exists',
  story_p1:
    'Dating apps can feel random. Fitness apps can feel transactional. I wanted something simple: meet active people in a way that feels modern, safe, and real.',
  story_p2:
    'GetTrainMate is built for three intents: training partners, social vibes, and romantic discovery — all through fitness as the starting point.',
  values_section_title: 'What I care about',
  founder_kicker: 'About GetTrainMate',
  founder_h2: 'Built by an athlete — for real people',
  founder_p1: 'GetTrainMate was created to solve a simple problem: finding the right people to train, play, and connect with in real life.',
  founder_p2: 'The best experiences don’t happen only online. They happen when people meet, move, compete, and share something real together.',
  founder_p3: 'Built by a sports fan (and yes — a Chelsea supporter 💙), this platform is designed for all sports, all teams, and all ways of connecting.',
  founder_p4: 'Train. Play. Meet. Vibe. Date.',
  founder_p5: 'Real-world connection — on your terms.',
  founder_list_title: 'Core positioning:',
  founder_activities: ['Train', 'Play', 'Meet', 'Vibe', 'Date'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate is independent and not affiliated with or endorsed by any club, league, federation, or event organizer.',
};

const ES: AboutPageContent = {
  hero_title: 'Sobre GetTrainMate',
  hero_sub: 'Entrena, socializa o cita — con gente que encaje contigo.',
  stats: [
    { value: '1', label: 'Creador' },
    { value: 'Solo', label: 'Producto indie' },
    { value: 'Global', label: 'Para todo el mundo' },
    { value: 'Con gusto', label: 'Moderno y seguro' },
  ],
  values: [
    {
      title: 'Conexión real',
      description: 'Entrena, rollo o cita — con energía compatible.',
    },
    {
      title: 'Fitness primero',
      description: 'El movimiento es el punto en común; conocer gente se siente natural.',
    },
    {
      title: 'Seguridad y confianza',
      description: 'Perfiles verificados y chat seguro para conectar con tranquilidad.',
    },
    {
      title: 'Con intención clara',
      description: 'Modos Train, Vibe y Date para decidir por qué estás aquí.',
    },
  ],
  story_title: 'Por qué existe',
  story_p1:
    'Las apps de citas pueden parecer aleatorias; las de fitness, frías. Quería algo simple: gente activa, moderna, segura y real.',
  story_p2:
    'GetTrainMate cubre tres intenciones: compañeros de entreno, ambiente social y ligar — empezando por el deporte.',
  values_section_title: 'En lo que creo',
  founder_kicker: 'Sobre GetTrainMate',
  founder_h2: 'Hecho por un deportista — para gente real',
  founder_p1: 'GetTrainMate se creó para resolver un problema simple: encontrar a las personas adecuadas para entrenar, jugar y conectar en la vida real.',
  founder_p2: 'Las mejores experiencias no ocurren solo online. Ocurren cuando la gente se encuentra, se mueve, compite y comparte algo real.',
  founder_p3: 'Creado por un fan del deporte (y sí — hincha del Chelsea 💙), esta plataforma está diseñada para todos los deportes, todos los equipos y todas las formas de conectar.',
  founder_p4: 'Entrena. Juega. Conoce. Vibra. Cita.',
  founder_p5: 'Conexión real — a tu manera.',
  founder_list_title: 'Qué hago:',
  founder_activities: ['Entrena', 'Juega', 'Conoce', 'Vibra', 'Cita'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate es independiente y no está afiliado ni respaldado por ningún club, liga, federación u organizador de eventos.',
};

const RU: AboutPageContent = {
  hero_title: 'О GetTrainMate',
  hero_sub: 'Тренировки, общение или свидания — с теми, кто на вашей волне.',
  stats: [
    { value: '1', label: 'Создатель' },
    { value: 'Solo', label: 'Инди-продукт' },
    { value: 'Глобально', label: 'Для всего мира' },
    { value: 'Со вкусом', label: 'Современно и безопасно' },
  ],
  values: [
    {
      title: 'Настоящий контакт',
      description: 'Тренировки, вайб или дейтинг — с подходящими людьми.',
    },
    {
      title: 'Фитнес в приоритете',
      description: 'Движение как общая тема — знакомства ощущаются естественно.',
    },
    {
      title: 'Безопасность и доверие',
      description: 'Проверенные профили и защищённые сообщения.',
    },
    {
      title: 'Осознанный дизайн',
      description: 'Режимы Train, Vibe, Date — вы сами выбирате цель.',
    },
  ],
  story_title: 'Зачем это сделано',
  story_p1:
    'Дейтинг бывает хаотичным, фитнес-приложения — сухими. Хотелось простого способа встречать активных людей современно и безопасно.',
  story_p2:
    'Три намерения: партнёры по спорту, общение и романтика — всё от фитнеса как стартовой точки.',
  values_section_title: 'Что для меня важно',
  founder_kicker: 'О GetTrainMate',
  founder_h2: 'Сделано спортсменом — для живых людей',
  founder_p1: 'GetTrainMate создан, чтобы решить простую задачу: находить подходящих людей для тренировок, игр и живого общения.',
  founder_p2: 'Лучшие впечатления происходят не только онлайн. Они происходят, когда люди встречаются, двигаются, соревнуются и делятся чем-то настоящим.',
  founder_p3: 'Проект создан спортивным фанатом (и да — болельщиком Chelsea 💙) и подходит для любых видов спорта, команд и форм знакомства.',
  founder_p4: 'Тренируйся. Играй. Знакомься. Вайб. Дейт.',
  founder_p5: 'Связь в реальном мире — на ваших условиях.',
  founder_list_title: 'Чем занимаюсь:',
  founder_activities: ['Тренируйся', 'Играй', 'Знакомься', 'Вайб', 'Дейт'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate — независимая платформа и не связана с клубами, лигами, федерациями или организаторами событий.',
};

const UA: AboutPageContent = {
  hero_title: 'Про GetTrainMate',
  hero_sub: 'Тренування, вайб чи знайомства — з тими, хто на вашій хвилі.',
  stats: [
    { value: '1', label: 'Розробник' },
    { value: 'Solo', label: 'Indie-продукт' },
    { value: 'Глобально', label: 'Для всього світу' },
    { value: 'Зі смаком', label: 'Сучасно й безпечно' },
  ],
  values: [
    {
      title: 'Справжній контакт',
      description: 'Тренування, спілкування чи романтика — з відповідними людьми.',
    },
    {
      title: 'Фітнес на першому плані',
      description: 'Рух як спільна тема — знайомства природніші.',
    },
    {
      title: 'Безпека й довіра',
      description: 'Перевірені профілі та захищені повідомлення.',
    },
    {
      title: 'З чітким наміром',
      description: 'Режими Train, Vibe, Date — ви обираєте мету.',
    },
  ],
  story_title: 'Навіщо це існує',
  story_p1:
    'Знайомства випадкові, фітнес-додатки іноді відчужені. Хотілося простого способу зустрічати активних людей сучасно й безпечно.',
  story_p2:
    'Три наміри: партнери з тренувань, спілкування та романтика — через спорт як старт.',
  values_section_title: 'Що для мене важливо',
  founder_kicker: 'Про GetTrainMate',
  founder_h2: 'Зроблено спортсменом — для реальних людей',
  founder_p1: 'GetTrainMate створено, щоб вирішити просту задачу: знаходити правильних людей для тренувань, гри та живого спілкування.',
  founder_p2: 'Найкращі враження трапляються не лише онлайн. Вони народжуються, коли люди зустрічаються, рухаються, змагаються та діляться чимось справжнім.',
  founder_p3: 'Платформу створив фанат спорту (і так — прихильник Chelsea 💙), і вона підходить для всіх видів спорту, команд та форматів знайомств.',
  founder_p4: 'Тренуйся. Грай. Знайомся. Вайб. Дейт.',
  founder_p5: 'Реальний звʼязок — на ваших умовах.',
  founder_list_title: 'Чим займаюсь:',
  founder_activities: ['Тренуйся', 'Грай', 'Знайомся', 'Вайб', 'Дейт'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate є незалежною платформою і не афілійований та не підтримується жодним клубом, лігою, федерацією чи організатором подій.',
};

const HI: AboutPageContent = {
  hero_title: 'GetTrainMate के बारे में',
  hero_sub: 'ट्रेन, वाइब या डेट — ऐसे लोगों के साथ जो आपकी ऊर्जा से मेल खाएँ।',
  stats: [
    { value: '1', label: 'निर्माता' },
    { value: 'Solo', label: 'इंडी प्रोडक्ट' },
    { value: 'वैश्विक', label: 'हर जगह के लिए' },
    { value: 'संतुलित', label: 'आधुनिक + सुरक्षित' },
  ],
  values: [
    {
      title: 'सच्चा कनेक्शन',
      description: 'वर्कआउट, दोस्ती या रोमांस — मेल खाती ऊर्जा के साथ।',
    },
    {
      title: 'फिटनेस-फर्स्ट',
      description: 'गति साझा आधार है; मिलना स्वाभाविक लगता है।',
    },
    {
      title: 'सुरक्षा और भरोसा',
      description: 'सत्यापित प्रोफाइल और सुरक्षित चैट।',
    },
    {
      title: 'इरादे से डिज़ाइन',
      description: 'स्पष्ट मोड: Train, Vibe, Date।',
    },
  ],
  story_title: 'यह क्यों है',
  story_p1:
    'डेटिंग ऐप यादृच्छिक लग सकते हैं; फिटनेस ऐप लेन-देन जैसे। सक्रिय लोगों से मिलना आधुनिक, सुरक्षित और सच्चा हो — यही लक्ष्य था।',
  story_p2:
    'तीन इरादे: ट्रेनिंग पार्टनर, सोशल वाइब और रोमांटिक खोज — शुरुआत फिटनेस से।',
  values_section_title: 'जो मायने रखता है',
  founder_kicker: 'GetTrainMate के बारे में',
  founder_h2: 'एक एथलीट द्वारा — असली लोगों के लिए',
  founder_p1: 'GetTrainMate एक सरल समस्या हल करने के लिए बनाया गया: सही लोगों को ढूँढना जिनके साथ आप ट्रेन कर सकें, खेल सकें और वास्तविक जीवन में जुड़ सकें।',
  founder_p2: 'सबसे अच्छे अनुभव सिर्फ ऑनलाइन नहीं होते। वे तब होते हैं जब लोग मिलते हैं, चलते हैं, प्रतिस्पर्धा करते हैं और कुछ सच्चा साझा करते हैं।',
  founder_p3: 'एक स्पोर्ट्स फैन द्वारा बनाया गया (और हाँ — Chelsea समर्थक 💙), यह प्लेटफ़ॉर्म हर खेल, हर टीम और हर तरह के कनेक्शन के लिए डिज़ाइन किया गया है।',
  founder_p4: 'ट्रेन करो। खेलो। मिलो। वाइब करो। डेट करो।',
  founder_p5: 'रियल-वर्ल्ड कनेक्शन — आपकी शर्तों पर।',
  founder_list_title: 'मैं क्या करता हूँ:',
  founder_activities: ['ट्रेन', 'खेल', 'मिलो', 'वाइब', 'डेट'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate स्वतंत्र है और किसी क्लब, लीग, फेडरेशन या इवेंट आयोजक से संबद्ध या समर्थित नहीं है।',
};

const ZH: AboutPageContent = {
  hero_title: '关于 GetTrainMate',
  hero_sub: '一起练、聊得来、或约会——与气场相投的人相遇。',
  stats: [
    { value: '1', label: '独立开发者' },
    { value: 'Solo', label: '独立产品' },
    { value: '全球', label: '面向各地' },
    { value: '克制', label: '现代且安全' },
  ],
  values: [
    {
      title: '真实连接',
      description: '训练、氛围或恋爱——与合拍的人同行。',
    },
    {
      title: '健身优先',
      description: '运动是共同语言，让相识更自然。',
    },
    {
      title: '安全与信任',
      description: '资料验证与安全消息，放心建立联系。',
    },
    {
      title: '意图清晰',
      description: 'Train、Vibe、Date 模式，让你明确为何而来。',
    },
  ],
  story_title: '存在的理由',
  story_p1:
    '约会软件有时太随机，健身应用又太工具化。我想要更简单的方式：以现代、安全、真实的方式结识爱动的人。',
  story_p2:
    'GetTrainMate 面向三种意向：训练伙伴、社交氛围与恋爱探索——都以运动为起点。',
  values_section_title: '我在乎的事',
  founder_kicker: '关于 GetTrainMate',
  founder_h2: '由运动者打造——为真实的人',
  founder_p1: 'GetTrainMate 的创建是为了解决一个简单问题：找到合适的人，一起训练、一起运动，并在线下建立真实连接。',
  founder_p2: '最好的体验不只发生在网上，而是在人们相遇、运动、竞争并分享真实时刻时发生。',
  founder_p3: '这款平台由一位体育迷打造（没错，也是 Chelsea 球迷 💙），面向所有运动、所有球队和所有连接方式。',
  founder_p4: '训练。比赛。相识。同频。约会。',
  founder_p5: '真实世界的连接——由你定义。',
  founder_list_title: '我常做的事：',
  founder_activities: ['训练', '比赛', '相识', '同频', '约会'],
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
