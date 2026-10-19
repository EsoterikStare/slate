import type { HourFormat } from '../calendar/format';

export interface ClockParts {
  time: string;
  /** "AM"/"PM" in 12-hour mode, empty in 24-hour mode. */
  meridiem: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(d: Date, hours: HourFormat, seconds = false): ClockParts {
  const s = seconds ? `:${pad(d.getSeconds())}` : '';
  if (hours === 24) return { time: `${pad(d.getHours())}:${pad(d.getMinutes())}${s}`, meridiem: '' };
  return {
    time: `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}${s}`,
    meridiem: d.getHours() < 12 ? 'AM' : 'PM',
  };
}

/** Milliseconds until the next whole minute (or second), for scheduling the next tick. */
export function msUntilNextTick(now: Date, seconds: boolean): number {
  const ms = now.getMilliseconds();
  return seconds ? 1000 - ms : 60_000 - now.getSeconds() * 1000 - ms;
}
