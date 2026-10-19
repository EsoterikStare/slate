import type { HaCalendarEvent } from '../ha/types';
import { addDays, dayDiff, parseLocalDate, startOfDay } from './dates';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  /** Exclusive. For all-day events, local midnight after the last day. */
  end: Date;
  allDay: boolean;
  /**
   * Calendars this event appears on, in configured order. More than one when
   * the same event was found on several calendars and merged.
   */
  calendars: string[];
}

function parseWhen(w: HaCalendarEvent['start']): { date: Date; allDay: boolean } {
  return 'date' in w
    ? { date: parseLocalDate(w.date), allDay: true }
    : { date: new Date(w.dateTime), allDay: false };
}

export function normalizeEvent(raw: HaCalendarEvent, calendar: string): CalendarEvent {
  const start = parseWhen(raw.start);
  const end = parseWhen(raw.end);
  let endDate = end.date;
  // Guard against feeds that send an all-day event with end == start.
  if (start.allDay && endDate <= start.date) endDate = addDays(start.date, 1);
  const instance = raw.recurrence_id ?? start.date.toISOString();
  return {
    id: `${calendar}|${raw.uid ?? raw.summary}|${instance}`,
    title: raw.summary,
    start: start.date,
    end: endDate,
    allDay: start.allDay,
    calendars: [calendar],
  };
}

/**
 * Collapses the same event appearing on several calendars (e.g. a family event
 * also on a personal calendar) into one, listing every calendar it came from.
 * "Same" means same title (case/whitespace-insensitive), same start and end.
 */
export function mergeDuplicates(events: CalendarEvent[], calendarOrder: string[]): CalendarEvent[] {
  const rank = (c: string) => {
    const i = calendarOrder.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byKey = new Map<string, CalendarEvent>();
  for (const e of events) {
    const key = [e.title.trim().toLowerCase(), e.start.getTime(), e.end.getTime(), e.allDay].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...e, calendars: [...e.calendars] });
    } else {
      for (const c of e.calendars) if (!existing.calendars.includes(c)) existing.calendars.push(c);
    }
  }
  const merged = [...byKey.values()];
  for (const e of merged) e.calendars.sort((a, b) => rank(a) - rank(b));
  return merged;
}

/**
 * Whether an event renders as a spanning bar (all-day, or timed but crossing
 * into another day) rather than a two-line timed entry within one day.
 * A timed event ending exactly at midnight still belongs to its start day.
 */
export function isBar(e: CalendarEvent): boolean {
  if (e.allDay) return true;
  const lastInstant = new Date(e.end.getTime() - 1);
  return dayDiff(e.start, lastInstant) > 0;
}

/** First and last local day (inclusive) an event occupies. */
export function eventDays(e: CalendarEvent): { first: Date; last: Date } {
  const first = startOfDay(e.start);
  const last = e.end.getTime() > e.start.getTime() ? startOfDay(new Date(e.end.getTime() - 1)) : first;
  return { first, last };
}
