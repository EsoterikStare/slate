import { describe, expect, it } from 'vitest';
import { conditionLabel } from './conditions';

describe('conditionLabel', () => {
  it('shows conditions HA might add later as they are', () => {
    expect(conditionLabel('pouring')).toBe('Heavy rain');
    expect(conditionLabel('volcanic-ash')).toBe('volcanic-ash');
  });
});
