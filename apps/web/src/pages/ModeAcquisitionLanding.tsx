import React, { useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { useI18n } from '@/hooks/useI18n';
import { trackEvent } from '@/utils/analytics';
import { captureAcquisitionFromSearch, mergeAndPersistAcquisition } from '@/utils/acquisitionAttribution';

export type ModeLandingCopy = {
  path: string;
  mode: 'TRAIN' | 'VIBE' | 'DATE';
  eyebrow: string;
  headline: string;
  subhead: string;
  bullets: string[];
  afterJoin: string;
  cta: string;
  signupQuery: string;
  freeLine: string;
};

export const MODE_LANDINGS: Record<string, ModeLandingCopy> = {
  TRAIN: {
    path: '/workout-partner',
    mode: 'TRAIN',
    eyebrow: 'TRAIN mode',
    headline: 'Find people who actually want to train.',
    subhead:
      'Gym sessions, runs, pickleball, HYROX, cycling — match with workout partners who share your pace and schedule.',
    bullets: [
      'Filter for training intent — not dating-first results',
      'Set your city, open Discover, and start connecting',
      'Works in any supported city worldwide',
    ],
    afterJoin: 'After signup: pick TRAIN → set location → complete profile → Discover.',
    cta: 'Join free — find training partners',
    signupQuery: 'mode=TRAIN&src=workout-partner',
    freeLine: 'Free to create an account. Credits unlock chats when you are ready.',
  },
  VIBE: {
    path: '/meet-people',
    mode: 'VIBE',
    eyebrow: 'VIBE mode',
    headline: 'Meet active people you actually click with.',
    subhead:
      'New in town, weekend plans, events, coffee, concerts — find friends for real-life hangouts, not endless scrolling.',
    bullets: [
      'Social discovery for friendship and shared interests',
      'Separate from DATE unless you choose that mode',
      'Localized by your city and language',
    ],
    afterJoin: 'After signup: pick VIBE → set location → complete profile → Discover.',
    cta: 'Join free — meet people',
    signupQuery: 'mode=VIBE&src=meet-people',
    freeLine: 'Free to create an account. Credits unlock chats when you are ready.',
  },
  DATE: {
    path: '/active-dating',
    mode: 'DATE',
    eyebrow: 'DATE mode',
    headline: 'Meet someone who wants to do more than swipe.',
    subhead:
      'Activity-based dating for people who bond over sports, events, and shared interests — optional, never guaranteed.',
    bullets: [
      'Romantic discovery alongside real activities',
      'You only see DATE when you select it',
      'TRAIN and VIBE stay separate if that is what you want',
    ],
    afterJoin: 'After signup: pick DATE → set location → complete profile → Discover.',
    cta: 'Join free — start dating',
    signupQuery: 'mode=DATE&src=active-dating',
    freeLine: 'Free to create an account. Credits unlock chats when you are ready.',
  },
};

const LOCALIZED_MODE_LANDINGS: Record<string, Record<string, Partial<ModeLandingCopy>>> = {
  es: {
    TRAIN: {
      eyebrow: 'Modo TRAIN',
      headline: 'Encuentra a personas que realmente quieren entrenar.',
      subhead:
        'Gimnasio, running, deportes, HYROX, ciclismo — conecta con compañeros de entreno que comparten tu ritmo y horario.',
      bullets: [
        'Filtra por objetivos de entrenamiento — sin mezclar con citas',
        'Elige tu ciudad, abre Discover y empieza a conectar',
        'Disponible en cualquier ciudad del mundo',
      ],
      afterJoin: 'Tras registrarte: elige TRAIN → pon tu ubicación → completa tu perfil → Discover.',
      cta: 'Únete gratis — encuentra compañeros de entreno',
      freeLine: 'Crear tu cuenta es gratis. Los créditos desbloquean chats cuando estés listo.',
    },
    VIBE: {
      eyebrow: 'Modo VIBE',
      headline: 'Conoce gente activa con la que realmente conectes.',
      subhead:
        'Nuevo en la ciudad, planes de fin de semana, eventos, café, conciertos — amigos para planes reales, no para deslizar sin parar.',
      bullets: [
        'Descubrimiento social para amistad e intereses compartidos',
        'Separado de DATE a menos que elijas ese modo',
        'Adaptado a tu ciudad y tu idioma',
      ],
      afterJoin: 'Tras registrarte: elige VIBE → pon tu ubicación → completa tu perfil → Discover.',
      cta: 'Únete gratis — conoce gente',
      freeLine: 'Crear tu cuenta es gratis. Los créditos desbloquean chats cuando estés listo.',
    },
    DATE: {
      eyebrow: 'Modo DATE',
      headline: 'Conoce a alguien que quiera algo más que solo deslizar.',
      subhead:
        'Citas basadas en actividades para personas que conectan a través del deporte, eventos e intereses compartidos — opcional, nunca garantizado.',
      bullets: [
        'Descubrimiento romántico a través de actividades reales',
        'Solo ves DATE cuando tú lo activas',
        'TRAIN y VIBE se mantienen separados si así lo prefieres',
      ],
      afterJoin: 'Tras registrarte: elige DATE → pon tu ubicación → completa tu perfil → Discover.',
      cta: 'Únete gratis — empieza a conectar',
      freeLine: 'Crear tu cuenta es gratis. Los créditos desbloquean chats cuando estés listo.',
    },
  },
  ru: {
    TRAIN: {
      eyebrow: 'Режим TRAIN',
      headline: 'Найдите людей, которые реально хотят тренироваться.',
      subhead:
        'Зал, бег, спорт, HYROX, велоспорт — тренируйтесь вместе с теми, кто разделяет ваш темп и график.',
      bullets: [
        'Фокус на тренировках — без смешивания со знакомствами',
        'Укажите ваш город, откройте Discover и начните общаться',
        'Работает в любом городе мира',
      ],
      afterJoin: 'После регистрации: выберите TRAIN → укажите город → заполните профиль → Discover.',
      cta: 'Присоединиться бесплатно — найти TrainMates',
      freeLine: 'Создание аккаунта бесплатно. Кредиты открывают чаты, когда вы готовы.',
    },
    VIBE: {
      eyebrow: 'Режим VIBE',
      headline: 'Знакомьтесь с активными людьми, с кем есть общий вайб.',
      subhead:
        'Новый город, планы на выходные, мероприятия, кофе, концерты — друзья для реальных встреч, а не бесконечных лент.',
      bullets: [
        'Социальные знакомства для дружбы и общих интересов',
        'Отдельно от DATE, если вам это не нужно',
        'С учетом вашего города и языка',
      ],
      afterJoin: 'После регистрации: выберите VIBE → укажите город → заполните профиль → Discover.',
      cta: 'Присоединиться бесплатно — найти людей',
      freeLine: 'Создание аккаунта бесплатно. Кредиты открывают чаты, когда вы готовы.',
    },
    DATE: {
      eyebrow: 'Режим DATE',
      headline: 'Знакомьтесь с теми, кто хочет больше, чем просто свайпы.',
      subhead:
        'Свидания через активности для тех, кто сближается через спорт, события и общие интересы — совпадения не гарантируются.',
      bullets: [
        'Романтические знакомства вокруг реальных занятий',
        'Вы видите DATE только тогда, когда сами выбираете этот режим',
        'TRAIN и VIBE остаются отдельно, если вы этого хотите',
      ],
      afterJoin: 'После регистрации: выберите DATE → укажите город → заполните профиль → Discover.',
      cta: 'Присоединиться бесплатно — свидания',
      freeLine: 'Создание аккаунта бесплатно. Кредиты открывают чаты, когда вы готовы.',
    },
  },
};

const OTHER_MODES: Record<string, { label: string; path: string }[]> = {
  TRAIN: [
    { label: 'VIBE — meet people', path: '/meet-people' },
    { label: 'DATE — active dating', path: '/active-dating' },
  ],
  VIBE: [
    { label: 'TRAIN — workout partners', path: '/workout-partner' },
    { label: 'DATE — active dating', path: '/active-dating' },
  ],
  DATE: [
    { label: 'TRAIN — workout partners', path: '/workout-partner' },
    { label: 'VIBE — meet people', path: '/meet-people' },
  ],
};

export const ModeAcquisitionLanding: React.FC<{ copy: ModeLandingCopy }> = ({ copy }) => {
  const location = useLocation();
  const { locale } = useI18n();

  const activeCopy = useMemo(() => {
    const loc = LOCALIZED_MODE_LANDINGS[locale]?.[copy.mode];
    if (!loc) return copy;
    return { ...copy, ...loc };
  }, [copy, locale]);

  useEffect(() => {
    mergeAndPersistAcquisition(captureAcquisitionFromSearch(location.search));
    trackEvent('landing_page_view', {
      source_page: copy.path,
      segment: copy.mode,
      acquisition_source: copy.path.replace('/', ''),
      mode: copy.mode,
      ...(locale ? { lang: locale } : {}),
    });
  }, [copy.path, copy.mode, location.search, locale]);

  const signupTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.set('mode', copy.mode);
    if (!params.has('src')) {
      params.set('src', copy.path.replace('/', ''));
    }
    return `/signup?${params.toString()}`;
  }, [location.search, copy]);

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ letterSpacing: 1.2, color: 'primary.main', fontWeight: 700 }}
        >
          {activeCopy.eyebrow}
        </Typography>
        <Typography
          variant="h2"
          component="h1"
          sx={{ mt: 1, fontSize: { xs: '1.85rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15 }}
        >
          {activeCopy.headline}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          {activeCopy.subhead}
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <Button
            component={RouterLink}
            to={signupTo}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: copy.path,
                segment: copy.mode,
                mode: copy.mode,
                acquisition_source: copy.path.replace('/', ''),
              })
            }
          >
            {activeCopy.cta}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, lineHeight: 1.5 }}>
            {activeCopy.freeLine}
          </Typography>
        </Box>

        <Box component="ul" sx={{ mt: 3.5, pl: 2.25, m: 0, maxWidth: 560 }}>
          {activeCopy.bullets.map((item) => (
            <Box
              component="li"
              key={item}
              sx={{ color: 'text.secondary', py: 0.4, lineHeight: 1.6, fontSize: '0.95rem' }}
            >
              {item}
            </Box>
          ))}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, maxWidth: 560, lineHeight: 1.6 }}>
          {activeCopy.afterJoin}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, lineHeight: 1.7 }}>
          Looking for something else?{' '}
          {OTHER_MODES[copy.mode].map((link, i) => (
            <React.Fragment key={link.path}>
              {i > 0 ? ' · ' : null}
              <RouterLink to={link.path} style={{ color: 'inherit' }}>
                {link.label}
              </RouterLink>
            </React.Fragment>
          ))}
        </Typography>
      </Container>
    </PageShell>
  );
};

export const WorkoutPartnerPage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.TRAIN} />;
export const MeetPeoplePage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.VIBE} />;
export const ActiveDatingPage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.DATE} />;
