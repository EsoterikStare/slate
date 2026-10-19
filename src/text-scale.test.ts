import { describe, expect, it } from 'vitest';
import { textScaleVars } from './text-scale';

describe('textScaleVars', () => {
  it('maps card and role scales to CSS custom properties', () => {
    expect(textScaleVars(1.1, { event_title: 1.2, event_time: undefined })).toEqual({
      '--wall-card-scale': '1.1',
      '--wall-text-event_title': '1.2',
    });
  });

  it.each([0, -1, Number.NaN])('rejects a non-positive scale (%s)', (bad) => {
    expect(() => textScaleVars(bad, {})).toThrow(/scale/);
    expect(() => textScaleVars(1, { legend: bad })).toThrow(/text\.legend/);
  });
});
