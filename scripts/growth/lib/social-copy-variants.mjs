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

/** Benefit-driven image headlines by mode + locale. */
export const HEADLINE_VARIANTS = {
  TRAIN: {
    en: [
      { id: 'train-hl-stop-alone', text: 'STOP TRAINING ALONE.' },
      { id: 'train-hl-next-partner', text: 'FIND YOUR NEXT WORKOUT PARTNER.' },
      { id: 'train-hl-better-together', text: 'BETTER WORKOUTS START TOGETHER.' },
      { id: 'train-hl-trains-like-you', text: 'FIND SOMEONE WHO TRAINS LIKE YOU.' },
      { id: 'train-hl-partner-here', text: 'YOUR NEXT TRAINING PARTNER IS HERE.' },
      { id: 'train-hl-match-goals', text: 'MATCH YOUR GOALS. TRAIN TOGETHER.' }
    ],
    es: [
      { id: 'train-hl-stop-alone', text: 'DEJA DE ENTRENAR SOLO.' },
      { id: 'train-hl-next-partner', text: 'ENCUENTRA TU PRÓXIMO SOCIO DE ENTRENO.' },
      { id: 'train-hl-better-together', text: 'MEJORES ENTRENOS EMPIEZAN JUNTOS.' },
      { id: 'train-hl-trains-like-you', text: 'ENCUENTRA A QUIEN ENTRENA COMO TÚ.' },
      { id: 'train-hl-partner-here', text: 'TU PRÓXIMO SOCIO DE ENTRENO ESTÁ AQUÍ.' },
      { id: 'train-hl-match-goals', text: 'MISMO OBJETIVO. ENTRENAD JUNTOS.' }
    ],
    ru: [
      { id: 'train-hl-stop-alone', text: 'ХВАТИТ ТРЕНИРОВАТЬСЯ В ОДИНОЧКУ.' },
      { id: 'train-hl-next-partner', text: 'НАЙДИ ПАРТНЁРА ДЛЯ ТРЕНИРОВОК.' },
      { id: 'train-hl-better-together', text: 'ЛУЧШИЕ ТРЕНИРОВКИ — ВМЕСТЕ.' },
      { id: 'train-hl-trains-like-you', text: 'НАЙДИ ТОГО, КТО ТРЕНИРУЕТСЯ КАК ТЫ.' },
      { id: 'train-hl-partner-here', text: 'ТВОЙ ПАРТНЁР ПО ТРЕНИРОВКАМ УЖЕ ЗДЕСЬ.' },
      { id: 'train-hl-match-goals', text: 'ОДИНАКОВЫЕ ЦЕЛИ. ТРЕНИРУЙТЕСЬ ВМЕСТЕ.' }
    ]
  },
  VIBE: {
    en: [
      { id: 'vibe-hl-into-what', text: "FIND PEOPLE WHO ARE INTO WHAT YOU'RE INTO." },
      { id: 'vibe-hl-beyond-feed', text: 'MEET PEOPLE BEYOND THE FEED.' },
      { id: 'vibe-hl-your-people', text: 'YOUR INTERESTS. YOUR PEOPLE.' },
      { id: 'vibe-hl-do-more', text: 'DO MORE WITH PEOPLE WHO GET YOU.' },
      { id: 'vibe-hl-love-doing', text: 'MEET THROUGH WHAT YOU LOVE DOING.' },
      { id: 'vibe-hl-kind-of-people', text: 'FIND YOUR KIND OF PEOPLE.' }
    ],
    es: [
      { id: 'vibe-hl-into-what', text: 'ENCUENTRA GENTE CON TUS MISMOS GUSTOS.' },
      { id: 'vibe-hl-beyond-feed', text: 'CONOCE GENTE FUERA DEL FEED.' },
      { id: 'vibe-hl-your-people', text: 'TUS INTERESES. TU GENTE.' },
      { id: 'vibe-hl-do-more', text: 'HAZ MÁS CON QUIEN TE ENTIENDE.' },
      { id: 'vibe-hl-love-doing', text: 'CONOCE A TRAVÉS DE LO QUE TE GUSTA.' },
      { id: 'vibe-hl-kind-of-people', text: 'ENCUENTRA A TU TIPO DE GENTE.' }
    ],
    ru: [
      { id: 'vibe-hl-into-what', text: 'НАЙДИ ЛЮДЕЙ С ТВОИМИ ИНТЕРЕСАМИ.' },
      { id: 'vibe-hl-beyond-feed', text: 'ЗНАКОМСТВА ЗА ПРЕДЕЛАМИ ЛЕНТЫ.' },
      { id: 'vibe-hl-your-people', text: 'ТВОИ ИНТЕРЕСЫ. ТВОИ ЛЮДИ.' },
      { id: 'vibe-hl-do-more', text: 'ДЕЛАЙ БОЛЬШЕ С ТЕМИ, КТО ТЕБЯ ПОНИМАЕТ.' },
      { id: 'vibe-hl-love-doing', text: 'ЗНАКОМЬТЕСЬ ЧЕРЕЗ ТО, ЧТО ЛЮБИТЕ.' },
      { id: 'vibe-hl-kind-of-people', text: 'НАЙДИ СВОИХ ЛЮДЕЙ.' }
    ]
  },
  DATE: {
    en: [
      { id: 'date-hl-energy', text: 'MEET SOMEONE WHO MATCHES YOUR ENERGY' },
      { id: 'date-hl-tired-swiping', text: 'TIRED OF ENDLESS SWIPING?' },
      { id: 'date-hl-live-like-you', text: 'DATE PEOPLE WHO LIVE LIKE YOU' },
      { id: 'date-hl-shared-interests', text: 'SHARED INTERESTS. REAL CONNECTIONS.' },
      { id: 'date-hl-beyond-profile', text: 'MEET BEYOND THE PROFILE.' },
      { id: 'date-hl-actually-click', text: 'FIND SOMEONE YOU ACTUALLY CLICK WITH.' },
      { id: 'date-hl-less-swiping', text: 'LESS SWIPING. MORE CONNECTION.' },
      { id: 'date-hl-lifestyle', text: 'MEET PEOPLE WHO GET YOUR LIFESTYLE.' }
    ],
    es: [
      { id: 'date-hl-energy', text: 'CONOCE A ALGUIEN QUE COMBINE CON TU ENERGÍA' },
      { id: 'date-hl-tired-swiping', text: '¿CANSADO DE DESLIZAR SIN PARAR?' },
      { id: 'date-hl-live-like-you', text: 'SAL CON GENTE QUE VIVE COMO TÚ' },
      { id: 'date-hl-shared-interests', text: 'INTERESES EN COMÚN. CONEXIONES REALES.' },
      { id: 'date-hl-beyond-profile', text: 'CONOCE MÁS ALLÁ DEL PERFIL.' },
      { id: 'date-hl-actually-click', text: 'ENCUENTRA A ALGUIEN CON QUIEN HAYA CLIC.' },
      { id: 'date-hl-less-swiping', text: 'MENOS SWIPES. MÁS CONEXIÓN.' },
      { id: 'date-hl-lifestyle', text: 'CONOCE GENTE QUE ENTIENDE TU ESTILO DE VIDA.' }
    ],
    ru: [
      { id: 'date-hl-energy', text: 'НАЙДИ КОГО-ТО ПОД ТВОЮ ЭНЕРГИЮ' },
      { id: 'date-hl-tired-swiping', text: 'УСТАЛИ ОТ БЕСКОНЕЧНЫХ СВАЙПОВ?' },
      { id: 'date-hl-live-like-you', text: 'ЗНАКОМЬТЕСЬ С ТЕМИ, КТО ЖИВЁТ КАК ВЫ' },
      { id: 'date-hl-shared-interests', text: 'ОБЩИЕ ИНТЕРЕСЫ. НАСТОЯЩИЕ СВЯЗИ.' },
      { id: 'date-hl-beyond-profile', text: 'ЗНАКОМСТВА ЗА ПРЕДЕЛАМИ ПРОФИЛЯ.' },
      { id: 'date-hl-actually-click', text: 'НАЙДИ ТОГО, С КЕМ ЕСТЬ КЛИК.' },
      { id: 'date-hl-less-swiping', text: 'МЕНЬШЕ СВАЙПОВ. БОЛЬШЕ ОБЩЕНИЯ.' },
      { id: 'date-hl-lifestyle', text: 'ЗНАКОМЬТЕСЬ С ТЕМИ, КТО ПОНИМАЕТ ТВОЙ СТИЛЬ ЖИЗНИ.' }
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
      }
    ]
  },
  VIBE: {
    en: [
      {
        id: 'vibe-post-not-dating',
        hook: "Making friends shouldn't feel like another dating app.",
        benefit: 'Meet people through the activities and interests you actually enjoy.',
        differentiator: 'VIBE is for plans, events, and shared hobbies — not dating-first unless you pick DATE.',
        ctaLine: 'Find your people on GetTrainMate.',
        disclaimer: 'No guaranteed hangouts. You control who you meet.'
      },
      {
        id: 'vibe-post-beyond-feed',
        hook: 'Tired of scrolling people you never meet?',
        benefit: 'Find your kind of people for concerts, coffee, weekends, and real plans.',
        differentiator: 'Your interests. Your people. TRAIN and DATE stay separate modes.',
        ctaLine: 'Discover people on GetTrainMate (VIBE).',
        disclaimer: 'No guaranteed plans. You decide.'
      },
      {
        id: 'vibe-post-new-city',
        hook: 'New in town — or just out of plans?',
        benefit: 'Connect with people who are into what you are into.',
        differentiator: 'Do more with people who get you.',
        ctaLine: 'Start connecting on GetTrainMate.',
        disclaimer: 'No guaranteed meetups. You control your profile.'
      },
      {
        id: 'vibe-post-love-doing',
        hook: 'Your feed is full. Your weekend is empty.',
        benefit: 'Meet through what you love doing — events, hobbies, and shared energy.',
        differentiator: 'GetTrainMate VIBE — community first.',
        ctaLine: 'Explore VIBE and find your people.',
        disclaimer: 'No guaranteed hangouts. You choose who you talk to.'
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
      }
    ]
  },
  DATE: {
    en: [
      {
        id: 'date-post-swiping',
        hook: 'Tired of endless swiping?',
        benefit: 'Meet active people who share your interests, lifestyle, and energy.',
        differentiator: 'Less swiping. More real connections.',
        ctaLine: 'Find your match on GetTrainMate.',
        disclaimer: 'No guaranteed dates or relationships. You control your profile.'
      },
      {
        id: 'date-post-energy',
        hook: 'Looking for someone who matches your energy?',
        benefit: 'DATE on GetTrainMate is for people who want connection through real interests — not a swipe factory.',
        differentiator: 'Shared lifestyle. Real chemistry. TRAIN and VIBE stay available if dating is not your intent.',
        ctaLine: 'Meet someone who gets how you live.',
        disclaimer: 'No guaranteed dates. You choose who you talk to.'
      },
      {
        id: 'date-post-beyond-profile',
        hook: 'Profiles look the same. Chemistry does not.',
        benefit: 'Meet beyond the profile — through activities, interests, and how you actually live.',
        differentiator: 'Find someone you actually click with.',
        ctaLine: 'Start connecting on GetTrainMate (DATE).',
        disclaimer: 'No guaranteed matches. You control your profile.'
      },
      {
        id: 'date-post-lifestyle',
        hook: 'Want dating that fits your lifestyle?',
        benefit: 'Date people who live like you — active, social, and intentional.',
        differentiator: 'Shared interests. Real connections.',
        ctaLine: 'Discover people on GetTrainMate.',
        disclaimer: 'No guaranteed dates or relationships. You decide.'
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
  return [post.hook, '', post.benefit, '', post.differentiator, '', post.ctaLine, '', post.disclaimer, '', '{{url}}']
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
