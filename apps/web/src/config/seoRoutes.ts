import { absoluteUrl } from '@/config/site';

export type RouteSeo = {
  title: string;
  description: string;
  /** Canonical path (pathname), e.g. /pricing */
  canonicalPath: string;
  noindex: boolean;
  ogTitle?: string;
  ogDescription?: string;
};

const BRAND = 'GetTrainMate';

const PUBLIC: Record<string, Omit<RouteSeo, 'canonicalPath'> & { canonicalPath?: string }> = {
  '/': {
    title: `${BRAND} | Train, Vibe, or Date`,
    description:
      'Train, vibe, or date with active people worldwide. Choose your intent, swipe to match, then chat and meet — fitness-first, modern, and safe.',
    noindex: false,
  },
  '/pricing': {
    title: `Pricing & Credits | ${BRAND}`,
    description:
      'Credit packs to unlock chats, AI insights, and boosts. Simple pricing — buy credits when you need them.',
    noindex: false,
  },
  '/about': {
    title: `About Us | ${BRAND}`,
    description:
      'GetTrainMate helps active people connect worldwide — for training, social vibes, or dating — with flexible modes and safety-first design.',
    noindex: false,
  },
  '/faq': {
    title: `FAQ | ${BRAND}`,
    description:
      'Answers about matching, credits, TRAIN/VIBE/DATE modes, safety, and how GetTrainMate works.',
    noindex: false,
  },
  '/contact': {
    title: `Contact | ${BRAND}`,
    description: 'Contact the GetTrainMate team for support, partnerships, or feedback.',
    noindex: false,
  },
  '/gear': {
    title: `Gear & Equipment | ${BRAND}`,
    description: 'Training gear and equipment ideas for runners, lifters, and outdoor athletes.',
    noindex: false,
  },
  '/platform': {
    title: `Platform | ${BRAND}`,
    description: 'How GetTrainMate works — matching, credits, chat, events, and intent (Train/Vibe/Date).',
    noindex: false,
  },
  '/privacy': {
    title: `Privacy Policy | ${BRAND}`,
    description: 'How GetTrainMate collects, uses, and protects your information.',
    noindex: false,
  },
  '/terms': {
    title: `Terms of Service | ${BRAND}`,
    description: 'Terms of use for the GetTrainMate service.',
    noindex: false,
  },
  '/forgot-password': {
    title: `Reset Password | ${BRAND}`,
    description: 'Reset your GetTrainMate password using the verification code sent to your email.',
    noindex: false,
  },
};

const AUTH_PATHS = new Set(['/login', '/signup', '/verify-email', '/admin/login']);

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '') return '/';
  const p = pathname.split('?')[0].split('#')[0];
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

function eventLabelFromPath(path: string): string {
  const slug = decodeURIComponent(path.split('/').filter(Boolean).at(1) ?? '').trim();
  if (!slug) return 'Sports Event';
  if (slug === 'world-cup-2026') return 'World Cup 2026';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (/^\d+$/.test(lower)) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(' ');
}

export function getRouteSeo(pathname: string): RouteSeo {
  const path = normalizePath(pathname);

  const base = (partial: Omit<RouteSeo, 'canonicalPath'> & { canonicalPath: string }): RouteSeo => ({
    ...partial,
    ogTitle: partial.ogTitle ?? partial.title,
    ogDescription: partial.ogDescription ?? partial.description,
  });

  if (PUBLIC[path]) {
    const p = PUBLIC[path];
    return base({
      title: p.title,
      description: p.description,
      canonicalPath: p.canonicalPath ?? path,
      noindex: p.noindex,
      ogTitle: p.ogTitle,
      ogDescription: p.ogDescription,
    });
  }

  if (path.startsWith('/events/')) {
    const eventLabel = eventLabelFromPath(path);
    return base({
      title: `${eventLabel} on ${BRAND}`,
      description:
        'Find fans, training partners, watch parties, sports meetups, and real connections around featured events on GetTrainMate.',
      canonicalPath: path,
      noindex: false,
      ogTitle: `${eventLabel} on ${BRAND}`,
      ogDescription:
        'Do not watch alone. Meet fans nearby, connect around the event, and start free on GetTrainMate.',
    });
  }

  if (path.startsWith('/admin')) {
    return base({
      title: `Admin | ${BRAND}`,
      description: 'GetTrainMate admin.',
      canonicalPath: path,
      noindex: true,
    });
  }

  if (path.startsWith('/app')) {
    return base({
      title: `App | ${BRAND}`,
      description: 'Your GetTrainMate dashboard — discover, matches, chat, and profile.',
      canonicalPath: path,
      noindex: true,
    });
  }

  if (path.startsWith('/onboarding')) {
    return base({
      title: `Onboarding | ${BRAND}`,
      description: 'Complete your GetTrainMate profile.',
      canonicalPath: path,
      noindex: true,
    });
  }

  if (path.startsWith('/billing')) {
    return base({
      title: `Billing | ${BRAND}`,
      description: 'Payment confirmation.',
      canonicalPath: path,
      noindex: true,
    });
  }

  if (AUTH_PATHS.has(path)) {
    return base({
      title: path.includes('signup') ? `Sign up | ${BRAND}` : path.includes('login') ? `Log in | ${BRAND}` : `Account | ${BRAND}`,
      description: 'Sign in or create your GetTrainMate account.',
      canonicalPath: path,
      noindex: false,
    });
  }

  return base({
    title: `Page not found | ${BRAND}`,
    description: 'The page you are looking for does not exist.',
    canonicalPath: path,
    noindex: true,
  });
}

export function canonicalHrefForPath(canonicalPath: string): string {
  return absoluteUrl(canonicalPath);
}
