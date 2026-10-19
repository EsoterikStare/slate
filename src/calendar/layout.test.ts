import { describe, expect, it } from 'vitest';
import { buildWeeks } from './dates';
import type { CalendarEvent } from './events';
import type { RowMetrics } from './layout';
import { fitCalendar, placeWeek, planRow } from './layout';

// Weeks start Sunday 2026-10-18; days past 31 roll into November (32 = Nov 1).
const day = (d: number, h = 0) => new Date(2026, 9, d, h);
let n = 0;
const timed = (d: number, h: number, title = `t${n++}`): CalendarEvent => ({
  id: title,
  title,
  start: day(d, h),
  end: day(d, h + 1),
  allDay: false,
  calendars: ['c'],
});
const allDay = (from: number, toExclusive: number, title = `a${n++}`): CalendarEvent => ({
  id: title,
  title,
  start: day(from),
  end: day(toExclusive),
  allDay: true,
  calendars: ['c'],
});

const [week1, week2, week3] = buildWeeks(day(21), 'sunday', 3) as [Date[], Date[], Date[]];

const m: RowMetrics = { firstHeader: 30, header: 20, bar: 10, event: 20, more: 10, rowGap: 0 };

describe('placeWeek', () => {
  it('puts timed events in their column, sorted by start', () => {
    const w = placeWeek(week1, [timed(21, 15, 'late'), timed(21, 9, 'early'), timed(18, 9, 'sun')]);
    expect(w.timed[3]!.map((e) => e.title)).toEqual(['early', 'late']);
    expect(w.timed[0]!.map((e) => e.title)).toEqual(['sun']);
    expect(w.bars).toEqual([]);
  });

  it('ignores events outside the week', () => {
    const w = placeWeek(week1, [timed(17, 9), timed(25, 9), allDay(10, 18)]);
    expect(w.timed.flat()).toEqual([]);
    expect(w.bars).toEqual([]);
  });

  it('clips a bar that crosses into the next week and flags the continuation', () => {
    const trip = allDay(23, 27, 'trip'); // Fri 23 – Mon 26
    const [b1] = placeWeek(week1, [trip]).bars;
    const [b2] = placeWeek(week2, [trip]).bars;
    expect(b1).toMatchObject({ startCol: 5, endCol: 6, continuesBefore: false, continuesAfter: true });
    expect(b2).toMatchObject({ startCol: 0, endCol: 1, continuesBefore: true, continuesAfter: false });
  });

  it('stacks overlapping bars in separate lanes and reuses a lane once it is free', () => {
    const w = placeWeek(week1, [allDay(18, 21, 'A'), allDay(19, 20, 'B'), allDay(21, 22, 'C')]);
    const lane = (t: string) => w.bars.find((b) => b.event.title === t)!.lane;
    expect(lane('A')).toBe(0);
    expect(lane('B')).toBe(1);
    expect(lane('C')).toBe(0); // starts after A ends
    expect(w.laneCount).toBe(2);
  });

  it('gives the longer bar the top lane when two start the same day', () => {
    const w = placeWeek(week1, [allDay(19, 20, 'short'), allDay(19, 23, 'long')]);
    expect(w.bars.find((b) => b.event.title === 'long')!.lane).toBe(0);
  });

  it('treats a timed event that crosses midnight as a bar', () => {
    const late: CalendarEvent = { ...timed(21, 22, 'late'), end: day(22, 1) };
    const w = placeWeek(week1, [late]);
    expect(w.timed.flat()).toEqual([]);
    expect(w.bars[0]).toMatchObject({ startCol: 3, endCol: 4 });
  });
});

