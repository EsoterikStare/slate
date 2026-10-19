// <wall-clock>: large time and date. Uses the display device's clock (the
// kiosk's), re-rendering exactly on each minute — or second — boundary.

import { css, html, LitElement, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { HourFormat } from '../calendar/format';
import { formatClock, msUntilNextTick } from '../clock/format';
import type { HomeAssistant } from '../ha/types';
import { roleFontSize, textScaleVars } from '../text-scale';

export interface WallClockConfig {
  type: string;
  time_format?: HourFormat;
  show_seconds?: boolean;
  show_meridiem?: boolean;
  show_date?: boolean;
  /** Intl.DateTimeFormat options for the date line. */
  date_format?: Intl.DateTimeFormatOptions;
  scale?: number;
  text?: Partial<Record<'time' | 'date', number>>;
}

const DEFAULT_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };

export class WallClock extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _now: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: WallClockConfig;
  declare _now: Date;
  private _vars: Record<string, string> = {};
  private _timer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this._now = new Date();
  }

  setConfig(config: WallClockConfig): void {
    if (config.time_format !== undefined && config.time_format !== 12 && config.time_format !== 24) {
      throw new Error('wall-clock: `time_format` must be 12 or 24');
    }
    this._vars = textScaleVars(config.scale ?? 1, config.text ?? {});
    this._config = config;
    if (this.isConnected) this._schedule();
  }

  getCardSize(): number {
    return 3;
  }

  static getStubConfig(): WallClockConfig {
    return { type: 'custom:wall-clock' };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._schedule();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }

  private _schedule(): void {
    clearTimeout(this._timer);
    const seconds = this._config?.show_seconds ?? false;
    this._now = new Date();
    this._timer = setTimeout(() => this._schedule(), msUntilNextTick(this._now, seconds));
  }

  protected override render() {
    const cfg = this._config;
    if (!cfg) return nothing;
    const { time, meridiem } = formatClock(this._now, cfg.time_format ?? 12, cfg.show_seconds ?? false);
    const locale = this.hass?.locale.language ?? 'en';
    return html`<div class="clock" style=${styleMap(this._vars)}>
      <div class="time">
        ${time}${meridiem && cfg.show_meridiem !== false ? html`<span class="meridiem">${meridiem}</span>` : nothing}
      </div>
      ${cfg.show_date === false
        ? nothing
        : html`<div class="date">${this._now.toLocaleDateString(locale, cfg.date_format ?? DEFAULT_DATE)}</div>`}
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
      color: var(--wall-text-color, #fff);
      font-family: var(--wall-font-family, var(--primary-font-family, Roboto, system-ui, sans-serif));
    }
    .clock {
      /* Not a size container: inline-size containment would zero this card's
         natural width and wrap every word when placed side by side. */
      text-shadow: 0 0.04em 0.25em rgba(0, 0, 0, 0.5);
    }
    .time {
      ${roleFontSize('time', 13)}
      font-weight: 300;
      line-height: 1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .meridiem {
      font-size: 0.3em;
      font-weight: 400;
      margin-left: 0.25em;
      letter-spacing: 0;
    }
    .date {
      ${roleFontSize('date', 3.8)}
      margin-top: 0.2em;
      opacity: 0.9;
    }
  `;
}

if (!customElements.get('wall-clock')) {
  customElements.define('wall-clock', WallClock);
  const w = window as unknown as { customCards?: unknown[] };
  (w.customCards ??= []).push({ type: 'wall-clock', name: 'Wall Clock', description: 'Large time and date for wall displays.' });
}

declare global {
  interface HTMLElementTagNameMap {
    'wall-clock': WallClock;
  }
}
