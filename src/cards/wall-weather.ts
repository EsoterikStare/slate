// <wall-weather>: current conditions and/or a daily forecast strip from any
// HA weather entity. Current values come from the entity's state; the daily
// forecast from a live `weather/subscribe_forecast` subscription.

import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { HomeAssistant } from '../ha/types';
import { roleFontSize, textScaleVars } from '../text-scale';
import { conditionLabel } from '../weather/conditions';
import type { ForecastEntry, TempUnit } from '../weather/forecast';
import { displayTemp, splitForecast } from '../weather/forecast';
import '../weather/weather-icon';

export const WEATHER_DETAILS = ['feels_like', 'humidity', 'wind', 'precipitation'] as const;
export type WeatherDetail = (typeof WEATHER_DETAILS)[number];
export const WEATHER_TEXT_ROLES = [
  'temperature',
  'condition',
  'high_low',
  'details',
  'forecast_day',
  'forecast_temp',
] as const;

export interface WallWeatherConfig {
  type: string;
  entity: string;
  /** Which part(s) to show; wall-layout typically places them separately. */
  show?: 'both' | 'current' | 'forecast';
  forecast_days?: number;
  /** Display unit; defaults to the entity's own unit. */
  unit?: 'F' | 'C';
  /** Extra current-condition details, in order. */
  current?: WeatherDetail[];
  /** Show precipitation chance under each forecast day. */
  forecast_precipitation?: boolean;
  animations?: boolean;
  /** Entity whose `below_horizon` state switches current icons to night variants. */
  sun_entity?: string;
  scale?: number;
  text?: Partial<Record<(typeof WEATHER_TEXT_ROLES)[number], number>>;
}

interface ForecastMessage {
  type: string;
  forecast: ForecastEntry[] | null;
}

const asUnit = (u: unknown): TempUnit => (u === '°C' || u === 'C' ? '°C' : '°F');

export class WallWeather extends LitElement {
  static override properties = {
    hass: { attribute: false },
    dimmed: { attribute: false },
    _config: { state: true },
    _forecast: { state: true },
    _forecastError: { state: true },
    _now: { state: true },
  };

