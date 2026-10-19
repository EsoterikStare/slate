import { describe, expect, it } from 'vitest';
import { displayTemp, splitForecast } from './forecast';

const now = new Date(2026, 9, 18, 10);
const entry = (d: number, h = 12) => ({ datetime: new Date(2026, 9, d, h).toISOString(), temperature: d });

describe('splitForecast', () => {
  it('separates today from the following days', () => {
    const { today, upcoming } = splitForecast([entry(18), entry(19), entry(20), entry(21)], now, 2);
    expect(today?.temperature).toBe(18);
    expect(upcoming.map((f) => f.temperature)).toEqual([19, 20]);
  });

  it('handles providers whose forecast starts tomorrow', () => {
    const { today, upcoming } = splitForecast([entry(19), entry(20)], now, 5);
    expect(today).toBeUndefined();
    expect(upcoming.map((f) => f.temperature)).toEqual([19, 20]);
  });

  it('matches by local day even when timestamps sit at UTC midnight', () => {
    // 2026-10-19T00:00Z is still Oct 18 in Los Angeles.
    const { today } = splitForecast([{ datetime: '2026-10-19T00:00:00Z', temperature: 1 }], now, 5);
    expect(today?.temperature).toBe(1);
  });

  it('drops days already past (a stale forecast after midnight)', () => {
    const { upcoming } = splitForecast([entry(17), entry(18), entry(19)], now, 5);
    expect(upcoming.map((f) => f.temperature)).toEqual([19]);
  });
});

describe('displayTemp', () => {
  it('converts and rounds', () => {
    expect(displayTemp(72, '°F', '°F')).toBe('72°');
    expect(displayTemp(72, '°F', '°C')).toBe('22°');
    expect(displayTemp(22.2, '°C', '°F')).toBe('72°');
  });

  it('shows a dash for missing values', () => {
    expect(displayTemp(undefined, '°F', '°F')).toBe('–');
  });
});
