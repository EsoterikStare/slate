import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WallCalendarConfig } from '../calendar/config';
import { createFakeHass, touchEntity } from '../ha/fake-hass';
import type { HaCalendarEvent } from '../ha/types';
import './wall-calendar';
import type { WallCalendar } from './wall-calendar';

// "Now" is Wednesday 2026-10-21 12:00; with Sunday-first weeks the grid is
// Oct 18 – Nov 7 and Wednesday is column 3 of row 0.
const NOW = new Date(2026, 9, 21, 12, 0);

const at = (d: number, h: number, m = 0) => ({ dateTime: new Date(2026, 9, d, h, m).toISOString() });
const ev = (summary: string, start: HaCalendarEvent['start'], end: HaCalendarEvent['end']): HaCalendarEvent => ({
  summary,
  start,
  end,
});

const config = (extra: Partial<WallCalendarConfig> = {}): WallCalendarConfig => ({
  type: 'custom:wall-calendar',
  calendars: [
    { entity: 'calendar.alex', name: 'Alex', color: 'dodgerblue' },
    { entity: 'calendar.family', name: 'Family', color: 'gold' },
  ],
  ...extra,
});

let mounted: WallCalendar[] = [];

async function mount(
  calendars: Record<string, HaCalendarEvent[]>,
  extra: Partial<WallCalendarConfig> = {},
  setup?: (el: WallCalendar) => void,
) {
  const hass = createFakeHass({ calendars: { 'calendar.alex': [], 'calendar.family': [], ...calendars } });
  const el = document.createElement('wall-calendar');
  el.setConfig(config(extra));
  setup?.(el);
  el.hass = hass;
  document.body.append(el);
  mounted.push(el);
  await el.settled();
  return { el, hass };
}

const $$ = (el: WallCalendar, sel: string) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(sel)];
const text = (n: Element | undefined) => n?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** The `.day` cell (timed events) for a given row and column. */
const dayCell = (el: WallCalendar, row: number, col: number) =>
  $$(el, '.rows > .row')[row]!.querySelectorAll('.day')[col] as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  for (const el of mounted) el.remove();
  mounted = [];
  vi.useRealTimers();
});

