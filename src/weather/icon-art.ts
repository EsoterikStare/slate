// Slate's weather icons: layered and built for a Raspberry Pi kiosk.
//
// Shapes are derived from Meteocons by Bas Milius (MIT, see
// METEOCONS-LICENSE.txt), redrawn for viewing across a room: thicker rain,
// larger outlined snowflakes and hail, heavier fog and wind lines, a darker
// storm cloud, and a back cloud on "cloudy" so every icon carries similar
// weight.
//
// Each icon is a stack of layers. A layer is a static drawing on the shared
// 64×64 canvas; animation only moves or fades whole layers (CSS transform /
// opacity), which the GPU composites without redrawing. Animating inside the
// SVG (SMIL) instead re-rasterises every frame, which ran at under 1 fps on
// the Pi.

import type { IconName } from './conditions';

export type Motion = 'drift' | 'spin' | 'rain' | 'pour' | 'snow' | 'hail' | 'flash' | 'fog' | 'wind' | 'rock' | 'twinkle';

export interface Layer {
  /** SVG markup drawn on the 64×64 canvas (the layer's <svg> wrapper is added for it). */
  art: string;
  motion?: Motion;
  /** Seconds; negative starts the cycle part-way, to stagger drops and flakes. */
  delay?: number;
  /** Rotation centre for spin/rock/snow, in canvas units. */
  origin?: [number, number];
  /** Mirror a drift/fog/wind layer's direction. */
  reverse?: boolean;
}

/** Gradients shared by every layer of an icon. */
export const DEFS = `
  <linearGradient id="slate-cloud" x1="0.2" y1="0" x2="0.65" y2="1">
    <stop offset="0" stop-color="#f6f9fe"/><stop offset=".45" stop-color="#f3f7fe"/><stop offset="1" stop-color="#d9e6f8"/>
  </linearGradient>
  <linearGradient id="slate-cloud-back" x1="0.2" y1="0" x2="0.65" y2="1">
    <stop offset="0" stop-color="#d9e2ee"/><stop offset="1" stop-color="#b9c6d8"/>
  </linearGradient>
  <linearGradient id="slate-cloud-dark" x1="0.2" y1="0" x2="0.65" y2="1">
    <stop offset="0" stop-color="#a3abb8"/><stop offset=".45" stop-color="#9aa2b0"/><stop offset="1" stop-color="#6b7383"/>
  </linearGradient>
  <linearGradient id="slate-sun" x1="0.25" y1="0.05" x2="0.75" y2="0.95">
    <stop offset="0" stop-color="#fcc537"/><stop offset=".45" stop-color="#fbbf24"/><stop offset="1" stop-color="#f59e0b"/>
  </linearGradient>
  <linearGradient id="slate-moon" x1="0.25" y1="0.05" x2="0.75" y2="0.95">
    <stop offset="0" stop-color="#a5d4e8"/><stop offset=".45" stop-color="#86c3db"/><stop offset="1" stop-color="#5eafcf"/>
  </linearGradient>
  <linearGradient id="slate-bolt" x1="0.25" y1="0.05" x2="0.75" y2="0.95">
    <stop offset="0" stop-color="#fcd34d"/><stop offset=".45" stop-color="#f7b23b"/><stop offset="1" stop-color="#f59e0b"/>
  </linearGradient>
  <radialGradient id="slate-hail" cx="0.38" cy="0.35" r="0.7">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7dcf2"/>
  </radialGradient>`;

// --- shapes ---------------------------------------------------------------

const CLOUD_D =
  'M46.5 31.5h-.32a10.49 10.49 0 00-19.11-8 7 7 0 00-10.57 6 7.21 7.21 0 00.1 1.14A7.5 7.5 0 0018 45.5a4.19 4.19 0 00.5 0v0h28a7 7 0 000-14z';

/**
 * Clouds, rain, fog and wind are slightly see-through, as Meteocons' were.
 * Set on the shapes, so it's drawn into each layer once: no per-frame cost.
 */
const CLOUD_OPACITY = 0.85;
const LINE_OPACITY = 0.9;

const cloud = `<path opacity="${CLOUD_OPACITY}" fill="url(#slate-cloud)" stroke="#d3deee" stroke-width="0.5" d="${CLOUD_D}"/>`;
const stormCloud = `<path opacity="${CLOUD_OPACITY}" fill="url(#slate-cloud-dark)" stroke="#7d8696" stroke-width="0.5" d="${CLOUD_D}"/>`;
/** A smaller, darker cloud up and to the right, behind the main one. */
const backCloud = `<path opacity="${CLOUD_OPACITY}" fill="url(#slate-cloud-back)" stroke="#c0cbda" stroke-width="0.6" transform="translate(13 -9) scale(0.78)" d="${CLOUD_D}"/>`;

