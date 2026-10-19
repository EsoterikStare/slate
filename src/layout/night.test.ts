import { describe, expect, it } from 'vitest';
import { inWindow, parseTimeOfDay } from './night';

const at = (h: number, m = 0) => new Date(2026, 9, 18, h, m);

describe('inWindow', () => {
  it('handles a window that wraps past midnight', () => {
    expect(inWindow(at(21, 59), '22:00', '06:00')).toBe(false);
    expect(inWindow(at(22, 0), '22:00', '06:00')).toBe(true);
    expect(inWindow(at(3), '22:00', '06:00')).toBe(true);
    expect(inWindow(at(5, 59), '22:00', '06:00')).toBe(true);
    expect(inWindow(at(6, 0), '22:00', '06:00')).toBe(false);
  });

  it('handles a same-day window', () => {
    expect(inWindow(at(13), '12:30', '14:00')).toBe(true);
    expect(inWindow(at(14), '12:30', '14:00')).toBe(false);
  });

  it('treats equal start and end as never', () => {
    expect(inWindow(at(3), '00:00', '00:00')).toBe(false);
  });
});

describe('parseTimeOfDay', () => {
  it.each(['24:00', '7pm', '12:60', ''])('rejects %j', (bad) => {
    expect(() => parseTimeOfDay(bad)).toThrow(/time of day/);
  });

  it('accepts single-digit hours', () => {
    expect(parseTimeOfDay('6:30')).toBe(390);
  });
});