describe('wall-calendar', () => {
  it('renders the legend and timed events in their day, with compact times', async () => {
    const { el } = await mount({ 'calendar.alex': [ev('Dentist', at(22, 15, 30), at(22, 16, 30))] });
    expect($$(el, '.legend .entry').map(text)).toEqual(['Alex', 'Family']);
    const thursday = dayCell(el, 0, 4);
    expect(text(thursday.querySelector('.time')!)).toBe('3:30 – 4:30p');
    expect(text(thursday.querySelector('.title')!)).toBe('Dentist');
  });

  it('asks HA for exactly the visible three weeks', async () => {
    const { hass } = await mount({});
    const [path] = hass.requests;
    const params = new URLSearchParams(path!.split('?')[1]);
    expect(new Date(params.get('start')!)).toEqual(new Date(2026, 9, 18));
    expect(new Date(params.get('end')!)).toEqual(new Date(2026, 10, 8));
  });

  it('shows weekday names on the first row only, and real names by default', async () => {
    const { el } = await mount({});
    const rows = $$(el, '.rows > .row');
    expect(rows).toHaveLength(3);
    expect([...rows[0]!.querySelectorAll('.weekday')].map(text)).toEqual([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
    expect(rows[1]!.querySelectorAll('.weekday')).toHaveLength(0);
  });

  it('can use Today/Tomorrow when relative_day_names is on', async () => {
    const { el } = await mount({}, { relative_day_names: true });
    const labels = $$(el, '.rows > .row')[0]!.querySelectorAll('.weekday');
    expect(text(labels[3])).toBe('Today');
    expect(text(labels[4])).toBe('Tomorrow');
    expect(text(labels[5])).toBe('Friday');
  });

  it('starts weeks on Monday when configured', async () => {
    const { el } = await mount({}, { first_day: 'monday' });
    expect(text($$(el, '.rows > .row')[0]!.querySelector('.weekday')!)).toBe('Monday');
  });

  it('marks today and dims the days before it', async () => {
    const { el } = await mount({});
    const heads = [...$$(el, '.rows > .row')[0]!.querySelectorAll('.head')];
    expect(heads.findIndex((h) => h.querySelector('.num.today'))).toBe(3);
    expect(heads.map((h) => h.classList.contains('past'))).toEqual([true, true, true, false, false, false, false]);
  });

  it('dims events that have ended by default, and hides them with past_events: hide', async () => {
    const calendars = {
      'calendar.alex': [ev('Standup', at(21, 9), at(21, 10)), ev('Lunch', at(21, 12, 30), at(21, 13))],
    };
    const dimmed = await mount(calendars);
    const events = [...dayCell(dimmed.el, 0, 3).querySelectorAll('.event')];
    expect(events.map((e) => [text(e.querySelector('.title')!), e.classList.contains('ended')])).toEqual([
      ['Standup', true],
      ['Lunch', false],
    ]);

    const hidden = await mount(calendars, { past_events: 'hide' });
    expect([...dayCell(hidden.el, 0, 3).querySelectorAll('.title')].map(text)).toEqual(['Lunch']);
  });

  it('shows an event found on two calendars once, striped in both colors', async () => {
    const gameNight = ev('Game night', at(19, 18), at(19, 22));
    const { el } = await mount({ 'calendar.alex': [gameNight], 'calendar.family': [gameNight] });
    const events = dayCell(el, 0, 1).querySelectorAll('.event');
    expect(events).toHaveLength(1);
    const accent = (events[0] as HTMLElement).style.getPropertyValue('--accent');
    expect(accent).toContain('dodgerblue');
    expect(accent).toContain('gold');
  });

  it('draws a multi-day event as one bar per row it crosses', async () => {
    const trip = ev('Camping trip', { date: '2026-10-23' }, { date: '2026-10-27' }); // Fri – Mon
    const { el } = await mount({ 'calendar.family': [trip] });
    const rows = $$(el, '.rows > .row');
    const bar0 = rows[0]!.querySelector('.bar-slot') as HTMLElement;
    const bar1 = rows[1]!.querySelector('.bar-slot') as HTMLElement;
    expect(bar0.style.gridColumn).toBe('6 / 8');
    expect(bar0.querySelector('.bar')!.classList.contains('cont-after')).toBe(true);
    expect(bar1.style.gridColumn).toBe('1 / 3');
    expect(bar1.querySelector('.bar')!.classList.contains('cont-before')).toBe(true);
  });

  it('collapses the furthest week first when given too little height', async () => {
    const busy = (d: number) => [9, 10, 11, 12].map((h) => ev(`E${d}-${h}`, at(d, h), at(d, h + 1)));
    const calendars = { 'calendar.alex': [...busy(22), ...busy(29), ...busy(30 + 5)] };
    const metrics = { firstHeader: 30, header: 20, bar: 10, event: 20, more: 10, rowGap: 0, chrome: 40 };
    // Fully expanded: 40 chrome + (30+80) + (20+80) + (20+80) = 350. Give it 340.
    const { el } = await mount(calendars, {}, (c) => {
      c.metrics = metrics;
      c.availableHeight = 340;
    });
    const more = (row: number) => $$(el, '.rows > .row')[row]!.querySelectorAll('.more').length;
    expect([more(0), more(1), more(2)]).toEqual([0, 0, 1]);
    expect(text($$(el, '.rows > .row')[2]!.querySelector('.more')!)).toBe('+1 more');
  });

  it('announces its uncollapsed height even while squeezed', async () => {
    const busy = (d: number) => [9, 10, 11, 12].map((h) => ev(`E${d}-${h}`, at(d, h), at(d, h + 1)));
    const metrics = { firstHeader: 30, header: 20, bar: 10, event: 20, more: 10, rowGap: 0, chrome: 40 };
    const heights: number[] = [];
    const listener = (e: Event) => heights.push((e as CustomEvent<number>).detail);
    document.addEventListener('wall-natural-height', listener);
    const { el } = await mount({ 'calendar.alex': busy(22) }, {}, (c) => {
      c.metrics = metrics;
      c.availableHeight = 100;
    });
    // 40 chrome + (30 + 4×20) + 20 + 20, regardless of the 100px it was given.
    expect(el.naturalHeight).toBe(190);
    expect(heights.at(-1)).toBe(190);
    document.removeEventListener('wall-natural-height', listener);
  });

  it('refetches when a calendar entity changes, but not on unrelated updates', async () => {
    const { el, hass } = await mount({});
    const before = hass.requests.length;

    el.hass = { ...hass, states: { ...hass.states, 'light.kitchen': hass.states['calendar.alex']! } };
    await el.settled();
    expect(hass.requests.length).toBe(before);

    el.hass = touchEntity(hass, 'calendar.family');
    await el.settled();
    expect(hass.requests.length).toBe(before + 2);
  });

  it('strikes a calendar through in the legend when it fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hass = createFakeHass({ calendars: { 'calendar.alex': [] } }); // family missing → errors
    const el = document.createElement('wall-calendar');
    el.setConfig(config());
    el.hass = hass;
    document.body.append(el);
    mounted.push(el);
    await el.settled();
    expect($$(el, '.legend .entry.failed').map(text)).toEqual(['Family']);
    warn.mockRestore();
  });
});
