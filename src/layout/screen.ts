// How wall-layout splits the screen between the top area (clock/weather,
// pinned to the top) and the bottom card (calendar, pinned to the bottom).
// Both are only as tall as their content; the background shows through the
// gap between. When they'd collide, the gap shrinks to its minimum, then the
// top's collapsible rows (the forecast strip) fold away, and whatever height
// is left is what the calendar must fit itself into.

export interface ScreenInput {
  /** Usable height (viewport minus outer padding). */
  height: number;
  /** Smallest allowed space between top and bottom. */
  minGap: number;
  /** Top area height with every row shown. */
  topFull: number;
  /** Top area height with collapsible rows hidden. */
  topCompact: number;
  /** Bottom card's height if it could have all the room it wanted. */
  bottomNatural: number;
}

export interface ScreenPlan {
  collapseTop: boolean;
  /** Height the bottom card may use; it collapses itself to fit. */
  bottomAvailable: number;
}

export function planScreen(s: ScreenInput): ScreenPlan {
  const roomWithFullTop = s.height - s.topFull - s.minGap;
  if (s.bottomNatural <= roomWithFullTop || s.topCompact >= s.topFull) {
    return { collapseTop: false, bottomAvailable: Math.max(0, roomWithFullTop) };
  }
  return { collapseTop: true, bottomAvailable: Math.max(0, s.height - s.topCompact - s.minGap) };
}