describe('planRow', () => {
  it('shows everything when uncapped, sized by the busiest day', () => {
    const w = placeWeek(week2, [timed(26, 9), timed(26, 10), timed(26, 11), timed(27, 9)]);
    const r = planRow(w, Infinity, m, false);
    expect(r.visibleTimed[1]).toBe(3);
    expect(r.hidden.every((h) => h === 0)).toBe(true);
    expect(r.height).toBe(m.header + 3 * m.event);
  });

  it('uses the taller weekday header on the first row only', () => {
    const w = placeWeek(week1, []);
    expect(planRow(w, Infinity, m, true).height).toBe(m.firstHeader);
    expect(planRow(w, Infinity, m, false).height).toBe(m.header);
  });

  it('keeps the earliest timed events and counts the rest as hidden', () => {
    const w = placeWeek(week2, [timed(26, 9), timed(26, 10), timed(26, 11), timed(26, 12)]);
    const r = planRow(w, 2, m, false);
    expect(r.visibleTimed[1]).toBe(2);
    expect(r.hidden[1]).toBe(2);
    expect(r.height).toBe(m.header + 2 * m.event + m.more);
  });

  it('spends a day\'s budget on bars before timed events', () => {
    const w = placeWeek(week2, [allDay(26, 27), timed(26, 9), timed(26, 10)]);
    const r = planRow(w, 2, m, false);
    expect(r.visibleLanes).toBe(1);
    expect(r.visibleTimed[1]).toBe(1);
    expect(r.hidden[1]).toBe(1);
  });

  it('does not charge a day for lanes it has no bar in', () => {
    // A bar on Sunday only; Monday's budget should all go to its timed events.
    const w = placeWeek(week2, [allDay(25, 26), timed(26, 9), timed(26, 10)]);
    const r = planRow(w, 2, m, false);
    expect(r.visibleTimed[1]).toBe(2);
    expect(r.hidden[1]).toBe(0);
  });

  it('hides bars in lanes beyond the cap and counts them on every day they cover', () => {
    const w = placeWeek(week2, [allDay(25, 28, 'A'), allDay(25, 28, 'B'), allDay(25, 28, 'C')]);
    const r = planRow(w, 2, m, false);
    expect(r.visibleLanes).toBe(2);
    expect(r.hidden.slice(0, 3)).toEqual([1, 1, 1]);
    expect(r.hidden[3]).toBe(0);
  });
});

describe('fitCalendar', () => {
  // Three rows, each with one 4-event day: natural height = 30+80 + 20+80 + 20+80 = 310.
  const busy = [
    placeWeek(week1, [timed(21, 9), timed(21, 10), timed(21, 11), timed(21, 12)]),
    placeWeek(week2, [timed(28, 9), timed(28, 10), timed(28, 11), timed(28, 12)]),
    placeWeek(week3, [timed(35, 9), timed(35, 10), timed(35, 11), timed(35, 12)]),
  ];

  it('leaves everything expanded when it fits', () => {
    const plan = fitCalendar(busy, m, 310, 2);
    expect(plan.height).toBe(310);
    expect(plan.rows.flatMap((r) => r.hidden).every((h) => h === 0)).toBe(true);
  });

  it('collapses the furthest-future row first', () => {
    // Collapsing row 3 from 4 → 3 events: 80 → 60 + 10 more = 70, saving 10.
    const plan = fitCalendar(busy, m, 300, 2);
    expect(plan.height).toBeLessThanOrEqual(300);
    expect(plan.rows[2]!.hidden.some((h) => h > 0)).toBe(true);
    expect(plan.rows[0]!.hidden.every((h) => h === 0)).toBe(true);
    expect(plan.rows[1]!.hidden.every((h) => h === 0)).toBe(true);
  });

  it('moves on to earlier rows only once later rows reach the minimum', () => {
    // Each row bottoms out at 2 events + more = 50 (saves 30). Need to save 40.
    const plan = fitCalendar(busy, m, 270, 2);
    expect(plan.height).toBeLessThanOrEqual(270);
    expect(Math.max(...plan.rows[2]!.visibleTimed)).toBe(2);
    expect(plan.rows[1]!.hidden.some((h) => h > 0)).toBe(true);
    expect(plan.rows[0]!.hidden.every((h) => h === 0)).toBe(true);
  });

  it('never goes below the minimum per day', () => {
    const plan = fitCalendar(busy, m, 200, 2);
    for (const r of plan.rows) expect(Math.max(...r.visibleTimed)).toBeGreaterThanOrEqual(2);
  });

  it('drops far-future rows when even the minimum does not fit, keeping the current week', () => {
    // At minimum each row is header + 50: 80 + 70 + 70 = 220.
    const plan = fitCalendar(busy, m, 160, 2);
    expect(plan.droppedRows).toBe(1);
    expect(plan.rows).toHaveLength(2);
    expect(plan.height).toBeLessThanOrEqual(160);

    const tiny = fitCalendar(busy, m, 10, 2);
    expect(tiny.rows).toHaveLength(1);
  });

  it('re-expands the remaining rows after dropping one', () => {
    // Three rows at minimum need 220 > 215, so one is dropped — but the two
    // remaining rows fit fully expanded (110 + 100) and must not stay collapsed.
    const plan = fitCalendar(busy, m, 215, 2);
    expect(plan.droppedRows).toBe(1);
    expect(plan.height).toBe(210);
    expect(plan.rows.flatMap((r) => r.hidden).every((h) => h === 0)).toBe(true);
  });

  it('accounts for the gap between rows', () => {
    const quiet = [placeWeek(week1, []), placeWeek(week2, []), placeWeek(week3, [])];
    expect(fitCalendar(quiet, { ...m, rowGap: 8 }, 1000, 2).height).toBe(30 + 20 + 20 + 2 * 8);
  });
});
