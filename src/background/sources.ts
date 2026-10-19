import type { HomeAssistant } from '../ha/types';

export interface BackgroundConfig {
  /** An entity whose `entity_picture` (or a URL state) is the image, e.g. an Unsplash sensor. */
  entity?: string;
  /** One image URL. With `interval`, it's re-requested each time (for "random image" URLs). */
  url?: string;
  /** Several image URLs, shown in turn every `interval` minutes. */
  urls?: string[];
  /** Minutes between rotations. */
  interval?: number;
}

export function validateBackground(c: BackgroundConfig): void {
  const sources = [c.entity, c.url, c.urls].filter((s) => s !== undefined).length;
  if (sources !== 1) throw new Error('background: set exactly one of `entity`, `url`, or `urls`');
  if (c.urls && c.urls.length === 0) throw new Error('background: `urls` is empty');
  if (c.interval !== undefined && !(c.interval > 0)) throw new Error('background: `interval` must be positive minutes');
}

/**
 * The image to show now. `tick` counts elapsed `interval`s; it picks the
 * entry from `urls`, or busts the cache on a single `url` so a "random
 * image" endpoint actually returns a new picture.
 */
export function backgroundUrl(c: BackgroundConfig, hass: HomeAssistant | undefined, tick: number): string | undefined {
  if (c.entity) {
    const state = hass?.states[c.entity];
    const picture = state?.attributes.entity_picture;
    if (typeof picture === 'string' && picture) return picture;
    return state && /^https?:\/\//.test(state.state) ? state.state : undefined;
  }
  if (c.urls) return c.urls[tick % c.urls.length];
  if (c.url) {
    if (!c.interval) return c.url;
    return `${c.url}${c.url.includes('?') ? '&' : '?'}wall_t=${tick}`;
  }
  return undefined;
}
