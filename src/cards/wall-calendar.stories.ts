import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { WallCalendarConfig } from '../calendar/config';
import { addDays, buildWeeks } from '../calendar/dates';
import { createFakeHass } from '../ha/fake-hass';
import type { HaCalendarEvent } from '../ha/types';
import './wall-calendar';

// Sample data relative to the current week so the story always looks "live".
const week0 = buildWeeks(new Date(), 'sunday', 1)[0]![0]!;
const iso = (day: number, h: number, m = 0) => {
  const d = addDays(week0, day);
  d.setHours(h, m);
  return { dateTime: d.toISOString() };
};
const date = (day: number) => {
  const d = addDays(week0, day);
  return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
};
const timed = (summary: string, day: number, h: number, m: number, endH: number, endM = 0): HaCalendarEvent => ({
  summary,
  start: iso(day, h, m),
  end: iso(day, endH, endM),
});
const allDay = (summary: string, day: number, days: number): HaCalendarEvent => ({
  summary,
  start: date(day),
  end: date(day + days),
});

const gameNight = (day: number) => timed('Game night', day, 18, 0, 22);

const calendars: Record<string, HaCalendarEvent[]> = {
  'calendar.alex': [gameNight(1), gameNight(8), gameNight(15), timed('Dentist', 4, 15, 30, 16, 30)],
  'calendar.sam': [
    timed('Pick up groceries', 9, 1, 30, 2, 30),
    timed('Movie night', 9, 18, 0, 20, 30),
    timed('Choir rehearsal', 16, 16, 30, 18, 30),
    timed('Book club', 3, 19, 0, 21),
  ],
  'calendar.jamie': [
    timed('Art club', 2, 11, 0, 11, 50),
    timed('Neighborhood Cleanup', 2, 13, 30, 14, 20),
    timed('Bowling', 3, 11, 0, 13),
    timed('Science Fair Setup', 9, 10, 30, 13),
    timed('Piano lesson', 10, 13, 0, 16),
    timed('Bowling', 17, 11, 0, 13),
  ],
  'calendar.family': [allDay('Grandma visiting', 1, 3), allDay('Camping trip', 5, 4), gameNight(1)],
  'calendar.kids': [timed('Library story time', 10, 10, 0, 11)],
  'calendar.school': [allDay('No school', 12, 1), timed('Parent-teacher conf.', 11, 16, 0, 16, 30)],
  'calendar.garden': [timed('Plant garlic', 13, 9, 0, 11)],
};

const hass = createFakeHass({ calendars });

const baseConfig: WallCalendarConfig = {
  type: 'custom:wall-calendar',
  calendars: [
    { entity: 'calendar.alex', name: 'Alex', color: 'dodgerblue' },
    { entity: 'calendar.sam', name: 'Sam', color: 'tomato' },
    { entity: 'calendar.jamie', name: 'Jamie', color: 'chartreuse' },
    { entity: 'calendar.family', name: 'Family', color: 'gold' },
    { entity: 'calendar.kids', name: 'Kids', color: 'indigo' },
    { entity: 'calendar.school', name: 'School', color: 'darkorange' },
    { entity: 'calendar.garden', name: 'Garden', color: 'darkgreen' },
  ],
};

interface Args {
  weeks: number;
  first_day: 'sunday' | 'monday';
  scale: number;
  event_title: number;
  min_events_per_day: number;
  past_events: 'dim' | 'hide';
  relative_day_names: boolean;
  /** Height the calendar may use, as wall-layout would set it. 0 = unlimited. */
  availableHeight: number;
}

const meta: Meta<Args> = {
  title: 'Cards/wall-calendar',
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
    const config: WallCalendarConfig = {
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
    const el = document.createElement('wall-calendar');
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
