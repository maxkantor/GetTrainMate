/** Dispatched when the user chooses Chat in the app header (including while already on Chat). */
export const CHAT_NAV_SCROLL_TOP_EVENT = 'gettrainmate:chat-nav-scroll-top';

export function requestChatNavScrollTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  window.dispatchEvent(new Event(CHAT_NAV_SCROLL_TOP_EVENT));
}
