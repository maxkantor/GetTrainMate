/** Stored in profile.eventsInterestTypes (ids). */
export const EVENT_INTEREST_OPTIONS = [
  { id: 'gym_session', label: 'Gym session' },
  { id: 'running_group', label: 'Running group' },
  { id: 'hyrox_hybrid', label: 'HYROX / Hybrid race training' },
  { id: 'yoga_recovery', label: 'Yoga / Recovery' },
  { id: 'social_meetup', label: 'Social fitness meetup' },
] as const;

export type EventInterestId = (typeof EVENT_INTEREST_OPTIONS)[number]['id'];
