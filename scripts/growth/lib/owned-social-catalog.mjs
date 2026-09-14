/**
 * GetTrainMate owned-social catalog.
 * Creative policy: strong mode-first messaging, short captions, no doom/negative hooks,
 * no generic feed/scrolling language, no guaranteed outcomes.
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

export function modeForWeekday(weekday) {
  if (weekday === 1 || weekday === 4) return 'TRAIN';
  if (weekday === 2 || weekday === 5 || weekday === 0) return 'VIBE';
  if (weekday === 3 || weekday === 6) return 'DATE';
  return 'TRAIN';
}

export function languageForWeekday(weekday, isoDate = '') {
  const week = isoWeekNumber(isoDate);
  const cycle = week % 3;
  let esDay;
  let ruDay;
  if (cycle === 0) {
    esDay = 2;
    ruDay = 4;
  } else if (cycle === 1) {
    esDay = 3;
    ruDay = 5;
  } else {
    esDay = 4;
    ruDay = 6;
  }
  if (weekday === esDay) return 'es';
  if (weekday === ruDay) return 'ru';
  return 'en';
}

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function isoWeekNumber(isoDate = '') {
  const raw = String(isoDate || '').slice(0, 10);
  const d = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(`${raw}T12:00:00Z`) : new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export const CATALOG = [
  {
    contentId: 'train-en-workout-partner',
    mode: 'TRAIN',
    language: 'en',
    kind: 'acquisition',
    activity: 'workout',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  },
  {
    contentId: 'train-es-socio-entrenamiento',
    mode: 'TRAIN',
    language: 'es',
    kind: 'acquisition',
    activity: 'gym',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  },
  {
    contentId: 'train-ru-trenirovochniy-partner',
    mode: 'TRAIN',
    language: 'ru',
    kind: 'acquisition',
    activity: 'running',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  },
  {
    contentId: 'vibe-en-new-in-town',
    mode: 'VIBE',
    language: 'en',
    kind: 'community',
    activity: 'events',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE
  },
  {
    contentId: 'vibe-es-planes-ciudad',
    mode: 'VIBE',
    language: 'es',
    kind: 'community',
    activity: 'social',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE
  },
  {
    contentId: 'vibe-ru-kompaniya-v-gorode',
    mode: 'VIBE',
    language: 'ru',
    kind: 'community',
    activity: 'friendship',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE
  },
  {
    contentId: 'date-en-active-singles',
    mode: 'DATE',
    language: 'en',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE
  },
  {
    contentId: 'date-en-sf-bay',
    mode: 'DATE',
    language: 'en',
    market: 'San Francisco',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: '/san-francisco',
    imageUrl: IMAGE,
    marketHook: 'Bay Area:'
  },
  {
    contentId: 'date-es-citas-actividad',
    mode: 'DATE',
    language: 'es',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE
  },
  {
    contentId: 'date-ru-po-interesam',
    mode: 'DATE',
    language: 'ru',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE
  },
  {
    contentId: 'train-en-question-consistency',
    mode: 'TRAIN',
    language: 'en',
    kind: 'question',
    activity: 'accountability',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  }
];

const PREMIUM_HEADLINES = {
  TRAIN: {
    en: [
      { headline: 'NEED A WORKOUT PARTNER?', subheadline: 'Start with a workout. See what happens.', caption: 'Gym tonight? Find someone who actually wants to go.\n\n{{url}}' },
      { headline: 'GOOD GAME. DRINKS AFTER?', subheadline: 'Train first. Hang out after.', caption: 'Need a pickleball partner this weekend? Find someone nearby. If you hit it off, grab a drink after.\n\n{{url}}' },
      { headline: 'RUN TOGETHER. COFFEE AFTER?', subheadline: 'The workout brought you together.', caption: 'Running after work? Find someone to join you. Coffee afterward is optional.\n\n{{url}}' },
      { headline: 'FIND SOMEONE WHO CAN KEEP UP.', subheadline: 'Same sport. Same energy.', caption: 'Find someone who likes the same sport. What happens after is up to you.\n\n{{url}}' },
      { headline: 'START WITH A WORKOUT. SEE WHAT HAPPENS.', subheadline: 'Train • Vibe • Date', caption: 'Start with a workout. If the vibe is there, you already have something in common.\n\n{{url}}' },
      { headline: 'START WITH A HIKE. SEE WHAT HAPPENS.', subheadline: 'Activity first. Chemistry optional.', caption: 'Start with a hike. If the vibe is there, you already have something in common.\n\n{{url}}' }
    ],
    es: [
      { headline: '¿NECESITAS COMPAÑERO DE ENTRENO?', subheadline: 'Empieza con un entreno. Mira qué pasa.', caption: '¿Gym esta noche? Encuentra a alguien que de verdad quiera ir.\n\n{{url}}' },
      { headline: 'BUEN PARTIDO. ¿LUEGO UNAS COPAS?', subheadline: 'Primero entrenar. Después quedar.', caption: '¿Buscas pareja de pickleball este finde? Si hay vibe, luego unas copas.\n\n{{url}}' },
      { headline: 'CORRED JUNTOS. ¿CAFÉ DESPUÉS?', subheadline: 'El entreno os juntó.', caption: '¿Salir a correr después del trabajo? Encuentra a alguien. El café es opcional.\n\n{{url}}' }
    ],
    ru: [
      { headline: 'НУЖЕН ПАРТНЁР ПО ТРЕНИРОВКАМ?', subheadline: 'Начните с тренировки. Посмотрите, что будет.', caption: 'Зал сегодня вечером? Найдите человека, который реально хочет идти.\n\n{{url}}' },
      { headline: 'ХОРОШАЯ ИГРА. ПОТОМ НАПИТКИ?', subheadline: 'Сначала тренировка. Потом общение.', caption: 'Нужен партнёр по пиклболу на выходные? Если есть вайб — потом можно и выпить.\n\n{{url}}' },
      { headline: 'БЕГИТЕ ВМЕСТЕ. КОФЕ ПОТОМ?', subheadline: 'Тренировка вас свела.', caption: 'Пробежка после работы? Найдите компанию. Кофе — по желанию.\n\n{{url}}' }
    ]
  },
  VIBE: {
    en: [
      { headline: 'WORK OUT. HANG OUT. MAYBE MORE.', subheadline: 'If you click, keep the vibe going.', caption: 'Gym partner today. Drinks tonight? That\'s between you two.\n\n{{url}}' },
      { headline: 'GOOD WORKOUT. YOUR MOVE.', subheadline: 'Keep hanging out.', caption: 'Training is easier with someone else. Meeting people can be too.\n\n{{url}}' },
      { headline: 'FIND YOUR GAME. FIND YOUR PEOPLE.', subheadline: 'Plans after the workout.', caption: 'Find someone nearby to play. If you click, keep the vibe going.\n\n{{url}}' },
      { headline: 'SAME ENERGY. NOW SAY HI.', subheadline: 'Start with activity. Stay for the vibe.', caption: 'Need someone to ride with? Start here.\n\n{{url}}' }
    ],
    es: [
      { headline: 'ENTRENA. QUEDAD. QUIZÁ MÁS.', subheadline: 'Si hay vibe, seguid.', caption: 'Compañero de gym hoy. ¿Copas esta noche? Eso lo decidís vosotros.\n\n{{url}}' },
      { headline: 'BUEN ENTRENO. TU TURNO.', subheadline: 'Seguid quedando.', caption: 'Entrenar es más fácil con alguien. Conocer gente también.\n\n{{url}}' }
    ],
    ru: [
      { headline: 'ТРЕНИРОВКА. ОБЩЕНИЕ. МОЖЕТ, БОЛЬШЕ.', subheadline: 'Если есть вайб — продолжайте.', caption: 'Партнёр по залу сегодня. Напитки вечером? Это уже между вами.\n\n{{url}}' },
      { headline: 'ХОРОШАЯ ТРЕНИРОВКА. ТВОЙ ХОД.', subheadline: 'Продолжайте общение.', caption: 'Тренироваться легче с кем-то. Знакомиться — тоже.\n\n{{url}}' }
    ]
  },
  DATE: {
    en: [
      { headline: 'START WITH A WORKOUT. SEE WHAT HAPPENS.', subheadline: 'Dating is optional.', caption: 'Start with a workout. See what happens.\n\n{{url}}' },
      { headline: 'NEED A SPOT? MAYBE A DATE?', subheadline: 'Chemistry is up to you.', caption: 'Gym partner today. What happens next is up to you.\n\n{{url}}' },
      { headline: 'TRAIN FIRST. FLIRT LATER.', subheadline: 'Activity first. Chemistry optional.', caption: 'Find someone who can keep up. If there\'s chemistry, you decide what\'s next.\n\n{{url}}' },
      { headline: 'GOOD MATCH. YOUR MOVE.', subheadline: 'You already have something in common.', caption: 'Meet through something active. If the vibe is there, take it further — or don\'t.\n\n{{url}}' }
    ],
    es: [
      { headline: 'EMPIEZA CON UN ENTRENO. MIRA QUÉ PASA.', subheadline: 'La cita es opcional.', caption: 'Empieza con un entreno. Mira qué pasa.\n\n{{url}}' },
      { headline: '¿NECESITAS SPOT? ¿QUIZÁ UNA CITA?', subheadline: 'La química la decidís vosotros.', caption: 'Compañero de gym hoy. Lo que sigue lo decidís vosotros.\n\n{{url}}' }
    ],
    ru: [
      { headline: 'НАЧНИТЕ С ТРЕНИРОВКИ. ПОСМОТРИТЕ, ЧТО БУДЕТ.', subheadline: 'Свидание — по желанию.', caption: 'Начните с тренировки. Посмотрите, что будет.\n\n{{url}}' },
      { headline: 'НУЖНА СТРАХОВКА? МОЖЕТ, СВИДАНИЕ?', subheadline: 'Химию решаете вы.', caption: 'Партнёр по залу сегодня. Что дальше — решаете вы.\n\n{{url}}' }
    ]
  }
};

function premiumCta(mode, language) {
  const lang = String(language || 'en').toLowerCase().slice(0, 2);
  const m = String(mode || 'TRAIN').toUpperCase();
  const byLang = {
    en: { TRAIN: 'FIND YOUR PEOPLE', VIBE: 'KEEP THE VIBE', DATE: 'SEE WHAT HAPPENS' },
    es: { TRAIN: 'ENCUENTRA TU GENTE', VIBE: 'SIGUE EL VIBE', DATE: 'MIRA QUÉ PASA' },
    ru: { TRAIN: 'НАЙДИ СВОИХ', VIBE: 'СОХРАНИ ВАЙБ', DATE: 'ПОСМОТРИ, ЧТО БУДЕТ' }
  };
  const table = byLang[lang] || byLang.en;
  return table[m] || table.TRAIN;
}

function withComplianceFooter(caption, language) {
  const lang = String(language || 'en').toLowerCase().slice(0, 2);
  const footer =
    lang === 'es'
      ? 'GetTrainMate. Sin coincidencias garantizadas — tú decides con quién quedar.'
      : lang === 'ru'
        ? 'GetTrainMate. Совпадения не гарантируем — вы сами решаете, с кем общаться.'
        : 'GetTrainMate. No guaranteed matches — you decide who you meet.';
  const body = String(caption || '').trim();
  if (/GetTrainMate/i.test(body) && /no guaranteed|sin coincidencias|не гарантируем/i.test(body)) {
    return body;
  }
  return `${body}\n\n${footer}`;
}

function premiumCopyFor(item, isoDate = '') {
  const mode = String(item?.mode || 'TRAIN').toUpperCase();
  const language = String(item?.language || 'en').toLowerCase().slice(0, 2);
  const byMode = PREMIUM_HEADLINES[mode] || PREMIUM_HEADLINES.TRAIN;
  const pool = byMode[language] || byMode.en;
  const seed = hashSeed(`${isoDate}:${item?.contentId || mode}:${language}`);
  const copy = pool[seed % pool.length];
  const caption = withComplianceFooter(copy.caption, language);
  return {
    headline: copy.headline,
    subheadline: copy.subheadline,
    cta: premiumCta(mode, language),
    facebook: caption,
    instagram: caption,
    copyVariant: `premium-${mode.toLowerCase()}-${language}-v3-${seed % pool.length}`,
    headlineVariant: `premium-${mode.toLowerCase()}-headline-v3-${seed % pool.length}`,
    ctaVariant: `premium-${mode.toLowerCase()}-cta-v3`,
    locale: language,
    campaign: `owned-${mode.toLowerCase()}-${language}-${String(isoDate || '').replace(/-/g, '')}`
  };
}

function withMarketHook(body, marketHook) {
  if (!marketHook || !body) return body;
  const lines = String(body).split('\n');
  if (!lines[0]) return body;
  lines[0] = `${marketHook} ${lines[0]}`;
  return lines.join('\n');
}

export function resolveOwnedSocialCreative(catalogItem, { isoDate = '' } = {}) {
  const item = catalogItem || CATALOG[0];
  const copyPackage = premiumCopyFor(item, isoDate);
  let facebook = copyPackage.facebook;
  let instagram = copyPackage.instagram;
  if (item.marketHook) {
    facebook = withMarketHook(facebook, item.marketHook);
    instagram = withMarketHook(instagram, item.marketHook);
  }
  return {
    ...item,
    facebook,
    instagram,
    imageHeadline: copyPackage.headline,
    imageSubheadline: copyPackage.subheadline,
    imageCta: copyPackage.cta,
    copyPackage,
    copy_variant: copyPackage.copyVariant,
    headline_variant: copyPackage.headlineVariant,
    cta_variant: copyPackage.ctaVariant,
    locale: copyPackage.locale,
    campaign: copyPackage.campaign
  };
}

export function goCodeForDestination({ mode, landingPath } = {}) {
  const path = String(landingPath || '').replace(/\/$/, '') || '';
  if (path === '/san-francisco') return 'sf';
  if (path === '/meet-people' || String(mode).toUpperCase() === 'VIBE') return 'v';
  if (path === '/active-dating' || String(mode).toUpperCase() === 'DATE') return 'd';
  return 't';
}

export function ownedSocialClickPath({ mode, landingPath } = {}) {
  const path = String(landingPath || '').replace(/\/$/, '');
  if (path === '/san-francisco') return '/san-francisco';
  if (path === '/workout-partner') return '/workout-partner';
  if (path === '/meet-people') return '/meet-people';
  if (path === '/active-dating') return '/active-dating';
  if (path === '/signup') return '/signup';
  const m = String(mode || '').toUpperCase();
  if (m === 'TRAIN') return '/workout-partner';
  if (m === 'VIBE') return '/meet-people';
  if (m === 'DATE') return '/active-dating';
  return '/workout-partner';
}

export function trackedUrl({
  network,
  mode,
  language,
  contentId,
  landingPath,
  isoDate,
  market,
  copyVariant,
  headlineVariant,
  ctaVariant,
  campaign: campaignOverride
} = {}) {
  const path = ownedSocialClickPath({ mode, landingPath });
  const marketSlug = market ? String(market).toLowerCase().replace(/\s+/g, '-') : '';
  const campaign =
    campaignOverride ||
    (marketSlug
      ? `owned-${network}-${String(mode).toLowerCase()}-${language}-${marketSlug}-${isoDate}`
      : `owned-${network}-${String(mode).toLowerCase()}-${language}-${isoDate}`);
  const contentParts = [contentId, copyVariant, headlineVariant, ctaVariant].filter(Boolean);
  const params = new URLSearchParams({
    utm_source: network,
    utm_medium: 'organic',
    utm_campaign: campaign,
    utm_content: contentParts.join('__'),
    mode,
    lang: language,
    src: 'owned_social'
  });
  if (market) params.set('metro', String(market));
  if (copyVariant) params.set('copy_variant', String(copyVariant));
  if (headlineVariant) params.set('headline_variant', String(headlineVariant));
  if (ctaVariant) params.set('cta_variant', String(ctaVariant));
  return `https://gettrainmate.com${path}?${params.toString()}`;
}

export function shortTrackedUrl(opts) {
  const code = goCodeForDestination(opts);
  const full = new URL(trackedUrl(opts));
  return `https://gettrainmate.com/go/${code}?${full.searchParams.toString()}`;
}

export const OWNED_SOCIAL_BIO_URL = 'https://gettrainmate.com/go';

export function renderCopy(template, url) {
  return String(template || '').replaceAll('{{url}}', url);
}

const BIO_LINK_LINES = {
  en: 'Link also in bio → gettrainmate.com/go',
  es: 'Enlace también en la bio → gettrainmate.com/go',
  ru: 'Ссылка также в профиле → gettrainmate.com/go'
};

export function renderFacebookCopy(template, shortUrl) {
  return String(template || '').replaceAll('{{url}}', shortUrl || '').trim();
}

export function renderInstagramCopy(template, shortUrl, { language = 'en' } = {}) {
  const locale = String(language || 'en').toLowerCase().slice(0, 2);
  const body = String(template || '')
    .replaceAll('{{url}}', '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const linkBlock = [
    shortUrl || OWNED_SOCIAL_BIO_URL,
    '',
    BIO_LINK_LINES[locale] || BIO_LINK_LINES.en
  ].join('\n');
  return `${body}\n\n${linkBlock}`;
}

export function selectCatalogItem({
  weekday,
  recentlyUsedIds = [],
  recentLanguages = [],
  preferMode,
  preferLanguage,
  isoDate = ''
} = {}) {
  const mode = preferMode || modeForWeekday(weekday ?? 1);
  let language = preferLanguage || languageForWeekday(weekday ?? 1, isoDate);
  if (!preferLanguage && language !== 'en' && recentLanguages.length && recentLanguages[0] === language) {
    language = 'en';
  }
  const used = new Set(recentlyUsedIds);
  const pool = CATALOG.filter((c) => c.mode === mode);
  let candidates = pool.filter((c) => c.language === language && !used.has(c.contentId));
  if (!candidates.length) candidates = pool.filter((c) => c.language === language);
  if (!candidates.length) candidates = pool.filter((c) => !used.has(c.contentId));
  if (!candidates.length) candidates = pool.slice();
  candidates.sort((a, b) => a.contentId.localeCompare(b.contentId));
  const seed = hashSeed(`${isoDate}:${weekday}:${mode}:${language}`);
  return candidates[seed % candidates.length] || CATALOG[0];
}

export function findCatalogItemByContentId(contentId) {
  return CATALOG.find((c) => c.contentId === contentId) || null;
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

export function alreadyPublishedToday(log = [], isoDate = easternIsoDate()) {
  if (!Array.isArray(log) || !log.length) return false;
  return log.some((entry) => {
    if (entry.status !== 'published') return false;
    if (!entry.facebookPostId && !entry.instagramPostId) return false;
    const entryDate = entry.publishedAtUtc
      ? easternIsoDate(new Date(entry.publishedAtUtc))
      : '';
    const campaignMatch = typeof entry.campaign === 'string' && entry.campaign.includes(isoDate);
    return entryDate === isoDate || campaignMatch;
  });
}