const sunCore = `<circle cx="32" cy="32" r="10.5" fill="url(#slate-sun)" stroke="#f6ad1d" stroke-width="0.5"/>`;
const sunRays = `<path fill="none" stroke="#fbbf24" stroke-linecap="round" stroke-width="3.4" d="M32 15.71V9.5m0 45v-6.21m11.52-27.81l4.39-4.39M16.09 47.91l4.39-4.39m0-23l-4.39-4.39m31.82 31.78l-4.39-4.39M15.71 32H9.5m45 0h-6.21"/>`;
const smallSunCore = `<circle cx="19" cy="24" r="5.4" fill="url(#slate-sun)" stroke="#f6ad1d" stroke-width="0.5"/>`;
const smallSunRays = `<path fill="none" stroke="#fbbf24" stroke-linecap="round" stroke-width="2.6" d="M19 15.67V12.5m0 23v-3.17m5.89-14.22l2.24-2.24M10.87 32.13l2.24-2.24m0-11.78l-2.24-2.24m16.26 16.26l-2.24-2.24M7.5 24h3.17m19.83 0h-3.17"/>`;

const moon = `<path fill="url(#slate-moon)" stroke="#6cb3d2" stroke-linejoin="round" stroke-width="0.5" d="M46.66 36.2a16.66 16.66 0 01-16.78-16.55 16.29 16.29 0 01.55-4.15A16.56 16.56 0 1048.5 36.1c-.61.06-1.22.1-1.84.1z"/>`;
const smallMoon = `<path fill="url(#slate-moon)" stroke="#6cb3d2" stroke-linejoin="round" stroke-width="0.5" d="M29.33 26.68a10.61 10.61 0 01-10.68-10.54A10.5 10.5 0 0119 13.5a10.54 10.54 0 1011.5 13.11 11.48 11.48 0 01-1.17.07z"/>`;
const star = (x: number, y: number, r: number) =>
  `<path fill="#e8f3fb" stroke="#86c3db" stroke-width="0.6" stroke-linejoin="round" d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z"/>`;

/** A rain line hanging under the cloud at x: bold and slanted (Meteocons' were 2×5 units). */
const rainStreak = (x: number, length = 9) =>
  `<path opacity="${LINE_OPACITY}" fill="none" stroke="#2f86f6" stroke-linecap="round" stroke-width="3.4" d="M${x + 1.4} 47l-${(length * 0.2).toFixed(2)} ${length}"/>`;

