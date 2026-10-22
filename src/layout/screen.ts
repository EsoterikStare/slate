// How slate-layout shares the screen height between the top rows
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

export type RowPlacement = 'top' | 'stack' | 'hidden';

/**
 * Where a row goes when its config doesn't say: a row holding only the
 * forecast strip is pinned to the top of the screen, anything else sits on
 * the calendar.
 */
export function defaultPlacement(cards: { type: string; [key: string]: unknown }[]): 'top' | 'stack' {
  const forecastOnly =
    cards.length > 0 && cards.every((c) => c.type === 'custom:slate-weather' && c.show === 'forecast');
  return forecastOnly ? 'top' : 'stack';
}

export interface MeasuredRow {
  height: number;
  placement: 'top' | 'stack';
  collapsible: boolean;
}

/**
 * Height the rows need: those pinned to the top of the screen, those stacked
 * on the calendar, and — when both groups are showing — `gap` of photo
 * between them. With `withCollapsible` false, collapsible rows are left out
 * (the folded state).
 */
export function rowsHeight(rows: MeasuredRow[], rowGap: number, gap: number, withCollapsible: boolean): number {
  const shown = rows.filter((r) => withCollapsible || !r.collapsible);
  const group = (p: 'top' | 'stack') => {
    const g = shown.filter((r) => r.placement === p);
    return { height: g.reduce((s, r) => s + r.height, 0) + Math.max(0, g.length - 1) * rowGap, any: g.length > 0 };
  };
  const top = group('top');
  const stack = group('stack');
  return top.height + stack.height + (top.any && stack.any ? gap : 0);
}
