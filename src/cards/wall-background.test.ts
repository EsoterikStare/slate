import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeHass } from '../ha/fake-hass';
import type { HomeAssistant } from '../ha/types';
import './wall-background';
import type { WallBackground, WallBackgroundConfig } from './wall-background';

let el: WallBackground | undefined;

/** Image loading is the network boundary: resolve unless the URL is marked broken. */
const fakeLoad = vi.fn(async (url: string) => {
  if (url.includes('broken')) throw new Error('404');
});

async function mount(config: WallBackgroundConfig, hass?: HomeAssistant) {
  el = document.createElement('wall-background');
  el.loadImage = fakeLoad;
  el.setConfig(config);
  el.hass = hass;
  document.body.append(el);
  await settle();
  return el;
}
async function settle() {
  await el!.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el!.updateComplete;
}
const imgs = () => [...el!.shadowRoot!.querySelectorAll('img')].map((i) => [i.getAttribute('src'), i.className]);

const unsplash = (picture: string) =>
  createFakeHass({ entities: { 'sensor.unsplash_background': { state: 'ok', attributes: { entity_picture: picture } } } });

beforeEach(() => {
  fakeLoad.mockClear();
});
afterEach(() => {
  el?.remove();
  vi.useRealTimers();
});

describe('wall-background', () => {
  it('shows the entity’s picture once it has loaded', async () => {
    await mount({ entity: 'sensor.unsplash_background' }, unsplash('/img/1'));
    expect(fakeLoad).toHaveBeenCalledWith('/img/1');
    expect(imgs()).toEqual([['/img/1', 'active']]);
    expect(el!.shown).toBe('/img/1');
  });

  it('cross-fades to a new picture, keeping the old one underneath', async () => {
    await mount({ entity: 'sensor.unsplash_background' }, unsplash('/img/1'));
    el!.hass = unsplash('/img/2');
    await settle();
    expect(imgs()).toEqual([
      ['/img/2', 'active'],
      ['/img/1', ''],
    ]);
  });

  it('keeps the current picture when the next one fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount({ entity: 'sensor.unsplash_background' }, unsplash('/img/1'));
    el!.hass = unsplash('/img/broken');
    await settle();
    expect(el!.shown).toBe('/img/1');
    warn.mockRestore();
  });

  it('rotates a URL list on its interval', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await mount({ urls: ['a.jpg', 'b.jpg'], interval: 10 });
    expect(el!.shown).toBe('a.jpg');
    vi.advanceTimersByTime(10 * 60_000);
    await settle();
    expect(el!.shown).toBe('b.jpg');
  });

  it('does not reload when nothing changed', async () => {
    const hass = unsplash('/img/1');
    await mount({ entity: 'sensor.unsplash_background' }, hass);
    el!.hass = { ...hass };
    await settle();
    expect(fakeLoad).toHaveBeenCalledTimes(1);
  });
});
