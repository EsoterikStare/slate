import type { HaCalendarEvent, HomeAssistant } from '../ha/types';
import type { CalendarEvent } from './events';
import { mergeDuplicates, normalizeEvent } from './events';

export interface FetchResult {
  events: CalendarEvent[];
  /** Calendars whose request failed; their events are missing from `events`. */
  failed: string[];
}

/**
 * Fetches events from every calendar for [start, end) through HA's calendar
 * REST endpoint, then merges duplicates across calendars. One failing
 * calendar doesn't take the others down with it.
 */
export async function fetchEvents(
  hass: Pick<HomeAssistant, 'callApi'>,
  calendars: string[],
  start: Date,
  end: Date,
): Promise<FetchResult> {
  const query = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  const results = await Promise.allSettled(
    calendars.map((entity) => hass.callApi<HaCalendarEvent[]>('GET', `calendars/${entity}?${query}`)),
  );
  const events: CalendarEvent[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    const entity = calendars[i]!;
    if (r.status === 'fulfilled') events.push(...r.value.map((e) => normalizeEvent(e, entity)));
    else failed.push(entity);
  });
  return { events: mergeDuplicates(events, calendars), failed };
}
