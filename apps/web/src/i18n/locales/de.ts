import { en } from './en';
import { eventHubDe } from './partials/eventHub.de';

export const de = {
  ...en,
  event_hub: { ...en.event_hub, ...eventHubDe },
};
