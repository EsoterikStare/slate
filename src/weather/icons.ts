// Meteocons "fill" animated icons by Bas Milius (MIT), from the
// @bybas/weather-icons package. Only the icons conditionIcon() can return are
// imported, so the bundle carries ~18 small SVGs rather than all 122.

import type { IconName } from './conditions';
import clearDay from '@bybas/weather-icons/production/fill/all/clear-day.svg?raw';
import clearNight from '@bybas/weather-icons/production/fill/all/clear-night.svg?raw';
import cloudy from '@bybas/weather-icons/production/fill/all/cloudy.svg?raw';
import fogDay from '@bybas/weather-icons/production/fill/all/fog-day.svg?raw';
import fogNight from '@bybas/weather-icons/production/fill/all/fog-night.svg?raw';
import hail from '@bybas/weather-icons/production/fill/all/hail.svg?raw';
import thunderstormsDay from '@bybas/weather-icons/production/fill/all/thunderstorms-day.svg?raw';
import thunderstormsNight from '@bybas/weather-icons/production/fill/all/thunderstorms-night.svg?raw';
import thunderstormsDayRain from '@bybas/weather-icons/production/fill/all/thunderstorms-day-rain.svg?raw';
import thunderstormsNightRain from '@bybas/weather-icons/production/fill/all/thunderstorms-night-rain.svg?raw';
import partlyCloudyDay from '@bybas/weather-icons/production/fill/all/partly-cloudy-day.svg?raw';
import partlyCloudyNight from '@bybas/weather-icons/production/fill/all/partly-cloudy-night.svg?raw';
import rain from '@bybas/weather-icons/production/fill/all/rain.svg?raw';
import drizzle from '@bybas/weather-icons/production/fill/all/drizzle.svg?raw';
import snow from '@bybas/weather-icons/production/fill/all/snow.svg?raw';
import sleet from '@bybas/weather-icons/production/fill/all/sleet.svg?raw';
import wind from '@bybas/weather-icons/production/fill/all/wind.svg?raw';
import notAvailable from '@bybas/weather-icons/production/fill/all/not-available.svg?raw';

export const ICONS: Record<IconName, string> = {
  'clear-day': clearDay,
  'clear-night': clearNight,
  'cloudy': cloudy,
  'fog-day': fogDay,
  'fog-night': fogNight,
  'hail': hail,
  'thunderstorms-day': thunderstormsDay,
  'thunderstorms-night': thunderstormsNight,
  'thunderstorms-day-rain': thunderstormsDayRain,
  'thunderstorms-night-rain': thunderstormsNightRain,
  'partly-cloudy-day': partlyCloudyDay,
  'partly-cloudy-night': partlyCloudyNight,
  'rain': rain,
  'drizzle': drizzle,
  'snow': snow,
  'sleet': sleet,
  'wind': wind,
  'not-available': notAvailable,
};
