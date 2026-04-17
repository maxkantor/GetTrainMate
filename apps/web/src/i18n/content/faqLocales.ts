import type { Locale } from '@/i18n';

export type FaqItem = { q: string; a: string };
export type FaqCategory = { category: string; questions: FaqItem[] };

export type FaqPageUi = {
  title: string;
  subtitle: string;
  ai_help_title: string;
  ai_placeholder: string;
  ask: string;
  help_sign_in: string;
  help_generic_error: string;
  still_title: string;
  still_body: string;
  contact_link: string;
};

export type FaqPageBundle = { sections: FaqCategory[]; ui: FaqPageUi };

const FAQ_EN: FaqCategory[] = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How does GetTrainMate work?',
        a: 'You create a profile with your sports, level, goals, schedule, and what you’re open to (Train, Vibe, Date). Then you swipe to match, chat, and meet — fitness-first, modern, and intent-led.',
      },
      {
        q: 'Is GetTrainMate free to use?',
        a: 'You can explore and browse matches for free. Unlocking chats, AI insights, icebreakers, and boosts use credits. Credits are one-time packs — no subscription.',
      },
      {
        q: 'Is this only for workouts?',
        a: 'No. GetTrainMate is for training partners, social vibes, and dating — through fitness as the common ground. You choose what you’re open to.',
      },
      {
        q: 'What AI features does GetTrainMate offer?',
        a: 'AI powers compatibility insights for each match, smart first-message suggestions (icebreakers), an AI coach chat for profile and training help, and optional workout or meetup plans. AI is used to make matching and messaging more helpful, not replace human connection.',
      },
      {
        q: 'What sports and activities are supported?',
        a: 'The platform supports activities like running, gym workouts, CrossFit, cycling, tennis, swimming, hiking, and more. New activities will continue to be added.',
      },
    ],
  },
  {
    category: 'Safety & Privacy',
    questions: [
      {
        q: 'How does GetTrainMate keep me safe?',
        a: 'We use profile moderation, report and block tools, and community guidelines. We recommend meeting in public places for first sessions.',
      },
      {
        q: 'Is GetTrainMate a dating app?',
        a: 'It can be — if you want it to be. Dating is one of the modes, and it stays fitness-first and tasteful. You control your intent and you’ll only see people with compatible intent.',
      },
      {
        q: 'Can I block or report users?',
        a: 'Yes. You can block or report profiles directly from the profile or chat. Reports are reviewed by the moderation team.',
      },
      {
        q: 'What information is visible on my profile?',
        a: 'Profiles typically include sports, experience level, training goals, and general location. Users control what they share.',
      },
    ],
  },
  {
    category: 'Matching & Compatibility',
    questions: [
      {
        q: 'How does the matching algorithm work?',
        a: 'AI compares sport, skill level, goals, schedule, and distance to suggest compatible partners. You can view an AI match insight per profile to see why you’re a good fit.',
      },
      {
        q: 'What are the different modes (TRAIN, VIBE, DATE)?',
        a: 'TRAIN is for workout partners. VIBE is for social connection. DATE is for romantic connection. You can pick one or more, and matching respects what you choose.',
      },
      {
        q: 'Can I change what I’m open to later?',
        a: 'Yes. You can update your modes anytime from your profile.',
      },
      {
        q: 'Is it available worldwide?',
        a: 'Yes — GetTrainMate is designed to work globally. Availability can vary by city, but you can use it while traveling or relocating.',
      },
      {
        q: 'Can I filter matches by specific criteria?',
        a: 'Yes. You can filter by sport, distance, experience level, goals, and training schedule. Advanced filters may use credits.',
      },
    ],
  },
  {
    category: 'Messaging',
    questions: [
      {
        q: 'How does the chat system work?',
        a: 'Chats are unlocked with credits. Once unlocked, you message freely. AI icebreakers can suggest first messages; an in-chat Ask AI helper can assist with conversation and plans.',
      },
      {
        q: 'Can I share my contact information?',
        a: 'Users may share contact details when comfortable. We encourage using in-app chat first.',
      },
      {
        q: 'What if someone isn\'t responding?',
        a: 'You can continue browsing other matches. Compatibility increases chances of engagement.',
      },
    ],
  },
  {
    category: 'Credits & Payments',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'Secure payments are processed through Stripe. We support major credit and debit cards.',
      },
      {
        q: 'Do credits expire?',
        a: 'Purchased credits do not expire and remain in your account until used.',
      },
      {
        q: 'Do you offer refunds?',
        a: 'The app only collects payments; it cannot issue or adjust refunds. For a refund or billing change, use the Contact page and choose “Billing & subscriptions.” Our team reviews requests and, when appropriate, processes them manually in Stripe.',
      },
    ],
  },
  {
    category: 'Technical Support',
    questions: [
      {
        q: 'Which devices and browsers are supported?',
        a: 'GetTrainMate works on modern browsers on desktop, tablet, and mobile. We support Chrome, Safari, and Edge.',
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'Use "Forgot Password" on the login page. Enter your email to receive a reset link.',
      },
      {
        q: 'How do I delete my account?',
        a: 'You can delete your account from your account settings or contact support.',
      },
    ],
  },
];

