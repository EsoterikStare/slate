// Compact time ranges for ~150px-wide day columns: "11 – 11:50a",
// "6 – 10p", "11:30a – 1p", or 24h "18:30 – 22".

export type HourFormat = 12 | 24;

const DASH = ' – ';

function clock(d: Date, hours: HourFormat): string {
  const m = d.getMinutes();
  const h = hours === 24 ? d.getHours() : d.getHours() % 12 || 12;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
}

const meridiem = (d: Date) => (d.getHours() < 12 ? 'a' : 'p');

export function formatTime(d: Date, hours: HourFormat): string {
  return hours === 24 ? clock(d, 24) : clock(d, 12) + meridiem(d);
}

export function formatTimeRange(start: Date, end: Date, hours: HourFormat): string {
  if (start.getTime() === end.getTime()) return formatTime(start, hours);
  if (hours === 24) return clock(start, 24) + DASH + clock(end, 24);
  // Only repeat a/p when the range crosses noon (or midnight).
  const startPart = meridiem(start) === meridiem(end) ? clock(start, 12) : formatTime(start, 12);
  return startPart + DASH + formatTime(end, 12);
}
