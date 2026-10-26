import { afterEach, describe, expect, it } from 'vitest';
import { ICON_ART } from './icon-art';
import { layerStyle, SlateWeatherIcon } from './weather-icon';

async function icon(props: Partial<Pick<SlateWeatherIcon, 'condition' | 'night' | 'animated'>>) {
  const el = Object.assign(document.createElement('slate-weather-icon'), props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
afterEach(() => document.body.replaceChildren());

describe('layerStyle', () => {
  it('animates moving layers with their delay, and leaves static layers alone', () => {
    expect(layerStyle({ art: '' })).toEqual({});
    expect(layerStyle({ art: '', motion: 'rain', delay: -0.4 }).animation).toBe('slate-rain 0.7s linear -0.4s infinite normal');
    expect(layerStyle({ art: '', motion: 'drift', reverse: true }).animation).toContain('alternate-reverse');
  });

  it('turns a canvas origin into a percentage of the icon', () => {
    expect(layerStyle({ art: '', motion: 'spin', origin: [32, 16] })['transform-origin']).toBe('50% 25%');
  });
});

describe('<slate-weather-icon>', () => {
  it('draws one layer per piece of artwork, with the moon at night', async () => {
    const day = await icon({ condition: 'sunny' });
    expect(day.renderRoot.querySelectorAll('.layer')).toHaveLength(ICON_ART['clear-day'].length);
    const night = await icon({ condition: 'sunny', night: true });
    expect(night.renderRoot.querySelectorAll('.layer')).toHaveLength(ICON_ART['clear-night'].length);
  });

  it('draws rain as lines, not drops', async () => {
    for (const condition of ['rainy', 'pouring']) {
      const el = await icon({ condition });
      expect(el.renderRoot.querySelectorAll('.layer path[stroke-linecap="round"]').length, condition).toBeGreaterThanOrEqual(3);
      expect(el.renderRoot.querySelector('.layer circle'), condition).toBeNull();
    }
  });

  it('pauses its animations when not animated', async () => {
    const el = await icon({ condition: 'rainy', animated: false });
    expect(el.renderRoot.querySelector('.icon')?.classList.contains('paused')).toBe(true);
    el.animated = true;
    await el.updateComplete;
    expect(el.renderRoot.querySelector('.icon')?.classList.contains('paused')).toBe(false);
  });

  it('carries the shadow filter its layers reference', async () => {
    const el = await icon({ condition: 'cloudy' });
    expect(el.renderRoot.querySelector('.defs filter#slate-icon-shadow')).not.toBeNull();
  });
});
