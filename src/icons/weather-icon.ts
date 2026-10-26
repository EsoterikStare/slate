// <slate-weather-icon>: one weather icon as a stack of layers (see art.ts). Each layer is a static SVG; animation only moves or fades
// whole layers with CSS transform/opacity, which the GPU composites without
// re-rasterising, so animations stay fluid on a Raspberry Pi. (The Meteocons
// SMIL icons this replaces re-rasterised every frame: under 1 fps there.)

import { css, html, LitElement, unsafeCSS } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { Layer, Motion } from './art';
import { DEFS, ICON_ART } from './art';
import type { WeatherDescription } from './describe';
import { resolveIcon } from './describe';
import { iconGlowBackground } from './glow';
import { type IconName, isIconName } from './names';

/** Duration (s), timing and direction for each motion. */
const MOTION: Record<Motion, { dur: number; ease: string; alternate?: boolean }> = {
  drift: { dur: 3.5, ease: 'ease-in-out', alternate: true },
  spin: { dur: 45, ease: 'linear' },
  rain: { dur: 0.7, ease: 'linear' },
  pour: { dur: 0.55, ease: 'linear' },
  snow: { dur: 4, ease: 'linear' },
  hail: { dur: 0.9, ease: 'ease-in' },
  flash: { dur: 2, ease: 'linear' },
  fog: { dur: 5, ease: 'ease-in-out', alternate: true },
  wind: { dur: 2, ease: 'ease-in-out', alternate: true },
  rock: { dur: 4, ease: 'ease-in-out', alternate: true },
  twinkle: { dur: 3, ease: 'ease-in-out' },
};

/** Inline style that animates a layer; empty for a static one. */
export function layerStyle(layer: Layer): Record<string, string> {
  const style: Record<string, string> = {};
  if (layer.origin) style['transform-origin'] = `${(layer.origin[0] / 64) * 100}% ${(layer.origin[1] / 64) * 100}%`;
  if (!layer.motion) return style;
  const m = MOTION[layer.motion];
  const direction = m.alternate
    ? layer.reverse
      ? 'alternate-reverse'
      : 'alternate'
    : layer.reverse
      ? 'reverse'
      : 'normal';
  style.animation = `wi-${layer.motion} ${m.dur}s ${m.ease} ${layer.delay ?? 0}s infinite ${direction}`;
  return style;
}

/**
 * Shows either a named icon (`icon`) or the closest icon to a weather
 * description (`description`, usually from a service adapter such as
 * haDescription). A name without artwork falls back to the description.
 */
export class SlateWeatherIcon extends LitElement {
  static override properties = {
    icon: {},
    description: { attribute: false },
    animated: { type: Boolean },
  };

  declare icon: string;
  declare description: WeatherDescription;
  declare animated: boolean;

  constructor() {
    super();
    this.icon = '';
    this.description = {};
    this.animated = true;
  }

  /** The icon actually drawn. */
  get shown(): IconName {
    return isIconName(this.icon) ? this.icon : resolveIcon(this.description ?? {});
  }

  protected override render() {
    return html`<div class=${classMap({ icon: true, paused: !this.animated })}>
      <svg class="defs" width="0" height="0" aria-hidden="true"><defs>${unsafeSVG(DEFS)}</defs></svg>
      ${ICON_ART[this.shown].map(
        (layer) =>
          html`<div class=${classMap({ layer: true, moving: !!layer.motion })} style=${styleMap(layerStyle(layer))}>
            <svg viewBox="0 0 64 64" aria-hidden="true">${unsafeSVG(layer.art)}</svg>
          </div>`,
      )}
    </div>`;
  }

  static override styles = css`
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
      line-height: 0;
    }
    .icon {
      position: relative;
      width: 100%;
      height: 100%;
    }
    /* Holds the shared gradients; display: none would stop
       url(#…) references from resolving in some browsers. */
    .defs {
      position: absolute;
    }
    .layer {
      position: absolute;
      inset: 0;
    }
    .layer.moving {
      will-change: transform, opacity;
    }
    .layer svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    /* A soft dark glow behind the whole icon separates it from bright photos.
       One static gradient: nothing to redraw per frame, and unlike per-shape
       drop shadows it never shades one part of the icon onto another.
       --weather-icon-glow overrides it (a background, or none; see glow.ts).
       The layer is twice the icon's size (see GLOW_BOX_SCALE). */
    .icon::before {
      content: '';
      position: absolute;
      inset: -50%;
      background: var(--weather-icon-glow, ${unsafeCSS(iconGlowBackground())});
    }
    /* Still icons show each layer's artwork where it was drawn (a paused
       animation could freeze a raindrop mid-fade, invisible). */
    .paused .layer {
      animation: none !important;
    }
    @media (prefers-reduced-motion: reduce) {
      .layer {
        animation: none !important;
      }
    }

    /* Percentages are of the icon's size: 1 canvas unit = 1.5625%. */
    @keyframes wi-drift {
      from { transform: translateX(-4.7%); }
      to { transform: translateX(4.7%); }
    }
    @keyframes wi-spin {
      to { transform: rotate(360deg); }
    }
    /* Precipitation rests fully below the cloud (what a still icon shows)
       and animates from behind it to past that point. */
    @keyframes wi-rain {
      0% { transform: translate(2.5%, -12.5%); opacity: 0; }
      30% { opacity: 1; }
      70% { opacity: 1; }
      100% { transform: translate(-1.9%, 9.4%); opacity: 0; }
    }
    @keyframes wi-pour {
      0% { transform: translate(2.5%, -12.5%); opacity: 0; }
      25% { opacity: 1; }
      75% { opacity: 1; }
      100% { transform: translate(-2.5%, 12.5%); opacity: 0; }
    }
    @keyframes wi-snow {
      0% { transform: translate(0, -11%) rotate(0deg); opacity: 0; }
      15% { opacity: 1; }
      50% { transform: translate(3.1%, 0) rotate(60deg); }
      85% { opacity: 1; }
      100% { transform: translate(-1.6%, 11%) rotate(120deg); opacity: 0; }
    }
    @keyframes wi-hail {
      0% { transform: translateY(-12%); opacity: 0; }
      15% { opacity: 1; }
      65% { transform: translateY(8%); }
      75% { transform: translateY(4.5%); }
      85% { transform: translateY(8%); opacity: 1; }
      100% { transform: translateY(8%); opacity: 0; }
    }
    @keyframes wi-flash {
      0%, 58%, 64%, 70%, 100% { opacity: 1; }
      61%, 67% { opacity: 0.15; }
    }
    @keyframes wi-fog {
      from { transform: translateX(-4.7%); }
      to { transform: translateX(4.7%); }
    }
    @keyframes wi-wind {
      from { transform: translateX(-6%); opacity: 0.6; }
      to { transform: translateX(6%); opacity: 1; }
    }
    @keyframes wi-rock {
      from { transform: rotate(-10deg); }
      to { transform: rotate(10deg); }
    }
    @keyframes wi-twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.2; }
    }
  `;
}

if (!customElements.get('slate-weather-icon')) customElements.define('slate-weather-icon', SlateWeatherIcon);

declare global {
  interface HTMLElementTagNameMap {
    'slate-weather-icon': SlateWeatherIcon;
  }
}
