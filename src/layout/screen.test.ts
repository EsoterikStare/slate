import { describe, expect, it } from 'vitest';
import { planScreen } from './screen';

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
