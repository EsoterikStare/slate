// <wall-layout>: the full-screen kiosk composition. A background photo fills
// the screen; the top rows (clock, weather) sit directly on the bottom card
// (calendar), and that whole block is anchored to the bottom edge and only
// as tall as its content, so the photo shows above it. How the height is
// shared when it runs short is planScreen().
// Also handles night dimming and a reload watchdog for a dropped HA
// connection, since nobody is there to press F5.

import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { BackgroundConfig } from '../background/sources';
import { validateBackground } from '../background/sources';
import type { HomeAssistant } from '../ha/types';
import { inWindow, parseTimeOfDay } from '../layout/night';
import { planScreen } from '../layout/screen';
import './wall-background';
import type { WallBackground } from './wall-background';

export interface CardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LayoutRow {
  cards: CardConfig[];
  /** Folded away first when the calendar needs the room (the forecast strip). */
  collapsible?: boolean;
}

export interface WallLayoutConfig {
  type: string;
  /** Global text multiplier for every card. */
  scale?: number;
  /** Outer padding, px. */
  padding?: number;
  /** Space between the top rows and the bottom card, px. */
  gap?: number;
  background?: BackgroundConfig & { fade_seconds?: number };
  night?: { start: string; end: string; brightness?: number };
  /** Reload the page after the HA connection has been down this many seconds. `false` disables. */
  reload_after?: number | false;
  top?: (LayoutRow | CardConfig[])[];
  bottom?: CardConfig;
}

/** What the layout reads from the DOM; replaceable where nothing has layout (tests). */
export interface LayoutMeasurement {
  width: number;
  height: number;
  /** Rendered height of each top row (collapsed rows keep their full height). */
  rowHeights: number[];
  rowGap: number;
  bottomNatural: number;
}

type CardElement = HTMLElement & {
  setConfig?(c: CardConfig): void;
  hass?: HomeAssistant;
  availableHeight?: number;
  naturalHeight?: number;
  dimmed?: boolean;
};

interface CardHelpers {
  createCardElement(config: CardConfig): CardElement;
}

async function createCard(config: CardConfig): Promise<CardElement> {
  const loader = (window as unknown as { loadCardHelpers?: () => Promise<CardHelpers> }).loadCardHelpers;
  // Inside HA: its helper builds any card type (built-in or custom) with HA's error handling.
  if (loader) return (await loader()).createCardElement(config);
  // Outside HA (Storybook, tests): only custom elements, which is all ours are.
  const tag = config.type.replace(/^custom:/, '');
  await customElements.whenDefined(tag);
  const el = document.createElement(tag) as CardElement;
  el.setConfig?.(config);
  return el;
}

const toRow = (r: LayoutRow | CardConfig[]): LayoutRow => (Array.isArray(r) ? { cards: r } : r);

