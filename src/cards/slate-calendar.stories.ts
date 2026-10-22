import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { SlateCalendarConfig } from '../calendar/config';
import { createFakeHass } from '../ha/fake-hass';
import { calendarConfig, calendars } from '../stories/fixtures';
import './slate-calendar';

const hass = createFakeHass({ calendars });
const baseConfig = calendarConfig;

interface Args {
  weeks: number;
  first_day: 'sunday' | 'monday';
  scale: number;
  event_title: number;
  min_events_per_day: number;
  past_events: 'dim' | 'hide';
  relative_day_names: boolean;
  /** Height the calendar may use, as slate-layout would set it. 0 = unlimited. */
  availableHeight: number;
}

const meta: Meta<Args> = {
  title: 'Cards/slate-calendar',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    weeks: { control: { type: 'range', min: 1, max: 6 } },
    first_day: { control: 'inline-radio', options: ['sunday', 'monday'] },
    scale: { control: { type: 'range', min: 0.6, max: 1.8, step: 0.05 } },
    event_title: { control: { type: 'range', min: 0.6, max: 1.8, step: 0.05 } },
    min_events_per_day: { control: { type: 'range', min: 0, max: 5 } },
    past_events: { control: 'inline-radio', options: ['dim', 'hide'] },
    availableHeight: { control: { type: 'range', min: 0, max: 1900, step: 10 } },
  },
  args: {
    weeks: 3,
    first_day: 'sunday',
    scale: 1,
    event_title: 1,
    min_events_per_day: 2,
    past_events: 'dim',
    relative_day_names: false,
    availableHeight: 0,
  },
  render: (args) => {
    const config: SlateCalendarConfig = {
      ...baseConfig,
      weeks: args.weeks,
      first_day: args.first_day,
      scale: args.scale,
      text: { event_title: args.event_title },
      min_events_per_day: args.min_events_per_day,
      past_events: args.past_events,
      relative_day_names: args.relative_day_names,
    };
    // A fresh element per render so setConfig() sees every arg change.
    const el = document.createElement('slate-calendar');
    el.setConfig(config);
    el.hass = hass;
    if (args.availableHeight > 0) el.availableHeight = args.availableHeight;
    return html`
      <div
        style="width: 1080px; height: 1920px; display: flex; flex-direction: column; justify-content: flex-end;
               padding: 16px; box-sizing: border-box;
               background: linear-gradient(160deg, #3b5a40 0%, #2a3b2c 45%, #4a4235 100%)"
      >
        ${el}
      </div>
    `;
  },
};
export default meta;

export const Default: StoryObj<Args> = {};
export const MondayStart: StoryObj<Args> = { args: { first_day: 'monday' } };
export const BigText: StoryObj<Args> = { args: { scale: 1.3 } };
export const Squeezed: StoryObj<Args> = { args: { availableHeight: 700 } };
export const FourWeeks: StoryObj<Args> = { args: { weeks: 4 } };
