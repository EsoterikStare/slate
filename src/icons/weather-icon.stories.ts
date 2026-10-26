// Every icon the card can show, at the forecast and current-weather sizes,
// over dark and deliberately hard backgrounds. "Compare" adds the Meteocons
// icon the card used before, for judging weight and legibility side by side.

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ORIGINAL_ICONS } from '../stories/meteocons-original';
import { hardPhotos } from '../stories/fixtures';
import { conditionLabel } from '../weather/conditions';
import { haDescription } from './adapters/home-assistant';
import { resolveIcon } from './describe';
import './weather-icon';

// What the old mapping picked for each condition (rainy was the dot "drizzle").
const OLD_ICON: Record<string, [string, string?]> = {
  sunny: ['clear-day', 'clear-night'],
  partlycloudy: ['partly-cloudy-day', 'partly-cloudy-night'],
  cloudy: ['cloudy'],
  fog: ['fog-day', 'fog-night'],
  rainy: ['drizzle'],
  pouring: ['rain'],
  'lightning-rainy': ['thunderstorms-day-rain', 'thunderstorms-night-rain'],
  lightning: ['thunderstorms-day', 'thunderstorms-night'],
  snowy: ['snow'],
  'snowy-rainy': ['sleet'],
  hail: ['hail'],
  windy: ['wind'],
  exceptional: ['not-available'],
};

const tiles = Object.entries(OLD_ICON).flatMap(([condition, [day, night]]) => [
  { condition, night: false, old: day },
  ...(night ? [{ condition, night: true, old: night }] : []),
]);

interface Args {
  background: 'dark' | keyof typeof hardPhotos;
  size: number;
  compare: boolean;
  animated: boolean;
}

const backgroundCss = (b: Args['background']) => (b === 'dark' ? '#000' : `center / cover url("${hardPhotos[b]}")`);

const meta: Meta<Args> = {
  title: 'Weather/Icons',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    background: { control: 'inline-radio', options: ['dark', ...Object.keys(hardPhotos)] },
    size: { control: 'inline-radio', options: [67, 138] },
  },
  args: { background: 'dark', size: 138, compare: true, animated: true },
  render: ({ background, size, compare, animated }) => html`<div
    style="display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; min-height: 100vh; box-sizing: border-box;
           align-content: flex-start; background: ${backgroundCss(background)}; font: 13px system-ui; color: #fff;
           text-shadow: 0 0 4px #000"
  >
    ${tiles.map(
      (t) => html`<figure style="margin: 0; text-align: center">
        <div style="display: flex; gap: 6px">
          <slate-weather-icon
            style="font-size: ${size}px"
            .icon=${resolveIcon(haDescription(t.condition, t.night))}
            .animated=${animated}
          ></slate-weather-icon>
          ${compare
            ? html`<img
                style="width: ${size}px; height: ${size}px; opacity: 0.85"
                alt=""
                src=${`data:image/svg+xml,${encodeURIComponent(ORIGINAL_ICONS[t.old]!)}`}
              />`
            : ''}
        </div>
        <figcaption>${conditionLabel(t.condition)}${t.night ? ' (night)' : ''}${compare ? ' · new | old' : ''}</figcaption>
      </figure>`,
    )}
  </div>`,
};
export default meta;

type Story = StoryObj<Args>;
export const Gallery: Story = {};
export const OverSky: Story = { args: { background: 'sky' } };
export const ForecastSize: Story = { args: { size: 67, compare: false } };