/** Six-armed snowflake at (x, y): a blue outline stroke under a white one, readable on white. */
const snowflake = (x: number, y: number) => {
  const a = 4.6;
  const dx = a * Math.cos(Math.PI / 6);
  const dy = a / 2;
  const d = `M${x} ${y - a}V${y + a}M${x - dx} ${y - dy}L${x + dx} ${y + dy}M${x - dx} ${y + dy}L${x + dx} ${y - dy}`;
  return (
    `<path fill="none" stroke="#5b8fcc" stroke-linecap="round" stroke-width="3.4" d="${d}"/>` +
    `<path fill="none" stroke="#f8fbff" stroke-linecap="round" stroke-width="1.8" d="${d}"/>`
  );
};
const hailstone = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="3.3" fill="url(#slate-hail)" stroke="#86acd8" stroke-width="0.6"/>`;

const bolt = `<path fill="url(#slate-bolt)" stroke="#d98a0b" stroke-linejoin="round" stroke-width="0.5" d="M30 36l-4 12h4l-2 10 10-14h-6l4-8h-6z"/>`;

const fogLine = (y: number, x1: number, x2: number) =>
  `<path opacity="${LINE_OPACITY}" fill="none" stroke="#d3d8df" stroke-linecap="round" stroke-width="3.6" d="M${x1} ${y}H${x2}"/>`;
const windUpper = `<path opacity="${LINE_OPACITY}" fill="none" stroke="#e6eaf0" stroke-linecap="round" stroke-width="3.6" d="M43.64 20a5 5 0 113.61 8.46h-35.5"/>`;
const windLower = `<path opacity="${LINE_OPACITY}" fill="none" stroke="#d6dce5" stroke-linecap="round" stroke-width="3.6" d="M29.14 44a5 5 0 103.61-8.46h-21"/>`;

const question = `<text x="32" y="43" text-anchor="middle" font-family="Roboto, system-ui, sans-serif" font-weight="700" font-size="17" fill="#4f5867">?</text>`;

// --- icons ----------------------------------------------------------------

const DROP_X = [24, 31, 38];
/** Snowflakes are wider than rain lines, so they spread further. */
const FLAKE_X = [19, 32, 45];
/** The middle one hangs lower so they read as falling, not as a row. */
const FLAKE_Y = [50, 54.5, 50];
const STAGGER = [0, -0.4, -0.2];
/** Heavy rain: five longer lines, closer together, falling faster. */
const HEAVY_X = [20, 25.5, 31, 36.5, 42];
const HEAVY_STAGGER = [0, -0.3, -0.12, -0.42, -0.2];

const sun = (): Layer[] => [
  { art: sunRays, motion: 'spin', origin: [32, 32] },
  { art: sunCore },
];
const smallSun = (): Layer[] => [
  { art: smallSunRays, motion: 'spin', origin: [19, 24] },
  { art: smallSunCore },
];
const smallMoonLayer = (): Layer => ({ art: smallMoon, motion: 'rock', origin: [20, 20] });
const rain = (xs = DROP_X): Layer[] => xs.map((x, i) => ({ art: rainStreak(x), motion: 'rain', delay: STAGGER[i] }));
/** Storm rain falls either side of the bolt rather than behind it. */
const STORM_X = [18, 41, 47];
const lightning = (): Layer => ({ art: bolt, motion: 'flash' });

export const ICON_ART: Record<IconName, Layer[]> = {
  'clear-day': sun(),
  'clear-night': [
    { art: star(13, 15, 4.2), motion: 'twinkle' },
    { art: star(52, 47, 3.4), motion: 'twinkle', delay: -1.5 },
    { art: moon, motion: 'rock', origin: [32, 32] },
  ],
  'partly-cloudy-day': [...smallSun(), { art: cloud, motion: 'drift' }],
  'partly-cloudy-night': [smallMoonLayer(), { art: cloud, motion: 'drift' }],
  cloudy: [
    { art: backCloud, motion: 'drift', reverse: true },
    { art: cloud, motion: 'drift' },
  ],
  rain: [...rain(), { art: cloud }],
  'heavy-rain': [
    ...HEAVY_X.map((x, i): Layer => ({ art: rainStreak(x, 11), motion: 'pour', delay: HEAVY_STAGGER[i] })),
    { art: stormCloud },
  ],
  snow: [
    ...FLAKE_X.map((x, i): Layer => ({ art: snowflake(x, FLAKE_Y[i]!), motion: 'snow', delay: [0, -2.6, -1.3][i], origin: [x, FLAKE_Y[i]!] })),
    { art: cloud },
  ],
  sleet: [
    { art: snowflake(21, 50.5), motion: 'snow', origin: [21, 50.5] },
    { art: rainStreak(32), motion: 'rain', delay: -0.35 },
    { art: snowflake(43, 50.5), motion: 'snow', delay: -2, origin: [43, 50.5] },
    { art: cloud },
  ],
  hail: [
    ...[22, 32, 42].map((x, i): Layer => ({ art: hailstone(x, FLAKE_Y[i]!), motion: 'hail', delay: [0, -0.4, -0.2][i] })),
    { art: cloud },
  ],
  'thunderstorms-day': [...smallSun(), { art: stormCloud }, lightning()],
  'thunderstorms-night': [smallMoonLayer(), { art: stormCloud }, lightning()],
  'thunderstorms-day-rain': [...smallSun(), ...rain(STORM_X), { art: stormCloud }, lightning()],
  'thunderstorms-night-rain': [smallMoonLayer(), ...rain(STORM_X), { art: stormCloud }, lightning()],
  'fog-day': [
    { art: `<g transform="translate(0 -6)">${sunRays}</g>`, motion: 'spin', origin: [32, 26] },
    { art: `<g transform="translate(0 -6)">${sunCore}</g>` },
    { art: fogLine(42, 15, 49), motion: 'fog' },
    { art: fogLine(48.5, 19, 45), motion: 'fog', reverse: true },
    { art: fogLine(55, 17, 47), motion: 'fog' },
  ],
  'fog-night': [
    { art: `<g transform="translate(0 -6)">${moon}</g>`, motion: 'rock', origin: [32, 26] },
    { art: fogLine(42, 15, 49), motion: 'fog' },
    { art: fogLine(48.5, 19, 45), motion: 'fog', reverse: true },
    { art: fogLine(55, 17, 47), motion: 'fog' },
  ],
  wind: [
    { art: windUpper, motion: 'wind' },
    { art: windLower, motion: 'wind', delay: -1 },
  ],
  'not-available': [{ art: cloud }, { art: question }],
};
