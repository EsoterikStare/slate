// <wall-background>: a full-bleed photo that cross-fades to the next image
// only once it has fully loaded, so the screen never flashes blank. Meant to
// sit behind wall-layout's content (wall-layout creates it from its
// `background:` option); it fills its positioned parent.

import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import type { BackgroundConfig } from '../background/sources';
import { backgroundUrl, validateBackground } from '../background/sources';
import type { HomeAssistant } from '../ha/types';

export type WallBackgroundConfig = BackgroundConfig & { type?: string; fade_seconds?: number };

const preload = (url: string) =>
  new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });

export class WallBackground extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _layers: { state: true },
    _active: { state: true },
    _tick: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: WallBackgroundConfig;
  /** Two stacked images; the active one is opaque, the other fades out. */
  declare _layers: [string | undefined, string | undefined];
  declare _active: 0 | 1;
  declare _tick: number;

  /** How images are fetched before being shown; replaceable where nothing loads (tests). */
  loadImage: (url: string) => Promise<void> = preload;

  private _wanted?: string;
  private _timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this._layers = [undefined, undefined];
    this._active = 0;
    this._tick = 0;
  }

  setConfig(config: WallBackgroundConfig): void {
    validateBackground(config);
    this._config = config;
    this._restartTimer();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._restartTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
  }

  private _restartTimer(): void {
    clearInterval(this._timer);
    const minutes = this._config?.interval;
    if (!minutes || !this.isConnected) return;
    this._timer = setInterval(() => this._tick++, minutes * 60_000);
  }

  /** The image currently shown (after any fade has started). */
  get shown(): string | undefined {
    return this._layers[this._active];
  }

  protected override willUpdate(_: PropertyValues<this>): void {
    if (!this._config) return;
    const url = backgroundUrl(this._config, this.hass, this._tick);
    if (!url || url === this._wanted) return;
    this._wanted = url;
    this.loadImage(url).then(
      () => {
        if (this._wanted !== url) return; // superseded while loading
        const next = this._active === 0 ? 1 : 0;
        const layers: [string | undefined, string | undefined] = [...this._layers];
        layers[next] = url;
        this._layers = layers;
        this._active = next;
      },
      (err: unknown) => {
        console.warn('wall-background:', err);
        if (this._wanted === url) this._wanted = undefined; // allow a retry next tick
      },
    );
  }

  protected override render() {
    const fade = `${this._config?.fade_seconds ?? 2}s`;
    return html`${this._layers.map((url, i) =>
      url
        ? html`<img
            class=${i === this._active ? 'active' : ''}
            src=${url}
            alt=""
            style="transition-duration: ${fade}"
          />`
        : nothing,
    )}`;
  }

  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: var(--wall-background-color, #111);
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition-property: opacity;
      transition-timing-function: ease-in-out;
    }
    img.active {
      opacity: 1;
    }
  `;
}

if (!customElements.get('wall-background')) {
  customElements.define('wall-background', WallBackground);
}

declare global {
  interface HTMLElementTagNameMap {
    'wall-background': WallBackground;
  }
}
