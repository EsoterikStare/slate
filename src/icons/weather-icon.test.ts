import { afterEach, describe, expect, it } from 'vitest';
import { haDescription } from './adapters/home-assistant';
import { ICON_ART } from './art';
import { layerStyle, SlateWeatherIcon } from './weather-icon';

async function icon(props: Partial<Pick<SlateWeatherIcon, 'icon' | 'description' | 'animated'>>) {
  const el = Object.assign(document.createElement('slate-weather-icon'), props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
afterEach(() => document.body.replaceChildren());

describe('layerStyle', () => {
  it('animates moving layers with their delay, and leaves static layers alone', () => {
    expect(layerStyle({ art: '' })).toEqual({});
    expect(layerStyle({ art: '', motion: 'rain', delay: -0.4 }).animation).toBe('wi-rain 0.7s linear -0.4s infinite normal');
    expect(layerStyle({ art: '', motion: 'drift', reverse: true }).animation).toContain('alternate-reverse');
  });

  it('turns a canvas origin into a percentage of the icon', () => {
    expect(layerStyle({ art: '', motion: 'spin', origin: [32, 16] })['transform-origin']).toBe('50% 25%');
  });
});

describe('<slate-weather-icon>', () => {
  it('draws one layer per piece of artwork, with the moon at night', async () => {
    const day = await icon({ description: { sky: 'clear' } });
    expect(day.renderRoot.querySelectorAll('.layer')).toHaveLength(ICON_ART['clear-day'].length);
    const night = await icon({ description: { sky: 'clear', night: true } });
    expect(night.renderRoot.querySelectorAll('.layer')).toHaveLength(ICON_ART['clear-night'].length);
  });

  it('shows a named icon, or the description when the name has no artwork', async () => {
    expect((await icon({ icon: 'snow', description: { sky: 'clear' } })).shown).toBe('snow');
    expect((await icon({ icon: 'tornado', description: { sky: 'clear' } })).shown).toBe('clear-day');
    expect((await icon({})).shown).toBe('not-available');
  });

  it('draws rain as lines, not drops', async () => {
    for (const condition of ['rainy', 'pouring']) {
      const el = await icon({ description: haDescription(condition) });
      expect(el.renderRoot.querySelectorAll('.layer path[stroke-linecap="round"]').length, condition).toBeGreaterThanOrEqual(3);
      expect(el.renderRoot.querySelector('.layer circle'), condition).toBeNull();
    }
  });

  it('pauses its animations when not animated', async () => {
    const el = await icon({ icon: 'rain', animated: false });
    expect(el.renderRoot.querySelector('.icon')?.classList.contains('paused')).toBe(true);
    el.animated = true;
    await el.updateComplete;
    expect(el.renderRoot.querySelector('.icon')?.classList.contains('paused')).toBe(false);
  });
});
