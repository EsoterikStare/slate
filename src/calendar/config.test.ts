import { describe, expect, it } from 'vitest';
import { resolveConfig } from './config';

const base = { type: 'custom:slate-calendar' };

describe('resolveConfig', () => {
  it('fills defaults from the plan', () => {
    const c = resolveConfig({ ...base, calendars: ['calendar.alex'] });
    expect(c).toMatchObject({
      weeks: 3,
      firstDay: 'sunday',
      timeFormat: 12,
      minEventsPerDay: 2,
      pastEvents: 'dim',
      relativeDayNames: false,
      showLegend: true,
      titleLines: 2,
      monthOnFirst: true,
    });
  });

  it('accepts bare entity strings and derives a name and color', () => {
    const c = resolveConfig({ ...base, calendars: ['calendar.kids', 'calendar.school'] });
    expect(c.calendars[0]).toEqual({ entity: 'calendar.kids', name: 'Kids', color: 'dodgerblue' });
    expect(c.calendars[1]!.color).not.toBe(c.calendars[0]!.color);
  });

  it('keeps names and colors that were given', () => {
    const c = resolveConfig({ ...base, calendars: [{ entity: 'calendar.a', name: 'Alex', color: 'tomato' }] });
    expect(c.calendars[0]).toEqual({ entity: 'calendar.a', name: 'Alex', color: 'tomato' });
  });

  it.each([
    [{ calendars: [] }, /at least one/],
    [{ calendars: ['sensor.nope'] }, /not a calendar/],
    [{ calendars: ['calendar.a'], weeks: 0 }, /weeks/],
    [{ calendars: ['calendar.a'], weeks: 2.5 }, /weeks/],
    [{ calendars: ['calendar.a'], first_day: 'friday' }, /first_day/],
    [{ calendars: ['calendar.a'], title_lines: 0 }, /title_lines/],
  ])('rejects %j', (bad, message) => {
    expect(() => resolveConfig({ ...base, ...(bad as object) } as never)).toThrow(message);
  });
});
