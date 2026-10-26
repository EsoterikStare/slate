// Display labels for HA weather conditions. Icons come from the icon
// library (src/icons), via its Home Assistant adapter.

import type { HaCondition } from '../icons/adapters/home-assistant';

export { HA_CONDITIONS } from '../icons/adapters/home-assistant';

const LABELS: Record<HaCondition, string> = {
  'clear-night': 'Clear',
  cloudy: 'Cloudy',
  exceptional: 'Exceptional',
  fog: 'Fog',
  hail: 'Hail',
  lightning: 'Lightning',
  'lightning-rainy': 'Thunderstorms',
  partlycloudy: 'Partly cloudy',
  pouring: 'Heavy rain',
  rainy: 'Rain',
  snowy: 'Snow',
  'snowy-rainy': 'Sleet',
  sunny: 'Sunny',
  windy: 'Windy',
  'windy-variant': 'Windy',
};

export function conditionLabel(condition: string): string {
  return LABELS[condition as HaCondition] ?? condition;
}
