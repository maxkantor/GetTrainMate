import { en } from './en';
import { eventHubFr } from './partials/eventHub.fr';

export const fr = {
  ...en,
  event_hub: { ...en.event_hub, ...eventHubFr },
};