const UI_EN: FaqPageUi = {
  title: 'Frequently Asked Questions',
  subtitle: 'Clear answers about matching, modes, credits, and safety.',
  ai_help_title: 'Ask AI about credits, safety, or how the app works',
  ai_placeholder: 'e.g. How do credits work?',
  ask: 'Ask',
  help_sign_in: 'Please sign in to use the help assistant.',
  help_generic_error: 'Something went wrong.',
  still_title: 'Still have questions?',
  still_body: "Can't find the answer you're looking for? Our support team is here to help.",
  contact_link: 'Contact Support →',
};

const FAQ_ES: FaqCategory[] = [
  {
    category: 'Primeros pasos',
    questions: [
      {
        q: '¿Cómo funciona GetTrainMate?',
        a: 'Creas un perfil con deportes, nivel, objetivos, horario y qué buscas (Train, Vibe, Date). Luego deslizas para hacer match, chatear y quedar — fitness primero, moderno y con intención clara.',
      },
      {
        q: '¿GetTrainMate es gratis?',
        a: 'Explorar y ver perfiles es gratis. Desbloquear chats, insights de IA, rompehielos e impulsos usa créditos. Los créditos son packs puntuales — sin suscripción.',
      },
      {
        q: '¿Solo es para entrenar?',
        a: 'No. Es para compañeros de entreno, rollo social y citas — con el deporte como punto en común. Tú eliges a qué estás abierto.',
      },
      {
        q: '¿Qué funciones de IA hay?',
        a: 'IA para compatibilidad, sugerencias de primer mensaje, chat de coach para perfil y entreno, y planes opcionales. La IA ayuda a conectar, no sustituye el vínculo humano.',
      },
      {
        q: '¿Qué deportes hay?',
        a: 'Correr, gimnasio, CrossFit, ciclismo, tenis, natación, senderismo y más. Se irán añadiendo actividades.',
      },
    ],
  },
  {
    category: 'Seguridad y privacidad',
    questions: [
      {
        q: '¿Cómo me protegéis?',
        a: 'Moderación de perfiles, denunciar y bloquear, y normas de comunidad. Recomendamos primeras citas en lugares públicos.',
      },
      {
        q: '¿Es una app de ligoteo?',
        a: 'Puede serlo si tú quieres. «Date» es un modo, siempre fitness-first y con buen gusto. Tú marcas la intención y solo ves gente compatible.',
      },
      {
        q: '¿Puedo bloquear o denunciar?',
        a: 'Sí, desde el perfil o el chat. Revisamos las denuncias.',
      },
      {
        q: '¿Qué se ve en mi perfil?',
        a: 'Deporte, nivel, objetivos y ubicación general. Tú decides qué compartes.',
      },
    ],
  },
  {
    category: 'Matching y compatibilidad',
    questions: [
      {
        q: '¿Cómo funciona el algoritmo?',
        a: 'La IA compara deporte, nivel, objetivos, horario y distancia. Puedes ver un insight por perfil.',
      },
      {
        q: '¿Qué son TRAIN, VIBE y DATE?',
        a: 'TRAIN: compañeros de entreno. VIBE: conexión social. DATE: conexión romántica. Puedes elegir uno o varios.',
      },
      {
        q: '¿Puedo cambiar mis modos?',
        a: 'Sí, cuando quieras desde tu perfil.',
      },
      {
        q: '¿Funciona en todo el mundo?',
        a: 'Sí, está pensado para uso global; la oferta puede variar por ciudad.',
      },
      {
        q: '¿Hay filtros?',
        a: 'Sí: deporte, distancia, nivel, objetivos y horario. Algunos filtros avanzados pueden usar créditos.',
      },
    ],
  },
  {
    category: 'Mensajería',
    questions: [
      {
        q: '¿Cómo va el chat?',
        a: 'Se desbloquea con créditos; luego escribes libremente. Hay rompehielos con IA y ayuda en el chat.',
      },
      {
        q: '¿Puedo dar mi contacto?',
        a: 'Si te sientes a gusto. Recomendamos empezar en la app.',
      },
      {
        q: '¿Y si no contestan?',
        a: 'Sigue descubriendo otros perfiles; la compatibilidad ayuda a que haya respuesta.',
      },
    ],
  },
  {
    category: 'Créditos y pagos',
    questions: [
      {
        q: '¿Qué métodos de pago?',
        a: 'Pagos seguros con Stripe; tarjetas habituales.',
      },
      {
        q: '¿Caducan los créditos?',
        a: 'Los comprados no caducan hasta que los uses.',
      },
      {
        q: '¿Hay reembolsos?',
        a: 'La app solo cobra; no gestiona reembolsos ni ajustes de pago. Usa Contacto y elige «Pagos y suscripciones» con los detalles; si procede, lo tramitamos manualmente en Stripe.',
      },
    ],
  },
  {
    category: 'Soporte técnico',
    questions: [
      {
        q: '¿Qué dispositivos y navegadores?',
        a: 'Navegadores modernes en escritorio, tablet y móvil: Chrome, Safari, Edge.',
      },
      {
        q: 'Olvidé la contraseña',
        a: 'Usa «Olvidé mi contraseña» en el login; te llegará un enlace al correo.',
      },
      {
        q: '¿Cómo borro la cuenta?',
        a: 'Desde ajustes de cuenta o contactando soporte.',
      },
    ],
  },
];

