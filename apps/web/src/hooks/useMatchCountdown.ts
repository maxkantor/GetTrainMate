import { useEffect, useState } from 'react';
import { parseKickoffUtc } from '@/utils/eventMatchUtils';

export const MATCH_COUNTDOWN_IN_PROGRESS = 'In progress';

export function useMatchCountdown(matchDate: string, matchTime?: string): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const kickoff = parseKickoffUtc(matchDate, matchTime);
    if (kickoff == null) {
      setLabel('');
      return;
    }
    const update = () => {
      const diff = kickoff - Date.now();
      if (diff <= 0) {
        setLabel(MATCH_COUNTDOWN_IN_PROGRESS);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setLabel(`${d}d ${h}h ${m}m`);
      else if (h > 0) setLabel(`${h}h ${m}m ${s}s`);
      else setLabel(`${m}m ${s}s`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => clearInterval(id);
  }, [matchDate, matchTime]);

  return label;
}
