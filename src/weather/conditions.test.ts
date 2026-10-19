import { describe, expect, it } from 'vitest';
import { conditionIcon, conditionLabel, HA_CONDITIONS } from './conditions';
import { ICONS } from './icons';

describe('conditionIcon', () => {
  it('gives every HA condition, day and night, an icon that is actually bundled', () => {
    for (const c of HA_CONDITIONS) {
      for (const night of [false, true]) {
        const icon = conditionIcon(c, night);
        expect(ICONS[icon], `${c} night=${night} → ${icon}`).toMatch(/^<svg/);
      }
    }
  });

  it('uses moon variants at night', () => {
    expect(conditionIcon('sunny', true)).toBe('clear-night');
    expect(conditionIcon('partlycloudy', true)).toBe('partly-cloudy-night');
    expect(conditionIcon('partlycloudy', false)).toBe('partly-cloudy-day');
  });

  it('falls back for conditions HA might add later', () => {
    expect(conditionIcon('volcanic-ash')).toBe('not-available');
    expect(conditionLabel('volcanic-ash')).toBe('volcanic-ash');
  });
});
