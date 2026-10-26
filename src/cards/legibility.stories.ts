// Side-by-side comparison of the legibility aids over deliberately hard
// backgrounds: the previous look, shadows only, the scrim gradient only, and
// both. Each panel is a real slate-layout at a 9:16 portrait size (the layout
// scales with width, so this is the kiosk in miniature).

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createFakeHass } from '../ha/fake-hass';
import { calendarConfig, calendars, forecast, hardPhotos, weatherEntity } from '../stories/fixtures';
import './slate-calendar';
import './slate-clock';
import './slate-layout';
import type { SlateLayoutConfig } from './slate-layout';
import './slate-weather';

const PREVIOUS_SHADOW = '0 0.04em 0.25em rgba(0, 0, 0, 0.5)';

const variants = [
  { label: 'Before', scrim: 0, previousShadows: true },
  { label: 'Shadows only', scrim: 0, previousShadows: false },
  { label: 'Gradient only', scrim: 0.5, previousShadows: true },
  { label: 'Gradient + shadows', scrim: 0.5, previousShadows: false },
];

interface Args {
  photo: keyof typeof hardPhotos;
  strength: number;
  width: number;
}

const meta: Meta<Args> = {
  title: 'Dashboard/Legibility comparison',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    photo: { control: 'inline-radio', options: Object.keys(hardPhotos) },
    strength: { control: { type: 'range', min: 0.1, max: 0.9, step: 0.05 } },
    width: { control: { type: 'range', min: 300, max: 700, step: 10 } },
  },
  args: { photo: 'sky', strength: 0.5, width: 390 },
  render: ({ photo, strength, width }) => {
    const hass = createFakeHass({
      calendars,
      entities: { 'weather.forecast_home': weatherEntity('partlycloudy'), 'sun.sun': { state: 'above_horizon' } },
      forecasts: { 'weather.forecast_home': forecast },
    });
    const height = Math.round((width * 16) / 9);
    return html`<div
      style="display: grid; grid-template-columns: repeat(2, ${width}px); gap: 12px; padding: 12px;
             background: #222; font: 14px system-ui; color: #ddd; width: max-content"
    >
      ${variants.map((v) => {
        const config: SlateLayoutConfig = {
          type: 'custom:slate-layout',
          background: { url: hardPhotos[photo] },
          scrim: v.scrim ? strength : 0,
          icon_shadow: !v.previousShadows,
          top: [
            [
              { type: 'custom:slate-clock' },
              { type: 'custom:slate-weather', entity: 'weather.forecast_home', show: 'current', current: ['feels_like', 'precipitation'] },
            ],
            { cards: [{ type: 'custom:slate-weather', entity: 'weather.forecast_home', show: 'forecast', forecast_days: 5 }], collapsible: true },
          ],
          bottom: { ...calendarConfig, weeks: 2 },
        };
        const el = document.createElement('slate-layout');
        el.setConfig(config);
        el.hass = hass;
        if (v.previousShadows) el.style.setProperty('--slate-text-shadow', PREVIOUS_SHADOW);
        return html`<div>
          <div style="margin-bottom: 6px">${v.label}</div>
          <div style="width: ${width}px; --slate-layout-height: ${height}px">${el}</div>
        </div>`;
      })}
    </div>`;
  },
};
export default meta;

export const Sky: StoryObj<Args> = {};
export const Snow: StoryObj<Args> = { args: { photo: 'snow' } };
export const Foliage: StoryObj<Args> = { args: { photo: 'foliage' } };
