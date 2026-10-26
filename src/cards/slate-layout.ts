// <slate-layout>: the full-screen kiosk composition. The top rows (clock,
// weather) sit directly on the bottom card (calendar), anchored to the bottom
// edge and only as tall as their content; rows can instead be pinned to the
// top of the screen (the forecast strip, by default) or hidden. Two styles:
//   docked (default)  the calendar runs edge to edge down to the bottom edge
//                     on solid black; the photo fills only the area above it,
//                     behind the clock and weather.
//   floating          the photo fills the whole screen and the calendar is a
//                     translucent card floating over it.
// How the height is shared when it runs short is planScreen().
// Also handles night dimming and a reload watchdog for a dropped HA
// connection, since nobody is there to press F5.

import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { BackgroundConfig } from '../background/sources';
import { validateBackground } from '../background/sources';
import type { HomeAssistant } from '../ha/types';
import { inWindow, parseTimeOfDay } from '../layout/night';
import type { RowPlacement } from '../layout/screen';
import { defaultPlacement, planScreen, rowsHeight } from '../layout/screen';
import { scrimBackground } from '../layout/scrim';
import { iconGlowBackground, type IconGlowConfig } from '../icons/glow';
import type { InsetConfig } from '../layout/inset';
import { resolveInset } from '../layout/inset';
import './slate-background';
import type { SlateBackground } from './slate-background';

export interface CardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LayoutRow {
  cards: CardConfig[];
  /** Folded away first when the calendar needs the room (the forecast strip). */
  collapsible?: boolean;
  /**
   * `top`: pinned to the top of the screen. `stack`: sits on the calendar.
   * `hidden`: not shown. Defaults to `top` for a row holding only the
   * forecast strip, `stack` otherwise.
   */
  placement?: RowPlacement;
}

export interface SlateLayoutConfig {
  type: string;
  /** Global text multiplier for every card. */
  scale?: number;
  /** Outer padding, px. */
  padding?: number;
  /**
   * Moves the content (clock, weather, calendar contents) in from the screen
   * edges, px, for monitors that crop their edges; the photo and the docked
   * calendar's black background still reach the edges. A number for all
   * sides, or e.g. `{ left: 8, right: 8 }`.
   */
  inset?: InsetConfig;
  /** Space between the top rows and the bottom card, px. */
  gap?: number;
  /** `docked`: edge-to-edge calendar on black, photo above it. `floating`: card over a full-screen photo. */
  bottom_style?: 'docked' | 'floating';
  /** Darkness (0–1) of the soft gradient laid over the photo behind text; 0 turns it off. */
  scrim?: number;
  /** Layered shadow behind clock and weather text (default on). */
  text_shadow?: boolean;
  /** Soft glow behind weather icons: on by default, `false` to omit, or a radius and centre opacity. */
  icon_shadow?: boolean | IconGlowConfig;
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
  /** Rendered height of each shown row, in config order (collapsed rows keep their full height). */
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

export class SlateLayout extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _rows: { state: true },
    _bottom: { state: true },
    _background: { state: true },
    _collapsed: { state: true },
    _unit: { state: true },
    _night: { state: true },
    _scrim: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: SlateLayoutConfig;
  /** Shown rows only (hidden ones are never built), in config order. */
  declare _rows: { row: LayoutRow; placement: 'top' | 'stack'; cards: CardElement[] }[];
  declare _bottom?: CardElement;
  declare _background?: SlateBackground;
  declare _collapsed: boolean;
  declare _unit: number;
  declare _night: boolean;
  /** CSS background of the scrim layer (see ../layout/scrim.ts). */
  declare _scrim: string;

  /** Overrides DOM measurement; for tests, where nothing has layout. */
  measure?: () => LayoutMeasurement;
  /** How the watchdog reloads; replaceable in tests. */
  reloadPage: () => void = () => location.reload();

