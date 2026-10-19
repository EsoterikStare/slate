import { describe, expect, it } from 'vitest';
import { buildWeeks, dayDiff, parseLocalDate } from './dates';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('buildWeeks', () => {
  // 2026-10-21 is a Wednesday.
  const wed = new Date(2026, 9, 21, 15, 30);

  it('starts the first row on the Sunday of the current week', () => {
    const weeks = buildWeeks(wed, 'sunday', 3);
    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => ymd(w[0]!))).toEqual(['2026-10-18', '2026-10-25', '2026-11-01']);
    expect(weeks[0]!.map(ymd)).toEqual([
      '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
    ]);
  });

  it('starts the first row on the Monday of the current week', () => {
    expect(ymd(buildWeeks(wed, 'monday', 1)[0]![0]!)).toBe('2026-10-19');
  });

  it('puts a Sunday at the end of a Monday-first week, not the start of the next', () => {
    const sun = new Date(2026, 9, 25);
    expect(ymd(buildWeeks(sun, 'monday', 1)[0]![0]!)).toBe('2026-10-19');
    expect(ymd(buildWeeks(sun, 'sunday', 1)[0]![0]!)).toBe('2026-10-25');
  });

  it('keeps every cell at local midnight across a DST change', () => {
    // US DST ends 2026-11-01; a naive +24h step would land on 23:00 the day before.
    const cells = buildWeeks(new Date(2026, 9, 28), 'sunday', 2).flat();
    for (const c of cells) expect(c.getHours()).toBe(0);
    expect(new Set(cells.map(ymd)).size).toBe(14);
  });
});

describe('dayDiff', () => {
  it('counts calendar days, ignoring time of day', () => {
    expect(dayDiff(new Date(2026, 9, 21, 23, 59), new Date(2026, 9, 22, 0, 1))).toBe(1);
    expect(dayDiff(new Date(2026, 9, 22, 0, 1), new Date(2026, 9, 21, 23, 59))).toBe(-1);
  });
});

describe('parseLocalDate', () => {
  it('parses as local midnight rather than UTC', () => {
    const d = parseLocalDate('2026-10-21');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 21, 0]);
  });
});
