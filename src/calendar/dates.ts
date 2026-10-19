// Local-calendar-day arithmetic. Everything works on local midnights and
// steps with setDate() rather than adding 24h of milliseconds, so DST
// transitions (23h/25h days) never shift a date.

export type FirstDay = 'sunday' | 'monday';

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Whole calendar days from `a` to `b` (both reduced to local midnight). */
export function dayDiff(a: Date, b: Date): number {
  // Rounding absorbs the ±1h a DST transition adds between two midnights.
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export function sameDay(a: Date, b: Date): boolean {
  return dayDiff(a, b) === 0;
}

/** Parses an all-day `YYYY-MM-DD` as local midnight (not UTC, which `new Date(str)` does). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * The grid of days the calendar shows: `weeks` rows of 7 local midnights, the
 * first row being the week that contains `today`.
 */
export function buildWeeks(today: Date, firstDay: FirstDay, weeks: number): Date[][] {
  const offset = (today.getDay() - (firstDay === 'monday' ? 1 : 0) + 7) % 7;
  const start = addDays(startOfDay(today), -offset);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  );
}