  private _build = 0;
  private _resize?: ResizeObserver;
  private _observed = new WeakSet<Element>();
  private _clock?: ReturnType<typeof setInterval>;
  private _watchdog?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this._rows = [];
    this._collapsed = false;
    this._unit = 0;
    this._night = false;
    this._scrim = 'none';
  }

  setConfig(config: SlateLayoutConfig): void {
    if (!config.top?.length && !config.bottom) throw new Error('slate-layout: add `top` rows and/or a `bottom` card');
    if (config.background) validateBackground(config.background);
    resolveInset(config.inset); // throws on a bad inset
    if (config.scrim !== undefined && !(config.scrim >= 0 && config.scrim <= 1)) {
      throw new Error('slate-layout: `scrim` must be between 0 and 1');
    }
    for (const r of config.top ?? []) {
      const p = toRow(r).placement;
      if (p !== undefined && p !== 'top' && p !== 'stack' && p !== 'hidden') {
        throw new Error('slate-layout: a row `placement` must be top, stack or hidden');
      }
    }
    if (config.bottom_style !== undefined && config.bottom_style !== 'docked' && config.bottom_style !== 'floating') {
      throw new Error('slate-layout: `bottom_style` must be docked or floating');
    }
    if (config.night) {
      parseTimeOfDay(config.night.start);
      parseTimeOfDay(config.night.end);
      const b = config.night.brightness ?? 0.3;
      if (!(b >= 0 && b <= 1)) throw new Error('slate-layout: `night.brightness` must be between 0 and 1');
    }
    this._config = config;
    void this._buildCards(config);
    this._checkNight();
  }

  getCardSize(): number {
    return 20;
  }

  private async _buildCards(config: SlateLayoutConfig): Promise<void> {
    const build = ++this._build;
    const shown = (config.top ?? [])
      .map(toRow)
      .map((row) => ({ row, placement: row.placement ?? defaultPlacement(row.cards) }))
      .filter((r): r is { row: LayoutRow; placement: 'top' | 'stack' } => r.placement !== 'hidden');
    const rows = await Promise.all(
      shown.map(async ({ row, placement }) => ({ row, placement, cards: await Promise.all(row.cards.map(createCard)) })),
    );
    const bottom = config.bottom ? await createCard(config.bottom) : undefined;
    if (build !== this._build) return; // config changed again meanwhile
    this._rows = rows;
    this._bottom = bottom;
    if (config.background) {
      const bg = document.createElement('slate-background');
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
    this.addEventListener('slate-natural-height', this._relayout);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
    clearTimeout(this._watchdog);
    this._watchdog = undefined;
    this._resize?.disconnect();
    this._resize = undefined;
    this.removeEventListener('slate-natural-height', this._relayout);
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
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    // The top rows and bottom card appear once their cards are built, and
    // swap containers with bottom_style, so (re)attach the observer as they do.
    for (const el of this.renderRoot.querySelectorAll('.header, .top, .bottom')) {
      if (this._resize && !this._observed.has(el)) {
        this._resize.observe(el);
        this._observed.add(el);
      }
    }
    if (changed.has('_rows') || changed.has('_bottom') || changed.has('_config')) this._relayout();
  }

  private get _docked(): boolean {
    return (this._config?.bottom_style ?? 'docked') === 'docked';
  }

  private _measureDom(): LayoutMeasurement {
    const root = this.renderRoot;
    const screen = root.querySelector('.screen') as HTMLElement | null;
    const group = root.querySelector('.top, .header') as HTMLElement | null;
    const pad = this._config?.padding ?? 16;
    const inset = resolveInset(this._config?.inset);
    return {
      width: screen?.clientWidth ?? 0,
      // Docked, the calendar meets the screen edge: only the top is padded.
      height: (screen?.clientHeight ?? 0) - (this._docked ? 1 : 2) * pad - inset.top - inset.bottom,
      rowHeights: this._rows.map(
        (_, i) => root.querySelector(`.row[data-index="${i}"]`)?.getBoundingClientRect().height ?? 0,
      ),
      rowGap: group ? parseFloat(getComputedStyle(group).rowGap) || 0 : 0,
      bottomNatural: this._bottom?.naturalHeight || this._bottom?.getBoundingClientRect().height || 0,
    };
  }

  private _relayout = (): void => {
    if (!this._config) return;
    const m = (this.measure ?? (() => this._measureDom()))();
    this._unit = m.width / 100;
    const gap = this._config.gap ?? 24;
    const rows = this._rows.map((r, i) => ({
      height: m.rowHeights[i] ?? 0,
      placement: r.placement,
      collapsible: !!r.row.collapsible,
    }));
    const plan = planScreen({
      height: m.height,
      gap,
      topFull: rowsHeight(rows, m.rowGap, gap, true),
      topCompact: rowsHeight(rows, m.rowGap, gap, false),
      bottomNatural: m.bottomNatural,
    });
    this._collapsed = plan.collapseTop;
    if (this._bottom && this._bottom.availableHeight !== plan.bottomAvailable) {
      this._bottom.availableHeight = plan.bottomAvailable;
    }

    // Scrim bands cover the text that's actually showing over the photo.
    const pad = this._config.padding ?? 16;
    const inset = resolveInset(this._config.inset);
    const shown = rows.filter((r) => !(r.collapsible && plan.collapseTop));
    const groupHeight = (p: 'top' | 'stack') => {
      const g = shown.filter((r) => r.placement === p);
      return g.length ? g.reduce((sum, r) => sum + r.height, 0) + (g.length - 1) * m.rowGap : 0;
    };
    const header = groupHeight('top');
    const stack = groupHeight('stack');
    // Docked, the photo ends at the calendar; floating, it runs under the
    // calendar card to the screen's bottom edge.
    const belowStack = this._docked ? 0 : pad + inset.bottom + Math.min(m.bottomNatural, plan.bottomAvailable);
    this._scrim = scrimBackground({
      top: header ? pad + inset.top + header : 0,
      bottom: stack ? belowStack + gap + stack : 0,
      strength: this._config.scrim ?? 0.2,
    });
  };

  protected override render() {
    const cfg = this._config;
    if (!cfg) return nothing;
    const brightness = cfg.night?.brightness ?? 0.3;
    const group = (placement: 'top' | 'stack', cls: string) => {
      const rows = this._rows.map((r, i) => ({ r, i })).filter(({ r }) => r.placement === placement);
      return rows.length
        ? html`<div class=${cls}>
            ${rows.map(
              ({ r, i }) => html`<div
                class=${classMap({ row: true, collapsed: !!r.row.collapsible && this._collapsed })}
                data-index=${i}
              >
                ${r.cards}
              </div>`,
            )}
          </div>`
        : nothing;
    };
    const header = group('top', 'header');
    const top = group('stack', 'top');
    const inset = resolveInset(cfg.inset);
    // Docked, the calendar's black runs edge to edge, so the inset goes inside
    // it, onto its content. Floating, the card itself moves in (via .stack).
    const bottom = this._bottom
      ? html`<div
          class="bottom"
          style=${styleMap(
            this._docked
              ? {
                  '--slate-calendar-inset-left': `${inset.left}px`,
                  '--slate-calendar-inset-right': `${inset.right}px`,
                  '--slate-calendar-inset-bottom': `${inset.bottom}px`,
                }
              : {},
          )}
        >
          ${this._bottom}
        </div>`
      : nothing;
    const scrim = html`<div class="scrim" style=${styleMap({ backgroundImage: this._scrim })}></div>`;
    const body = this._docked
      ? html`<div class="photo">${this._background ?? nothing}${scrim}${header}${top}</div>
          ${bottom}`
      : html`${this._background ?? nothing}${scrim}${header}
          <div class="stack">${top}${bottom}</div>`;
    return html`<div
      class=${classMap({ screen: true, docked: this._docked, floating: !this._docked })}
      style=${styleMap({
        '--inset-top': `${inset.top}px`,
        '--inset-right': `${inset.right}px`,
        '--inset-bottom': `${inset.bottom}px`,
        '--inset-left': `${inset.left}px`,
        '--slate-unit': this._unit ? `${this._unit}px` : null,
        '--slate-scale': String(cfg.scale ?? 1),
        '--pad': `${cfg.padding ?? 16}px`,
        '--gap': `${cfg.gap ?? 24}px`,
        '--slate-text-shadow': cfg.text_shadow === false ? 'none' : null,
        '--weather-icon-glow':
          cfg.icon_shadow === undefined || cfg.icon_shadow === true ? null : iconGlowBackground(cfg.icon_shadow),
      })}
    >
      ${body}
      <div class="dim" style=${styleMap({ opacity: this._night ? String(1 - brightness) : '0' })}></div>
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
    }
    .screen {
      position: relative;
      height: var(--slate-layout-height, 100dvh);
      overflow: hidden;
      box-sizing: border-box;
    }
    /* Floating: top rows sit directly on the bottom card; the block hugs the
       bottom edge, over a full-screen photo. */
    .stack {
      position: absolute;
      left: calc(var(--pad) + var(--inset-left));
      right: calc(var(--pad) + var(--inset-right));
      bottom: calc(var(--pad) + var(--inset-bottom));
      display: flex;
      flex-direction: column;
      row-gap: var(--gap);
    }
    .top,
    .header {
      position: relative;
      display: flex;
      flex-direction: column;
      row-gap: 16px;
    }
    .scrim {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    /* Rows pinned to the top of the screen, over the photo. */
    .header {
      position: absolute;
      top: calc(var(--pad) + var(--inset-top));
      left: calc(var(--pad) + var(--inset-left));
      right: calc(var(--pad) + var(--inset-right));
    }
    /* Docked: the photo area takes whatever the calendar leaves; the top rows
       sit at its bottom edge, just above the calendar. */
    .screen.docked {
      display: flex;
      flex-direction: column;
      background: #000;
    }
    .photo {
      position: relative;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
    .docked .top {
      position: absolute;
      left: calc(var(--pad) + var(--inset-left));
      right: calc(var(--pad) + var(--inset-right));
      bottom: var(--gap);
    }
    .docked .bottom {
      flex: none;
      --slate-panel-background: #000;
      --slate-panel-blur: 0px;
      --slate-panel-radius: 0;
      --slate-event-background: #1c1c1c;
      /* No rounded card to keep clear of; the monitor bezel is the margin. */
      --slate-calendar-padding: 0.4cqw;
      --slate-calendar-column-gap: 0.4cqw;
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

if (!customElements.get('slate-layout')) {
  customElements.define('slate-layout', SlateLayout);
  const w = window as unknown as { customCards?: unknown[] };
  (w.customCards ??= []).push({
    type: 'slate-layout',
    name: 'Slate Layout',
    description: 'Full-screen kiosk layout: background photo, top rows, and a bottom-anchored calendar.',
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'slate-layout': SlateLayout;
  }
}
