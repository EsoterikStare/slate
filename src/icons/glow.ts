// The soft dark glow behind each weather icon that separates it from a
// bright photo. Set --weather-icon-glow to iconGlowBackground(config) to
// change it (slate-layout's `icon_shadow` does). One static radial gradient:
// darkest at the centre, always fading to nothing at its radius.

export interface IconGlowConfig {
  /** Radius as a fraction of the icon's width (0.65 = 65%); 0.1–1. */
  radius?: number;
  /** Darkness at the centre, 0–1. */
  opacity?: number;
}

export const GLOW_DEFAULTS = { radius: 0.65, opacity: 0.22 } as const;

/**
 * The glow's layer is twice the icon's size, centred on it (inset: -50%), so
 * a radius of a whole icon width still fits inside it.
 */
export const GLOW_BOX_SCALE = 2;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const black = (alpha: number) => `rgba(0, 0, 0, ${Number(alpha.toFixed(3))})`;

/**
 * CSS `background` for the glow layer, or `none` when it's off (`false`, or a
 * centre opacity of 0). `true` and missing values take the defaults.
 */
export function iconGlowBackground(config: boolean | IconGlowConfig | undefined = true): string {
  if (config === false) return 'none';
  const c = config === true ? {} : config;
  const radius = clamp(c.radius ?? GLOW_DEFAULTS.radius, 0.1, 1);
  const opacity = clamp(c.opacity ?? GLOW_DEFAULTS.opacity, 0, 1);
  if (opacity === 0) return 'none';
  const r = `${Number(((radius / GLOW_BOX_SCALE) * 100).toFixed(2))}%`;
  // A long, eased tail so the edge is never visible.
  return `radial-gradient(${r} ${r} at 50% 50%, ${black(opacity)} 0%, ${black(opacity * 0.55)} 50%, ${black(opacity * 0.18)} 80%, ${black(0)} 100%)`;
}