export class WallLayout extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _rows: { state: true },
    _bottom: { state: true },
    _background: { state: true },
    _collapsed: { state: true },
    _unit: { state: true },
    _night: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: WallLayoutConfig;
  declare _rows: { row: LayoutRow; cards: CardElement[] }[];
  declare _bottom?: CardElement;
  declare _background?: WallBackground;
  declare _collapsed: boolean;
  declare _unit: number;
  declare _night: boolean;

  /** Overrides DOM measurement; for tests, where nothing has layout. */
  measure?: () => LayoutMeasurement;
  /** How the watchdog reloads; replaceable in tests. */
  reloadPage: () => void = () => location.reload();

  private _build = 0;
  private _resize?: ResizeObserver;
  private _clock?: ReturnType<typeof setInterval>;
  private _watchdog?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this._rows = [];
    this._collapsed = false;
    this._unit = 0;
    this._night = false;
  }

  setConfig(config: WallLayoutConfig): void {
    if (!config.top?.length && !config.bottom) throw new Error('wall-layout: add `top` rows and/or a `bottom` card');
    if (config.background) validateBackground(config.background);
    if (config.night) {
      parseTimeOfDay(config.night.start);
      parseTimeOfDay(config.night.end);
      const b = config.night.brightness ?? 0.3;
      if (!(b >= 0 && b <= 1)) throw new Error('wall-layout: `night.brightness` must be between 0 and 1');
    }
    this._config = config;
    void this._buildCards(config);
    this._checkNight();
  }

  getCardSize(): number {
    return 20;
  }

  private async _buildCards(config: WallLayoutConfig): Promise<void> {
    const build = ++this._build;
    const rows = await Promise.all(
      (config.top ?? []).map(async (r) => {
        const row = toRow(r);
        return { row, cards: await Promise.all(row.cards.map(createCard)) };
      }),
    );
    const bottom = config.bottom ? await createCard(config.bottom) : undefined;
    if (build !== this._build) return; // config changed again meanwhile
    this._rows = rows;
    this._bottom = bottom;
    if (config.background) {
      const bg = document.createElement('wall-background');
      bg.setConfig(config.background);
      this._background = bg;
    } else {
      this._background = undefined;
    }
    this._passHass();
  }

  private _children(): CardElement[] {
    return [...this._rows.flatMap((r) => r.cards), ...(this._bottom ? [this._bottom] : [])];
  }

  private _passHass(): void {
    if (this._background && this.hass) this._background.hass = this.hass;
    for (const card of this._children()) {
      if (this.hass) card.hass = this.hass;
      card.dimmed = this._night;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._clock = setInterval(() => this._checkNight(), 30_000);
    this._checkNight();
    this.addEventListener('wall-natural-height', this._relayout);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
    clearTimeout(this._watchdog);
    this._watchdog = undefined;
    this._resize?.disconnect();
    this._resize = undefined;
    this.removeEventListener('wall-natural-height', this._relayout);
  }

  private _checkNight(): void {
    const n = this._config?.night;
    this._night = !!n && inWindow(new Date(), n.start, n.end);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') || changed.has('_night')) this._passHass();
    if (changed.has('hass')) this._updateWatchdog();
  }

  /**
   * HA's frontend usually reconnects by itself, but after some restarts it
   * sits on a dead connection. A kiosk can't be clicked, so reload instead.
   */
  private _updateWatchdog(): void {
    const after = this._config?.reload_after ?? 300;
    if (after === false || !this.hass || this.hass.connected !== false) {
      clearTimeout(this._watchdog);
      this._watchdog = undefined;
      return;
    }
    this._watchdog ??= setTimeout(() => this.reloadPage(), after * 1000);
  }

  protected override firstUpdated(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this._resize = new ResizeObserver(() => this._relayout());
      this._resize.observe(this);
      // The stack resizes whenever a row or the bottom card does.
      const stack = this.renderRoot.querySelector('.stack');
      if (stack) this._resize.observe(stack);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('_rows') || changed.has('_bottom') || changed.has('_config')) this._relayout();
  }

  private _measureDom(): LayoutMeasurement {
    const root = this.renderRoot;
    const screen = root.querySelector('.screen') as HTMLElement | null;
    const top = root.querySelector('.top') as HTMLElement | null;
    const pad = this._config?.padding ?? 16;
    return {
      width: screen?.clientWidth ?? 0,
      height: (screen?.clientHeight ?? 0) - 2 * pad,
      rowHeights: [...root.querySelectorAll('.top > .row')].map((r) => r.getBoundingClientRect().height),
      rowGap: top ? parseFloat(getComputedStyle(top).rowGap) || 0 : 0,
      bottomNatural: this._bottom?.naturalHeight || this._bottom?.getBoundingClientRect().height || 0,
    };
  }

  private _relayout = (): void => {
    if (!this._config) return;
    const m = (this.measure ?? (() => this._measureDom()))();
    this._unit = m.width / 100;
    const gaps = (n: number) => Math.max(0, n - 1) * m.rowGap;
    const visible = this._rows.map((r, i) => ({ h: m.rowHeights[i] ?? 0, keep: !r.row.collapsible }));
    const plan = planScreen({
      height: m.height,
      gap: this._config.gap ?? 24,
      topFull: visible.reduce((s, r) => s + r.h, 0) + gaps(visible.length),
      topCompact: visible.filter((r) => r.keep).reduce((s, r) => s + r.h, 0) + gaps(visible.filter((r) => r.keep).length),
      bottomNatural: m.bottomNatural,
    });
    this._collapsed = plan.collapseTop;
    if (this._bottom && this._bottom.availableHeight !== plan.bottomAvailable) {
      this._bottom.availableHeight = plan.bottomAvailable;
    }
  };

  protected override render() {
    const cfg = this._config;
    if (!cfg) return nothing;
    const pad = `${cfg.padding ?? 16}px`;
    const brightness = cfg.night?.brightness ?? 0.3;
    return html`<div
      class="screen"
      style=${styleMap({
        '--wall-unit': this._unit ? `${this._unit}px` : null,
        '--wall-scale': String(cfg.scale ?? 1),
        '--pad': pad,
        '--gap': `${cfg.gap ?? 24}px`,
      })}
    >
      ${this._background ?? nothing}
      <div class="stack">
        ${this._rows.length
          ? html`<div class="top">
              ${this._rows.map(
                (r) => html`<div class=${classMap({ row: true, collapsed: !!r.row.collapsible && this._collapsed })}>
                  ${r.cards}
                </div>`,
              )}
            </div>`
          : nothing}
        ${this._bottom ? html`<div class="bottom">${this._bottom}</div>` : nothing}
      </div>
      <div class="dim" style=${styleMap({ opacity: this._night ? String(1 - brightness) : '0' })}></div>
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
    }
    .screen {
      position: relative;
      height: var(--wall-layout-height, 100dvh);
      overflow: hidden;
      box-sizing: border-box;
    }
    /* Top rows sit directly on the bottom card; the block hugs the bottom edge. */
    .stack {
      position: absolute;
      left: var(--pad);
      right: var(--pad);
      bottom: var(--pad);
      display: flex;
      flex-direction: column;
      row-gap: var(--gap);
    }
    .top {
      position: relative;
      display: flex;
      flex-direction: column;
      row-gap: 16px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .row > * {
      flex: 0 1 auto;
      min-width: 0;
    }
    .row > :only-child {
      flex: 1 1 auto;
    }
    /* Collapsed rows stay measurable (so they can come back) but take no space. */
    .row.collapsed {
      position: absolute;
      visibility: hidden;
      left: 0;
      right: 0;
    }
    .dim {
      position: absolute;
      inset: 0;
      background: #000;
      pointer-events: none;
      transition: opacity 3s ease-in-out;
    }
  `;
}

if (!customElements.get('wall-layout')) {
  customElements.define('wall-layout', WallLayout);
  const w = window as unknown as { customCards?: unknown[] };
  (w.customCards ??= []).push({
    type: 'wall-layout',
    name: 'Wall Layout',
    description: 'Full-screen kiosk layout: background photo, top rows, and a bottom-anchored calendar.',
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'wall-layout': WallLayout;
  }
}
