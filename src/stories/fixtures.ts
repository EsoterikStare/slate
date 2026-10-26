// Sample Home Assistant data for Storybook: the real 7-calendar setup with
// events placed relative to the current week, so stories always look live.

import { addDays, buildWeeks, startOfDay } from '../calendar/dates';
import type { SlateCalendarConfig } from '../calendar/config';
import type { HaCalendarEvent } from '../ha/types';
import type { ForecastEntry } from '../weather/forecast';

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

export const calendars: Record<string, HaCalendarEvent[]> = {
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

export const calendarConfig: SlateCalendarConfig = {
  type: 'custom:slate-calendar',
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


const today = startOfDay(new Date());
const conditions = ['sunny', 'partlycloudy', 'rainy', 'pouring', 'lightning-rainy', 'snowy', 'cloudy'];
export const forecast: ForecastEntry[] = conditions.map((condition, i) => ({
  datetime: addDays(today, i).toISOString(),
  condition,
  temperature: 78 - i * 3,
  templow: 55 - i * 2,
  precipitation_probability: [10, 20, 70, 90, 60, 40, 15][i],
}));

export const weatherEntity = (condition: string) => ({
  state: condition,
  attributes: {
    temperature: 72,
    apparent_temperature: 70,
    humidity: 45,
    wind_speed: 8,
    wind_speed_unit: 'mph',
    temperature_unit: '°F',
  },
});

/** Stand-in "photos" (SVG gradients) so stories don't depend on the network. */
export const photos = [
  ['#5b7f63', '#2c3e30', '#8a7a55'],
  ['#4f6d8f', '#1f2b3a', '#b0835a'],
  ['#7a5f86', '#2a2033', '#c9a46b'],
].map(
  ([a, b, c]) =>
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><circle cx="820" cy="420" r="160" fill="#fff" opacity="0.12"/><path d="M0 1300 L300 1000 L520 1200 L760 900 L1080 1250 L1080 1920 L0 1920Z" fill="#000" opacity="0.25"/></svg>`,
    ),
);

/** Deterministic pseudo-random numbers, so generated "photos" look the same every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const svgUri = (body: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">${body}</svg>`);

/**
 * Backgrounds chosen to be hard on white text: a bright sky with clouds where
 * the text sits, near-white snow, and busy high-contrast foliage.
 */
export const hardPhotos: Record<'sky' | 'snow' | 'foliage', string> = {
  sky: (() => {
    const r = seeded(7);
    const clouds = Array.from({ length: 26 }, () => {
      const x = r() * 1080;
      const y = 80 + r() * 1300;
      const w = 160 + r() * 260;
      return `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * 0.42}" fill="#fff" opacity="${0.75 + r() * 0.25}"/>`;
    }).join('');
    return svgUri(
      `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc9ef"/><stop offset="1" stop-color="#e3f1fb"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#s)"/>${clouds}`,
    );
  })(),
  snow: (() => {
    const r = seeded(11);
    const drifts = Array.from({ length: 14 }, () => {
      const y = 200 + r() * 1500;
      return `<ellipse cx="${r() * 1080}" cy="${y}" rx="${300 + r() * 400}" ry="${60 + r() * 90}" fill="#dfe6ee" opacity="0.7"/>`;
    }).join('');
    const trees = Array.from({ length: 6 }, () => {
      const x = r() * 1080;
      const y = 300 + r() * 600;
      return `<path d="M${x} ${y} l-40 140 h80 z" fill="#8a9aa6" opacity="0.5"/>`;
    }).join('');
    return svgUri(`<rect width="1080" height="1920" fill="#f4f7fa"/>${drifts}${trees}`);
  })(),
  foliage: (() => {
    const r = seeded(23);
    const colors = ['#1e3d1a', '#2f6b25', '#7fb83f', '#c9e27a', '#f2e66b', '#0f1f0d', '#a7d65a'];
    const leaves = Array.from({ length: 900 }, () => {
      const c = colors[Math.floor(r() * colors.length)];
      return `<ellipse cx="${r() * 1080}" cy="${r() * 1920}" rx="${12 + r() * 38}" ry="${6 + r() * 16}" transform="rotate(${r() * 180})" fill="${c}"/>`;
    }).join('');
    return svgUri(`<rect width="1080" height="1920" fill="#3d7a2e"/>${leaves}`);
  })(),
};
