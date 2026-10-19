import { dayDiff } from '../calendar/dates';

/** One entry of HA's daily forecast (`weather/subscribe_forecast`, type daily). */
export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation_probability?: number;
  precipitation?: number;
}

export type TempUnit = '°F' | '°C';

export function convertTemp(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value;
  return to === '°C' ? ((value - 32) * 5) / 9 : (value * 9) / 5 + 32;
}

/** Rounded, unit-converted temperature for display; "–" when missing. */
export function displayTemp(value: number | undefined, from: TempUnit, to: TempUnit): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '–';
  return `${Math.round(convertTemp(value, from, to))}°`;
}

/**
 * Splits a daily forecast into today's entry (for the current-conditions
 * high/low) and the next `days` days after today for the strip. Entries are
 * matched by local calendar day, since providers differ on whether the
 * first entry is today, and on what time of day its timestamp carries.
 */
export function splitForecast(
  forecast: ForecastEntry[],
  now: Date,
  days: number,
): { today?: ForecastEntry; upcoming: ForecastEntry[] } {
  const withOffset = forecast.map((f) => ({ f, offset: dayDiff(now, new Date(f.datetime)) }));
  return {
    today: withOffset.find((x) => x.offset === 0)?.f,
    upcoming: withOffset
      .filter((x) => x.offset > 0)
      .sort((a, b) => a.offset - b.offset)
      .slice(0, Math.max(0, days))
      .map((x) => x.f),
  };
}
