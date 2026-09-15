/**
 * Conversion-oriented owned-social copy for TRAIN / VIBE / DATE.
 * Image headline + CTA + post body share one locale. No guaranteed outcomes.
 */

const LOCALES = ['en', 'es', 'ru'];

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function pickAvoiding(list, seed, recentKeys = [], keyFn = (x) => x.id || x) {
  if (!list?.length) return null;
  const recent = new Set(recentKeys.map(normalizeKey).filter(Boolean));
  const fresh = list.filter((item) => !recent.has(normalizeKey(keyFn(item))));
  const pool = fresh.length ? fresh : list;
  return pool[seed % pool.length];
}

/** Journey-voice image headlines by mode + locale (TRAIN → VIBE → MAYBE DATE). */
export const HEADLINE_VARIANTS = {
  TRAIN: {
    en: [
      { id: 'train-hl-stop-alone', text: 'NEED A WORKOUT PARTNER?' },
      { id: 'train-hl-next-partner', text: 'FIND SOMEONE WHO CAN KEEP UP.' },
      { id: 'train-hl-better-together', text: 'GOOD GAME. DRINKS AFTER?' },
      { id: 'train-hl-trains-like-you', text: 'RUN TOGETHER. COFFEE AFTER?' },
      { id: 'train-hl-partner-here', text: 'START WITH A WORKOUT. SEE WHAT HAPPENS.' },
      { id: 'train-hl-match-goals', text: 'START WITH A HIKE. SEE WHAT HAPPENS.' },
      { id: 'train-hl-meet-active', text: 'FIND YOUR GAME. FIND YOUR PEOPLE.' },
      { id: 'train-hl-gym-accountability', text: 'TRAIN TOGETHER. SEE WHERE IT GOES.' },
      { id: 'train-hl-social-fitness', text: 'SAME SPORT. SAME ENERGY.' }
    ],
    es: [
      { id: 'train-hl-stop-alone', text: '¿NECESITAS COMPAÑERO DE ENTRENO?' },
      { id: 'train-hl-next-partner', text: 'ENCUENTRA A QUIEN AGUANTE TU RITMO.' },
      { id: 'train-hl-better-together', text: 'BUEN PARTIDO. ¿LUEGO UNAS COPAS?' },
      { id: 'train-hl-trains-like-you', text: 'CORRED JUNTOS. ¿CAFÉ DESPUÉS?' },
      { id: 'train-hl-partner-here', text: 'EMPIEZA CON UN ENTRENO. MIRA QUÉ PASA.' },
      { id: 'train-hl-match-goals', text: 'EMPIEZA CON UNA RUTA. MIRA QUÉ PASA.' },
      { id: 'train-hl-meet-active', text: 'ENCUENTRA TU DEPORTE. ENCUENTRA TU GENTE.' },
      { id: 'train-hl-gym-accountability', text: 'ENTRENA JUNTOS. MIRA A DÓNDE LLEGA.' },
      { id: 'train-hl-social-fitness', text: 'MISMO DEPORTE. MISMA ENERGÍA.' }
    ],
    ru: [
      { id: 'train-hl-stop-alone', text: 'НУЖЕН ПАРТНЁР ПО ТРЕНИРОВКАМ?' },
      { id: 'train-hl-next-partner', text: 'НАЙДИ ТОГО, КТО УСПЕВАЕТ ЗА ТОБОЙ.' },
      { id: 'train-hl-better-together', text: 'ХОРОШАЯ ИГРА. ПОТОМ НАПИТКИ?' },
      { id: 'train-hl-trains-like-you', text: 'БЕГИТЕ ВМЕСТЕ. КОФЕ ПОТОМ?' },
      { id: 'train-hl-partner-here', text: 'НАЧНИТЕ С ТРЕНИРОВКИ. ПОСМОТРИТЕ, ЧТО БУДЕТ.' },
      { id: 'train-hl-match-goals', text: 'НАЧНИТЕ С ПОХОДА. ПОСМОТРИТЕ, ЧТО БУДЕТ.' },
      { id: 'train-hl-meet-active', text: 'НАЙДИ СВОЙ СПОРТ. НАЙДИ СВОИХ ЛЮДЕЙ.' },
      { id: 'train-hl-gym-accountability', text: 'ТРЕНИРУЙТЕСЬ ВМЕСТЕ. ПОСМОТРИТЕ, КУДА ЭТО ЗАВЕДЁТ.' },
      { id: 'train-hl-social-fitness', text: 'ОДИН СПОРТ. ОДНА ЭНЕРГИЯ.' }
    ]
  },
  VIBE: {
    en: [
      { id: 'vibe-hl-into-what', text: 'WORK OUT. HANG OUT. MAYBE MORE.' },
      { id: 'vibe-hl-beyond-feed', text: 'GOOD WORKOUT. YOUR MOVE.' },
      { id: 'vibe-hl-your-people', text: 'FIND YOUR GAME. FIND YOUR PEOPLE.' },
      { id: 'vibe-hl-do-more', text: 'THE MATCH ENDS. THE CONNECTION DOESN\'T HAVE TO.' },
      { id: 'vibe-hl-love-doing', text: 'TRAIN FIRST. HANG OUT AFTER.' },
      { id: 'vibe-hl-kind-of-people', text: 'TRAIN TOGETHER. SEE WHERE IT GOES.' },
      { id: 'vibe-hl-make-friends', text: 'START WITH AN ACTIVITY. SEE WHERE IT GOES.' },
      { id: 'vibe-hl-local-activities', text: 'START WITH FITNESS. STAY FOR THE CONNECTION.' }
    ],
    es: [
      { id: 'vibe-hl-into-what', text: 'ENTRENA. QUEDAD. QUIZÁ MÁS.' },
      { id: 'vibe-hl-beyond-feed', text: 'BUEN ENTRENO. TU TURNO.' },
      { id: 'vibe-hl-your-people', text: 'ENCUENTRA TU DEPORTE. ENCUENTRA TU GENTE.' },
      { id: 'vibe-hl-do-more', text: 'EL PARTIDO TERMINA. LA CONEXIÓN NO TIENE POR QUÉ.' },
      { id: 'vibe-hl-love-doing', text: 'PRIMERO ENTRENA. LUEGO QUEDAD.' },
      { id: 'vibe-hl-kind-of-people', text: 'ENTRENAD JUNTOS. MIRAD A DÓNDE LLEGA.' },
      { id: 'vibe-hl-make-friends', text: 'EMPIEZA CON UNA ACTIVIDAD. MIRA A DÓNDE LLEGA.' },
      { id: 'vibe-hl-local-activities', text: 'EMPIEZA CON FITNESS. QUÉDATE POR LA CONEXIÓN.' }
    ],
    ru: [
      { id: 'vibe-hl-into-what', text: 'ТРЕНИРОВКА. ОБЩЕНИЕ. МОЖЕТ, БОЛЬШЕ.' },
      { id: 'vibe-hl-beyond-feed', text: 'ХОРОШАЯ ТРЕНИРОВКА. ТВОЙ ХОД.' },
      { id: 'vibe-hl-your-people', text: 'НАЙДИ СВОЙ СПОРТ. НАЙДИ СВОИХ ЛЮДЕЙ.' },
      { id: 'vibe-hl-do-more', text: 'МАТЧ ЗАКОНЧИЛСЯ. СВЯЗЬ — НЕТ.' },
      { id: 'vibe-hl-love-doing', text: 'СНАЧАЛА ТРЕНИРОВКА. ПОТОМ ОБЩЕНИЕ.' },
      { id: 'vibe-hl-kind-of-people', text: 'ТРЕНИРУЙТЕСЬ ВМЕСТЕ. ПОСМОТРИТЕ, КУДА ЭТО ЗАВЕДЁТ.' },
      { id: 'vibe-hl-make-friends', text: 'НАЧНИ С АКТИВНОСТИ. ПОСМОТРИ, КУДА ЭТО ЗАВЕДЁТ.' },
      { id: 'vibe-hl-local-activities', text: 'НАЧНИ С ФИТНЕСА. ОСТАНЬСЯ РАДИ СВЯЗИ.' }
    ]
  },
  DATE: {
    en: [
      { id: 'date-hl-energy', text: 'MEET SOMEONE WHO MATCHES YOUR ENERGY' },
      { id: 'date-hl-tired-swiping', text: 'NEED A SPOT? MAYBE A DATE?' },
      { id: 'date-hl-live-like-you', text: 'TRAIN FIRST. FLIRT LATER.' },
      { id: 'date-hl-shared-interests', text: 'START WITH A WORKOUT. SEE WHAT HAPPENS.' },
      { id: 'date-hl-beyond-profile', text: 'GOOD MATCH. YOUR MOVE.' },
      { id: 'date-hl-actually-click', text: 'IF THERE\'S CHEMISTRY, YOU DECIDE.' },
      { id: 'date-hl-less-swiping', text: 'ACTIVITY FIRST. DATING OPTIONAL.' },
      { id: 'date-hl-lifestyle', text: 'GYM PARTNER TODAY. WHAT\'S NEXT IS UP TO YOU.' },
      { id: 'date-hl-active-dating', text: 'YOU ALREADY HAVE SOMETHING IN COMMON.' },
      { id: 'date-hl-meet-active', text: 'SEE WHERE IT GOES.' }
    ],
    es: [
      { id: 'date-hl-energy', text: 'CONOCE A ALGUIEN QUE COMBINE CON TU ENERGÍA' },
      { id: 'date-hl-tired-swiping', text: '¿NECESITAS SPOT? ¿QUIZÁ UNA CITA?' },
      { id: 'date-hl-live-like-you', text: 'PRIMERO ENTRENA. LUEGO FLIRTEA.' },
      { id: 'date-hl-shared-interests', text: 'EMPIEZA CON UN ENTRENO. MIRA QUÉ PASA.' },
      { id: 'date-hl-beyond-profile', text: 'BUEN MATCH. TU TURNO.' },
      { id: 'date-hl-actually-click', text: 'SI HAY QUÍMICA, TÚ DECIDES.' },
      { id: 'date-hl-less-swiping', text: 'ACTIVIDAD PRIMERO. CITA OPCIONAL.' },
      { id: 'date-hl-lifestyle', text: 'COMPAÑERO DE GYM HOY. LO QUE SIGUE LO DECIDES TÚ.' },
      { id: 'date-hl-active-dating', text: 'YA TENÉIS ALGO EN COMÚN.' },
      { id: 'date-hl-meet-active', text: 'MIRA A DÓNDE LLEGA.' }
    ],
    ru: [
      { id: 'date-hl-energy', text: 'НАЙДИ КОГО-ТО ПОД ТВОЮ ЭНЕРГИЮ' },
      { id: 'date-hl-tired-swiping', text: 'НУЖНА СТРАХОВКА? МОЖЕТ, СВИДАНИЕ?' },
      { id: 'date-hl-live-like-you', text: 'СНАЧАЛА ТРЕНИРОВКА. ПОТОМ ФЛИРТ.' },
      { id: 'date-hl-shared-interests', text: 'НАЧНИТЕ С ТРЕНИРОВКИ. ПОСМОТРИТЕ, ЧТО БУДЕТ.' },
      { id: 'date-hl-beyond-profile', text: 'ХОРОШИЙ МАТЧ. ТВОЙ ХОД.' },
      { id: 'date-hl-actually-click', text: 'ЕСЛИ ЕСТЬ ХИМИЯ — РЕШАЕТЕ ВЫ.' },
      { id: 'date-hl-less-swiping', text: 'СНАЧАЛА АКТИВНОСТЬ. СВИДАНИЕ — ПО ЖЕЛАНИЮ.' },
      { id: 'date-hl-lifestyle', text: 'ПАРТНЁР ПО ЗАЛУ СЕГОДНЯ. ДАЛЬШЕ — РЕШАЕТЕ ВЫ.' },
      { id: 'date-hl-active-dating', text: 'У ВАС УЖЕ ЕСТЬ ЧТО-ТО ОБЩЕЕ.' },
      { id: 'date-hl-meet-active', text: 'ПОСМОТРИТЕ, КУДА ЭТО ЗАВЕДЁТ.' }
    ]
  }
};

