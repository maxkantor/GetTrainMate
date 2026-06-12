import { useEffect, useState } from 'react';

function parseKickoff(matchDate: string, matchTime?: string): number | null {
  const time = matchTime?.trim() || '00:00';
  const iso = `${matchDate}T${time.length === 5 ? `${time}:00` : time}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function useMatchCountdown(matchDate: string, matchTime?: string): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const kickoff = parseKickoff(matchDate, matchTime);
    if (kickoff == null) {
      setLabel('');
      return;
    }
    const update = () => {
      const diff = kickoff - Date.now();
      if (diff <= 0) {
        setLabel('In progress');
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
