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
  hero_sub: 'Built by one guy who didn’t like how apps work.',
  stats: [
    { value: 'One', label: 'Solo builder' },
    { value: 'Real', label: 'People first' },
    { value: 'No', label: 'Pressure or labels' },
    { value: 'Play', label: 'Train. Meet. Vibe.' },
  ],
  values: [
    {
      title: 'What this is',
      description: 'A place where you can train, play, watch games, meet new people, hang out, or maybe find something more.',
    },
    {
      title: 'No pressure',
      description: 'No labels upfront. Start with something real and see where it goes.',
    },
    {
      title: 'How it works',
      description: 'You start with a workout, a game, or a shared interest. Some people find training partners, some find friends, and some find something unexpected.',
    },
    {
      title: 'Why it exists',
      description: 'Real connections do not happen from endless scrolling. They happen when people move, laugh, compete, and show up.',
    },
  ],
  story_title: 'Hi — I’m Max.',
  story_p1: 'I built GetTrainMate because most apps for meeting people just don’t feel right.',
  story_p2:
    'Dating apps feel random. Fitness apps feel cold. And somehow… everything ends up being about swiping instead of actually meeting. I wanted something simpler.',
  values_section_title: 'What this is',
  founder_kicker: 'How it actually works',
  founder_h2: 'You start with something real',
  founder_p1: 'A workout, a game, a shared interest. And then you see where it goes.',
  founder_p2: 'Some people find training partners. Some find friends. Some find something they didn’t expect. That’s kind of the point.',
  founder_p3:
    'Because real connections don’t happen from endless scrolling. They happen when people move, laugh, compete, show up. This just helps that happen a little easier.',
  founder_p4: 'Also yes… I built the whole thing myself. And yes — I’m a Chelsea fan 💙 (doesn’t mean you have to be).',
  founder_p5: 'That’s it. No complicated rules. Just real people, real energy, real connection. Train. Play. Meet. Vibe. Date.',
  founder_list_title: 'A place where you can:',
  founder_activities: ['Train', 'Play', 'Watch games', 'Meet new people', 'Hang out', 'Maybe find something more'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate is independent and not affiliated with or endorsed by any club, league, or organization.',
};