export const CTA_VARIANTS = {
  TRAIN: {
    en: [
      { id: 'train-cta-partner', text: 'FIND A TRAINING PARTNER' },
      { id: 'train-cta-your-partner', text: 'FIND YOUR PARTNER' },
      { id: 'train-cta-start', text: 'START TRAINING' },
      { id: 'train-cta-discover', text: 'DISCOVER TRAINMATES' }
    ],
    es: [
      { id: 'train-cta-partner', text: 'ENCUENTRA SOCIO DE ENTRENO' },
      { id: 'train-cta-your-partner', text: 'ENCUENTRA TU SOCIO' },
      { id: 'train-cta-start', text: 'EMPIEZA A ENTRENAR' },
      { id: 'train-cta-discover', text: 'DESCUBRE TRAINMATES' }
    ],
    ru: [
      { id: 'train-cta-partner', text: 'НАЙТИ ПАРТНЁРА' },
      { id: 'train-cta-your-partner', text: 'НАЙТИ СВОЕГО' },
      { id: 'train-cta-start', text: 'НАЧАТЬ ТРЕНИРОВАТЬСЯ' },
      { id: 'train-cta-discover', text: 'НАЙТИ TRAINMATES' }
    ]
  },
  VIBE: {
    en: [
      { id: 'vibe-cta-people', text: 'FIND YOUR PEOPLE' },
      { id: 'vibe-cta-discover', text: 'DISCOVER PEOPLE' },
      { id: 'vibe-cta-connect', text: 'START CONNECTING' },
      { id: 'vibe-cta-explore', text: 'EXPLORE VIBE' }
    ],
    es: [
      { id: 'vibe-cta-people', text: 'ENCUENTRA TU GENTE' },
      { id: 'vibe-cta-discover', text: 'DESCUBRE PERSONAS' },
      { id: 'vibe-cta-connect', text: 'EMPIEZA A CONECTAR' },
      { id: 'vibe-cta-explore', text: 'EXPLORA VIBE' }
    ],
    ru: [
      { id: 'vibe-cta-people', text: 'НАЙТИ СВОИХ' },
      { id: 'vibe-cta-discover', text: 'ОТКРЫТЬ ЛЮДЕЙ' },
      { id: 'vibe-cta-connect', text: 'НАЧАТЬ ОБЩАТЬСЯ' },
      { id: 'vibe-cta-explore', text: 'СМОТРЕТЬ VIBE' }
    ]
  },
  DATE: {
    en: [
      { id: 'date-cta-match', text: 'FIND YOUR MATCH' },
      { id: 'date-cta-meet', text: 'MEET SOMEONE' },
      { id: 'date-cta-connect', text: 'START CONNECTING' },
      { id: 'date-cta-discover', text: 'DISCOVER PEOPLE' }
    ],
    es: [
      { id: 'date-cta-match', text: 'ENCUENTRA TU MATCH' },
      { id: 'date-cta-meet', text: 'CONOCE A ALGUIEN' },
      { id: 'date-cta-connect', text: 'EMPIEZA A CONECTAR' },
      { id: 'date-cta-discover', text: 'DESCUBRE PERSONAS' }
    ],
    ru: [
      { id: 'date-cta-match', text: 'НАЙТИ СВОЙ МАТЧ' },
      { id: 'date-cta-meet', text: 'ПОЗНАКОМИТЬСЯ' },
      { id: 'date-cta-connect', text: 'НАЧАТЬ ОБЩАТЬСЯ' },
      { id: 'date-cta-discover', text: 'ОТКРЫТЬ ЛЮДЕЙ' }
    ]
  }
};

