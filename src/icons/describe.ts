// A service-neutral description of the weather, and the icon that best
// shows it. Weather services report conditions at very different levels of
// detail (Home Assistant has 15 conditions; WMO codes, Met.no symbols and
// OpenWeatherMap distinguish drizzle, intensities, showers, haze, …). Each
// service gets an adapter that fills in what it knows; resolveIcon() picks
// the closest icon there is artwork for, so detail with no icon of its own
// yet (light snow, haze) falls back to the nearest one (snow, fog) and gets
// sharper as artwork is added.

import type { IconName } from './names';

export type Precipitation = 'rain' | 'drizzle' | 'snow' | 'sleet' | 'freezing-rain' | 'hail';

export interface WeatherDescription {
  /** Cloud cover. */
  sky?: 'clear' | 'partly-cloudy' | 'cloudy';
  /** What's falling, if anything. */
  precipitation?: Precipitation;
  intensity?: 'light' | 'moderate' | 'heavy';
  /** Passing showers rather than steady precipitation. */
  showers?: boolean;
  thunder?: boolean;
  /** Something reducing visibility. */
  obscuration?: 'fog' | 'mist' | 'haze' | 'smoke' | 'dust';
  wind?: boolean;
  /** Night variants (moon instead of sun) where the icon has a sun. */
  night?: boolean;
}

/**
 * The closest icon to a description. What matters most wins: thunder, then
 * precipitation, then reduced visibility, then wind, then cloud cover.
 * An empty description is "not available".
 */
export function resolveIcon(d: WeatherDescription): IconName {
  const night = !!d.night;
  if (d.thunder) {
    if (d.precipitation) return night ? 'thunderstorms-night-rain' : 'thunderstorms-day-rain';
    return night ? 'thunderstorms-night' : 'thunderstorms-day';
  }
  switch (d.precipitation) {
    case 'rain':
    case 'drizzle':
      return d.intensity === 'heavy' ? 'heavy-rain' : 'rain';
    case 'snow':
      return 'snow';
    case 'sleet':
    case 'freezing-rain':
      return 'sleet';
    case 'hail':
      return 'hail';
  }
  if (d.obscuration) return night ? 'fog-night' : 'fog-day';
  if (d.wind) return 'wind';
  switch (d.sky) {
    case 'clear':
      return night ? 'clear-night' : 'clear-day';
    case 'partly-cloudy':
      return night ? 'partly-cloudy-night' : 'partly-cloudy-day';
    case 'cloudy':
      return 'cloudy';
  }
  return 'not-available';
}
