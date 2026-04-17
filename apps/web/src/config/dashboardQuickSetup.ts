import type { AvailabilitySlot } from '@/services/profileService';

/** One-tap training picks → canonical PROFILE_SPORTS tags */
export const DASHBOARD_TRAINING_OPTIONS = [
  { id: 'gym', label: 'Gym', tag: 'Gym' },
  { id: 'running', label: 'Running', tag: 'Running' },
  { id: 'crossfit', label: 'CrossFit', tag: 'CrossFit' },
  { id: 'hyrox', label: 'HYROX', tag: 'Hyrox' },
] as const;

export const DASHBOARD_LEVEL_OPTIONS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
] as const;

export type DashboardTimeId = 'morning' | 'afternoon' | 'evening';

export const DASHBOARD_TIME_OPTIONS: { id: DashboardTimeId; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

/** Map quick-setup time to a valid availability slot (all days + time window). */
export function dashboardTimeToAvailabilitySlot(period: DashboardTimeId): AvailabilitySlot {
  switch (period) {
    case 'morning':
      return {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        timeStart: '06:00',
        timeEnd: '11:00',
      };
    case 'afternoon':
      return {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        timeStart: '12:00',
        timeEnd: '17:00',
      };
    case 'evening':
    default:
      return {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        timeStart: '17:00',
        timeEnd: '21:00',
      };
  }
}
