import { describe, expect, it } from 'vitest';
import { formatClock, msUntilNextTick } from './format';

const at = (h: number, m: number, s = 0, ms = 0) => new Date(2026, 9, 18, h, m, s, ms);

describe('formatClock', () => {
  it.each([
    [at(0, 5), { time: '12:05', meridiem: 'AM' }],
    [at(9, 7), { time: '9:07', meridiem: 'AM' }],
    [at(12, 0), { time: '12:00', meridiem: 'PM' }],
    [at(22, 42), { time: '10:42', meridiem: 'PM' }],
  ])('12h %s', (d, expected) => {
    expect(formatClock(d, 12)).toEqual(expected);
  });

  it('pads 24h hours and adds seconds when asked', () => {
    expect(formatClock(at(9, 7, 3), 24)).toEqual({ time: '09:07', meridiem: '' });
    expect(formatClock(at(9, 7, 3), 24, true).time).toBe('09:07:03');
  });
});

describe('msUntilNextTick', () => {
  it('lands exactly on the next minute or second', () => {
    expect(msUntilNextTick(at(9, 7, 45, 250), false)).toBe(14_750);
    expect(msUntilNextTick(at(9, 7, 45, 250), true)).toBe(750);
  });
});
