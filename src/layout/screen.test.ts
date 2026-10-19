import { describe, expect, it } from 'vitest';
import { defaultPlacement, planScreen, rowsHeight } from './screen';

const base = { height: 1900, gap: 20, topFull: 500, topCompact: 300 };

describe('planScreen', () => {
  it('keeps the full top area when the calendar fits beneath it', () => {
    expect(planScreen({ ...base, bottomNatural: 1380 })).toEqual({ collapseTop: false, bottomAvailable: 1380 });
  });

  it('collapses the top area once the whole block would outgrow the screen', () => {
    expect(planScreen({ ...base, bottomNatural: 1381 })).toEqual({ collapseTop: true, bottomAvailable: 1580 });
  });

  it('still hands the calendar the remaining room when even collapsing is not enough', () => {
    // The calendar then collapses its own weeks to fit 1580.
    expect(planScreen({ ...base, bottomNatural: 3000 })).toEqual({ collapseTop: true, bottomAvailable: 1580 });
  });

  it('does not report a collapse when the top area has nothing collapsible', () => {
    expect(planScreen({ ...base, topCompact: 500, bottomNatural: 3000 })).toEqual({
      collapseTop: false,
      bottomAvailable: 1380,
    });
  });

  it('never hands out negative height', () => {
    expect(planScreen({ ...base, height: 100, bottomNatural: 50 }).bottomAvailable).toBe(0);
  });
});

describe('defaultPlacement', () => {
  it('pins a forecast-only row to the top', () => {
    expect(defaultPlacement([{ type: 'custom:wall-weather', entity: 'weather.x', show: 'forecast' }])).toBe('top');
  });

  it('stacks everything else on the calendar', () => {
    expect(defaultPlacement([{ type: 'custom:wall-clock' }, { type: 'custom:wall-weather', show: 'current' }])).toBe('stack');
    expect(defaultPlacement([{ type: 'custom:wall-weather', show: 'both' }])).toBe('stack');
    expect(defaultPlacement([])).toBe('stack');
  });
});

describe('rowsHeight', () => {
  const clock = { height: 300, placement: 'stack' as const, collapsible: false };
  const date = { height: 50, placement: 'stack' as const, collapsible: false };
  const forecast = { height: 200, placement: 'top' as const, collapsible: true };

  it('adds a gap of photo between the top-pinned rows and the stacked ones', () => {
    expect(rowsHeight([clock, forecast], 16, 24, true)).toBe(300 + 200 + 24);
  });

  it('drops that gap once the pinned rows are folded away', () => {
    expect(rowsHeight([clock, forecast], 16, 24, false)).toBe(300);
  });

  it('uses the row gap between rows in the same group', () => {
    expect(rowsHeight([clock, date], 16, 24, true)).toBe(300 + 16 + 50);
    expect(rowsHeight([{ ...clock, placement: 'top' }, { ...date, placement: 'top' }], 16, 24, true)).toBe(366);
  });
});
