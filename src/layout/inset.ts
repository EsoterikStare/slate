// The content inset: moves the dashboard's content (clock, weather, forecast,
// calendar contents) in from the screen edges, for monitors that crop their
// edges (overscan) or bezels that cover the outer pixels. Backgrounds (the
// photo, the docked calendar's black) still run to the edges.

export type InsetConfig = number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;

export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** A number applies to all four sides; an object sets only the sides it names (others 0). */
export function resolveInset(inset: InsetConfig | undefined): Inset {
  if (inset === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  const sides =
    typeof inset === 'number'
      ? { top: inset, right: inset, bottom: inset, left: inset }
      : { top: 0, right: 0, bottom: 0, left: 0, ...inset };
  for (const side of SIDES) {
    const v = sides[side];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new Error(`slate-layout: inset ${side} must be a number of pixels ≥ 0`);
    }
  }
  if (typeof inset === 'object') {
    const unknown = Object.keys(inset).filter((k) => !(SIDES as readonly string[]).includes(k));
    if (unknown.length) throw new Error(`slate-layout: unknown inset side "${unknown[0]}" (use top, right, bottom, left)`);
  }
  return sides;
}