const UI_ES: FaqPageUi = {
  title: 'Preguntas frecuentes',
  subtitle: 'Respuestas claras sobre matching, modos, créditos y seguridad.',
  ai_help_title: 'Pregunta a la IA sobre créditos, seguridad o el funcionamiento',
  ai_placeholder: 'p. ej. ¿Cómo funcionan los créditos?',
  ask: 'Preguntar',
  help_sign_in: 'Inicia sesión para usar el asistente de ayuda.',
  help_generic_error: 'Algo salió mal.',
  still_title: '¿Sigues con dudas?',
  still_body: 'Si no encuentras la respuesta, el equipo de soporte puede ayudarte.',
  contact_link: 'Contactar soporte →',
};

const FAQ_RU: FaqCategory[] = [
  {
    category: 'С чего начать',
    questions: [
      {
        q: 'Как работает GetTrainMate?',
        a: 'Вы заполняете профиль: виды спорта, уровень, цели, расписание и намерения (Train, Vibe, Date). Затем свайпы, чаты и встречи — фитнес в приоритете, современно и по вашему выбору.',
      },
      {
        q: 'Бесплатно ли это?',
        a: 'Просмотр и поиск бесплатны. Чаты, AI-инсайты, айсбрейкеры и бусты — за кредиты. Кредиты разовые пакеты, без подписки.',
      },
      {
        q: 'Только для тренировок?',
        a: 'Нет. Партнёры по спорту, общение и знакомства — через спорт как общую тему. Вы сами задаёте намерения.',
      },
      {
        q: 'Какие функции AI?',
        a: 'Совместимость, первые сообщения, AI-коуч по профилю и тренировкам, опционально планы. AI помогает связи, а не заменяет её.',
      },
      {
        q: 'Какие виды спорта?',
        a: 'Бег, зал, кроссфит, велосипед, теннис, плавание, походы и др.; список расширяется.',
      },
    ],
  },
  {
    category: 'Безопасность и приватность',
    questions: [
      {
        q: 'Как вы обеспечиваете безопасность?',
        a: 'Модерация, жалобы и блокировки, правила сообщества. Первые встречи — в публичных местах.',
      },
      {
        q: 'Это дейтинг-приложение?',
        a: 'Может быть, если вы выберете режим Date — всё равно фитнес-фокус и уважительный тон. Видите только совместимые намерения.',
      },
      {
        q: 'Можно пожаловаться или заблокировать?',
        a: 'Да, из профиля или чата; жалобы рассматриваются.',
      },
      {
        q: 'Что видно в профиле?',
        a: 'Спорт, уровень, цели, примерная локация — вы контролируете детали.',
      },
    ],
  },
  {
    category: 'Мэтчинг и совместимость',
    questions: [
      {
        q: 'Как работает алгоритм?',
        a: 'AI учитывает спорт, уровень, цели, расписание и дистанцию; можно открыть инсайт по профилю.',
      },
      {
        q: 'Что такое TRAIN, VIBE, DATE?',
        a: 'TRAIN — партнёры по тренировкам, VIBE — общение, DATE — романтика. Можно выбрать несколько.',
      },
      {
        q: 'Можно менять намерения?',
        a: 'Да, в любой момент в профиле.',
      },
      {
        q: 'Доступно по всему миру?',
        a: 'Да, сервис глобальный; наполнение может отличаться по городам.',
      },
      {
        q: 'Есть фильтры?',
        a: 'Да: спорт, дистанция, уровень, цели, расписание. Часть расширенных фильтров может тратить кредиты.',
      },
    ],
  },
  {
    category: 'Сообщения',
    questions: [
      {
        q: 'Как устроен чат?',
        a: 'Открывается за кредиты, дальше переписка свободно; есть AI-айсбрейкеры и подсказки.',
      },
      {
        q: 'Можно делиться контактами?',
        a: 'Если комфортно; сначала лучше в приложении.',
      },
      {
        q: 'Если не отвечают?',
        a: 'Продолжайте Discover — совместимость повышает шанс ответа.',
      },
    ],
  },
  {
    category: 'Кредиты и оплата',
    questions: [
      {
        q: 'Какие способы оплаты?',
        a: 'Безопасные платежи через Stripe, основные карты.',
      },
      {
        q: 'Сгорают ли кредиты?',
        a: 'Купленные не сгорают, пока не израсходуете.',
      },
      {
        q: 'Есть ли возвраты?',
        a: 'Приложение только принимает оплату; возвраты и правки платежа в нём не оформляются. Напишите через Контакты, тема «Кредиты и оплата»; при одобрении оформляем вручную в Stripe.',
      },
    ],
  },
  {
    category: 'Техподдержка',
    questions: [
      {
        q: 'Какие устройства и браузеры?',
        a: 'Современные браузеры на ПК, планшете и телефоне: Chrome, Safari, Edge.',
      },
      {
        q: 'Забыл пароль',
        a: '«Забыли пароль» на странице входа — ссылка на почту.',
      },
      {
        q: 'Как удалить аккаунт?',
        a: 'В настройках аккаунта или через поддержку.',
      },
    ],
  },
];

