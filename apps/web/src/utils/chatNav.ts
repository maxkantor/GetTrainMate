/** Dispatched when the user chooses Chat in the app header (including while already on Chat). */
export const CHAT_NAV_SCROLL_TOP_EVENT = 'gettrainmate:chat-nav-scroll-top';

/** Do not call `window.scrollTo(0)` here — it jumps the whole page upward. Chat listens and scrolls the thread list + messages pane. */
export function requestChatNavScrollTop(): void {
  window.dispatchEvent(new Event(CHAT_NAV_SCROLL_TOP_EVENT));
}
