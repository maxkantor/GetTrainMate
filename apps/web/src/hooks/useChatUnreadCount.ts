import { useEffect, useState } from 'react';
import { getChatUnreadTotal, subscribeChatUnread } from '@/utils/chatUnreadStore';

export function useChatUnreadCount() {
  const [n, setN] = useState(() => getChatUnreadTotal());
  useEffect(() => subscribeChatUnread(() => setN(getChatUnreadTotal())), []);
  return n;
}
