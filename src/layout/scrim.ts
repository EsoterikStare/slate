// A "scrim": a soft dark gradient laid over the background photo only where
// text sits on it (a band at the top behind the pinned rows, a band at the
// bottom behind the rows stacked on the calendar), so white text stays
// readable on bright or busy photos while the rest of the photo is untouched.
// Each band is full strength at the edge, still 60% at the far edge of the
// text, and fades out over another half of the band's height.

export interface ScrimBands {
  /** Height of the band from the top edge, px (0 = no top band). */
  top: number;
  /** Height of the band from the bottom edge, px (0 = no bottom band). */
  bottom: number;
  /** Darkness at the edge, 0–1 (0 = no scrim). */
  strength: number;
}

const black = (alpha: number) => `rgba(0, 0, 0, ${Number(alpha.toFixed(3))})`;

function band(direction: 'to bottom' | 'to top', size: number, strength: number): string {
  const px = (n: number) => `${Math.round(n)}px`;
  return `linear-gradient(${direction}, ${black(strength)} 0px, ${black(strength * 0.6)} ${px(size)}, ${black(0)} ${px(size * 1.5)})`;
}

/** CSS `background-image` for the scrim layer, or `none` when there's nothing to darken. */
export function scrimBackground({ top, bottom, strength }: ScrimBands): string {
  if (!(strength > 0)) return 'none';
  const layers = [
    ...(top > 0 ? [band('to bottom', top, strength)] : []),
    ...(bottom > 0 ? [band('to top', bottom, strength)] : []),
  ];
  return layers.length ? layers.join(', ') : 'none';
}
