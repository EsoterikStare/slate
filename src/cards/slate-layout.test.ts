import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeHass } from '../ha/fake-hass';
import type { HomeAssistant } from '../ha/types';
import './slate-calendar';
import './slate-clock';
import './slate-layout';
import type { LayoutMeasurement, LayoutRow, SlateLayout, SlateLayoutConfig } from './slate-layout';
import './slate-weather';

const hass = createFakeHass({
  calendars: { 'calendar.alex': [] },
  entities: {
    'weather.home': { state: 'sunny', attributes: { temperature: 70, temperature_unit: '°F' } },
    'sensor.unsplash_background': { state: 'ok', attributes: { entity_picture: '/img/1' } },
  },
  forecasts: { 'weather.home': [] },
});

const config = (extra: Partial<SlateLayoutConfig> = {}): SlateLayoutConfig => ({
  type: 'custom:slate-layout',
  background: { entity: 'sensor.unsplash_background' },
  top: [
    [{ type: 'custom:slate-clock' }, { type: 'custom:slate-weather', entity: 'weather.home', show: 'current' }],
    { cards: [{ type: 'custom:slate-weather', entity: 'weather.home', show: 'forecast' }], collapsible: true },
  ],
  bottom: { type: 'custom:slate-calendar', calendars: ['calendar.alex'] },
  ...extra,
});

let el: SlateLayout | undefined;
let measured: LayoutMeasurement;

async function settle() {
  for (let i = 0; i < 6; i++) {
    await el!.updateComplete;
    await Promise.resolve();
  }
}

async function mount(cfg = config(), h: HomeAssistant = hass) {
  el = document.createElement('slate-layout');
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
/** Shown rows in config order, wherever they're placed. */
const rows = () =>
  [...root().querySelectorAll<HTMLElement>('.row[data-index]')].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  );
const groupOf = (row: HTMLElement) => row.parentElement!.className;
const calendar = () => root().querySelector('.bottom > slate-calendar') as HTMLElement & { availableHeight?: number };

afterEach(() => {
  el?.remove();
  el = undefined;
  vi.useRealTimers();
});

