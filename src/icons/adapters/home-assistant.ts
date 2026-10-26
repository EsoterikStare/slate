// Home Assistant weather conditions → WeatherDescription. HA's list is fixed
// (developers.home-assistant.io, "Weather entity" → "Recommended values for
// state and condition").

import type { WeatherDescription } from '../describe';

export const HA_CONDITIONS = [
  'clear-night',
  'cloudy',
  'exceptional',
  'fog',
  'hail',
  'lightning',
  'lightning-rainy',
  'partlycloudy',
  'pouring',
  'rainy',
  'snowy',
  'snowy-rainy',
  'sunny',
  'windy',
  'windy-variant',
] as const;
export type HaCondition = (typeof HA_CONDITIONS)[number];

const DESCRIPTIONS: Record<HaCondition, WeatherDescription> = {
  sunny: { sky: 'clear' },
  'clear-night': { sky: 'clear', night: true },
  partlycloudy: { sky: 'partly-cloudy' },
  cloudy: { sky: 'cloudy' },
  fog: { obscuration: 'fog' },
  hail: { precipitation: 'hail' },
  lightning: { thunder: true },
  'lightning-rainy': { thunder: true, precipitation: 'rain' },
  // HA's two rain intensities.
  rainy: { precipitation: 'rain' },
  pouring: { precipitation: 'rain', intensity: 'heavy' },
  snowy: { precipitation: 'snow' },
  'snowy-rainy': { precipitation: 'sleet' },
  windy: { wind: true },
  'windy-variant': { wind: true, sky: 'cloudy' },
  exceptional: {},
};

/**
 * Description of an HA condition. `night` (e.g. from sun.sun) switches to
 * moon variants; HA's own `clear-night` is always night. Unknown conditions
 * (ones HA might add later) describe nothing, so they show "not available".
 */
export function haDescription(condition: string, night = false): WeatherDescription {
  const d = DESCRIPTIONS[condition as HaCondition];
  return d ? { ...d, night: d.night || night } : {};
}