/** Optional short subheadlines (used sparingly on image when helpful). */
export const SUBHEADLINE_VARIANTS = {
  TRAIN: {
    en: [
      { id: 'train-sub-goals', text: 'Gym, run, sports — match your style.' },
      { id: 'train-sub-city', text: 'People near you who actually train.' }
    ],
    es: [
      { id: 'train-sub-goals', text: 'Gym, running, deporte — a tu estilo.' },
      { id: 'train-sub-city', text: 'Gente cerca que sí entrena.' }
    ],
    ru: [
      { id: 'train-sub-goals', text: 'Зал, бег, спорт — под твой стиль.' },
      { id: 'train-sub-city', text: 'Рядом те, кто реально тренируется.' }
    ]
  },
  VIBE: {
    en: [
      { id: 'vibe-sub-activities', text: 'Events, hobbies, real plans.' },
      { id: 'vibe-sub-not-dating', text: 'Friendship and shared interests first.' }
    ],
    es: [
      { id: 'vibe-sub-activities', text: 'Eventos, hobbies, planes reales.' },
      { id: 'vibe-sub-not-dating', text: 'Amistad e intereses primero.' }
    ],
    ru: [
      { id: 'vibe-sub-activities', text: 'События, хобби, реальные планы.' },
      { id: 'vibe-sub-not-dating', text: 'Сначала общение и интересы.' }
    ]
  },
  DATE: {
    en: [
      { id: 'date-sub-activities', text: 'Shared interests. Real chemistry.' },
      { id: 'date-sub-lifestyle', text: 'Less swiping. More real plans.' }
    ],
    es: [
      { id: 'date-sub-activities', text: 'Intereses en común. Química real.' },
      { id: 'date-sub-lifestyle', text: 'Menos swipes. Más planes reales.' }
    ],
    ru: [
      { id: 'date-sub-activities', text: 'Общие интересы. Живая химия.' },
      { id: 'date-sub-lifestyle', text: 'Меньше свайпов. Больше реальных планов.' }
    ]
  }
};

