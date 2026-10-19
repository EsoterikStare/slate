// Per-element text sizing. Every piece of text has a named role whose final
// size is  global scale × card scale × role scale × base size, where the
// base size is in container-query width units so text tracks the card's
// width. The global scale (--wall-scale) is inherited from wall-layout; card
// and role scales are set on the card from its YAML.

import { unsafeCSS, type CSSResult } from 'lit';

/** CSS custom properties for a card's `scale` and `text:` config. */
export function textScaleVars(scale: number, text: Record<string, number | undefined>): Record<string, string> {
  const vars: Record<string, string> = { '--wall-card-scale': String(positive(scale, 'scale')) };
  for (const [role, value] of Object.entries(text)) {
    if (value !== undefined) vars[`--wall-text-${role}`] = String(positive(value, `text.${role}`));
  }
  return vars;
}

function positive(n: number, name: string): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new Error(`\`${name}\` must be a positive number`);
  }
  return n;
}

/** `font-size` for a role, `baseCqw` being its size at scale 1 (1cqw = 1% of card width). */
export function roleFontSize(role: string, baseCqw: number): CSSResult {
  return unsafeCSS(
    `font-size: calc(var(--wall-scale, 1) * var(--wall-card-scale, 1) * var(--wall-text-${role}, 1) * ${baseCqw}cqw);`,
  );
}
