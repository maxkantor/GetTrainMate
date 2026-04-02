/** Lightweight store so AppHeader can show chat unread without prop drilling from Chat. */
let totalUnread = 0;
const listeners = new Set<() => void>();

export function setChatUnreadTotal(n: number) {
  totalUnread = Math.max(0, Math.floor(n));
  listeners.forEach((l) => l());
}

export function subscribeChatUnread(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getChatUnreadTotal() {
  return totalUnread;
}
