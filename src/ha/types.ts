// The slice of Home Assistant's frontend `hass` object these cards use. HA
// doesn't publish its frontend types as a package, so we declare only what we
// touch; anything wider would be guesswork that silently drifts from HA.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  /** False while the frontend's websocket to HA is down. */
  connected?: boolean;
  config: {
    time_zone: string;
    unit_system: { temperature: string };
  };
  locale: { language: string };
  callApi<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T>;
  connection: {
    subscribeMessage<T>(
      callback: (message: T) => void,
      subscribeMessage: Record<string, unknown>,
    ): Promise<() => Promise<void>>;
  };
}

/** One event as returned by HA's `GET /api/calendars/<entity_id>`. */
export interface HaCalendarEvent {
  summary: string;
  start: { dateTime: string } | { date: string };
  end: { dateTime: string } | { date: string };
  description?: string | null;
  location?: string | null;
  uid?: string | null;
  recurrence_id?: string | null;
}