const UI_RU: FaqPageUi = {
  title: 'Частые вопросы',
  subtitle: 'Кратко о мэтчинге, режимах, кредитах и безопасности.',
  ai_help_title: 'Спросите AI про кредиты, безопасность или работу приложения',
  ai_placeholder: 'напр. Как работают кредиты?',
  ask: 'Спросить',
  help_sign_in: 'Войдите, чтобы использовать помощника.',
  help_generic_error: 'Что-то пошло не так.',
  still_title: 'Остались вопросы?',
  still_body: 'Не нашли ответ — напишите в поддержку.',
  contact_link: 'Связаться с поддержкой →',
};

const FAQ_UA: FaqCategory[] = [
  {
    category: 'Початок',
    questions: [
      {
        q: 'Як працює GetTrainMate?',
        a: 'Профіль: спорт, рівень, цілі, розклад і наміри (Train, Vibe, Date). Потім свайпи, чати та зустрічі — фітнес на першому плані.',
      },
      {
        q: 'Це безкоштовно?',
        a: 'Перегляд безкоштовний. Чати, AI-інсайти, айсбрейкери та бусти — за кредити. Разові пакети, без підписки.',
      },
      {
        q: 'Тільки для тренувань?',
        a: 'Ні: партнери, спілкування та знайомства через спорт. Ви обираєте наміри.',
      },
      {
        q: 'Які функції AI?',
        a: 'Сумісність, перші повідомлення, AI-коуч, опціонально плани. AI допомагає, а не замінює людину.',
      },
      {
        q: 'Які види спорту?',
        a: 'Біг, зал, кросфіт, велосипед, теніс, плавання, походи тощо; список зростає.',
      },
    ],
  },
  {
    category: 'Безпека та приватність',
    questions: [
      {
        q: 'Як ви захищаєте?',
        a: 'Модерація, скарги та блокування, правила. Перші зустрічі — у публічних місцях.',
      },
      {
        q: 'Це дейтинг?',
        a: 'Може бути, якщо обрати Date — з повагою та фітнес-фокусом. Бачите лише сумісні наміри.',
      },
      {
        q: 'Можна заблокувати чи поскаржитися?',
        a: 'Так, з профілю або чату; скарги розглядаються.',
      },
      {
        q: 'Що видно в профілі?',
        a: 'Спорт, рівень, цілі, приблизна локація — ви керуєте деталями.',
      },
    ],
  },
  {
    category: 'Метчинг',
    questions: [
      {
        q: 'Як працює алгоритм?',
        a: 'AI враховує спорт, рівень, цілі, час і відстань; є інсайт по профілю.',
      },
      {
        q: 'Що таке TRAIN, VIBE, DATE?',
        a: 'TRAIN — партнери, VIBE — спілкування, DATE — романтика. Можна кілька.',
      },
      {
        q: 'Чи можна змінити наміри?',
        a: 'Так, у профілі в будь-який момент.',
      },
      {
        q: 'Чи є по всьому світу?',
        a: 'Так; наповнення залежить від міста.',
      },
      {
        q: 'Чи є фільтри?',
        a: 'Так: спорт, дистанція, рівень, цілі, розклад. Частина розширених — за кредити.',
      },
    ],
  },
  {
    category: 'Повідомлення',
    questions: [
      {
        q: 'Як працює чат?',
        a: 'Відкривається за кредити; далі вільна переписка та AI-підказки.',
      },
      {
        q: 'Чи можна ділитися контактами?',
        a: 'Якщо комфортно; спочатку краще в додатку.',
      },
      {
        q: 'Якщо не відповідають?',
        a: 'Продовжуйте Discover — сумісність підвищує шанс відповіді.',
      },
    ],
  },
  {
    category: 'Кредити та оплата',
    questions: [
      {
        q: 'Які способи оплати?',
        a: 'Stripe, основні картки.',
      },
      {
        q: 'Чи згорають кредити?',
        a: 'Куплені ні — доки не використаєте.',
      },
      {
        q: 'Повернення коштів?',
        a: 'Застосунок лише приймає оплату; повернення та зміни платежу в ньому не оформлюються. Напишіть через Контакти → «Оплата та підписки»; за потреби оформлюємо вручну в Stripe.',
      },
    ],
  },
  {
    category: 'Техпідтримка',
    questions: [
      {
        q: 'Пристрої та браузери?',
        a: 'Сучасні браузери: Chrome, Safari, Edge.',
      },
      {
        q: 'Забув пароль',
        a: 'Посилання зі сторінки входу на пошту.',
      },
      {
        q: 'Як видалити акаунт?',
        a: 'У налаштуваннях або через підтримку.',
      },
    ],
  },
];

