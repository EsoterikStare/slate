// The whole kiosk at 1080×1920: slate-layout composing background, clock,
// weather and calendar, configured the way the real dashboard YAML would be.

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createFakeHass } from '../ha/fake-hass';
import { calendarConfig, calendars, forecast, photos, weatherEntity } from '../stories/fixtures';
import './slate-calendar';
import './slate-clock';
import './slate-layout';
import type { SlateLayoutConfig } from './slate-layout';
import './slate-weather';

interface Args {
  weeks: number;
  scale: number;
  condition: string;
  /** Simulate night dimming by putting the window around "now". */
  night: boolean;
  /** Extra filler events per day to push the calendar up the screen. */
  busy: number;
  bottom_style: 'docked' | 'floating';
  forecast_placement: 'top' | 'stack' | 'hidden';
}

function busyEvents(perDay: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const events = [];
  for (let d = 0; d < 28; d++) {
    for (let i = 0; i < perDay; i++) {
      const s = new Date(start);
      s.setDate(start.getDate() + d);
      s.setHours(8 + i * 2);
      const e = new Date(s.getTime() + 3_600_000);
      events.push({ summary: `Busy ${i + 1}`, start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() } });
    }
  }
  return events;
}

const meta: Meta<Args> = {
  title: 'Dashboard/Full kiosk',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    weeks: { control: { type: 'range', min: 1, max: 6 } },
    scale: { control: { type: 'range', min: 0.7, max: 1.5, step: 0.05 } },
    condition: { control: 'select', options: ['sunny', 'partlycloudy', 'rainy', 'snowy', 'lightning-rainy', 'clear-night'] },
    busy: { control: { type: 'range', min: 0, max: 6 } },
    bottom_style: { control: 'inline-radio', options: ['docked', 'floating'] },
    forecast_placement: { control: 'inline-radio', options: ['top', 'stack', 'hidden'] },
  },
  args: {
    weeks: 3,
    scale: 1,
    condition: 'partlycloudy',
    night: false,
    busy: 0,
    bottom_style: 'docked',
    forecast_placement: 'top',
  },
  render: (args) => {
    const hass = createFakeHass({
      calendars: { ...calendars, 'calendar.garden': [...calendars['calendar.garden']!, ...busyEvents(args.busy)] },
      entities: {
        'weather.forecast_home': weatherEntity(args.condition),
        'sun.sun': { state: 'above_horizon' },
      },
      forecasts: { 'weather.forecast_home': forecast },
    });
    const now = new Date();
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const config: SlateLayoutConfig = {
      type: 'custom:slate-layout',
      scale: args.scale,
      bottom_style: args.bottom_style,
      background: { urls: photos, interval: 0.25, fade_seconds: 3 },
      night: args.night
        ? { start: hhmm(new Date(now.getTime() - 3_600_000)), end: hhmm(new Date(now.getTime() + 3_600_000)), brightness: 0.35 }
        : undefined,
      top: [
        [
          { type: 'custom:slate-clock' },
          { type: 'custom:slate-weather', entity: 'weather.forecast_home', show: 'current', current: ['feels_like', 'precipitation'] },
        ],
        {
          cards: [{ type: 'custom:slate-weather', entity: 'weather.forecast_home', show: 'forecast', forecast_days: 5 }],
          collapsible: true,
          placement: args.forecast_placement,
        },
      ],
      bottom: { ...calendarConfig, weeks: args.weeks },
    };
    const el = document.createElement('slate-layout');
    el.setConfig(config);
    el.hass = hass;
    return html`<div style="width: 1080px; --slate-layout-height: 1920px">${el}</div>`;
  },
};
export default meta;

export const Default: StoryObj<Args> = {};
export const BusyWeeks: StoryObj<Args> = { args: { busy: 3 } };
export const VeryBusy: StoryObj<Args> = { args: { busy: 6, weeks: 4 } };
export const Night: StoryObj<Args> = { args: { night: true, condition: 'clear-night' } };
export const Floating: StoryObj<Args> = { args: { bottom_style: 'floating' } };
export const ForecastStacked: StoryObj<Args> = { args: { forecast_placement: 'stack' } };
export const ForecastHidden: StoryObj<Args> = { args: { forecast_placement: 'hidden' } };