describe('slate-layout', () => {
  it('builds its cards and hands every one of them hass', async () => {
    await mount();
    expect(rows().map((r) => [...r.children].map((c) => c.localName))).toEqual([
      ['slate-clock', 'slate-weather'],
      ['slate-weather'],
    ]);
    const children = [...root().querySelectorAll('slate-clock, slate-weather, slate-calendar, slate-background')];
    expect(children).toHaveLength(5);
    for (const c of children) expect((c as unknown as { hass: unknown }).hass).toBe(hass);
  });

  it('docks the calendar by default: photo and top rows above it, calendar on black below', async () => {
    await mount();
    const photo = root().querySelector('.screen.docked > .photo')!;
    expect(photo.querySelector(':scope > slate-background')).not.toBeNull();
    expect(photo.querySelector(':scope > .top')).not.toBeNull();
    const bottom = root().querySelector<HTMLElement>('.screen.docked > .bottom')!;
    expect(bottom.querySelector('slate-calendar')).not.toBeNull();
    // The calendar's panel styling is switched to solid, square, unblurred
    // black, with tighter padding and gaps since there's no card edge to clear.
    const styles = getComputedStyle(bottom);
    expect(styles.getPropertyValue('--slate-panel-background').trim()).toBe('#000');
    expect(styles.getPropertyValue('--slate-panel-radius').trim()).toBe('0');
    expect(styles.getPropertyValue('--slate-calendar-padding').trim()).toBe('0.4cqw');
    expect(styles.getPropertyValue('--slate-calendar-column-gap').trim()).toBe('0.4cqw');
  });

  it('can float the calendar as a card over a full-screen photo instead', async () => {
    await mount(config({ bottom_style: 'floating' }));
    expect(root().querySelector('.photo')).toBeNull();
    expect(root().querySelector('.screen.floating > slate-background')).not.toBeNull();
    expect(root().querySelector('.screen.floating > .header')).not.toBeNull();
    const stack = root().querySelector('.screen.floating > .stack')!;
    expect([...stack.children].map((c) => c.className)).toEqual(['top', 'bottom']);
  });

  it('sets the shared text unit from its width, and the global scale', async () => {
    await mount(config({ scale: 1.2 }));
    const screen = root().querySelector<HTMLElement>('.screen')!;
    expect(screen.style.getPropertyValue('--slate-unit')).toBe('10.8px');
    expect(screen.style.getPropertyValue('--slate-scale')).toBe('1.2');
  });

  it('pins the forecast row to the top of the screen by default, with the clock on the calendar', async () => {
    await mount();
    expect(rows().map(groupOf)).toEqual(['top', 'header']);
    expect(root().querySelector('.photo > .header')).not.toBeNull();
  });

  it('can stack the forecast under the clock instead', async () => {
    const cfg = config();
    (cfg.top![1] as LayoutRow).placement = 'stack';
    await mount(cfg);
    expect(rows().map(groupOf)).toEqual(['top', 'top']);
    // 1888 − (300 + 16 + 200) − 24
    expect(calendar().availableHeight).toBe(1348);
  });

  it('can hide the forecast row entirely', async () => {
    const cfg = config();
    (cfg.top![1] as LayoutRow).placement = 'hidden';
    await mount(cfg);
    expect(rows()).toHaveLength(1);
    expect(root().querySelectorAll('slate-weather')).toHaveLength(1);
    expect(root().querySelector('.header')).toBeNull();
    // Only the clock row counts: 1888 − 300 − 24.
    measured.rowHeights = [300];
    calendar().dispatchEvent(new CustomEvent('slate-natural-height', { detail: 900, bubbles: true, composed: true }));
    await settle();
    expect(calendar().availableHeight).toBe(1564);
  });

  it('gives the calendar the room below the full top area when it fits', async () => {
    await mount();
    // 1888 − (forecast 200 + 24 of photo + clock 300) − 24 above the calendar
    expect(calendar().availableHeight).toBe(1340);
    expect(rows()[1]!.classList.contains('collapsed')).toBe(false);
  });

  it('folds the forecast row away when the calendar needs the room, and brings it back', async () => {
    await mount();
    measured.bottomNatural = 1400;
    calendar().dispatchEvent(new CustomEvent('slate-natural-height', { detail: 1400, bubbles: true, composed: true }));
    await settle();
    expect(rows()[1]!.classList.contains('collapsed')).toBe(true);
    expect(calendar().availableHeight).toBe(1888 - 300 - 24);

    measured.bottomNatural = 600;
    calendar().dispatchEvent(new CustomEvent('slate-natural-height', { detail: 600, bubbles: true, composed: true }));
    await settle();
    expect(rows()[1]!.classList.contains('collapsed')).toBe(false);
  });

  describe('legibility over the photo', () => {
    const scrim = () => root().querySelector<HTMLElement>('.scrim')!.style.backgroundImage;
    const screenVar = (name: string) => root().querySelector<HTMLElement>('.screen')!.style.getPropertyValue(name);

    it('darkens a band behind the pinned forecast and one behind the clock', async () => {
      await mount();
      // Top: padding 16 + forecast 200. Bottom (docked): gap 24 + clock row 300.
      expect(scrim()).toContain('linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.3) 216px');
      expect(scrim()).toContain('linear-gradient(to top, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.3) 324px');
    });

    it('drops the top band when the forecast folds away', async () => {
      await mount();
      measured.bottomNatural = 1400;
      calendar().dispatchEvent(new CustomEvent('slate-natural-height', { detail: 1400, bubbles: true, composed: true }));
      await settle();
      expect(scrim()).not.toContain('to bottom');
      expect(scrim()).toContain('to top');
    });

    it('can turn the scrim and both shadows off', async () => {
      await mount(config({ scrim: 0, text_shadow: false, icon_shadow: false }));
      expect(scrim()).toBe('none');
      expect(screenVar('--slate-text-shadow')).toBe('none');
      expect(screenVar('--slate-icon-shadow')).toBe('none');
    });

    it('leaves the shadows at their defaults unless turned off', async () => {
      await mount();
      expect(screenVar('--slate-text-shadow')).toBe('');
      expect(screenVar('--slate-icon-shadow')).toBe('');
    });
  });

  describe('night dimming', () => {
    const night = { start: '22:00', end: '06:00', brightness: 0.25 };
    const dimOpacity = () => root().querySelector<HTMLElement>('.dim')!.style.opacity;
    const weatherDimmed = () =>
      [...root().querySelectorAll('slate-weather')].map((w) => (w as unknown as { dimmed: boolean }).dimmed);

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
    [{ scrim: 1.5 }, /scrim/],
    [{ top: [{ cards: [], placement: 'middle' }] }, /placement/],
  ])('rejects bad config %j', (bad, message) => {
    const l = document.createElement('slate-layout');
    expect(() => l.setConfig({ ...config(), ...(bad as object) } as SlateLayoutConfig)).toThrow(message);
  });
});
