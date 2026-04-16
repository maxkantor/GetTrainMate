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
  founder_p1: 'GetTrainMate was built by me — Max Kantor.',
  founder_p2: 'I created this because meeting active people shouldn’t be awkward, random, or low-trust.',
  founder_p3:
    'I regularly train, play soccer, hit the gym, and stay active with things like pickleball and fishing. I wanted a simple way to find people who actually show up and train consistently.',
  founder_p4:
    'This app is built for people who want fitness-first connection — whether that becomes a great workout partner, a new friend, or something more.',
  founder_p5: 'No sleaze. No games. Just real people with real energy.',
  founder_list_title: 'What I do:',
  founder_activities: ['Soccer / Football', 'Gym workouts', 'Pickleball', 'Fishing'],
  founder_closing: 'If you’re using GetTrainMate, you’re exactly the kind of person I built this for.',
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
  founder_p1: 'GetTrainMate lo construyo yo — Max Kantor.',
  founder_p2: 'Porque conocer gente activa no debería ser incómodo, aleatorio o poco fiable.',
  founder_p3:
    'Entreno, juego al fútbol, voy al gimnasio y practico cosas como pickleball o pesca. Quería una forma sencilla de encontrar gente que de verdad se apunte.',
  founder_p4:
    'La app es para quien quiere conexión fitness-first: buen compañero de entreno, amistad o algo más.',
  founder_p5: 'Sin postureo. Sin juegos. Gente real con energía real.',
  founder_list_title: 'Qué hago:',
  founder_activities: ['Fútbol', 'Gimnasio', 'Pickleball', 'Pesca'],
  founder_closing: 'Si usas GetTrainMate, eres justo a quien va dirigido esto.',
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
  founder_p1: 'Проект делает Макс Кантор.',
  founder_p2: 'Встречи с активными людьми не должны быть неловкими или ненадёжными.',
  founder_p3:
    'Тренируюсь, играю в футбол, хожу в зал, pickleball и рыбалка — хотелось простого способа находить тех, кто реально приходит на тренировки.',
  founder_p4:
    'Для тех, кто хочет связь через спорт: партнёр, друг или больше.',
  founder_p5: 'Без пошлости и игр — только люди с энергией.',
  founder_list_title: 'Чем занимаюсь:',
  founder_activities: ['Футбол', 'Зал', 'Пиклбол', 'Рыбалка'],
  founder_closing: 'Если вы здесь — вы как раз тот человек, для кого это сделано.',
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
  founder_p1: 'GetTrainMate роблю я — Макс Кантор.',
  founder_p2: 'Зустрічати активних людей не має бути неловко чи ненадійно.',
  founder_p3:
    'Тренуюсь, граю у футбол, зал, pickleball і рибалка — хотілося простого способу знаходити тих, хто реально зʼявляється на тренуваннях.',
  founder_p4:
    'Для тих, хто хоче звʼязок через фітнес: партнер, друг чи більше.',
  founder_p5: 'Без вульгарності й ігор — лише люди з енергією.',
  founder_list_title: 'Чим займаюсь:',
  founder_activities: ['Футбол', 'Зал', 'Піклбол', 'Рибалка'],
  founder_closing: 'Якщо ви тут — ви саме та людина, для якої це зроблено.',
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
  founder_p1: 'इसे मैंने बनाया — मैक्स कैंटर।',
  founder_p2: 'सक्रिय लोगों से मिलना अजीब या कम भरोसे वाला नहीं होना चाहिए।',
  founder_p3:
    'मैं ट्रेन करता हूँ, फुटबॉल, जिम, पिकलबॉल और मछली पकड़ता हूँ — ऐसे लोग चाहिए जो वास्तव में ट्रेनिंग पर आते हैं।',
  founder_p4:
    'फिटनेस-फर्स्ट कनेक्शन चाहने वालों के लिए: पार्टनर, दोस्त या कुछ और।',
  founder_p5: 'कोई अश्लीलता नहीं, कोई खेल नहीं — सच्ची ऊर्जा वाले लोग।',
  founder_list_title: 'मैं क्या करता हूँ:',
  founder_activities: ['फुटबॉल', 'जिम', 'पिकलबॉल', 'मछली पकड़ना'],
  founder_closing: 'अगर आप GetTrainMate इस्तेमाल कर रहे हैं, तो आपके लिए ही यह बना है।',
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
  founder_p1: '由我 Max Kantor 创建。',
  founder_p2: '结识爱动的人不该尴尬、随机或缺乏信任。',
  founder_p3:
    '我坚持训练、踢球、健身，也喜欢匹克球和钓鱼。我想找到真正会坚持来练的伙伴。',
  founder_p4:
    '这款应用面向想要「健身优先」连接的人——无论是训练搭档、新朋友，还是更进一步。',
  founder_p5: '不油腻、不套路，只有真实能量的人。',
  founder_list_title: '我常做的事：',
  founder_activities: ['足球', '健身房', '匹克球', '钓鱼'],
  founder_closing: '如果你正在使用 GetTrainMate，你就是我为之打造的那类人。',
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
