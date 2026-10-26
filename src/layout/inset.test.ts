import { describe, expect, it } from 'vitest';
import { resolveInset } from './inset';

describe('resolveInset', () => {
  it('is zero when not configured', () => {
    expect(resolveInset(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('applies a single number to all four sides', () => {
    expect(resolveInset(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it('sets only the sides an object names', () => {
    expect(resolveInset({ left: 8, right: 8 })).toEqual({ top: 0, right: 8, bottom: 0, left: 8 });
  });

  it.each([[-1], [Number.NaN], [{ left: -4 }], [{ left: '8' }]])('rejects %j', (bad) => {
    expect(() => resolveInset(bad as never)).toThrow(/inset/);
  });

  it('rejects a misspelt side rather than silently ignoring it', () => {
    expect(() => resolveInset({ lft: 8 } as never)).toThrow(/unknown inset side "lft"/);
  });
});