/**
 * Post bodies: HOOK + BENEFIT + DIFFERENTIATOR + CTA (+ compliance line).
 * Variation around value props — not the same lines every day.
 */
export const POST_VARIANTS = {
  TRAIN: {
    en: [
      {
        id: 'train-post-alone',
        hook: 'Still training alone?',
        benefit: 'Find people nearby who share your workouts, goals, and training style.',
        differentiator: 'Your next workout partner could already be on GetTrainMate.',
        ctaLine: 'Find your TrainMate.',
        disclaimer: 'No guaranteed training partners. You control your profile.'
      },
      {
        id: 'train-post-show-up',
        hook: 'Need someone who actually shows up?',
        benefit: 'Match with people who train like you — gym, running, sports, or race prep.',
        differentiator: 'TRAIN is built for workout partners, not endless small talk.',
        ctaLine: 'Find a training partner on GetTrainMate.',
        disclaimer: 'No guaranteed partners. You choose who you talk to.'
      },
      {
        id: 'train-post-goals',
        hook: 'Same goals. Different schedules. Still going solo?',
        benefit: 'Discover TrainMates who want better sessions — together.',
        differentiator: 'Pick TRAIN, set your city, open Discover.',
        ctaLine: 'Start training with someone who gets it.',
        disclaimer: 'No guaranteed matches. You control your profile.'
      },
      {
        id: 'train-post-accountability',
        hook: 'Motivation fades. A partner helps.',
        benefit: 'Find someone nearby who shares your workout style and schedule energy.',
        differentiator: 'GetTrainMate TRAIN — partners first. VIBE and DATE are separate modes.',
        ctaLine: 'Find your next training partner.',
        disclaimer: 'No guaranteed training partners.'
      },
      {
        id: 'train-post-social-fitness',
        hook: 'Fitness is better with company.',
        benefit: 'Connect with people who train like you — running, gym, cycling, sports, or HYROX.',
        differentiator: 'TRAIN mode pairs you by fitness goals and schedule, not endless small talk.',
        ctaLine: 'Find your workout partner on GetTrainMate.',
        disclaimer: 'No guaranteed partners. You choose who you train with.'
      },
      {
        id: 'train-post-meet-active',
        hook: 'Looking for active people in your city?',
        benefit: 'Discover workout partners and training buddies who share your intensity.',
        differentiator: 'GetTrainMate TRAIN connects you directly for workouts. VIBE and DATE are separate.',
        ctaLine: 'Meet active people who train.',
        disclaimer: 'No guaranteed training partners. You control your profile.'
      }
    ],
    es: [
      {
        id: 'train-post-alone',
        hook: '¿Sigues entrenando solo?',
        benefit: 'Encuentra gente cerca que comparte tus entrenos, objetivos y estilo.',
        differentiator: 'Tu próximo socio de entreno puede estar ya en GetTrainMate.',
        ctaLine: 'Encuentra tu TrainMate.',
        disclaimer: 'Sin socios garantizados. Tú controlas tu perfil.'
      },
      {
        id: 'train-post-show-up',
        hook: '¿Buscas a alguien que sí aparezca?',
        benefit: 'Conecta con gente que entrena como tú — gym, running, deporte o preparación.',
        differentiator: 'TRAIN es para socios de entreno, no para charla sin fin.',
        ctaLine: 'Encuentra un socio de entrenamiento en GetTrainMate.',
        disclaimer: 'Nadie te garantiza un socio. Tú decides con quién hablar.'
      },
      {
        id: 'train-post-goals',
        hook: '¿Mismos objetivos y aún solo?',
        benefit: 'Descubre TrainMates que quieren mejores sesiones — juntos.',
        differentiator: 'Elige TRAIN, pon tu ciudad y entra a Discover.',
        ctaLine: 'Empieza a entrenar con quien lo entiende.',
        disclaimer: 'Sin coincidencias garantizadas. Tú controlas tu perfil.'
      },
      {
        id: 'train-post-accountability',
        hook: 'La motivación baja. Un socio ayuda.',
        benefit: 'Encuentra cerca a alguien con tu estilo de entreno y tu energía.',
        differentiator: 'GetTrainMate TRAIN — socios primero. VIBE y DATE son otros modos.',
        ctaLine: 'Encuentra tu próximo socio de entreno.',
        disclaimer: 'Sin socios de entrenamiento garantizados.'
      },
      {
        id: 'train-post-social-fitness',
        hook: '¿Entrenar en compañía?',
        benefit: 'Conecta con gente que entrena como tú — gym, running, ciclismo o HYROX.',
        differentiator: 'El modo TRAIN te une por objetivos y horarios, sin charlas vacías.',
        ctaLine: 'Encuentra tu socio de entreno en GetTrainMate.',
        disclaimer: 'Sin socios garantizados. Tú decides con quién entrenar.'
      },
      {
        id: 'train-post-meet-active',
        hook: '¿Buscas gente activa en tu ciudad?',
        benefit: 'Descubre compañeros de entrenamiento que comparten tu ritmo y motivación.',
        differentiator: 'GetTrainMate TRAIN te conecta directo para entrenar. VIBE y DATE van aparte.',
        ctaLine: 'Conoce gente activa que entrena.',
        disclaimer: 'Sin socios de entrenamiento garantizados. Tú controlas tu perfil.'
      }
    ],
    ru: [
      {
        id: 'train-post-alone',
        hook: 'Всё ещё тренируетесь в одиночку?',
        benefit: 'Найдите рядом людей с похожими тренировками, целями и стилем.',
        differentiator: 'Ваш следующий партнёр по залу уже может быть в GetTrainMate.',
        ctaLine: 'Найдите своего TrainMate.',
        disclaimer: 'Партнёров не гарантируем. Профиль контролируете вы.'
      },
      {
        id: 'train-post-show-up',
        hook: 'Нужен тот, кто реально приходит?',
        benefit: 'Найдите людей, которые тренируются как вы — зал, бег, спорт или подготовка к старту.',
        differentiator: 'TRAIN — для партнёров по тренировкам, а не для пустых переписок.',
        ctaLine: 'Найдите партнёра для тренировок в GetTrainMate.',
        disclaimer: 'Мы не обещаем партнёров. Вы решаете, с кем писать.'
      },
      {
        id: 'train-post-goals',
        hook: 'Одинаковые цели — и всё равно одни?',
        benefit: 'Откройте TrainMates, которые хотят более сильные тренировки — вместе.',
        differentiator: 'Выберите TRAIN, укажите город и откройте Discover.',
        ctaLine: 'Начните тренироваться с тем, кто понимает — в GetTrainMate.',
        disclaimer: 'Совпадения не гарантируем. Профиль контролируете вы.'
      },
      {
        id: 'train-post-accountability',
        hook: 'Мотивация падает. Партнёр помогает.',
        benefit: 'Найдите рядом человека с вашим стилем тренировок и темпом.',
        differentiator: 'GetTrainMate TRAIN — сначала партнёры. VIBE и DATE — отдельные режимы.',
        ctaLine: 'Найдите следующего партнёра для тренировок.',
        disclaimer: 'Партнёров для тренировок не гарантируем.'
      },
      {
        id: 'train-post-social-fitness',
        hook: 'Фитнес лучше в компании.',
        benefit: 'Знакомьтесь с теми, кто тренируется как вы — зал, пробежки, велосипед или подготовка к стартам.',
        differentiator: 'Режим TRAIN подбирает по целям и расписанию, без пустой переписки.',
        ctaLine: 'Найдите партнёра по тренировкам в GetTrainMate.',
        disclaimer: 'Мы не обещаем партнёров. Вы сами выбираете, с кем тренироваться.'
      },
      {
        id: 'train-post-meet-active',
        hook: 'Ищете активных людей в своём городе?',
        benefit: 'Откройте партнёров для зала и пробежек, которые разделяют вашу интенсивность.',
        differentiator: 'GetTrainMate TRAIN объединяет именно для тренировок. VIBE и DATE — отдельные режимы.',
        ctaLine: 'Знакомьтесь с активными людьми для тренировок.',
        disclaimer: 'Партнёров для тренировок не гарантируем. Профиль контролируете вы.'
      }
    ]
  },
  VIBE: {
    en: [
      {
        id: 'vibe-post-not-dating',
        hook: 'Workout went well? Keep hanging out.',
        benefit: 'Find people nearby to train with — then grab coffee, drinks, or plans after.',
        differentiator: 'Start with an activity. Stay for the vibe. Dating is a separate choice.',
        ctaLine: 'Find your people on GetTrainMate.',
        disclaimer: 'No guaranteed hangouts. You control who you meet.'
      },
      {
        id: 'vibe-post-beyond-feed',
        hook: 'Good game. Drinks after?',
        benefit: 'Meet through pickleball, runs, gym sessions, or rides — then keep the night going if you want.',
        differentiator: 'Activity first. Chemistry optional. TRAIN and DATE stay separate modes.',
        ctaLine: 'Keep the vibe going on GetTrainMate.',
        disclaimer: 'No guaranteed plans. You decide.'
      },
      {
        id: 'vibe-post-new-city',
        hook: 'Same energy. Now say hi.',
        benefit: 'Find someone nearby who likes the same sport. If you click, keep hanging out.',
        differentiator: 'Train together. Catch a vibe. Maybe more — or not.',
        ctaLine: 'Start on GetTrainMate.',
        disclaimer: 'No guaranteed meetups. You control your profile.'
      },
      {
        id: 'vibe-post-love-doing',
        hook: 'Gym partner today. Drinks tonight?',
        benefit: 'Training is easier with someone else. Meeting people can be too.',
        differentiator: 'GetTrainMate VIBE — hangouts that start from real activity.',
        ctaLine: 'Find your people.',
        disclaimer: 'No guaranteed hangouts. You choose who you talk to.'
      },
      {
        id: 'vibe-post-shared-interests',
        hook: 'Find your game. Find your people.',
        benefit: 'Play, train, then decide if you want coffee or drinks after.',
        differentiator: 'VIBE is for plans after the workout — zero dating pressure.',
        ctaLine: 'Find people nearby on GetTrainMate.',
        disclaimer: 'No guaranteed hangouts. You decide who you connect with.'
      },
      {
        id: 'vibe-post-local-activities',
        hook: 'Want to do more in your city?',
        benefit: 'Connect with locals for activities, exploring new spots, and weekend plans.',
        differentiator: 'GetTrainMate VIBE connects you through what you love doing.',
        ctaLine: 'Discover local activities and friends.',
        disclaimer: 'No guaranteed meetups. You control your connections.'
      }
    ],
    es: [
      {
        id: 'vibe-post-not-dating',
        hook: 'Hacer amigos no debería parecer otra app de citas.',
        benefit: 'Conoce gente a través de actividades e intereses que de verdad te gustan.',
        differentiator: 'VIBE es para planes, eventos y hobbies — no citas primero, salvo que elijas DATE.',
        ctaLine: 'Encuentra tu gente en GetTrainMate.',
        disclaimer: 'Sin planes garantizados. Tú decides con quién quedar.'
      },
      {
        id: 'vibe-post-beyond-feed',
        hook: '¿Cansado de ver gente que nunca conoces?',
        benefit: 'Encuentra a tu tipo de gente para conciertos, café, fines de semana y planes reales.',
        differentiator: 'Tus intereses. Tu gente. TRAIN y DATE son modos aparte.',
        ctaLine: 'Descubre personas en GetTrainMate (VIBE).',
        disclaimer: 'Nadie te garantiza un plan. Tú decides.'
      },
      {
        id: 'vibe-post-new-city',
        hook: '¿Nuevo en la ciudad o sin planes?',
        benefit: 'Conecta con gente que comparte lo que a ti te gusta.',
        differentiator: 'Haz más con quien te entiende.',
        ctaLine: 'Empieza a conectar en GetTrainMate.',
        disclaimer: 'Sin quedadas garantizadas. Tú controlas tu perfil.'
      },
      {
        id: 'vibe-post-love-doing',
        hook: 'El feed lleno. El fin de semana vacío.',
        benefit: 'Conoce a través de lo que amas hacer — eventos, hobbies y energía en común.',
        differentiator: 'GetTrainMate VIBE — primero comunidad.',
        ctaLine: 'Explora VIBE y encuentra tu gente.',
        disclaimer: 'Sin planes garantizados. Tú eliges con quién hablar.'
      },
      {
        id: 'vibe-post-shared-interests',
        hook: 'Encuentra gente con tus mismos intereses.',
        benefit: 'Desde senderismo hasta tomar un café y eventos locales, conoce a quien sintoniza contigo.',
        differentiator: 'VIBE es para planes reales y amistad — sin presión de citas.',
        ctaLine: 'Encuentra gente con intereses en común en GetTrainMate.',
        disclaimer: 'Sin quedadas garantizadas. Tú decides con quién conectar.'
      },
      {
        id: 'vibe-post-local-activities',
        hook: '¿Quieres hacer más planes en tu ciudad?',
        benefit: 'Conecta con gente local para actividades, descubrir lugares y planes de finde.',
        differentiator: 'GetTrainMate VIBE te conecta a través de lo que disfrutas hacer.',
        ctaLine: 'Descubre actividades locales y nuevas amistades.',
        disclaimer: 'Sin quedadas garantizadas. Tú controlas tus conexiones.'
      }
    ],
    ru: [
      {
        id: 'vibe-post-not-dating',
        hook: 'Дружба не должна ощущаться как очередное приложение для свиданий.',
        benefit: 'Знакомьтесь через занятия и интересы, которые вам реально нравятся.',
        differentiator: 'VIBE — для планов, событий и хобби. DATE — отдельный режим, если он нужен.',
        ctaLine: 'Найдите своих в GetTrainMate.',
        disclaimer: 'Встречи не гарантируем. Вы решаете, с кем общаться.'
      },
      {
        id: 'vibe-post-beyond-feed',
        hook: 'Устали листать людей, которых никогда не встретите?',
        benefit: 'Найдите своих для концертов, кофе, выходных и реальных планов.',
        differentiator: 'Ваши интересы. Ваши люди. TRAIN и DATE — отдельные режимы.',
        ctaLine: 'Откройте людей в GetTrainMate (VIBE).',
        disclaimer: 'Планы не гарантируем. Вы решаете.'
      },
      {
        id: 'vibe-post-new-city',
        hook: 'Новый город — или просто нет планов?',
        benefit: 'Общайтесь с теми, кому интересно то же, что и вам.',
        differentiator: 'Делайте больше с теми, кто вас понимает.',
        ctaLine: 'Начните общаться в GetTrainMate.',
        disclaimer: 'Встречи не гарантируем. Профиль контролируете вы.'
      },
      {
        id: 'vibe-post-love-doing',
        hook: 'Лента полная. Выходные пустые.',
        benefit: 'Знакомьтесь через то, что любите — события, хобби и общую энергию.',
        differentiator: 'GetTrainMate VIBE — сначала сообщество.',
        ctaLine: 'Смотрите VIBE и найдите своих.',
        disclaimer: 'Встречи не гарантируем. Вы выбираете, с кем писать.'
      },
      {
        id: 'vibe-post-shared-interests',
        hook: 'Найдите людей с вашими интересами.',
        benefit: 'От походов выходного дня до кофе и городских событий — знакомьтесь на одной волне.',
        differentiator: 'VIBE создан для реальных планов и дружбы — без давления дейтинга.',
        ctaLine: 'Находите людей с общими интересами в GetTrainMate.',
        disclaimer: 'Встречи не гарантируем. Вы сами решаете, с кем общаться.'
      },
      {
        id: 'vibe-post-local-activities',
        hook: 'Хотите больше интересных планов в городе?',
        benefit: 'Знакомьтесь с местными для совместных активностей, новых мест и выходных.',
        differentiator: 'GetTrainMate VIBE объединяет через то, что вам действительно нравится.',
        ctaLine: 'Откройте локальные события и новых друзей.',
        disclaimer: 'Встречи не гарантируем. Вы контролируете свои связи.'
      }
    ]
  },
  DATE: {
    en: [
      {
        id: 'date-post-swiping',
        hook: 'Need a spot? Maybe a date?',
        benefit: 'Start with a workout. If there’s chemistry, you decide what’s next.',
        differentiator: 'Activity first. Dating optional. TRAIN and VIBE stay available when dating isn’t the intent.',
        ctaLine: 'See what happens on GetTrainMate.',
        disclaimer: 'No guaranteed dates or relationships. You control your profile.'
      },
      {
        id: 'date-post-energy',
        hook: 'Train first. Flirt later.',
        benefit: 'Meet someone who can keep up — gym, run, hike, or play — then see if there’s a spark.',
        differentiator: 'Chemistry is up to you. Not a swipe factory.',
        ctaLine: 'Start with a workout on GetTrainMate.',
        disclaimer: 'No guaranteed dates. You choose who you talk to.'
      },
      {
        id: 'date-post-beyond-profile',
        hook: 'Good match. Your move.',
        benefit: 'You already have something in common — the activity that brought you together.',
        differentiator: 'If the vibe is there, take it further — or don’t.',
        ctaLine: 'See where it goes on GetTrainMate.',
        disclaimer: 'No guaranteed matches. You control your profile.'
      },
      {
        id: 'date-post-lifestyle',
        hook: 'Start with a workout. See what happens.',
        benefit: 'Find someone nearby who trains like you. Dating is optional.',
        differentiator: 'Shared activity. Real chemistry — only if you both want it.',
        ctaLine: 'Find your people on GetTrainMate.',
        disclaimer: 'No guaranteed dates or relationships. You decide.'
      },
      {
        id: 'date-post-active-dating',
        hook: 'Gym partner today. What’s next is up to you.',
        benefit: 'Meet through something active — then coffee, drinks, or a date if you click.',
        differentiator: 'DATE mode is optional. The journey starts with TRAIN.',
        ctaLine: 'Try GetTrainMate.',
        disclaimer: 'No guaranteed dates or relationships. You control your profile.'
      }
    ],
    es: [
      {
        id: 'date-post-swiping',
        hook: '¿Cansado de deslizar sin parar?',
        benefit: 'Conoce gente activa que comparte tus intereses, estilo de vida y energía.',
        differentiator: 'Menos swipes. Más conexiones reales.',
        ctaLine: 'Encuentra tu match en GetTrainMate.',
        disclaimer: 'Sin citas ni relaciones garantizadas. Tú controlas tu perfil.'
      },
      {
        id: 'date-post-energy',
        hook: '¿Buscas a alguien que combine con tu energía?',
        benefit: 'DATE en GetTrainMate es para conectar por intereses reales — no una fábrica de swipes.',
        differentiator: 'Mismo estilo de vida. Química real. TRAIN y VIBE siguen ahí si no buscas citas.',
        ctaLine: 'Conoce a alguien que entienda cómo vives.',
        disclaimer: 'Nadie te garantiza una cita. Tú decides con quién hablar.'
      },
      {
        id: 'date-post-beyond-profile',
        hook: 'Los perfiles se parecen. La química, no.',
        benefit: 'Conoce más allá del perfil — por actividades, intereses y cómo vives de verdad.',
        differentiator: 'Encuentra a alguien con quien haya clic.',
        ctaLine: 'Empieza a conectar en GetTrainMate (DATE).',
        disclaimer: 'Sin matches garantizados. Tú controlas tu perfil.'
      },
      {
        id: 'date-post-lifestyle',
        hook: '¿Quieres citas que encajen con tu estilo de vida?',
        benefit: 'Sal con gente que vive como tú — activa, social e intencional.',
        differentiator: 'Intereses en común. Conexiones reales.',
        ctaLine: 'Descubre personas en GetTrainMate.',
        disclaimer: 'Sin citas ni relaciones garantizadas. Tú decides.'
      },
      {
        id: 'date-post-active-dating',
        hook: 'Citas activas para gente que de verdad hace cosas.',
        benefit: 'Conoce solteros que valoran el deporte, la vida sana y las salidas al aire libre.',
        differentiator: 'El modo DATE te conecta por estilo de vida e intereses — sin juegos superficiales.',
        ctaLine: 'Prueba citas activas en GetTrainMate.',
        disclaimer: 'Sin citas ni relaciones garantizadas. Tú controlas tu perfil.'
      }
    ],
    ru: [
      {
        id: 'date-post-swiping',
        hook: 'Устали от бесконечных свайпов?',
        benefit: 'Знакомьтесь с активными людьми, у которых похожие интересы, образ жизни и энергия.',
        differentiator: 'Меньше свайпов. Больше живого общения.',
        ctaLine: 'Найдите свой матч в GetTrainMate.',
        disclaimer: 'Свидания и отношения не гарантируем. Профиль контролируете вы.'
      },
      {
        id: 'date-post-energy',
        hook: 'Ищете того, кто совпадает по энергии?',
        benefit: 'DATE в GetTrainMate — для знакомств через реальные интересы, а не фабрики свайпов.',
        differentiator: 'Похожий образ жизни. Живая химия. TRAIN и VIBE остаются, если свидания — не ваша цель.',
        ctaLine: 'Познакомьтесь с тем, кто понимает, как вы живёте.',
        disclaimer: 'Мы не обещаем свидания. Вы решаете, с кем писать.'
      },
      {
        id: 'date-post-beyond-profile',
        hook: 'Профили похожи. Химия — нет.',
        benefit: 'Знакомьтесь за пределами профиля — через занятия, интересы и то, как вы реально живёте.',
        differentiator: 'Найдите того, с кем есть клик.',
        ctaLine: 'Начните общаться в GetTrainMate (DATE).',
        disclaimer: 'Совпадения не гарантируем. Профиль контролируете вы.'
      },
      {
        id: 'date-post-lifestyle',
        hook: 'Хотите знакомства под ваш образ жизни?',
        benefit: 'Знакомьтесь с теми, кто живёт как вы — активно, социально и осознанно.',
        differentiator: 'Общие интересы. Настоящие связи.',
        ctaLine: 'Откройте людей в GetTrainMate.',
        disclaimer: 'Свидания и отношения не гарантируем. Вы решаете.'
      },
      {
        id: 'date-post-active-dating',
        hook: 'Знакомства для тех, кто живёт активно.',
        benefit: 'Знакомьтесь с синглами, которые ценят спорт, движение и здоровый образ жизни.',
        differentiator: 'Режим DATE объединяет по интересам и стилю жизни — без пустых игр.',
        ctaLine: 'Попробуйте активный дейтинг в GetTrainMate.',
        disclaimer: 'Свидания и отношения не гарантируем. Профиль контролируете вы.'
      }
    ]
  }
};

