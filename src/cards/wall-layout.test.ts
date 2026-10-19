import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeHass } from '../ha/fake-hass';
import type { HomeAssistant } from '../ha/types';
import './wall-calendar';
import './wall-clock';
import './wall-layout';
import type { LayoutMeasurement, WallLayout, WallLayoutConfig } from './wall-layout';
import './wall-weather';

const hass = createFakeHass({
  calendars: { 'calendar.alex': [] },
  entities: {
    'weather.home': { state: 'sunny', attributes: { temperature: 70, temperature_unit: '°F' } },
    'sensor.unsplash_background': { state: 'ok', attributes: { entity_picture: '/img/1' } },
  },
  forecasts: { 'weather.home': [] },
});

const config = (extra: Partial<WallLayoutConfig> = {}): WallLayoutConfig => ({
  type: 'custom:wall-layout',
  background: { entity: 'sensor.unsplash_background' },
  top: [
    [{ type: 'custom:wall-clock' }, { type: 'custom:wall-weather', entity: 'weather.home', show: 'current' }],
    { cards: [{ type: 'custom:wall-weather', entity: 'weather.home', show: 'forecast' }], collapsible: true },
  ],
  bottom: { type: 'custom:wall-calendar', calendars: ['calendar.alex'] },
  ...extra,
});

let el: WallLayout | undefined;
let measured: LayoutMeasurement;

async function settle() {
  for (let i = 0; i < 6; i++) {
    await el!.updateComplete;
    await Promise.resolve();
  }
}

async function mount(cfg = config(), h: HomeAssistant = hass) {
  el = document.createElement('wall-layout');
  // 1080 wide; 1888 usable after padding; rows 300 + 200 with a 16 gap; calendar wants 900.
  measured = { width: 1080, height: 1888, rowHeights: [300, 200], rowGap: 16, bottomNatural: 900 };
  el.measure = () => measured;
  el.reloadPage = vi.fn();
  el.setConfig(cfg);
  el.hass = h;
  document.body.append(el);
  await settle();
  return el;
}

const root = () => el!.shadowRoot!;
const rows = () => [...root().querySelectorAll<HTMLElement>('.top > .row')];
const calendar = () => root().querySelector('.bottom > wall-calendar') as HTMLElement & { availableHeight?: number };

afterEach(() => {
  el?.remove();
  el = undefined;
  vi.useRealTimers();
});

