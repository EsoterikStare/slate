import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './wall-clock';
import type { WallClock, WallClockConfig } from './wall-clock';

let el: WallClock | undefined;

async function mount(config: Partial<WallClockConfig> = {}) {
  el = document.createElement('wall-clock');
  el.setConfig({ type: 'custom:wall-clock', ...config });
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const text = (sel: string) => el!.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 18, 22, 41, 50));
});
afterEach(() => {
  el?.remove();
  vi.useRealTimers();
});

describe('wall-clock', () => {
  it('shows the time with a meridiem and the long date', async () => {
    await mount();
    expect(text('.time')).toBe('10:41PM');
    expect(text('.meridiem')).toBe('PM');
    expect(text('.date')).toBe('Sunday, October 18');
  });

  it('ticks over exactly at the next minute', async () => {
    await mount();
    vi.advanceTimersByTime(9_999);
    await el!.updateComplete;
    expect(text('.time')).toBe('10:41PM');
    vi.advanceTimersByTime(1);
    await el!.updateComplete;
    expect(text('.time')).toBe('10:42PM');
  });

  it('supports 24h, hiding the date, and a custom date format', async () => {
    await mount({ time_format: 24, show_date: false });
    expect(text('.time')).toBe('22:41');
    expect(text('.date')).toBeUndefined();
    el!.remove();
    await mount({ date_format: { month: 'short', day: 'numeric' } });
    expect(text('.date')).toBe('Oct 18');
  });

  it('stops ticking when removed from the page', async () => {
    await mount();
    el!.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an invalid time_format', () => {
    const c = document.createElement('wall-clock');
    expect(() => c.setConfig({ type: 'custom:wall-clock', time_format: 13 as never })).toThrow(/time_format/);
  });
});
