// Weather icons: the public surface of src/icons, kept free of dashboard
// code so it can become its own package. See describe.ts for how services
// map onto icons, and adapters/ for each service's mapping.

export { HA_CONDITIONS, haDescription, type HaCondition } from './adapters/home-assistant';
export { resolveIcon, type Precipitation, type WeatherDescription } from './describe';
export { GLOW_DEFAULTS, iconGlowBackground, type IconGlowConfig } from './glow';
export { ICON_NAMES, isIconName, type IconName } from './names';
export { SlateWeatherIcon } from './weather-icon';
