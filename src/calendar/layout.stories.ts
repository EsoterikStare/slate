// A debugging view of fitCalendar(): rough boxes, not the real card's styling
// (that's the wall-calendar card's own stories). Drag the
// "available" slider to watch rows collapse from the far-future end.

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { addDays, buildWeeks } from './dates';
import type { CalendarEvent } from './events';
import { formatTimeRange } from './format';
import type { RowMetrics } from './layout';
import { fitCalendar, placeWeek } from './layout';

const today = new Date(2026, 9, 21);
const weeks = buildWeeks(today, 'sunday', 3);
const d0 = weeks[0]![0]!;

let n = 0;
const at = (day: number, h: number, len = 1, title = `Event ${++n}`): CalendarEvent => {
  const start = addDays(d0, day);
  start.setHours(Math.floor(h), (h % 1) * 60);
  return { id: title, title, start, end: new Date(start.getTime() + len * 3_600_000), allDay: false, calendars: ['c'] };
};
const span = (day: number, days: number, title: string): CalendarEvent => ({
  id: title,
  title,
  start: addDays(d0, day),
  end: addDays(d0, day + days),
  allDay: true,
  calendars: ['c'],
});

const events: CalendarEvent[] = [
  span(1, 3, 'Mom visiting'),
  span(5, 4, 'Camping trip'),
  at(1, 18, 4, 'Game night'),
  at(2, 11, 1, 'Art club'),
  at(2, 13.5, 1, 'Neighborhood Cleanup'),
  at(3, 11, 2, 'Bowling'),
  at(9, 1.5, 1, 'Pick up groceries'),
  at(9, 10.5, 2.5, 'Science Fair Setup'),
  at(9, 18, 2.5, 'Movie night'),
  at(9, 20.5, 1, 'Late call'),
  at(10, 13, 3, 'Piano lesson'),
  at(15, 18, 4, 'Game night'),
  at(16, 16.5, 2, 'Choir rehearsal'),
  at(16, 9), at(16, 10), at(16, 12), at(16, 14),
];

const metrics: RowMetrics = { firstHeader: 90, header: 60, bar: 34, event: 64, more: 28, rowGap: 12 };

interface Args {
  available: number;
  minPerDay: number;
}

const meta: Meta<Args> = {
  title: 'Calendar/Layout plan (debug)',
  argTypes: {
    available: { control: { type: 'range', min: 150, max: 1400, step: 10 } },
    minPerDay: { control: { type: 'range', min: 0, max: 5, step: 1 } },
  },
  args: { available: 1400, minPerDay: 2 },
  render: ({ available, minPerDay }) => {
    const placed = weeks.map((w) => placeWeek(w, events));
    const plan = fitCalendar(placed, metrics, available, minPerDay);
    return html`
      <div style="font: 13px system-ui; color: #ddd; background: #111; padding: 16px">
        <p>available ${available}px · used ${plan.height}px · dropped rows ${plan.droppedRows}</p>
        <div style="outline: 1px dashed #666; height: ${available}px; display: flex; flex-direction: column; justify-content: flex-end; gap: ${metrics.rowGap}px; width: 1048px">
          ${plan.rows.map((row, r) => {
            const w = placed[r]!;
            return html`
              <div style="height: ${row.height}px; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: ${r === 0 ? metrics.firstHeader : metrics.header}px repeat(${row.visibleLanes}, ${metrics.bar}px) auto; gap: 0 6px; background: #ffffff10">
                ${w.days.map((day, c) => html`<div style="grid-row: 1; grid-column: ${c + 1}; text-align: center; font-size: 22px">${day.getDate()}</div>`)}
                ${w.bars
                  .filter((b) => b.lane < row.visibleLanes)
                  .map(
                    (b) => html`<div style="grid-row: ${b.lane + 2}; grid-column: ${b.startCol + 1} / ${b.endCol + 2}; background: #3a7bd5; margin: 2px 0; border-radius: 4px; padding: 0 6px; overflow: hidden; white-space: nowrap">${b.event.title}</div>`,
                  )}
                ${w.timed.map(
                  (evs, c) => html`<div style="grid-row: ${row.visibleLanes + 2}; grid-column: ${c + 1}">
                    ${evs.slice(0, row.visibleTimed[c]).map(
                      (e) => html`<div style="height: ${metrics.event - 4}px; margin-bottom: 4px; border-left: 4px solid tomato; background: #222; padding: 4px 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; box-sizing: border-box">
                        <div style="color: #999">${formatTimeRange(e.start, e.end, 12)}</div>
                        <div style="overflow: hidden; text-overflow: ellipsis">${e.title}</div>
                      </div>`,
                    )}
                    ${row.hidden[c]! > 0 ? html`<div style="height: ${metrics.more}px; color: #aaa">+${row.hidden[c]} more</div>` : ''}
                  </div>`,
                )}
              </div>`;
          })}
        </div>
      </div>`;
  },
};
export default meta;

export const Playground: StoryObj<Args> = {};
export const Tight: StoryObj<Args> = { args: { available: 620 } };
