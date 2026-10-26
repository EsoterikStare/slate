import { describe, expect, it } from 'vitest';
import { resolveIcon } from './describe';

describe('resolveIcon', () => {
  it('shows cloud cover, with the moon at night', () => {
    expect(resolveIcon({ sky: 'clear' })).toBe('clear-day');
    expect(resolveIcon({ sky: 'clear', night: true })).toBe('clear-night');
    expect(resolveIcon({ sky: 'partly-cloudy', night: true })).toBe('partly-cloudy-night');
    expect(resolveIcon({ sky: 'cloudy', night: true })).toBe('cloudy');
  });

  it('tells rain intensities apart', () => {
    expect(resolveIcon({ precipitation: 'rain' })).toBe('rain');
    expect(resolveIcon({ precipitation: 'rain', intensity: 'heavy' })).toBe('heavy-rain');
  });

  it('puts what matters most first: thunder, precipitation, visibility, wind, then clouds', () => {
    expect(resolveIcon({ thunder: true, precipitation: 'snow', sky: 'cloudy', night: true })).toBe('thunderstorms-night-rain');
    expect(resolveIcon({ thunder: true })).toBe('thunderstorms-day');
    expect(resolveIcon({ precipitation: 'snow', obscuration: 'fog', wind: true })).toBe('snow');
    expect(resolveIcon({ obscuration: 'fog', wind: true, sky: 'cloudy' })).toBe('fog-day');
    expect(resolveIcon({ wind: true, sky: 'cloudy' })).toBe('wind');
  });

  it('falls back to the nearest icon for detail that has no artwork yet', () => {
    expect(resolveIcon({ precipitation: 'drizzle', intensity: 'light' })).toBe('rain');
    expect(resolveIcon({ precipitation: 'freezing-rain' })).toBe('sleet');
    expect(resolveIcon({ precipitation: 'snow', intensity: 'heavy', showers: true })).toBe('snow');
    expect(resolveIcon({ obscuration: 'haze', night: true })).toBe('fog-night');
  });

  it('is "not available" when there is nothing to show', () => {
    expect(resolveIcon({})).toBe('not-available');
    expect(resolveIcon({ night: true })).toBe('not-available');
  });
});
