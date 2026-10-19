import { describe, expect, it } from 'vitest';
import { createFakeHass } from '../ha/fake-hass';
import { fetchEvents } from './fetch';

const range = [new Date(2026, 9, 18), new Date(2026, 10, 8)] as const;
const gameNight = {
  summary: 'Game night',
  start: { dateTime: '2026-10-19T18:00:00-07:00' },
  end: { dateTime: '2026-10-19T22:00:00-07:00' },
};

describe('fetchEvents', () => {
  it('requests the grid range from each calendar', async () => {
    const hass = createFakeHass({ calendars: { 'calendar.a': [], 'calendar.b': [] } });
    await fetchEvents(hass, ['calendar.a', 'calendar.b'], ...range);
    expect(hass.requests).toEqual([
      `calendars/calendar.a?start=${encodeURIComponent(range[0].toISOString())}&end=${encodeURIComponent(range[1].toISOString())}`,
      `calendars/calendar.b?start=${encodeURIComponent(range[0].toISOString())}&end=${encodeURIComponent(range[1].toISOString())}`,
    ]);
  });

  it('merges the same event found on two calendars', async () => {
    const hass = createFakeHass({ calendars: { 'calendar.alex': [gameNight], 'calendar.family': [gameNight] } });
    const { events } = await fetchEvents(hass, ['calendar.family', 'calendar.alex'], ...range);
    expect(events).toHaveLength(1);
    expect(events[0]!.calendars).toEqual(['calendar.family', 'calendar.alex']);
  });

  it('keeps other calendars when one fails, and reports the failure', async () => {
    const hass = createFakeHass({
      calendars: { 'calendar.ok': [gameNight], 'calendar.down': [gameNight] },
      failing: ['calendar.down'],
    });
    const result = await fetchEvents(hass, ['calendar.ok', 'calendar.down'], ...range);
    expect(result.events.map((e) => e.calendars)).toEqual([['calendar.ok']]);
    expect(result.failed).toEqual(['calendar.down']);
  });
});
