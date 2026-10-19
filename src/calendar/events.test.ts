import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from './events';
import { eventDays, isBar, mergeDuplicates, normalizeEvent } from './events';

const timed = (title: string, start: Date, end: Date, cal = 'calendar.a'): CalendarEvent => ({
  id: `${cal}|${title}|${start.toISOString()}`,
  title,
  start,
  end,
  allDay: false,
  calendars: [cal],
});

describe('normalizeEvent', () => {
  it('reads all-day dates as local days with an exclusive end', () => {
    const e = normalizeEvent(
      { summary: 'Trip', start: { date: '2026-10-20' }, end: { date: '2026-10-22' } },
      'calendar.family',
    );
    expect(e.allDay).toBe(true);
    expect(e.start).toEqual(new Date(2026, 9, 20));
    expect(e.end).toEqual(new Date(2026, 9, 22));
    expect(e.calendars).toEqual(['calendar.family']);
  });

  it('repairs an all-day event whose end is not after its start', () => {
    const e = normalizeEvent(
      { summary: 'Holiday', start: { date: '2026-10-20' }, end: { date: '2026-10-20' } },
      'calendar.a',
    );
    expect(e.end).toEqual(new Date(2026, 9, 21));
  });

  it('parses timed events with their offset', () => {
    const e = normalizeEvent(
      {
        summary: 'Dentist',
        start: { dateTime: '2026-10-21T15:30:00-07:00' },
        end: { dateTime: '2026-10-21T16:30:00-07:00' },
      },
      'calendar.a',
    );
    expect(e.allDay).toBe(false);
    expect(e.start.toISOString()).toBe('2026-10-21T22:30:00.000Z');
  });

  it('gives each instance of a recurring event a distinct id', () => {
    const base = { summary: 'Standup', uid: 'abc', end: { dateTime: '2026-10-21T09:15:00-07:00' } };
    const a = normalizeEvent({ ...base, start: { dateTime: '2026-10-21T09:00:00-07:00' } }, 'c');
    const b = normalizeEvent({ ...base, start: { dateTime: '2026-10-22T09:00:00-07:00' } }, 'c');
    expect(a.id).not.toBe(b.id);
  });
});

describe('mergeDuplicates', () => {
  const s = new Date(2026, 9, 21, 18);
  const e = new Date(2026, 9, 21, 20);

  it('merges the same event from several calendars, in configured calendar order', () => {
    const merged = mergeDuplicates(
      [timed('Game night', s, e, 'calendar.alex'), timed('game night ', s, e, 'calendar.family')],
      ['calendar.family', 'calendar.alex'],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.calendars).toEqual(['calendar.family', 'calendar.alex']);
  });

  it('keeps events apart when the times differ', () => {
    const merged = mergeDuplicates(
      [timed('Soccer', s, e, 'calendar.a'), timed('Soccer', s, new Date(2026, 9, 21, 21), 'calendar.b')],
      [],
    );
    expect(merged).toHaveLength(2);
  });

  it('does not list a calendar twice when it holds the same event twice', () => {
    const merged = mergeDuplicates([timed('X', s, e), timed('X', s, e)], []);
    expect(merged[0]!.calendars).toEqual(['calendar.a']);
  });

  it('does not mutate its input', () => {
    const input = [timed('X', s, e, 'calendar.a'), timed('X', s, e, 'calendar.b')];
    mergeDuplicates(input, []);
    expect(input[0]!.calendars).toEqual(['calendar.a']);
  });
});

describe('isBar / eventDays', () => {
  it('treats a timed event ending exactly at midnight as single-day', () => {
    const e = timed('Late', new Date(2026, 9, 21, 22), new Date(2026, 9, 22, 0));
    expect(isBar(e)).toBe(false);
    expect(eventDays(e).last).toEqual(new Date(2026, 9, 21));
  });

  it('treats a timed event past midnight as a bar spanning both days', () => {
    const e = timed('Overnight', new Date(2026, 9, 21, 22), new Date(2026, 9, 22, 1));
    expect(isBar(e)).toBe(true);
    expect(eventDays(e)).toEqual({ first: new Date(2026, 9, 21), last: new Date(2026, 9, 22) });
  });

  it('gives an all-day event its inclusive last day', () => {
    const e = { ...timed('Trip', new Date(2026, 9, 20), new Date(2026, 9, 23)), allDay: true };
    expect(isBar(e)).toBe(true);
    expect(eventDays(e).last).toEqual(new Date(2026, 9, 22));
  });
});
