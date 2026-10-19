// How wall-layout shares the screen height between the top rows
// (clock/weather) and the bottom card (calendar). They form one block,
// anchored to the bottom of the screen with the top rows sitting directly on
// the calendar, and only as tall as its content — the background photo fills
// whatever is left above. When the block would outgrow the screen, the top's
// collapsible rows (the forecast strip) fold away first, and whatever height
// is left is what the calendar must fit itself into.

export interface ScreenInput {
  /** Usable height (viewport minus outer padding). */
  height: number;
  /** Space between the top rows and the bottom card. */
  gap: number;
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
  const roomWithFullTop = s.height - s.topFull - s.gap;
  if (s.bottomNatural <= roomWithFullTop || s.topCompact >= s.topFull) {
    return { collapseTop: false, bottomAvailable: Math.max(0, roomWithFullTop) };
  }
  return { collapseTop: true, bottomAvailable: Math.max(0, s.height - s.topCompact - s.gap) };
}