describe('wall-layout', () => {
  it('builds its cards and hands every one of them hass', async () => {
    await mount();
    expect(rows().map((r) => [...r.children].map((c) => c.localName))).toEqual([
      ['wall-clock', 'wall-weather'],
      ['wall-weather'],
    ]);
    const children = [...root().querySelectorAll('wall-clock, wall-weather, wall-calendar, wall-background')];
    expect(children).toHaveLength(5);
    for (const c of children) expect((c as unknown as { hass: unknown }).hass).toBe(hass);
  });

  it('docks the calendar by default: photo and top rows above it, calendar on black below', async () => {
    await mount();
    const photo = root().querySelector('.screen.docked > .photo')!;
    expect(photo.querySelector(':scope > wall-background')).not.toBeNull();
    expect(photo.querySelector(':scope > .top')).not.toBeNull();
    const bottom = root().querySelector<HTMLElement>('.screen.docked > .bottom')!;
    expect(bottom.querySelector('wall-calendar')).not.toBeNull();
    // The calendar's panel styling is switched to solid, square, unblurred black.
    const styles = getComputedStyle(bottom);
    expect(styles.getPropertyValue('--wall-panel-background').trim()).toBe('#000');
    expect(styles.getPropertyValue('--wall-panel-radius').trim()).toBe('0');
  });

  it('can float the calendar as a card over a full-screen photo instead', async () => {
    await mount(config({ bottom_style: 'floating' }));
    expect(root().querySelector('.photo')).toBeNull();
    expect(root().querySelector('.screen.floating > wall-background')).not.toBeNull();
    const stack = root().querySelector('.screen.floating > .stack')!;
    expect([...stack.children].map((c) => c.className)).toEqual(['top', 'bottom']);
  });

  it('sets the shared text unit from its width, and the global scale', async () => {
    await mount(config({ scale: 1.2 }));
    const screen = root().querySelector<HTMLElement>('.screen')!;
    expect(screen.style.getPropertyValue('--wall-unit')).toBe('10.8px');
    expect(screen.style.getPropertyValue('--wall-scale')).toBe('1.2');
  });

  it('gives the calendar the room below the full top area when it fits', async () => {
    await mount();
    // 1888 − (300 + 16 + 200) − 24 gap
    expect(calendar().availableHeight).toBe(1348);
    expect(rows()[1]!.classList.contains('collapsed')).toBe(false);
  });

  it('folds the forecast row away when the calendar needs the room, and brings it back', async () => {
    await mount();
    measured.bottomNatural = 1400;
    calendar().dispatchEvent(new CustomEvent('wall-natural-height', { detail: 1400, bubbles: true, composed: true }));
    await settle();
    expect(rows()[1]!.classList.contains('collapsed')).toBe(true);
    expect(calendar().availableHeight).toBe(1888 - 300 - 24);

    measured.bottomNatural = 600;
    calendar().dispatchEvent(new CustomEvent('wall-natural-height', { detail: 600, bubbles: true, composed: true }));
    await settle();
    expect(rows()[1]!.classList.contains('collapsed')).toBe(false);
  });

  describe('night dimming', () => {
    const night = { start: '22:00', end: '06:00', brightness: 0.25 };
    const dimOpacity = () => root().querySelector<HTMLElement>('.dim')!.style.opacity;
    const weatherDimmed = () =>
      [...root().querySelectorAll('wall-weather')].map((w) => (w as unknown as { dimmed: boolean }).dimmed);

    it('dims the screen and stills weather icons during the window', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 18, 23, 0));
      await mount(config({ night }));
      expect(dimOpacity()).toBe('0.75');
      expect(weatherDimmed()).toEqual([true, true]);
    });

    it('brightens again when the window ends', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(new Date(2026, 9, 19, 5, 59, 40));
      await mount(config({ night }));
      expect(dimOpacity()).toBe('0.75');
      vi.advanceTimersByTime(30_000);
      await settle();
      expect(dimOpacity()).toBe('0');
      expect(weatherDimmed()).toEqual([false, false]);
    });
  });

  describe('reload watchdog', () => {
    it('reloads after the connection has been down for reload_after seconds', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await mount(config({ reload_after: 60 }));
      el!.hass = { ...hass, connected: false };
      await settle();
      vi.advanceTimersByTime(59_000);
      expect(el!.reloadPage).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1_000);
      expect(el!.reloadPage).toHaveBeenCalledTimes(1);
    });

    it('counts from the first disconnect, and reloads once, despite further updates', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await mount(config({ reload_after: 60 }));
      el!.hass = { ...hass, connected: false };
      await settle();
      vi.advanceTimersByTime(30_000);
      el!.hass = { ...hass, connected: false };
      await settle();
      vi.advanceTimersByTime(30_000);
      expect(el!.reloadPage).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(120_000);
      expect(el!.reloadPage).toHaveBeenCalledTimes(1);
    });

    it('stands down if the connection comes back in time', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await mount(config({ reload_after: 60 }));
      el!.hass = { ...hass, connected: false };
      await settle();
      vi.advanceTimersByTime(30_000);
      el!.hass = { ...hass, connected: true };
      await settle();
      vi.advanceTimersByTime(60_000);
      expect(el!.reloadPage).not.toHaveBeenCalled();
    });

    it('can be turned off', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await mount(config({ reload_after: false }));
      el!.hass = { ...hass, connected: false };
      await settle();
      vi.advanceTimersByTime(3_600_000);
      expect(el!.reloadPage).not.toHaveBeenCalled();
    });
  });

  it.each([
    [{ top: [], bottom: undefined }, /top/],
    [{ night: { start: '10pm', end: '06:00' } }, /time of day/],
    [{ night: { start: '22:00', end: '06:00', brightness: 2 } }, /brightness/],
    [{ background: {} }, /background/],
    [{ bottom_style: 'sideways' }, /bottom_style/],
  ])('rejects bad config %j', (bad, message) => {
    const l = document.createElement('wall-layout');
    expect(() => l.setConfig({ ...config(), ...(bad as object) } as WallLayoutConfig)).toThrow(message);
  });
});
