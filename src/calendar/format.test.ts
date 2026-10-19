import { describe, expect, it } from 'vitest';
import { formatTimeRange } from './format';

const at = (h: number, m = 0) => new Date(2026, 9, 21, h, m);

describe('formatTimeRange, 12h', () => {
  it.each([
    [at(11), at(11, 50), '11 – 11:50a'],
    [at(18), at(22), '6 – 10p'],
    [at(11, 30), at(13), '11:30a – 1p'],
    [at(0), at(1), '12 – 1a'],
    [at(12), at(12, 30), '12 – 12:30p'],
    [at(9, 5), at(9, 5), '9:05a'],
  ])('%s → %s', (start, end, expected) => {
    expect(formatTimeRange(start, end, 12)).toBe(expected);
  });

  it('repeats the meridiem when the range wraps past midnight', () => {
    expect(formatTimeRange(at(22), new Date(2026, 9, 22, 1), 12)).toBe('10p – 1a');
  });
});

describe('formatTimeRange, 24h', () => {
  it.each([
    [at(18), at(22), '18 – 22'],
    [at(18, 30), at(22), '18:30 – 22'],
    [at(0), at(0, 45), '0 – 0:45'],
  ])('%s → %s', (start, end, expected) => {
    expect(formatTimeRange(start, end, 24)).toBe(expected);
  });
});
