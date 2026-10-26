// HA weather conditions → Meteocons icon names and display labels.
// The condition list is HA's fixed set (developers.home-assistant.io,
// "Weather entity" → "Recommended values for state and condition").

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

export type IconName =
  | 'clear-day'
  | 'clear-night'
  | 'cloudy'
  | 'fog-day'
  | 'fog-night'
  | 'hail'
  | 'thunderstorms-day'
  | 'thunderstorms-night'
  | 'thunderstorms-day-rain'
  | 'thunderstorms-night-rain'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'rain'
  | 'heavy-rain'
  | 'snow'
  | 'sleet'
  | 'wind'
  | 'not-available';

/** Icon for a condition; `night` picks the moon variants where Meteocons has them. */
export function conditionIcon(condition: string, night = false): IconName {
  const dn = <D extends IconName, N extends IconName>(day: D, nightIcon: N) => (night ? nightIcon : day);
  switch (condition as HaCondition) {
    case 'sunny':
      return dn('clear-day', 'clear-night');
    case 'clear-night':
      return 'clear-night';
    case 'partlycloudy':
      return dn('partly-cloudy-day', 'partly-cloudy-night');
    case 'cloudy':
      return 'cloudy';
    case 'fog':
      return dn('fog-day', 'fog-night');
    case 'hail':
      return 'hail';
    case 'lightning':
      return dn('thunderstorms-day', 'thunderstorms-night');
    case 'lightning-rainy':
      return dn('thunderstorms-day-rain', 'thunderstorms-night-rain');
    // HA has two rain intensities. Both use rain lines (Meteocons' round
    // "drizzle" drops read as a sprinkle and vanished at a distance).
    case 'rainy':
      return 'rain';
    case 'pouring':
      return 'heavy-rain';
    case 'snowy':
      return 'snow';
    case 'snowy-rainy':
      return 'sleet';
    case 'windy':
    case 'windy-variant':
      return 'wind';
    default:
      return 'not-available';
  }
}

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
