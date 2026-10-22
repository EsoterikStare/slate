// Per-element text sizing. Every piece of text has a named role whose final
// size is  global scale × card scale × role scale × base × unit. The unit is
// --slate-unit, which slate-layout sets to 1% of the whole dashboard's width so
// that a half-width card's text matches a full-width card's. Without it the
// fallback is 1cqw: 1% of the nearest size container (the calendar makes
// itself one), or of the viewport for cards that aren't inside one. The global scale
// (--slate-scale) is inherited from slate-layout; card and role scales are set
// on the card from its YAML.

import { unsafeCSS, type CSSResult } from 'lit';

/** CSS custom properties for a card's `scale` and `text:` config. */
export function textScaleVars(scale: number, text: Record<string, number | undefined>): Record<string, string> {
  const vars: Record<string, string> = { '--slate-card-scale': String(positive(scale, 'scale')) };
  for (const [role, value] of Object.entries(text)) {
    if (value !== undefined) vars[`--slate-text-${role}`] = String(positive(value, `text.${role}`));
  }
  return vars;
}

function positive(n: number, name: string): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new Error(`\`${name}\` must be a positive number`);
  }
  return n;
}

/** `font-size` for a role; `base` is its size at scale 1, in units of 1% of dashboard width. */
export function roleFontSize(role: string, base: number): CSSResult {
  return unsafeCSS(
    `font-size: calc(var(--slate-scale, 1) * var(--slate-card-scale, 1) * var(--slate-text-${role}, 1) * ${base} * var(--slate-unit, 1cqw));`,
  );
}
