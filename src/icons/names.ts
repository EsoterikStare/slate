// The icons that have artwork. Callers usually don't pick these directly:
// they describe the weather (describe.ts) and let resolveIcon() choose the
// closest icon, so new artwork can be added without changing callers.

export const ICON_NAMES = [
  'clear-day',
  'clear-night',
  'partly-cloudy-day',
  'partly-cloudy-night',
  'cloudy',
  'fog-day',
  'fog-night',
  'rain',
  'heavy-rain',
  'snow',
  'sleet',
  'hail',
  'thunderstorms-day',
  'thunderstorms-night',
  'thunderstorms-day-rain',
  'thunderstorms-night-rain',
  'wind',
  'not-available',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function isIconName(name: string): name is IconName {
  return (ICON_NAMES as readonly string[]).includes(name);
}