const UI_UA: FaqPageUi = {
  title: 'Часті запитання',
  subtitle: 'Коротко про метчинг, режими, кредити та безпеку.',
  ai_help_title: 'Запитайте AI про кредити, безпеку або роботу застосунку',
  ai_placeholder: 'напр. Як працюють кредити?',
  ask: 'Запитати',
  help_sign_in: 'Увійдіть, щоб скористатися помічником.',
  help_generic_error: 'Щось пішло не так.',
  still_title: 'Залишилися питання?',
  still_body: 'Зверніться до підтримки.',
  contact_link: 'Звʼязатися з підтримкою →',
};

const FAQ_HI: FaqCategory[] = [
  {
    category: 'शुरुआत',
    questions: [
      {
        q: 'GetTrainMate कैसे काम करता है?',
        a: 'प्रोफाइल में खेल, स्तर, लक्ष्य, शेड्यूल और इरादे (Train, Vibe, Date)। फिर स्वाइप, चैट और मिलना — फिटनेस-फर्स्ट।',
      },
      {
        q: 'क्या यह मुफ्त है?',
        a: 'ब्राउज़ मुफ्त है। चैट, AI इनसाइट, आइसब्रेकर और बूस्ट के लिए क्रेडिट। एक बार खरीदें — कोई सब्सक्रिप्शन नहीं।',
      },
      {
        q: 'केवल वर्कआउट के लिए?',
        a: 'नहीं: ट्रेनिंग पार्टनर, सोशल वाइब और डेटिंग — फिटनेस साझा आधार। आप चुनते हैं।',
      },
      {
        q: 'AI क्या करता है?',
        a: 'मैच इनसाइट, पहला संदेश, AI कोच, वैकल्पिक प्लान — इंसानी जुड़ाव की जगह नहीं लेता।',
      },
      {
        q: 'कौन से खेल?',
        a: 'दौड़, जिम, क्रॉसफिट, साइकिल, टेनिस, तैराकी, हाइकिंग आदि; और जोड़े जाते रहेंगे।',
      },
    ],
  },
  {
    category: 'सुरक्षा और गोपनीयता',
    questions: [
      {
        q: 'सुरक्षा कैसे?',
        a: 'मॉडरेशन, रिपोर्ट/ब्लॉक, दिशानिर्देश। पहली मुलाकात सार्वजनिक जगह पर।',
      },
      {
        q: 'क्या यह डेटिंग ऐप है?',
        a: 'अगर आप चाहें — Date मोड फिटनेस-फर्स्ट और सम्मानजनक। केवल मेल खाते इरादे।',
      },
      {
        q: 'ब्लॉक/रिपोर्ट?',
        a: 'हाँ, प्रोफाइल या चैट से; टीम समीक्षा करती है।',
      },
      {
        q: 'प्रोफाइल पर क्या दिखता है?',
        a: 'खेल, स्तर, लक्ष्य, सामान्य लोकेशन — आप नियंत्रित करते हैं।',
      },
    ],
  },
  {
    category: 'मैचिंग',
    questions: [
      {
        q: 'अल्गोरिदम कैसे काम करता है?',
        a: 'AI खेल, स्तर, लक्ष्य, समय और दूरी देखता है; प्रति प्रोफाइल इनसाइट।',
      },
      {
        q: 'TRAIN, VIBE, DATE क्या हैं?',
        a: 'TRAIN: वर्कआउट पार्टनर, VIBE: सोशल, DATE: रोमांटिक। एक या अधिक।',
      },
      {
        q: 'बाद में बदल सकते हैं?',
        a: 'हाँ, प्रोफाइल से कभी।',
      },
      {
        q: 'दुनिया भर में?',
        a: 'हाँ; शहर के हिसाब से उपलब्धता अलग हो सकती है।',
      },
      {
        q: 'फ़िल्टर?',
        a: 'हाँ: खेल, दूरी, स्तर, लक्ष्य, शेड्यूल। कुछ उन्नत फ़िल्टर क्रेडिट ले सकते हैं।',
      },
    ],
  },
  {
    category: 'मैसेजिंग',
    questions: [
      {
        q: 'चैट कैसे?',
        a: 'क्रेडिट से अनलॉक; फिर मुफ्त संदेश; AI आइसब्रेकर।',
      },
      {
        q: 'संपर्क साझा करें?',
        a: 'जब सहज लगे; पहले ऐप में बेहतर।',
      },
      {
        q: 'कोई जवाब न दे?',
        a: 'और मैच देखें; मेल खाना जवाब की संभावना बढ़ाता है।',
      },
    ],
  },
  {
    category: 'क्रेडिट और भुगतान',
    questions: [
      {
        q: 'भुगतान तरीके?',
        a: 'Stripe से सुरक्षित; मुख्य कार्ड।',
      },
      {
        q: 'क्रेडिट समाप्त?',
        a: 'खरीदे गए समाप्त नहीं होते जब तक उपयोग न हों।',
      },
      {
        q: 'रिफंड?',
        a: 'ऐप में रिफंड या भुगतान संशोधन नहीं होता। कॉन्टैक्ट पेज पर «बिलिंग और सब्सक्रिप्शन» चुनकर विवरण भेजें; स्वीकृति पर हम Stripe में मैन्युअल प्रक्रिया करते हैं।',
      },
    ],
  },
  {
    category: 'तकनीकी सहायता',
    questions: [
      {
        q: 'कौन से ब्राउज़र?',
        a: 'डेस्कटॉप, टैबलेट, मोबाइल पर Chrome, Safari, Edge।',
      },
      {
        q: 'पासवर्ड भूल गए?',
        a: 'लॉगिन पर «Forgot Password» — ईमेल लिंक।',
      },
      {
        q: 'खाता हटाएं?',
        a: 'सेटिंग्स या सपोर्ट से।',
      },
    ],
  },
];