export const WEAK_COPY_PATTERNS = [
  /meet through real chemistry/i,
  /start matching/i,
  /gettrainmate helps you/i,
  /discover our platform/i,
  /connect with like-minded individuals/i,
  /start your journey/i
];

export function normalizeLocale(language) {
  const lang = String(language || 'en').toLowerCase().slice(0, 2);
  return LOCALES.includes(lang) ? lang : 'en';
}

export function listFor(table, mode, language) {
  const m = String(mode || 'TRAIN').toUpperCase();
  const locale = normalizeLocale(language);
  return table[m]?.[locale] || table[m]?.en || [];
}

export function formatPostBody(post) {
  if (!post) return '';
  return [
    post.hook,
    '{{url}}',
    '',
    post.benefit,
    '',
    post.differentiator,
    '',
    post.ctaLine,
    '',
    post.disclaimer
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function recentCopyKeys(recentEntries = []) {
  const headlines = [];
  const ctas = [];
  const posts = [];
  for (const e of recentEntries) {
    if (e.imageHeadline) headlines.push(e.imageHeadline);
    if (e.headlineVariant) headlines.push(e.headlineVariant);
    if (e.imageCta || e.cta) ctas.push(e.imageCta || e.cta);
    if (e.ctaVariant) ctas.push(e.ctaVariant);
    if (e.copyVariant) posts.push(e.copyVariant);
  }
  return { headlines, ctas, posts };
}

/**
 * Select headline, CTA, optional subheadline, and post body for one locale+mode.
 * Avoids consecutive / recent headline and post-variant repeats when possible.
 */
export function selectCopyPackage({
  mode = 'TRAIN',
  language = 'en',
  isoDate = '',
  contentId = '',
  recentEntries = [],
  includeSubheadline = false
} = {}) {
  const locale = normalizeLocale(language);
  const m = String(mode || 'TRAIN').toUpperCase();
  const seed = hashSeed(`${isoDate}:${contentId}:${m}:${locale}:copy`);
  const recent = recentCopyKeys(recentEntries);

  const headline = pickAvoiding(listFor(HEADLINE_VARIANTS, m, locale), seed + 3, recent.headlines, (h) => h.text);
  const cta = pickAvoiding(listFor(CTA_VARIANTS, m, locale), seed + 11, recent.ctas, (c) => c.text);
  const post = pickAvoiding(listFor(POST_VARIANTS, m, locale), seed + 29, recent.posts, (p) => p.id);
  const subheadline =
    includeSubheadline || seed % 5 === 0
      ? pickAvoiding(listFor(SUBHEADLINE_VARIANTS, m, locale), seed + 41, [], (s) => s.id)
      : null;

  const facebook = formatPostBody(post);
  const instagram = formatPostBody(post);

  return {
    mode: m,
    locale,
    language: locale,
    headlineVariant: headline?.id || '',
    headline: headline?.text || '',
    ctaVariant: cta?.id || '',
    cta: cta?.text || '',
    subheadlineVariant: subheadline?.id || '',
    subheadline: subheadline?.text || '',
    copyVariant: post?.id || '',
    post,
    facebook,
    instagram,
    campaign: `owned-${String(m).toLowerCase()}-${locale}-${isoDate || 'undated'}`
  };
}

/** Flat headline strings for a mode+locale (image concept fallbacks). */
export function headlineTextsFor(mode, language) {
  return listFor(HEADLINE_VARIANTS, mode, language).map((h) => h.text);
}

export function ctaTextsFor(mode, language) {
  return listFor(CTA_VARIANTS, mode, language).map((c) => c.text);
}

export function assertStrongCopy(text) {
  const sample = String(text || '');
  for (const re of WEAK_COPY_PATTERNS) {
    if (re.test(sample)) return false;
  }
  return true;
}
