/**
 * Human-reviewed owned-social copy for Facebook + Instagram.
 * Not raw machine translation. Never promises matches, dates, or outcomes.
 */
export const OWNED_ACCOUNTS = {
  facebook: {
    network: 'facebook',
    url: 'https://www.facebook.com/gettrainmate',
    handle: 'gettrainmate'
  },
  instagram: {
    network: 'instagram',
    url: 'https://www.instagram.com/gettrainmate/',
    handle: '@gettrainmate'
  }
};

export const MODE_LANDINGS = {
  TRAIN: '/workout-partner',
  VIBE: '/meet-people',
  DATE: '/active-dating'
};

const IMAGE = 'https://gettrainmate.com/images/og-image.jpg';

/** Weekday (America/New_York, 0=Sun) → default mode rotation. */
export function modeForWeekday(weekday) {
  if (weekday === 1 || weekday === 4) return 'TRAIN';
  if (weekday === 2 || weekday === 5) return 'VIBE';
  if (weekday === 3) return 'DATE';
  return 'TRAIN';
}

export function languageForWeekday(weekday) {
  if (weekday === 2 || weekday === 5) return 'es';
  if (weekday === 3) return 'ru';
  return 'en';
}

export const CATALOG = [
  {
    contentId: 'train-en-workout-partner',
    mode: 'TRAIN',
    language: 'en',
    kind: 'acquisition',
    activity: 'workout',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE,
    instagram: [
      'Looking for a workout partner — gym, running, pickleball, HYROX, or whatever you actually train?',
      '',
      'GetTrainMate is TRAIN, VIBE, and DATE. Pick TRAIN, set your city, and use Discover.',
      '',
      'No guaranteed matches. You control your profile.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Find a workout partner on GetTrainMate.',
      '',
      'TRAIN is for gyms, running, sports, and accountability — not a dating-only app. Pick TRAIN, set your city, open Discover.',
      '',
      'No guaranteed partners. You choose who you talk to.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'train-es-socio-entrenamiento',
    mode: 'TRAIN',
    language: 'es',
    kind: 'acquisition',
    activity: 'gym',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE,
    instagram: [
      '¿Buscas alguien para entrenar — gym, correr, pádel o un plan constante?',
      '',
      'GetTrainMate tiene TRAIN, VIBE y DATE. Elige TRAIN, pon tu ciudad y entra a Discover.',
      '',
      'Sin coincidencias garantizadas. Tú controlas tu perfil.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Encuentra un socio de entrenamiento en GetTrainMate.',
      '',
      'TRAIN es para entrenar y competir. VIBE y DATE existen en la misma app, pero tú eliges el modo.',
      '',
      'Nadie te promete un match. Tú decides con quién hablar.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'train-ru-trenirovochniy-partner',
    mode: 'TRAIN',
    language: 'ru',
    kind: 'acquisition',
    activity: 'running',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE,
    instagram: [
      'Ищете партнёра для тренировок — зал, бег, HYROX, теннис?',
      '',
      'GetTrainMate — это TRAIN, VIBE и DATE. Выберите TRAIN, укажите город и откройте Discover.',
      '',
      'Совпадения не гарантируем. Профиль контролируете вы.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Найдите партнёра для тренировок в GetTrainMate.',
      '',
      'Режим TRAIN — для спорта и регулярных занятий. VIBE и DATE тоже есть: вы выбираете намерение.',
      '',
      'Мы не обещаем матчи. Вы решаете, с кем писать.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'vibe-en-new-in-town',
    mode: 'VIBE',
    language: 'en',
    kind: 'community',
    activity: 'events',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE,
    instagram: [
      'New in town — or just tired of going to concerts, coffee, and weekends alone?',
      '',
      'VIBE on GetTrainMate is for people, events, and shared interests. Not dating-first unless you pick DATE.',
      '',
      'Set your city. Choose VIBE. No guaranteed hangouts.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Find people to hang out with on GetTrainMate (VIBE).',
      '',
      'Events, coffee, travel, weekend plans, new-in-city friends. TRAIN and DATE are separate modes — you pick.',
      '',
      'No guaranteed plans. You control who you meet.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'vibe-es-planes-ciudad',
    mode: 'VIBE',
    language: 'es',
    kind: 'community',
    activity: 'social',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE,
    instagram: [
      '¿Nuevo en la ciudad o sin planes el fin de semana?',
      '',
      'VIBE en GetTrainMate es para quedar, eventos e intereses en común. DATE es otro modo, si lo quieres.',
      '',
      'Pon tu ciudad. Elige VIBE. Sin planes garantizados.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Conoce gente para planes en GetTrainMate (VIBE).',
      '',
      'Conciertos, café, planes de fin de semana. TRAIN y DATE existen, pero tú eliges el modo.',
      '',
      'Nadie te garantiza un plan. Tú decides.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'vibe-ru-kompaniya-v-gorode',
    mode: 'VIBE',
    language: 'ru',
    kind: 'community',
    activity: 'friendship',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE,
    instagram: [
      'Новый город — или просто хочется компанию на концерт, кофе, выходные?',
      '',
      'VIBE в GetTrainMate — для общения и интересов. DATE — отдельный режим, если он вам нужен.',
      '',
      'Укажите город. Выберите VIBE. Встречи не гарантируем.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Найдите компанию в GetTrainMate (режим VIBE).',
      '',
      'События, интересы, новые в городе. TRAIN и DATE — другие режимы: вы выбираете.',
      '',
      'Мы не обещаем встречи. Вы решаете, с кем общаться.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'date-en-active-singles',
    mode: 'DATE',
    language: 'en',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE,
    instagram: [
      'Want dating through shared activities — training, events, real interests — not a swipe factory?',
      '',
      'DATE is one mode on GetTrainMate. TRAIN and VIBE stay available if that is not what you want.',
      '',
      'No guaranteed dates or relationships. You control your profile.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Meet people through shared interests on GetTrainMate (DATE).',
      '',
      'Activity-based dating is optional. Pick DATE only if that is your intent. TRAIN and VIBE are separate.',
      '',
      'No guaranteed dates. You choose who you talk to.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'date-es-citas-actividad',
    mode: 'DATE',
    language: 'es',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE,
    instagram: [
      '¿Citas a través de planes reales — deporte, eventos, intereses — no una fábrica de swipes?',
      '',
      'DATE es un modo de GetTrainMate. TRAIN y VIBE siguen ahí si no es lo que buscas.',
      '',
      'Sin citas ni relaciones garantizadas. Tú controlas tu perfil.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Conoce gente por intereses en GetTrainMate (DATE).',
      '',
      'Las citas son opcionales. Elige DATE solo si ese es tu objetivo. TRAIN y VIBE son modos distintos.',
      '',
      'Nadie te garantiza una cita. Tú decides.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'date-ru-po-interesam',
    mode: 'DATE',
    language: 'ru',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE,
    instagram: [
      'Знакомства через общие занятия — спорт, события, интересы — а не бесконечный свайп?',
      '',
      'DATE — один из режимов GetTrainMate. TRAIN и VIBE остаются, если это не ваша цель.',
      '',
      'Свидания и отношения не гарантируем. Профиль контролируете вы.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Знакомьтесь через общие интересы в GetTrainMate (режим DATE).',
      '',
      'Свидания — по желанию. Выберите DATE только если это ваше намерение.',
      '',
      'Мы не обещаем свидания. Вы решаете, с кем писать.',
      '',
      '{{url}}'
    ].join('\n')
  },
  {
    contentId: 'train-en-question-consistency',
    mode: 'TRAIN',
    language: 'en',
    kind: 'question',
    activity: 'accountability',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE,
    instagram: [
      'What actually keeps you consistent — a plan, a gym, or another person who shows up?',
      '',
      'If it is a person: TRAIN on GetTrainMate. Pick your city. Discover is opt-in.',
      '',
      'No guaranteed training partners.',
      '',
      '{{url}}'
    ].join('\n'),
    facebook: [
      'Question: gym buddy, run club, or solo forever?',
      '',
      'GetTrainMate TRAIN is for people who want a training partner in their city. VIBE and DATE are other modes.',
      '',
      'No guaranteed training partners.',
      '',
      '{{url}}'
    ].join('\n')
  }
];

export function trackedUrl({ network, mode, language, contentId, landingPath, isoDate }) {
  const path = landingPath || MODE_LANDINGS[mode] || '/';
  const campaign = `owned-${network}-${String(mode).toLowerCase()}-${language}-${isoDate}`;
  const params = new URLSearchParams({
    utm_source: network,
    utm_medium: 'organic',
    utm_campaign: campaign,
    utm_content: contentId,
    mode,
    lang: language,
    src: 'owned_social'
  });
  return `https://gettrainmate.com${path}?${params.toString()}`;
}

export function renderCopy(template, url) {
  return String(template || '').replaceAll('{{url}}', url);
}

/**
 * Pick the next catalog item for a weekday, skipping recently used contentIds.
 */
export function selectCatalogItem({ weekday, recentlyUsedIds = [], preferMode, preferLanguage } = {}) {
  const mode = preferMode || modeForWeekday(weekday ?? 1);
  const language = preferLanguage || languageForWeekday(weekday ?? 1);
  const used = new Set(recentlyUsedIds);
  const pool = CATALOG.filter((c) => c.mode === mode);
  const unusedLang = pool.filter((c) => c.language === language && !used.has(c.contentId));
  if (unusedLang.length) return unusedLang[0];
  const unusedMode = pool.filter((c) => !used.has(c.contentId));
  if (unusedMode.length) return unusedMode[0];
  const unusedAny = CATALOG.filter((c) => !used.has(c.contentId));
  return unusedAny[0] || pool[0] || CATALOG[0];
}

export function easternWeekday(date = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short'
  }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? date.getUTCDay();
}

export function easternIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}
