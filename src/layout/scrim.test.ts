import { describe, expect, it } from 'vitest';
import { scrimBackground } from './scrim';

describe('scrimBackground', () => {
  it('darkens a band at each edge that holds text, fading out past it', () => {
    expect(scrimBackground({ top: 200, bottom: 300, strength: 0.5 })).toBe(
      'linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.3) 200px, rgba(0, 0, 0, 0) 300px), ' +
        'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.3) 300px, rgba(0, 0, 0, 0) 450px)',
    );
  });

  it('leaves out a band where there is no text', () => {
    const bottomOnly = scrimBackground({ top: 0, bottom: 300, strength: 0.5 });
    expect(bottomOnly).not.toContain('to bottom');
    expect(bottomOnly).toContain('to top');
  });

  it('is off at zero strength or with nothing to cover', () => {
    expect(scrimBackground({ top: 200, bottom: 300, strength: 0 })).toBe('none');
    expect(scrimBackground({ top: 0, bottom: 0, strength: 0.5 })).toBe('none');
  });
});
