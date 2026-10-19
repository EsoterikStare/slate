import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeHass, type FakeHassOptions } from '../ha/fake-hass';
import type { ForecastEntry } from '../weather/forecast';
import './wall-weather';
import type { WallWeather, WallWeatherConfig } from './wall-weather';

const NOW = new Date(2026, 9, 18, 10, 0); // Sunday
const day = (d: number, condition: string, hi: number, lo: number, pop?: number): ForecastEntry => ({
  datetime: new Date(2026, 9, d, 12).toISOString(),
  condition,
  temperature: hi,
  templow: lo,
  precipitation_probability: pop,
});
const forecast = [
  day(18, 'sunny', 78, 55, 10),
  day(19, 'partlycloudy', 70, 52),
  day(20, 'rainy', 64, 50, 80),
  day(21, 'pouring', 61, 49),
  day(22, 'sunny', 68, 51),
  day(23, 'sunny', 73, 54),
  day(24, 'cloudy', 66, 50),
];
const home = {
  state: 'sunny',
  attributes: {
    temperature: 72.4,
    apparent_temperature: 70,
    humidity: 45,
    wind_speed: 8,
    wind_speed_unit: 'mph',
    temperature_unit: '°F',
  },
};

let el: WallWeather | undefined;

async function mount(config: Partial<WallWeatherConfig> = {}, hassOpts: FakeHassOptions = {}) {
  const hass = createFakeHass({
    entities: { 'weather.forecast_home': home, 'sun.sun': { state: 'above_horizon' } },
    forecasts: { 'weather.forecast_home': forecast },
    ...hassOpts,
  });
  el = document.createElement('wall-weather');
  el.setConfig({ type: 'custom:wall-weather', entity: 'weather.forecast_home', ...config });
  el.hass = hass;
  document.body.append(el);
  await settle();
  return { el, hass };
}
async function settle() {
  await el!.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el!.updateComplete;
}
const $ = (sel: string) => el!.shadowRoot!.querySelector<HTMLElement>(sel);
const $$ = (sel: string) => [...el!.shadowRoot!.querySelectorAll<HTMLElement>(sel)];
const text = (n: Element | null | undefined) => n?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  el?.remove();
  el = undefined;
  vi.useRealTimers();
});

describe('wall-weather', () => {
  it('subscribes to the daily forecast for its entity', async () => {
    const { hass } = await mount();
    expect(hass.subscriptions.map((s) => s.message)).toEqual([
      { type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: 'weather.forecast_home' },
    ]);
  });

  it('shows current temperature, condition, and today’s high/low from the forecast', async () => {
    await mount();
    expect(text($('.temperature'))).toBe('72°');
    expect(text($('.condition'))).toBe('Sunny');
    expect(text($('.high-low'))).toBe('H 78° · L 55°');
    expect((($('.current-icon') as unknown) as { icon: string }).icon).toBe('clear-day');
  });

  it('shows the configured number of days after today', async () => {
    await mount({ forecast_days: 3 });
    expect($$('.forecast .day-name').map(text)).toEqual(['Mon', 'Tue', 'Wed']);
    expect($$('.forecast .day-temps').map(text)).toEqual(['70° 52°', '64° 50°', '61° 49°']);
  });

  it('converts to Celsius when asked', async () => {
    await mount({ unit: 'C' });
    expect(text($('.temperature'))).toBe('22°');
    expect(text($('.high-low'))).toBe('H 26° · L 13°');
  });

  it('lists the configured current details in order, skipping ones the entity lacks', async () => {
    await mount({ current: ['wind', 'feels_like', 'precipitation'] });
    expect(text($('.details'))).toBe('8 mph wind · Feels 70° · 10% rain');

    el!.remove();
    await mount(
      { current: ['humidity', 'feels_like'] },
      { entities: { 'weather.forecast_home': { state: 'sunny', attributes: { temperature: 70, humidity: 30 } } } },
    );
    expect(text($('.details'))).toBe('30% humidity');
  });

  it('uses night icons for current conditions after sunset', async () => {
    await mount({}, {
      entities: { 'weather.forecast_home': { ...home, state: 'partlycloudy' }, 'sun.sun': { state: 'below_horizon' } },
    });
    expect((($('.current-icon') as unknown) as { icon: string }).icon).toBe('partly-cloudy-night');
    // Forecast days always use day icons.
    expect((($('.day-icon') as unknown) as { icon: string }).icon).toBe('partly-cloudy-day');
  });

  it('updates when HA pushes a new forecast', async () => {
    const { hass } = await mount({ forecast_days: 1 });
    hass.pushForecast('weather.forecast_home', [day(18, 'sunny', 80, 60), day(19, 'snowy', 30, 20)]);
    await settle();
    expect(text($('.high-low'))).toBe('H 80° · L 60°');
    expect($$('.forecast .day-temps').map(text)).toEqual(['30° 20°']);
  });

  it('unsubscribes when removed from the page', async () => {
    const { hass } = await mount();
    el!.remove();
    await settle();
    expect(hass.subscriptions.every((s) => !s.active)).toBe(true);
  });

  it('can show only the forecast strip, or only current conditions', async () => {
    await mount({ show: 'forecast' });
    expect($('.current')).toBeNull();
    expect($$('.forecast .day')).toHaveLength(5);
    el!.remove();
    await mount({ show: 'current' });
    expect($('.forecast')).toBeNull();
    expect(text($('.temperature'))).toBe('72°');
  });

  it('says so when the forecast subscription fails, and still shows current conditions', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount({}, { forecasts: {} });
    expect(text($('.forecast-error'))).toBe('Forecast unavailable');
    expect(text($('.temperature'))).toBe('72°');
    warn.mockRestore();
  });

  it('reports a missing entity instead of crashing', async () => {
    await mount({ entity: 'weather.nope' });
    expect(text($('.missing'))).toContain('weather.nope');
  });

  it.each([
    [{ entity: 'sensor.temp' }, /weather entity/],
    [{ forecast_days: -1 }, /forecast_days/],
    [{ current: ['pollen'] }, /pollen/],
  ])('rejects bad config %j', (bad, message) => {
    const c = document.createElement('wall-weather');
    expect(() => c.setConfig({ type: 'custom:wall-weather', entity: 'weather.x', ...(bad as object) } as never)).toThrow(
      message,
    );
  });
});
