import type { EventHubSnapshot } from '@/services/sportsEventLayerService';

export const WC_TABS = [
  'overview',
  'groups',
  'matches',
  'predictions',
  'leaderboard',
  'fans',
  'my-picks',
] as const;

export type WcTab = (typeof WC_TABS)[number];

export function parseWcTab(hash: string): WcTab {
  const raw = hash.replace(/^#/, '').trim().toLowerCase();
  if (WC_TABS.includes(raw as WcTab)) return raw as WcTab;
  return 'overview';
}

export interface WcHubProps {
  eventId: string;
  hub: EventHubSnapshot;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  onTabChange: (tab: WcTab) => void;
  onFindFans: (teamId: string) => void;
  onFindNearby: (matchId: string) => void;
  onTeamPage: (teamId: string) => void;
}
