// <slate-weather-icon>: one Meteocons SVG in its own shadow root. Isolation
// matters: every Meteocons file reuses short gradient ids ("a", "b", …), so
// two icons inlined in the same root would paint with each other's gradients.

import { css, html, LitElement, type PropertyValues } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { conditionIcon } from './conditions';
import { ICONS } from './icons';

export class SlateWeatherIcon extends LitElement {
  static override properties = {
    condition: {},
    night: { type: Boolean },
    animated: { type: Boolean },
  };

  declare condition: string;
  declare night: boolean;
  declare animated: boolean;

  constructor() {
    super();
    this.condition = '';
    this.night = false;
    this.animated = true;
  }

  get icon() {
    return conditionIcon(this.condition, this.night);
  }

  protected override render() {
    return html`${unsafeSVG(ICONS[this.icon])}`;
  }

  protected override updated(_: PropertyValues<this>): void {
    // SMIL animations: pause/resume the SVG's own timeline.
    const svg = this.renderRoot.querySelector('svg') as (SVGSVGElement & Partial<SVGSVGElement>) | null;
    if (!svg || typeof svg.pauseAnimations !== 'function') return;
    if (this.animated) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }

  static override styles = css`
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
      line-height: 0;
      /* Separates the icon from bright photos; costs a little GPU per
         animation frame, so it's overridable (slate-layout sets \`none\` when
         icon_shadow is off). */
      filter: var(--slate-icon-shadow, drop-shadow(0 0 0.03em rgba(0, 0, 0, 0.55)) drop-shadow(0 0.02em 0.08em rgba(0, 0, 0, 0.4)));
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `;
}

if (!customElements.get('slate-weather-icon')) customElements.define('slate-weather-icon', SlateWeatherIcon);

declare global {
  interface HTMLElementTagNameMap {
    'slate-weather-icon': SlateWeatherIcon;
  }
}
