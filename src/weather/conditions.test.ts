import { describe, expect, it } from 'vitest';
import { conditionIcon, conditionLabel, HA_CONDITIONS } from './conditions';
import { ICON_ART } from './icon-art';

describe('conditionIcon', () => {
  it('gives every HA condition, day and night, an icon that has artwork', () => {
    for (const c of HA_CONDITIONS) {
      for (const night of [false, true]) {
        const icon = conditionIcon(c, night);
        expect(ICON_ART[icon]?.length, `${c} night=${night} → ${icon}`).toBeGreaterThan(0);
      }
    }
  });

  it('tells the two HA rain intensities apart', () => {
    expect(conditionIcon('rainy')).toBe('rain');
    expect(conditionIcon('pouring')).toBe('heavy-rain');
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