  declare hass?: HomeAssistant;
  /** Set by wall-layout during night dimming: icons hold still. */
  declare dimmed: boolean;
  declare _config?: WallWeatherConfig;
  declare _forecast?: ForecastEntry[];
  declare _forecastError: boolean;
  declare _now: Date;
  private _vars: Record<string, string> = {};
  private _unsub?: Promise<() => Promise<void>>;
  private _subscribedTo = '';
  private _clock?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this._forecastError = false;
    this._now = new Date();
    this.dimmed = false;
  }

  setConfig(config: WallWeatherConfig): void {
    if (!config?.entity?.startsWith('weather.')) throw new Error('wall-weather: `entity` must be a weather entity');
    const days = config.forecast_days ?? 5;
    if (!Number.isInteger(days) || days < 0) throw new Error('wall-weather: `forecast_days` must be a whole number');
    for (const d of config.current ?? []) {
      if (!WEATHER_DETAILS.includes(d)) throw new Error(`wall-weather: unknown current detail "${d}"`);
    }
    this._vars = textScaleVars(config.scale ?? 1, config.text ?? {});
    this._config = config;
  }

  getCardSize(): number {
    return 3;
  }

  static getStubConfig(hass: HomeAssistant): WallWeatherConfig {
    const entity = Object.keys(hass.states).find((id) => id.startsWith('weather.')) ?? 'weather.home';
    return { type: 'custom:wall-weather', entity };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Today/tomorrow boundaries move at midnight even if the forecast doesn't.
    this._clock = setInterval(() => (this._now = new Date()), 60_000);
    this._subscribedTo = '';
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
    this._unsubscribe();
  }

  protected override willUpdate(_: PropertyValues<this>): void {
    // Both views need the daily forecast: the strip, and today's high/low.
    const entity = this._config?.entity;
    if (!entity || !this.hass || !this.isConnected) return;
    if (this._subscribedTo === entity) return;
    this._unsubscribe();
    this._subscribedTo = entity;
    this._forecast = undefined;
    this._forecastError = false;
    const hass = this.hass;
    this._unsub = hass.connection.subscribeMessage<ForecastMessage>(
      (msg) => {
        this._forecast = msg.forecast ?? [];
      },
      { type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: entity },
    );
    this._unsub.catch((err: unknown) => {
      console.warn('wall-weather: forecast subscription failed', err);
      this._forecastError = true;
    });
  }

  private _unsubscribe(): void {
    const pending = this._unsub;
    this._unsub = undefined;
    this._subscribedTo = '';
    pending?.then((unsub) => unsub()).catch(() => {});
  }

  protected override render() {
    const cfg = this._config;
    if (!cfg || !this.hass) return nothing;
    const state = this.hass.states[cfg.entity];
    if (!state) return html`<div class="missing">Weather entity ${cfg.entity} not found</div>`;

    const from = asUnit(state.attributes.temperature_unit);
    const to = cfg.unit ? asUnit(cfg.unit) : from;
    const { today, upcoming } = splitForecast(this._forecast ?? [], this._now, cfg.forecast_days ?? 5);
    const show = cfg.show ?? 'both';
    const animated = cfg.animations !== false && !this.dimmed;

    return html`<div class="weather" style=${styleMap(this._vars)}>
      ${show !== 'forecast' ? this._renderCurrent(state.state, state.attributes, today, from, to, animated) : nothing}
      ${show !== 'current' ? this._renderForecast(upcoming, from, to, animated) : nothing}
    </div>`;
  }

  private _renderCurrent(
    condition: string,
    attrs: Record<string, unknown>,
    today: ForecastEntry | undefined,
    from: TempUnit,
    to: TempUnit,
    animated: boolean,
  ) {
    const sun = this.hass!.states[this._config!.sun_entity ?? 'sun.sun'];
    const night = sun?.state === 'below_horizon';
    const details = (this._config!.current ?? []).map((d) => this._detail(d, attrs, today, from, to)).filter(Boolean);
    return html`<div class="current">
      <wall-weather-icon class="current-icon" .condition=${condition} .night=${night} .animated=${animated}></wall-weather-icon>
      <div class="current-text">
        <div class="temperature">${displayTemp(attrs.temperature as number | undefined, from, to)}</div>
        <div class="condition">${conditionLabel(condition)}</div>
        ${today
          ? html`<div class="high-low">
              H ${displayTemp(today.temperature, from, to)} · L ${displayTemp(today.templow, from, to)}
            </div>`
          : nothing}
        ${details.length ? html`<div class="details">${details.join(' · ')}</div>` : nothing}
      </div>
    </div>`;
  }

  private _detail(
    d: WeatherDetail,
    attrs: Record<string, unknown>,
    today: ForecastEntry | undefined,
    from: TempUnit,
    to: TempUnit,
  ): string {
    switch (d) {
      case 'feels_like':
        return attrs.apparent_temperature === undefined
          ? ''
          : `Feels ${displayTemp(attrs.apparent_temperature as number, from, to)}`;
      case 'humidity':
        return attrs.humidity === undefined ? '' : `${Math.round(attrs.humidity as number)}% humidity`;
      case 'wind':
        return attrs.wind_speed === undefined
          ? ''
          : `${Math.round(attrs.wind_speed as number)} ${(attrs.wind_speed_unit as string | undefined) ?? ''} wind`.replace(
              /\s+/g,
              ' ',
            );
      case 'precipitation':
        return today?.precipitation_probability === undefined ? '' : `${today.precipitation_probability}% rain`;
    }
  }

  private _renderForecast(days: ForecastEntry[], from: TempUnit, to: TempUnit, animated: boolean) {
    if (this._forecastError) return html`<div class="forecast-error">Forecast unavailable</div>`;
    if (!days.length) return nothing;
    const locale = this.hass?.locale.language ?? 'en';
    return html`<div class="forecast" style=${styleMap({ gridTemplateColumns: `repeat(${days.length}, 1fr)` })}>
      ${days.map(
        (f) => html`<div class="day">
          <div class="day-name">${new Date(f.datetime).toLocaleDateString(locale, { weekday: 'short' })}</div>
          <wall-weather-icon class="day-icon" .condition=${f.condition ?? ''} .animated=${animated}></wall-weather-icon>
          <div class="day-temps">
            <span class="hi">${displayTemp(f.temperature, from, to)}</span>
            <span class="lo">${displayTemp(f.templow, from, to)}</span>
          </div>
          ${this._config!.forecast_precipitation && f.precipitation_probability !== undefined
            ? html`<div class="day-precip">${f.precipitation_probability}%</div>`
            : nothing}
        </div>`,
      )}
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
      color: var(--wall-text-color, #fff);
      font-family: var(--wall-font-family, var(--primary-font-family, Roboto, system-ui, sans-serif));
    }
    .weather {
      /* Not a size container: inline-size containment would zero this card's
         natural width and wrap every word when placed side by side. */
      text-shadow: 0 0.04em 0.25em rgba(0, 0, 0, 0.5);
    }
    .current {
      display: flex;
      align-items: center;
      justify-content: var(--wall-weather-align, flex-end);
      gap: 0.15em;
      ${roleFontSize('temperature', 8)}
    }
    .current-icon {
      font-size: 1.6em;
      flex: none;
    }
    .current-text {
      text-align: right;
    }
    .temperature {
      ${roleFontSize('temperature', 8)}
      font-weight: 300;
      line-height: 1;
    }
    .condition {
      ${roleFontSize('condition', 3.2)}
    }
    .high-low {
      ${roleFontSize('high_low', 2.8)}
      opacity: 0.85;
    }
    .details {
      ${roleFontSize('details', 2.3)}
      opacity: 0.75;
      margin-top: 0.2em;
    }
    .forecast {
      display: grid;
      gap: 0.5em;
      margin-top: 1em;
      text-align: center;
      ${roleFontSize('forecast_day', 2.6)}
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .day-name {
      ${roleFontSize('forecast_day', 2.6)}
      opacity: 0.9;
    }
    .day-icon {
      font-size: 2.4em;
    }
    .day-temps {
      ${roleFontSize('forecast_temp', 2.6)}
      white-space: nowrap;
    }
    .day-temps .lo {
      opacity: 0.65;
      margin-left: 0.3em;
    }
    .day-precip {
      ${roleFontSize('forecast_temp', 2.1)}
      opacity: 0.7;
    }
    .missing,
    .forecast-error {
      opacity: 0.6;
      font-size: 1rem;
    }
  `;
}

if (!customElements.get('wall-weather')) {
  customElements.define('wall-weather', WallWeather);
  const w = window as unknown as { customCards?: unknown[] };
  (w.customCards ??= []).push({
    type: 'wall-weather',
    name: 'Wall Weather',
    description: 'Current conditions and a daily forecast strip with animated icons.',
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'wall-weather': WallWeather;
  }
}
