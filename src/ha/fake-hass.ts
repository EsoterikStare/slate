// A stand-in for HA's `hass` object for tests and Storybook. It mirrors the
// real calendar endpoint's behaviour (only events overlapping the requested
// range come back; unknown calendars are an error) rather than echoing data.

import type { HaCalendarEvent, HassEntity, HomeAssistant } from './types';

export interface FakeHassOptions {
  calendars?: Record<string, HaCalendarEvent[]>;
  /** Calendars whose requests reject, to simulate an integration being down. */
  failing?: string[];
  timeZone?: string;
}

export interface FakeHass extends HomeAssistant {
  /** Every API path requested, in order. */
  requests: string[];
}

const toDate = (w: HaCalendarEvent['start']) => {
  if ('dateTime' in w) return new Date(w.dateTime);
  const [y, m, d] = w.date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

function entity(entity_id: string, state = 'off'): HassEntity {
  const now = new Date().toISOString();
  return { entity_id, state, attributes: {}, last_changed: now, last_updated: now };
}

export function createFakeHass(opts: FakeHassOptions = {}): FakeHass {
  const calendars = opts.calendars ?? {};
  const requests: string[] = [];
  const states: Record<string, HassEntity> = {};
  for (const id of Object.keys(calendars)) states[id] = entity(id);

  return {
    requests,
    states,
    config: { time_zone: opts.timeZone ?? 'America/Los_Angeles', unit_system: { temperature: '°F' } },
    locale: { language: 'en' },
    async callApi<T>(method: string, path: string): Promise<T> {
      requests.push(path);
      const match = /^calendars\/([^?]+)\?start=([^&]+)&end=(.+)$/.exec(path);
      if (method !== 'GET' || !match) throw new Error(`fake hass: unsupported ${method} ${path}`);
      const [, id, start, end] = match as unknown as [string, string, string, string];
      if (opts.failing?.includes(id) || !(id in calendars)) throw new Error(`fake hass: ${id} unavailable`);
      const from = new Date(decodeURIComponent(start));
      const to = new Date(decodeURIComponent(end));
      return calendars[id]!.filter((e) => toDate(e.start) < to && toDate(e.end) > from) as T;
    },
    connection: {
      async subscribeMessage() {
        return async () => {};
      },
    },
  };
}

/** Returns a new hass object with one entity's state bumped, as HA does on change. */
export function touchEntity<T extends HomeAssistant>(hass: T, entityId: string): T {
  const prev = hass.states[entityId] ?? entity(entityId);
  const updated = { ...prev, last_updated: new Date(Date.parse(prev.last_updated) + 1000).toISOString() };
  return { ...hass, states: { ...hass.states, [entityId]: updated } };
}
