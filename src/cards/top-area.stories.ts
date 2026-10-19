// Clock + weather arranged the way wall-layout will place them: clock and
// current conditions side by side, the forecast strip full-width beneath.
// --wall-unit is set by hand here (1% of 1080px), as wall-layout will.

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createFakeHass } from '../ha/fake-hass';
import { forecast, weatherEntity } from '../stories/fixtures';
import { HA_CONDITIONS } from '../weather/conditions';
import './wall-clock';
import './wall-weather';

const makeHass = (condition: string, night: boolean) =>
  createFakeHass({
    entities: {
      'weather.forecast_home': weatherEntity(condition),
      'sun.sun': { state: night ? 'below_horizon' : 'above_horizon' },
    },
    forecasts: { 'weather.forecast_home': forecast },
  });

interface Args {
  condition: string;
  night: boolean;
  forecast_days: number;
  unit: 'F' | 'C';
  time_format: 12 | 24;
  animations: boolean;
  scale: number;
}

const meta: Meta<Args> = {
  title: 'Cards/Top area (clock + weather)',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    condition: { control: 'select', options: [...HA_CONDITIONS] },
    forecast_days: { control: { type: 'range', min: 0, max: 7 } },
    unit: { control: 'inline-radio', options: ['F', 'C'] },
    time_format: { control: 'inline-radio', options: [12, 24] },
    scale: { control: { type: 'range', min: 0.6, max: 1.6, step: 0.05 } },
  },
  args: { condition: 'partlycloudy', night: false, forecast_days: 5, unit: 'F', time_format: 12, animations: true, scale: 1 },
  render: (args) => {
    const hass = makeHass(args.condition, args.night);
    const clock = document.createElement('wall-clock');
    clock.setConfig({ type: 'custom:wall-clock', time_format: args.time_format });
    const current = document.createElement('wall-weather');
    current.setConfig({
      type: 'custom:wall-weather',
      entity: 'weather.forecast_home',
      show: 'current',
      unit: args.unit,
      current: ['feels_like', 'precipitation'],
      animations: args.animations,
    });
    current.hass = hass;
    const strip = document.createElement('wall-weather');
    strip.setConfig({
      type: 'custom:wall-weather',
      entity: 'weather.forecast_home',
      show: 'forecast',
      forecast_days: args.forecast_days,
      unit: args.unit,
      animations: args.animations,
    });
    strip.hass = hass;
    return html`
      <div
        style="width: 1080px; padding: 32px; box-sizing: border-box; --wall-unit: 10.8px; --wall-scale: ${args.scale};
               background: linear-gradient(160deg, #3b5a40 0%, #2a3b2c 60%, #4a4235 100%); min-height: 760px"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px">
          <div>${clock}</div>
          <div>${current}</div>
        </div>
        ${strip}
      </div>
    `;
  },
};
export default meta;

export const Day: StoryObj<Args> = {};
export const Night: StoryObj<Args> = { args: { condition: 'clear-night', night: true } };
export const Celsius24h: StoryObj<Args> = { args: { unit: 'C', time_format: 24, condition: 'snowy' } };
export const Static: StoryObj<Args> = { args: { animations: false } };