const ES: AboutPageContent = {
  hero_title: 'Sobre GetTrainMate',
  hero_sub: 'Creado por un solo tipo al que no le gustaba cómo funcionan las apps.',
  stats: [
    { value: 'Uno', label: 'Creador solo' },
    { value: 'Real', label: 'Personas primero' },
    { value: 'Sin', label: 'Presión ni etiquetas' },
    { value: 'Play', label: 'Entrena. Conoce. Vibra.' },
  ],
  values: [
    {
      title: 'Qué es esto',
      description: 'Un lugar donde puedes entrenar, jugar, ver partidos, conocer gente nueva, pasar el rato o quizá encontrar algo más.',
    },
    {
      title: 'Sin presión',
      description: 'Sin etiquetas desde el principio. Empieza con algo real y mira adónde va.',
    },
    {
      title: 'Cómo funciona',
      description: 'Empiezas con un entrenamiento, un partido o un interés compartido. Algunos encuentran compañeros de entrenamiento, otros amigos y otros algo inesperado.',
    },
    {
      title: 'Por qué existe',
      description: 'Las conexiones reales no nacen de hacer scroll infinito. Nacen cuando la gente se mueve, se ríe, compite y aparece.',
    },
  ],
  story_title: 'Hola — soy Max.',
  story_p1: 'Construí GetTrainMate porque la mayoría de apps para conocer gente simplemente no se sienten bien.',
  story_p2:
    'Las apps de citas se sienten aleatorias. Las apps de fitness se sienten frías. Y de alguna forma… todo termina siendo deslizar en vez de realmente quedar. Quería algo más simple.',
  values_section_title: 'Qué es esto',
  founder_kicker: 'Cómo funciona de verdad',
  founder_h2: 'Empiezas con algo real',
  founder_p1: 'Un entrenamiento, un partido, un interés compartido. Y luego ves adónde va.',
  founder_p2: 'Algunos encuentran compañeros de entrenamiento. Otros encuentran amigos. Otros encuentran algo que no esperaban. Esa es un poco la idea.',
  founder_p3:
    'Porque las conexiones reales no nacen de hacer scroll infinito. Nacen cuando la gente se mueve, se ríe, compite y aparece. Esto solo ayuda a que pase un poco más fácil.',
  founder_p4: 'Y sí… construí todo esto yo solo. Y sí — soy fan del Chelsea 💙 (eso no significa que tú tengas que serlo).',
  founder_p5: 'Eso es todo. Sin reglas complicadas. Solo personas reales, energía real y conexión real. Entrena. Juega. Conoce. Vibra. Cita.',
  founder_list_title: 'Un lugar donde puedes:',
  founder_activities: ['Entrenar', 'Jugar', 'Ver partidos', 'Conocer gente nueva', 'Pasar el rato', 'Quizá encontrar algo más'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate es independiente y no está afiliado ni respaldado por ningún club, liga u organización.',
};

const RU: AboutPageContent = {
  hero_title: 'О GetTrainMate',
  hero_sub: 'Сделано одним парнем, которому не нравилось, как работают приложения.',
  stats: [
    { value: 'Один', label: 'Соло-разработчик' },
    { value: 'Реально', label: 'Сначала люди' },
    { value: 'Без', label: 'Давления и ярлыков' },
    { value: 'Play', label: 'Тренируйся. Встречайся. Вайб.' },
  ],
  values: [
    {
      title: 'Что это такое',
      description: 'Место, где можно тренироваться, играть, смотреть матчи, знакомиться с новыми людьми, проводить время или, может быть, найти что-то большее.',
    },
    {
      title: 'Без давления',
      description: 'Без ярлыков с самого начала. Начните с чего-то настоящего и посмотрите, куда это приведёт.',
    },
    {
      title: 'Как это работает',
      description: 'Вы начинаете с тренировки, игры или общего интереса. Кто-то находит партнёров для тренировок, кто-то друзей, а кто-то — то, чего не ожидал.',
    },
    {
      title: 'Зачем это сделано',
      description: 'Настоящие связи не появляются от бесконечной прокрутки. Они появляются, когда люди двигаются, смеются, соревнуются и приходят.',
    },
  ],
  story_title: 'Привет — я Max.',
  story_p1: 'Я создал GetTrainMate, потому что большинство приложений для знакомств с людьми просто ощущаются неправильно.',
  story_p2:
    'Дейтинг-приложения кажутся случайными. Фитнес-приложения — холодными. И почему-то всё сводится к свайпам вместо настоящих встреч. Я хотел сделать что-то проще.',
  values_section_title: 'Что это такое',
  founder_kicker: 'Как это на самом деле работает',
  founder_h2: 'Вы начинаете с чего-то настоящего',
  founder_p1: 'Тренировка, игра, общий интерес. А дальше смотрите, куда это приведёт.',
  founder_p2: 'Кто-то находит партнёров для тренировок. Кто-то находит друзей. Кто-то находит то, чего не ожидал. В этом и смысл.',
  founder_p3:
    'Потому что настоящие связи не возникают от бесконечной прокрутки. Они возникают, когда люди двигаются, смеются, соревнуются, приходят. Это просто помогает этому случиться немного легче.',
  founder_p4: 'И да… я построил всё сам. И да — я болельщик Chelsea 💙 (вам не обязательно им быть).',
  founder_p5: 'Вот и всё. Без сложных правил. Просто реальные люди, реальная энергия, реальная связь. Тренируйся. Играй. Встречайся. Вайб. Дейт.',
  founder_list_title: 'Место, где можно:',
  founder_activities: ['Тренироваться', 'Играть', 'Смотреть матчи', 'Знакомиться с новыми людьми', 'Проводить время', 'Может быть, найти что-то большее'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate — независимая платформа и не связана с каким-либо клубом, лигой или организацией и не одобрена ими.',
};

const UA: AboutPageContent = {
  hero_title: 'Про GetTrainMate',
  hero_sub: 'Створено одним хлопцем, якому не подобалось, як працюють додатки.',
  stats: [
    { value: 'Один', label: 'Соло-розробник' },
    { value: 'Реально', label: 'Спочатку люди' },
    { value: 'Без', label: 'Тиску й ярликів' },
    { value: 'Play', label: 'Тренуйся. Зустрічайся. Вайб.' },
  ],
  values: [
    {
      title: 'Що це таке',
      description: 'Місце, де можна тренуватися, грати, дивитися матчі, знайомитися з новими людьми, проводити час або, можливо, знайти щось більше.',
    },
    {
      title: 'Без тиску',
      description: 'Без ярликів із самого початку. Почніть із чогось справжнього й подивіться, куди це приведе.',
    },
    {
      title: 'Як це працює',
      description: 'Ви починаєте з тренування, гри або спільного інтересу. Хтось знаходить партнерів для тренувань, хтось друзів, а хтось — щось несподіване.',
    },
    {
      title: 'Чому я зробив це саме так',
      description: 'Реальні звʼязки не народжуються з нескінченного скролу. Вони зʼявляються, коли люди рухаються, сміються, змагаються і приходять.',
    },
  ],
  story_title: 'Привіт — я Max.',
  story_p1: 'Я створив GetTrainMate, бо більшість додатків для знайомства з людьми просто відчуваються неправильно.',
  story_p2:
    'Додатки для знайомств здаються випадковими. Фітнес-додатки — холодними. І якось усе зводиться до свайпів замість справжніх зустрічей. Я хотів чогось простішого.',
  values_section_title: 'Що це таке',
  founder_kicker: 'Як це насправді працює',
  founder_h2: 'Ви починаєте з чогось справжнього',
  founder_p1: 'Тренування, гра, спільний інтерес. А далі дивитеся, куди це приведе.',
  founder_p2: 'Хтось знаходить партнерів для тренувань. Хтось знаходить друзів. Хтось знаходить те, чого не очікував. У цьому й сенс.',
  founder_p3:
    'Бо реальні звʼязки не зʼявляються з нескінченного скролу. Вони зʼявляються, коли люди рухаються, сміються, змагаються, приходять. Це просто допомагає цьому статися трохи легше.',
  founder_p4: 'І так… я побудував усе сам. І так — я фан Chelsea 💙 (вам не обовʼязково ним бути).',
  founder_p5: 'Ось і все. Без складних правил. Просто реальні люди, реальна енергія, реальний звʼязок. Тренуйся. Грай. Зустрічайся. Вайб. Дейт.',
  founder_list_title: 'Місце, де можна:',
  founder_activities: ['Тренуватися', 'Грати', 'Дивитися матчі', 'Знайомитися з новими людьми', 'Проводити час', 'Можливо, знайти щось більше'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate є незалежною платформою і не афілійований та не підтримується жодним клубом, лігою чи організацією.',
};

const HI: AboutPageContent = {
  hero_title: 'GetTrainMate के बारे में',
  hero_sub: 'एक ऐसे आदमी ने बनाया जिसे apps के काम करने का तरीका पसंद नहीं था।',
  stats: [
    { value: 'One', label: 'Solo builder' },
    { value: 'Real', label: 'लोग पहले' },
    { value: 'No', label: 'दबाव या labels नहीं' },
    { value: 'Play', label: 'Train. Meet. Vibe.' },
  ],
  values: [
    {
      title: 'यह क्या है',
      description: 'एक जगह जहाँ आप train कर सकते हैं, play कर सकते हैं, games देख सकते हैं, नए लोगों से मिल सकते हैं, hang out कर सकते हैं, या शायद कुछ और पा सकते हैं।',
    },
    {
      title: 'कोई दबाव नहीं',
      description: 'शुरुआत में कोई labels नहीं। किसी real चीज़ से शुरू करें और देखें बात कहाँ जाती है।',
    },
    {
      title: 'यह कैसे काम करता है',
      description: 'आप workout, game या shared interest से शुरू करते हैं। कुछ लोगों को training partners मिलते हैं, कुछ को friends, और कुछ को कुछ unexpected.',
    },
    {
      title: 'मैंने इसे ऐसे क्यों बनाया',
      description: 'Real connections endless scrolling से नहीं बनते। वे तब बनते हैं जब लोग move करते हैं, laugh करते हैं, compete करते हैं और show up करते हैं।',
    },
  ],
  story_title: 'Hi — मैं Max हूँ।',
  story_p1: 'मैंने GetTrainMate इसलिए बनाया क्योंकि लोगों से मिलने वाली ज़्यादातर apps सही महसूस नहीं होतीं।',
  story_p2:
    'Dating apps random लगती हैं। Fitness apps cold लगती हैं। और somehow… सब कुछ actually मिलने के बजाय swiping के बारे में हो जाता है। मैं कुछ simpler चाहता था।',
  values_section_title: 'यह क्या है',
  founder_kicker: 'यह असल में कैसे काम करता है',
  founder_h2: 'आप किसी real चीज़ से शुरू करते हैं',
  founder_p1: 'एक workout, एक game, एक shared interest. फिर देखते हैं बात कहाँ जाती है।',
  founder_p2: 'कुछ लोगों को training partners मिलते हैं। कुछ को friends मिलते हैं। कुछ को कुछ ऐसा मिलता है जिसकी उम्मीद नहीं थी। यही point है।',
  founder_p3:
    'क्योंकि real connections endless scrolling से नहीं बनते। वे तब बनते हैं जब लोग move करते हैं, laugh करते हैं, compete करते हैं, show up करते हैं। यह बस उसे थोड़ा आसान बनाता है।',
  founder_p4: 'और हाँ… मैंने पूरा thing खुद बनाया। और हाँ — मैं Chelsea fan हूँ 💙 (इसका मतलब यह नहीं कि आपको भी होना पड़ेगा)।',
  founder_p5: 'बस इतना ही। कोई complicated rules नहीं। बस real people, real energy, real connection. Train. Play. Meet. Vibe. Date.',
  founder_list_title: 'एक जगह जहाँ आप कर सकते हैं:',
  founder_activities: ['Train', 'Play', 'Watch games', 'Meet new people', 'Hang out', 'Maybe find something more'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate स्वतंत्र है और किसी club, league या organization से affiliated या endorsed नहीं है।',
};

const ZH: AboutPageContent = {
  hero_title: '关于 GetTrainMate',
  hero_sub: '由一个不喜欢现有应用运作方式的人打造。',
  stats: [
    { value: 'One', label: '一个人打造' },
    { value: 'Real', label: '真实的人优先' },
    { value: 'No', label: '没有压力或标签' },
    { value: 'Play', label: '训练。见面。同频。' },
  ],
  values: [
    {
      title: '这是什么',
      description: '一个可以训练、比赛、看球、认识新朋友、一起玩，或者也许找到更多可能的地方。',
    },
    {
      title: '没有压力',
      description: '一开始没有标签。先从真实的事情开始，再看看会发生什么。',
    },
    {
      title: '它怎么运作',
      description: '你从一次训练、一场比赛或一个共同兴趣开始。有些人找到训练伙伴，有些人找到朋友，有些人找到意想不到的东西。',
    },
    {
      title: '为什么这样做',
      description: '真实连接不是从无尽滚动里发生的。它发生在人们移动、欢笑、竞争并真正出现的时候。',
    },
  ],
  story_title: '你好 — 我是 Max。',
  story_p1: '我做 GetTrainMate，是因为大多数让人认识彼此的应用都感觉不太对。',
  story_p2:
    '约会应用感觉太随机。健身应用感觉太冷。最后不知怎么… 一切都变成了滑动，而不是实际见面。我想要更简单的东西。',
  values_section_title: '这是什么',
  founder_kicker: '它实际怎么运作',
  founder_h2: '你从真实的事情开始',
  founder_p1: '一次训练，一场比赛，一个共同兴趣。然后看看它会走向哪里。',
  founder_p2: '有人找到训练伙伴。有人找到朋友。有人找到意想不到的东西。这差不多就是重点。',
  founder_p3:
    '因为真实连接不是从无尽滚动里发生的。它发生在人们移动、欢笑、竞争、出现的时候。这个产品只是让这件事更容易一点。',
  founder_p4: '还有，是的… 整个东西都是我自己做的。还有，是的 — 我是 Chelsea 球迷 💙（但你不必是）。',
  founder_p5: '就是这样。没有复杂规则。只有真实的人、真实的能量、真实的连接。训练。比赛。见面。同频。约会。',
  founder_list_title: '在这里你可以：',
  founder_activities: ['训练', '比赛', '看球', '认识新朋友', '一起玩', '也许找到更多可能'],
  founder_closing: '— Max',
  founder_disclaimer: 'GetTrainMate 是独立平台，与任何俱乐部、联赛或组织均无隶属关系，也未获得其背书。',
};

const BY_LOCALE: Record<Locale, AboutPageContent> = {
  en: EN,
  es: ES,
  ru: RU,
  ua: UA,
  hi: HI,
  zh: ZH,
  fr: EN,
  de: EN,
};

export function getAboutPage(locale: Locale): AboutPageContent {
  return BY_LOCALE[locale] ?? BY_LOCALE.en;
}
