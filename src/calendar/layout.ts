// Pure layout for the week-row calendar: which events land in which row,
// which lane each spanning bar takes, and — when the rows don't all fit —
// how many entries each day keeps. Heights are abstract numbers supplied by
// the caller (measured from the DOM), so this stays testable without CSS.

import { dayDiff } from './dates';
import type { CalendarEvent } from './events';
import { eventDays, isBar } from './events';

export interface BarSegment {
  event: CalendarEvent;
  lane: number;
  /** Inclusive column range within the week, 0–6. */
  startCol: number;
  endCol: number;
  /** The event started before this row / continues into the next one. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface WeekPlacement {
  days: Date[];
  bars: BarSegment[];
  laneCount: number;
  /** Timed single-day events per column, sorted by start. */
  timed: CalendarEvent[][];
}

const byStartThenTitle = (a: CalendarEvent, b: CalendarEvent) =>
  a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime() || a.title.localeCompare(b.title);

export function placeWeek(days: Date[], events: CalendarEvent[]): WeekPlacement {
  const weekStart = days[0]!;
  const timed: CalendarEvent[][] = days.map(() => []);
  const segments: Omit<BarSegment, 'lane'>[] = [];

  for (const e of events) {
    const { first, last } = eventDays(e);
    const firstCol = dayDiff(weekStart, first);
    const lastCol = dayDiff(weekStart, last);
    if (lastCol < 0 || firstCol > 6) continue;
    if (isBar(e)) {
      segments.push({
        event: e,
        startCol: Math.max(0, firstCol),
        endCol: Math.min(6, lastCol),
        continuesBefore: firstCol < 0,
        continuesAfter: lastCol > 6,
      });
    } else {
      timed[firstCol]!.push(e);
    }
  }
  for (const day of timed) day.sort(byStartThenTitle);

  // Greedy lane packing: earliest first, longer spans first on ties, so long
  // trips settle into the top lanes and short bars fill in under them.
  segments.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - b.startCol - (a.endCol - a.startCol) ||
      byStartThenTitle(a.event, b.event),
  );
  const laneEnds: number[] = []; // last occupied column per lane
  const bars: BarSegment[] = segments.map((s) => {
    let lane = laneEnds.findIndex((end) => end < s.startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = s.endCol;
    return { ...s, lane };
  });

  return { days, bars, laneCount: laneEnds.length, timed };
}

export interface RowMetrics {
  /** Day header height on the first row (weekday name + date number). */
  firstHeader: number;
  /** Day header height on later rows (date number only). */
  header: number;
  bar: number;
  event: number;
  /**
   * Measured height per event id, for events whose title wraps to a second
   * line. Events not listed are `event` tall.
   */
  eventHeights?: ReadonlyMap<string, number>;
  /** Height of a "+N more" line. */
  more: number;
  /** Vertical gap between week rows. */
  rowGap: number;
}

export interface RowPlan {
  /** Lanes shown, counted from the top. */
  visibleLanes: number;
  /** Per column: timed events shown (always the earliest ones). */
  visibleTimed: number[];
  /** Per column: entries hidden behind "+N more". */
  hidden: number[];
  height: number;
}

export interface CalendarPlan {
  rows: RowPlan[];
  /** Rows dropped from the far-future end because nothing else could fit. */
  droppedRows: number;
  height: number;
}

/** Most entries (bars + timed) on any one day in the row. */
function busiestDay(w: WeekPlacement): number {
  return Math.max(
    0,
    ...w.timed.map((t, col) => t.length + w.bars.filter((b) => b.startCol <= col && col <= b.endCol).length),
  );
}

/**
 * Lays out one row where each day may show at most `cap` entries. Bars take
 * priority over timed events: lanes are shared across the whole row, and each
 * day's leftover budget goes to its earliest timed events.
 */
export function planRow(w: WeekPlacement, cap: number, m: RowMetrics, isFirst: boolean): RowPlan {
  const visibleLanes = Math.min(w.laneCount, cap);
  const visibleTimed: number[] = [];
  const hidden: number[] = [];
  let tallestDay = 0;

  w.timed.forEach((timed, col) => {
    const covering = w.bars.filter((b) => b.startCol <= col && col <= b.endCol);
    const barsShown = covering.filter((b) => b.lane < visibleLanes).length;
    const shown = Math.min(timed.length, Math.max(0, cap - barsShown));
    const hide = covering.length - barsShown + (timed.length - shown);
    visibleTimed.push(shown);
    hidden.push(hide);
    let stack = hide > 0 ? m.more : 0;
    for (let i = 0; i < shown; i++) stack += m.eventHeights?.get(timed[i]!.id) ?? m.event;
    tallestDay = Math.max(tallestDay, stack);
  });

  const height = (isFirst ? m.firstHeader : m.header) + visibleLanes * m.bar + tallestDay;
  return { visibleLanes, visibleTimed, hidden, height };
}

const total = (rows: RowPlan[], m: RowMetrics) =>
  rows.reduce((sum, r) => sum + r.height, 0) + Math.max(0, rows.length - 1) * m.rowGap;

/**
 * Fits the week rows into `available` height. Rows start fully expanded; if
 * that's too tall, rows are collapsed one at a time starting from the
 * furthest-future week, each down to no fewer than `minPerDay` entries per
 * day, until everything fits. If even that isn't enough, whole rows are
 * dropped from the far-future end (never the current week).
 */
export function fitCalendar(
  weeks: WeekPlacement[],
  m: RowMetrics,
  available: number,
  minPerDay: number,
): CalendarPlan {
  // Each attempt starts fresh from fully expanded rows: after dropping a
  // row, the ones that remain may have room to expand again.
  for (let count = weeks.length; count > 1; count--) {
    const rows = collapseToFit(weeks.slice(0, count), m, available, minPerDay);
    if (total(rows, m) <= available) {
      return { rows, droppedRows: weeks.length - count, height: total(rows, m) };
    }
  }
  const rows = collapseToFit(weeks.slice(0, 1), m, available, minPerDay);
  return { rows, droppedRows: weeks.length - 1, height: total(rows, m) };
}

/** Collapses from the last row backward; returns the best it could do. */
function collapseToFit(weeks: WeekPlacement[], m: RowMetrics, available: number, minPerDay: number): RowPlan[] {
  const rows = weeks.map((w, i) => planRow(w, Infinity, m, i === 0));
  if (total(rows, m) <= available) return rows;
  for (let i = weeks.length - 1; i >= 0; i--) {
    for (let cap = busiestDay(weeks[i]!) - 1; cap >= minPerDay; cap--) {
      rows[i] = planRow(weeks[i]!, cap, m, i === 0);
      if (total(rows, m) <= available) return rows;
    }
  }
  return rows;
}