const UI_HI: FaqPageUi = {
  title: 'अक्सर पूछे जाने वाले प्रश्न',
  subtitle: 'मैचिंग, मोड, क्रेडिट और सुरक्षा पर स्पष्ट जवाब।',
  ai_help_title: 'क्रेडिट, सुरक्षा या ऐप के बारे में AI से पूछें',
  ai_placeholder: 'जैसे: क्रेडिट कैसे काम करते हैं?',
  ask: 'पूछें',
  help_sign_in: 'सहायता सहायक के लिए साइन इन करें।',
  help_generic_error: 'कुछ गलत हो गया।',
  still_title: 'अभी भी सवाल?',
  still_body: 'जवाब न मिले तो सपोर्ट से संपर्क करें।',
  contact_link: 'सपोर्ट से संपर्क →',
};

const FAQ_ZH: FaqCategory[] = [
  {
    category: '入门',
    questions: [
      {
        q: 'GetTrainMate 如何运作？',
        a: '创建资料：运动、水平、目标、日程和意向（Train、Vibe、Date）。然后滑动匹配、聊天与见面——以健身为先。',
      },
      {
        q: '是否免费？',
        a: '浏览免费。解锁聊天、AI 洞察、破冰和曝光等需积分。积分为一次性购买，无订阅。',
      },
      {
        q: '只能约练吗？',
        a: '不是。涵盖训练伙伴、社交氛围和约会——以运动为共同点，由你选择意向。',
      },
      {
        q: '有哪些 AI 功能？',
        a: '匹配洞察、首条消息建议、AI 教练与可选计划。AI 辅助连接，而非取代人际。',
      },
      {
        q: '支持哪些运动？',
        a: '跑步、健身、CrossFit、骑行、网球、游泳、徒步等，并将持续增加。',
      },
    ],
  },
  {
    category: '安全与隐私',
    questions: [
      {
        q: '如何保障安全？',
        a: '资料审核、举报与拉黑、社区准则。建议首次在公共场所见面。',
      },
      {
        q: '这是约会软件吗？',
        a: '若你选择 Date 模式可以是——仍以健身为先、格调克制。你只看到意向匹配的人。',
      },
      {
        q: '能拉黑或举报吗？',
        a: '可以，在资料或聊天中操作，团队会处理举报。',
      },
      {
        q: '资料上显示什么？',
        a: '运动、水平、训练目标与大略位置，由你控制分享内容。',
      },
    ],
  },
  {
    category: '匹配与兼容',
    questions: [
      {
        q: '匹配算法如何工作？',
        a: 'AI 综合运动、水平、目标、日程与距离；可查看单条匹配洞察。',
      },
      {
        q: 'TRAIN、VIBE、DATE 是什么？',
        a: 'TRAIN：训练伙伴；VIBE：社交连接；DATE：恋爱意向。可多选。',
      },
      {
        q: '以后能改意向吗？',
        a: '可以，随时在资料中更新。',
      },
      {
        q: '全球可用吗？',
        a: '是，面向全球；各城市供给可能不同。',
      },
      {
        q: '能筛选吗？',
        a: '可按运动、距离、水平、目标与日程筛选；部分高级筛选可能消耗积分。',
      },
    ],
  },
  {
    category: '消息',
    questions: [
      {
        q: '聊天如何计费？',
        a: '用积分解锁后可自由聊天；支持 AI 破冰与对话辅助。',
      },
      {
        q: '能交换联系方式吗？',
        a: '在双方都舒适时可以；建议先在应用内沟通。',
      },
      {
        q: '对方不回怎么办？',
        a: '继续浏览其他匹配；契合度有助于提高回复率。',
      },
    ],
  },
  {
    category: '积分与支付',
    questions: [
      {
        q: '支持哪些支付方式？',
        a: '通过 Stripe 安全支付，支持常见银行卡。',
      },
      {
        q: '积分会过期吗？',
        a: '已购积分不过期，用完为止。',
      },
      {
        q: '能退款吗？',
        a: '应用内不办理退款或修改付款。请通过「联系」页选择「账单与订阅」并说明情况；获批后我们在 Stripe 中手动处理。',
      },
    ],
  },
  {
    category: '技术支持',
    questions: [
      {
        q: '支持哪些设备与浏览器？',
        a: '现代桌面、平板与手机浏览器，支持 Chrome、Safari、Edge。',
      },
      {
        q: '忘记密码？',
        a: '在登录页使用「忘记密码」，邮件收取重置链接。',
      },
      {
        q: '如何删除账户？',
        a: '在账户设置中删除或联系支持。',
      },
    ],
  },
];

