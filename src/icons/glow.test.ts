import { describe, expect, it } from 'vitest';
import { iconGlowBackground } from './glow';

describe('iconGlowBackground', () => {
  it('is on by default, darkest at the centre and transparent at its radius', () => {
    const css = iconGlowBackground();
    expect(css).toBe(iconGlowBackground(true));
    expect(css).toMatch(/^radial-gradient\(32\.5% 32\.5% at 50% 50%, rgba\(0, 0, 0, 0\.22\) 0%/);
    expect(css).toMatch(/rgba\(0, 0, 0, 0\) 100%\)$/);
  });

  it('takes a radius (fraction of the icon width) and a centre opacity', () => {
    const css = iconGlowBackground({ radius: 0.9, opacity: 0.5 });
    expect(css).toContain('45% 45% at 50% 50%');
    expect(css).toContain('rgba(0, 0, 0, 0.5) 0%');
    expect(css).toContain('rgba(0, 0, 0, 0) 100%');
    // Only one of them given: the other keeps its default.
    expect(iconGlowBackground({ opacity: 0.4 })).toContain('32.5% 32.5%');
  });

  it('can be left out entirely', () => {
    expect(iconGlowBackground(false)).toBe('none');
    expect(iconGlowBackground({ opacity: 0 })).toBe('none');
  });

  it('keeps out-of-range values inside the glow layer and opacity range', () => {
    expect(iconGlowBackground({ radius: 3, opacity: 2 })).toMatch(/^radial-gradient\(50% 50% at 50% 50%, rgba\(0, 0, 0, 1\) 0%/);
    expect(iconGlowBackground({ radius: 0 })).toContain('5% 5%');
  });
});
