import { describe, expect, it } from 'vitest';
import { ICON_ART } from '../art';
import { resolveIcon } from '../describe';
import { HA_CONDITIONS, haDescription } from './home-assistant';

const icon = (condition: string, night = false) => resolveIcon(haDescription(condition, night));

describe('haDescription', () => {
  it('gives every HA condition, day and night, an icon that has artwork', () => {
    for (const c of HA_CONDITIONS) {
      for (const night of [false, true]) {
        expect(ICON_ART[icon(c, night)]?.length, `${c} night=${night}`).toBeGreaterThan(0);
      }
    }
  });

  it('tells the two HA rain intensities apart', () => {
    expect(icon('rainy')).toBe('rain');
    expect(icon('pouring')).toBe('heavy-rain');
  });

  it('uses moon variants at night', () => {
    expect(icon('sunny', true)).toBe('clear-night');
    expect(icon('clear-night')).toBe('clear-night');
    expect(icon('partlycloudy', true)).toBe('partly-cloudy-night');
    expect(icon('partlycloudy')).toBe('partly-cloudy-day');
  });

  it('shows "not available" for conditions HA might add later', () => {
    expect(icon('volcanic-ash')).toBe('not-available');
  });
});
