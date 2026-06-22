import { absoluteUrl } from './site';

export const WC_EVENT_IMAGE_PATH = '/images/event-banner.png';

export const WC_EVENT_DESCRIPTION =
  'FIFA World Cup 2026 — hosted across the United States, Canada, and Mexico. Follow the tournament, make free fan predictions, and connect with supporters on GetTrainMate.';

/** SportsEvent JSON-LD for Google Event rich results (world-cup hub + event landing). */
export function buildWorldCupSportsEventLd(canonicalPath: string): Record<string, unknown> {
  const pageUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(WC_EVENT_IMAGE_PATH);

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'FIFA World Cup 2026',
    description: WC_EVENT_DESCRIPTION,
    sport: 'Soccer',
    startDate: '2026-06-11T00:00:00-05:00',
    endDate: '2026-07-19T23:59:59-05:00',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [imageUrl],
    url: pageUrl,
    location: {
      '@type': 'Place',
      name: 'United States, Canada, Mexico',
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
    organizer: {
      '@type': 'Organization',
      name: 'FIFA',
      url: 'https://www.fifa.com/',
    },
    performer: [
      {
        '@type': 'SportsTeam',
        name: 'FIFA World Cup 2026 national teams',
      },
    ],
    offers: {
      '@type': 'Offer',
      name: 'Free GetTrainMate fan hub',
      url: pageUrl,
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: '2026-01-01T00:00:00Z',
    },
  };
}