const UI_ZH: FaqPageUi = {
  title: '常见问题',
  subtitle: '关于匹配、模式、积分与安全的清晰解答。',
  ai_help_title: '向 AI 询问积分、安全或应用使用方式',
  ai_placeholder: '例如：积分如何计费？',
  ask: '提问',
  help_sign_in: '请登录后使用帮助助手。',
  help_generic_error: '出错了。',
  still_title: '还有疑问？',
  still_body: '找不到答案？支持团队可以协助。',
  contact_link: '联系支持 →',
};

const BUNDLES: Record<Locale, FaqPageBundle> = {
  en: { sections: FAQ_EN, ui: UI_EN },
  es: { sections: FAQ_ES, ui: UI_ES },
  ru: { sections: FAQ_RU, ui: UI_RU },
  ua: { sections: FAQ_UA, ui: UI_UA },
  hi: { sections: FAQ_HI, ui: UI_HI },
  zh: { sections: FAQ_ZH, ui: UI_ZH },
};

export function getFaqPage(locale: Locale): FaqPageBundle {
  return BUNDLES[locale] ?? BUNDLES.en;
}

export function getFaqJsonLdItems(locale: Locale): { question: string; answer: string }[] {
  return getFaqPage(locale).sections.flatMap((c) => c.questions.map((q) => ({ question: q.q, answer: q.a })));
}
