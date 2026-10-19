// A stand-in for HA's `hass` object for tests and Storybook. It mirrors the
// real behaviour rather than echoing data: the calendar endpoint returns only
// events overlapping the requested range, and unknown calendars or weather
// entities without a daily forecast are errors, as in HA.

import type { ForecastEntry } from '../weather/forecast';
import type { HaCalendarEvent, HassEntity, HomeAssistant } from './types';

export interface FakeHassOptions {
  calendars?: Record<string, HaCalendarEvent[]>;
  /** Extra entities (weather.*, sun.sun, …) as state + attributes. */
  entities?: Record<string, { state: string; attributes?: Record<string, unknown> }>;
  /** Daily forecasts served to `weather/subscribe_forecast`, keyed by entity. */
  forecasts?: Record<string, ForecastEntry[]>;
  /** Calendars whose requests reject, to simulate an integration being down. */
  failing?: string[];
  timeZone?: string;
}

export interface FakeHass extends HomeAssistant {
  /** Every API path requested, in order. */
  requests: string[];
  /** Every subscription opened, and whether it has been unsubscribed since. */
  subscriptions: { message: Record<string, unknown>; active: boolean }[];
  /** Pushes a new forecast to open subscriptions for `entity`, as HA does on update. */
  pushForecast(entity: string, forecast: ForecastEntry[]): void;
}

const toDate = (w: HaCalendarEvent['start']) => {
  if ('dateTime' in w) return new Date(w.dateTime);
  const [y, m, d] = w.date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

function entity(entity_id: string, state = 'off', attributes: Record<string, unknown> = {}): HassEntity {
  const now = new Date().toISOString();
  return { entity_id, state, attributes, last_changed: now, last_updated: now };
}

export function createFakeHass(opts: FakeHassOptions = {}): FakeHass {
  const calendars = opts.calendars ?? {};
  const requests: string[] = [];
  const states: Record<string, HassEntity> = {};
  for (const id of Object.keys(calendars)) states[id] = entity(id);
  for (const [id, e] of Object.entries(opts.entities ?? {})) states[id] = entity(id, e.state, e.attributes);

  const subscriptions: FakeHass['subscriptions'] = [];
  const listeners: { entity: string; callback: (m: unknown) => void; sub: FakeHass['subscriptions'][number] }[] = [];

  return {
    requests,
    subscriptions,
    pushForecast(entityId, forecast) {
      for (const l of listeners) if (l.entity === entityId && l.sub.active) l.callback({ type: 'daily', forecast });
    },
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
      async subscribeMessage<T>(callback: (m: T) => void, message: Record<string, unknown>) {
        if (message.type !== 'weather/subscribe_forecast') throw new Error(`fake hass: unsupported ${message.type}`);
        const id = message.entity_id as string;
        const forecast = opts.forecasts?.[id];
        // HA rejects the subscription for entities without that forecast type.
        if (!forecast || message.forecast_type !== 'daily') throw new Error(`fake hass: no daily forecast for ${id}`);
        const sub = { message, active: true };
        subscriptions.push(sub);
        listeners.push({ entity: id, callback: callback as (m: unknown) => void, sub });
        queueMicrotask(() => callback({ type: 'daily', forecast } as T));
        return async () => {
          sub.active = false;
        };
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
