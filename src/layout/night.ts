/** Parses "HH:MM" (24h) to minutes after midnight. */
export function parseTimeOfDay(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  const h = m ? Number(m[1]) : NaN;
  const min = m ? Number(m[2]) : NaN;
  if (!m || h > 23 || min > 59) throw new Error(`"${s}" is not a time of day like "22:00"`);
  return h * 60 + min;
}

/**
 * Whether `now` falls in the [start, end) window, which may wrap past
 * midnight ("22:00"–"06:00"). Equal start and end means never.
 */
export function inWindow(now: Date, start: string, end: string): boolean {
  const t = now.getHours() * 60 + now.getMinutes();
  const s = parseTimeOfDay(start);
  const e = parseTimeOfDay(end);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}
