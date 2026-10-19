// <wall-calendar>: week-row calendar anchored to the bottom of its space.
// Layout decisions live in ../calendar/layout.ts; this element fetches,
// measures its own rendered pieces, and draws whatever plan comes back.

import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { ResolvedCalendarConfig, WallCalendarConfig } from '../calendar/config';
import { resolveConfig } from '../calendar/config';
import { addDays, buildWeeks, dayDiff, startOfDay } from '../calendar/dates';
import type { CalendarEvent } from '../calendar/events';
import { fetchEvents } from '../calendar/fetch';
import { formatTime, formatTimeRange } from '../calendar/format';
import type { BarSegment, CalendarPlan, RowMetrics, RowPlan, WeekPlacement } from '../calendar/layout';
import { fitCalendar, placeWeek } from '../calendar/layout';
import type { HomeAssistant } from '../ha/types';
import { roleFontSize, textScaleVars } from '../text-scale';

/** Hard-edged stripes, one per calendar, for events merged across calendars. */
function stripes(colors: string[], direction: 'to bottom' | 'to right'): string {
  if (colors.length === 1) return colors[0]!;
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`);
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

export class WallCalendar extends LitElement {
  static override properties = {
    hass: { attribute: false },
    availableHeight: { attribute: false },
    metrics: { attribute: false },
    _config: { state: true },
    _events: { state: true },
    _failed: { state: true },
    _now: { state: true },
    _measured: { state: true },
  };

  declare hass?: HomeAssistant;
  /**
   * Height this card may use, set by wall-layout. Unset means "as tall as it
   * needs" and nothing collapses.
   */
  declare availableHeight?: number;
  /** Overrides DOM-measured row metrics; for tests, where nothing has layout. */
  declare metrics?: RowMetrics & { chrome: number };

  declare _config?: ResolvedCalendarConfig;
  declare _events: CalendarEvent[];
  declare _failed: string[];
  declare _now: Date;
  declare _measured?: RowMetrics & { chrome: number };

  private _scaleVars: Record<string, string> = {};
  private _fetchedKey = '';
  private _fetchSeq = 0;
  private _clock?: ReturnType<typeof setInterval>;
  private _refresh?: ReturnType<typeof setInterval>;
  private _resize?: ResizeObserver;

  constructor() {
    super();
    this._events = [];
    this._failed = [];
    this._now = new Date();
  }

  setConfig(config: WallCalendarConfig): void {
    const resolved = resolveConfig(config);
    this._scaleVars = textScaleVars(resolved.scale, resolved.text);
    this._config = resolved;
    this._fetchedKey = '';
  }

  getCardSize(): number {
    return (this._config?.weeks ?? 3) * 3 + 1;
  }

  static getStubConfig(hass: HomeAssistant): WallCalendarConfig {
    const calendars = Object.keys(hass.states).filter((id) => id.startsWith('calendar.'));
    return { type: 'custom:wall-calendar', calendars: calendars.slice(0, 3) };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Tick the clock so past-dimming and the day rollover stay current.
    this._clock = setInterval(() => {
      const now = new Date();
      if (now.getMinutes() !== this._now.getMinutes() || dayDiff(this._now, now) !== 0) this._now = now;
    }, 15_000);
    this._restartRefresh();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
    clearInterval(this._refresh);
    this._resize?.disconnect();
    this._resize = undefined;
  }

  private _restartRefresh(): void {
    clearInterval(this._refresh);
    if (!this._config || !this.isConnected) return;
    this._refresh = setInterval(() => {
      this._fetchedKey = '';
      this.requestUpdate();
    }, this._config.refreshMinutes * 60_000);
  }

  private _weeks(): Date[][] {
    return buildWeeks(this._now, this._config!.firstDay, this._config!.weeks);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('_config')) this._restartRefresh();
    if (!this._config || !this.hass) return;
    // Refetch when the visible range moves (day rollover) or any calendar
    // entity changes state — HA has no push API for calendar events.
    const weeks = this._weeks();
    const stamps = this._config.calendars.map((c) => this.hass!.states[c.entity]?.last_updated ?? '');
    const key = [weeks[0]![0]!.toISOString(), ...stamps].join('|');
    if (key !== this._fetchedKey) {
      this._fetchedKey = key;
      void this._fetch(weeks);
    }
  }

  private async _fetch(weeks: Date[][]): Promise<void> {
    const seq = ++this._fetchSeq;
    const start = weeks[0]![0]!;
    const end = addDays(weeks[weeks.length - 1]![6]!, 1);
    const entities = this._config!.calendars.map((c) => c.entity);
    const result = await fetchEvents(this.hass!, entities, start, end);
    if (seq !== this._fetchSeq) return; // a newer fetch started meanwhile
    if (result.failed.length) console.warn('wall-calendar: failed to load', result.failed);
    this._events = result.events;
    this._failed = result.failed;
  }

  /** Resolves once the in-flight fetch (if any) has landed and rendered. */
  async settled(): Promise<void> {
    await this.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await this.updateComplete;
  }

  protected override firstUpdated(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this._resize = new ResizeObserver(() => this._measure());
      this._resize.observe(this);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('_config')) this._measure();
  }

  /** Reads the rendered sizes of one of each building block from the hidden probe. */
  private _measure(): void {
    const root = this.renderRoot as ShadowRoot;
    const h = (sel: string) => (root.querySelector(sel) as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
    const card = root.querySelector('.card');
    const rows = root.querySelector('.rows');
    if (!card || !rows) return;
    const next = {
      firstHeader: h('.probe .head.first'),
      header: h('.probe .head.later'),
      bar: h('.probe .bar-slot'),
      event: h('.probe .slot'),
      more: h('.probe .more'),
      rowGap: parseFloat(getComputedStyle(rows).rowGap) || 0,
      chrome: card.getBoundingClientRect().height - rows.getBoundingClientRect().height,
    };
    const prev = this._measured;
    if (!prev || (Object.keys(next) as (keyof typeof next)[]).some((k) => Math.abs(next[k] - prev[k]) > 0.5)) {
      this._measured = next;
    }
  }

  protected override render() {
    const cfg = this._config;
    if (!cfg) return nothing;
    const now = this._now;
    const weeks = this._weeks();
    const events = cfg.pastEvents === 'hide' ? this._events.filter((e) => e.end > now) : this._events;
    const placed = weeks.map((w) => placeWeek(w, events));
    const m = this.metrics ?? this._measured;
    const available = m && this.availableHeight !== undefined ? this.availableHeight - m.chrome : Infinity;
    const plan = fitCalendar(placed, m ?? ZERO_METRICS, available, cfg.minEventsPerDay);

    return html`
      <div class="card" style=${styleMap({ ...this._scaleVars, '--today-color': cfg.todayColor })}>
        ${cfg.showLegend ? this._renderLegend(cfg) : nothing}
        <div class="rows">${plan.rows.map((row, i) => this._renderRow(placed[i]!, row, i === 0))}</div>
        ${this._renderProbe()}
      </div>
    `;
  }

  private _renderLegend(cfg: ResolvedCalendarConfig): TemplateResult {
    return html`<div class="legend">
      ${cfg.calendars.map(
        (c) => html`<span class=${classMap({ entry: true, failed: this._failed.includes(c.entity) })}>
          <i style=${styleMap({ background: c.color })}></i>${c.name}
        </span>`,
      )}
    </div>`;
  }

  private _colorsOf(e: CalendarEvent): string[] {
    const byEntity = new Map(this._config!.calendars.map((c) => [c.entity, c.color]));
    return e.calendars.map((c) => byEntity.get(c) ?? 'grey');
  }

  private _weekdayLabel(day: Date): string {
    const today = startOfDay(this._now);
    if (this._config!.relativeDayNames) {
      const diff = dayDiff(today, day);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
    }
    return day.toLocaleDateString(this.hass?.locale.language ?? 'en', { weekday: 'long' });
  }

  private _renderRow(week: WeekPlacement, row: RowPlan, isFirst: boolean): TemplateResult {
    const today = startOfDay(this._now);
    const lanes = row.visibleLanes;
    return html`<div class="row" style=${styleMap({ gridTemplateRows: `auto repeat(${lanes}, auto) 1fr` })}>
      ${week.days.map((day, col) => {
        const offset = dayDiff(today, day);
        return html`<div
          class=${classMap({ head: true, first: isFirst, later: !isFirst, past: offset < 0 })}
          style=${styleMap({ gridColumn: `${col + 1}` })}
        >
          ${isFirst ? html`<div class="weekday">${this._weekdayLabel(day)}</div>` : nothing}
          <div class=${classMap({ num: true, today: offset === 0 })}><span>${day.getDate()}</span></div>
        </div>`;
      })}
      ${week.bars.filter((b) => b.lane < lanes).map((b) => this._renderBar(b))}
      ${week.timed.map((timed, col) => {
        const past = dayDiff(today, week.days[col]!) < 0;
        const hidden = row.hidden[col]!;
        return html`<div
          class=${classMap({ day: true, past })}
          style=${styleMap({ gridColumn: `${col + 1}`, gridRow: `${lanes + 2}` })}
        >
          ${timed.slice(0, row.visibleTimed[col]).map((e) => this._renderEvent(e))}
          ${hidden > 0 ? html`<div class="more">+${hidden} more</div>` : nothing}
        </div>`;
      })}
    </div>`;
  }

  private _renderBar(b: BarSegment): TemplateResult {
    const e = b.event;
    const colors = this._colorsOf(e);
    const prefix = e.allDay || b.continuesBefore ? '' : `${formatTime(e.start, this._config!.timeFormat)} `;
    return html`<div
      class="bar-slot"
      style=${styleMap({ gridColumn: `${b.startCol + 1} / ${b.endCol + 2}`, gridRow: `${b.lane + 2}` })}
    >
      <div
        class=${classMap({ bar: true, ended: e.end <= this._now, 'cont-before': b.continuesBefore, 'cont-after': b.continuesAfter })}
        style=${styleMap({ '--tint': colors[0]!, '--accent': stripes(colors, 'to bottom') })}
      >
        ${prefix}${e.title}
      </div>
    </div>`;
  }

  private _renderEvent(e: CalendarEvent): TemplateResult {
    return html`<div class="slot">
      <div
        class=${classMap({ event: true, ended: e.end <= this._now })}
        style=${styleMap({ '--accent': stripes(this._colorsOf(e), 'to bottom') })}
      >
        <div class="time">${formatTimeRange(e.start, e.end, this._config!.timeFormat)}</div>
        <div class="title">${e.title}</div>
      </div>
    </div>`;
  }

  /** One of each building block, invisible, so _measure() can read real sizes. */
  private _renderProbe(): TemplateResult {
    return html`<div class="probe" aria-hidden="true">
      <div class="head first"><div class="weekday">W</div><div class="num"><span>30</span></div></div>
      <div class="head later"><div class="num"><span>30</span></div></div>
      <div class="bar-slot"><div class="bar">X</div></div>
      <div class="slot"><div class="event"><div class="time">1</div><div class="title">X</div></div></div>
      <div class="more">+1 more</div>
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
      color: var(--wall-text-color, #fff);
      font-family: var(--wall-font-family, var(--primary-font-family, Roboto, system-ui, sans-serif));
    }
    .card {
      container-type: inline-size;
      position: relative;
      box-sizing: border-box;
      padding: 1.5cqw;
      background: var(--wall-panel-background, rgba(0, 0, 0, 0.45));
      backdrop-filter: blur(var(--wall-panel-blur, 4px));
      border-radius: var(--wall-panel-radius, 16px);
      overflow: hidden;
    }
    .legend {
      ${roleFontSize('legend', 1.8)}
      display: flex;
      flex-wrap: wrap;
      gap: 0.4em 1.4em;
      margin-bottom: 1cqw;
    }
    .legend .entry {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
    }
    .legend .entry.failed {
      opacity: 0.5;
      text-decoration: line-through;
    }
    .legend i {
      width: 0.6em;
      height: 0.6em;
      border-radius: 50%;
    }
    .rows {
      display: flex;
      flex-direction: column;
      row-gap: 1.5cqw;
    }
    .row {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      column-gap: 0.8cqw;
    }
    .head {
      grid-row: 1;
      text-align: center;
      padding-bottom: 0.6cqw;
    }
    .weekday {
      ${roleFontSize('weekday', 2)}
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .num {
      ${roleFontSize('date_number', 3.6)}
      line-height: 1.35;
    }
    .num span {
      display: inline-block;
      min-width: 1.35em;
      border-radius: 999px;
    }
    .num.today span {
      background: var(--today-color);
    }
    .past {
      opacity: var(--wall-past-opacity, 0.45);
    }
    .bar-slot {
      padding-bottom: 0.4cqw;
      min-width: 0;
    }
    .bar {
      ${roleFontSize('all_day', 1.8)}
      position: relative;
      padding: 0.2em 0.5em 0.2em 0.8em;
      background: color-mix(in srgb, var(--tint) 60%, rgba(20, 20, 20, 0.8));
      border-radius: 0.3em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 0.3em;
      background: var(--accent);
    }
    .bar.cont-before {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
    .bar.cont-before::before {
      display: none;
    }
    .bar.cont-after {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    .day {
      min-width: 0;
    }
    .slot {
      padding-bottom: 0.4cqw;
    }
    .event {
      position: relative;
      padding: 0.35em 0.4em 0.35em 0.7em;
      background: var(--wall-event-background, rgba(20, 20, 20, 0.75));
      border-radius: 0.25em;
      overflow: hidden;
      white-space: nowrap;
    }
    .event::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 0.25em;
      background: var(--accent);
    }
    .time {
      ${roleFontSize('event_time', 1.6)}
      opacity: 0.7;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .title {
      ${roleFontSize('event_title', 2)}
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ended {
      opacity: var(--wall-past-opacity, 0.45);
    }
    .more {
      ${roleFontSize('more', 1.6)}
      opacity: 0.75;
      padding: 0.1em 0.3em;
    }
    .probe {
      position: absolute;
      visibility: hidden;
      pointer-events: none;
      top: 0;
      left: 0;
      width: calc(100% / 7);
    }
  `;
}

const ZERO_METRICS: RowMetrics = { firstHeader: 0, header: 0, bar: 0, event: 0, more: 0, rowGap: 0 };

if (!customElements.get('wall-calendar')) {
  customElements.define('wall-calendar', WallCalendar);
  const w = window as unknown as { customCards?: unknown[] };
  w.customCards = w.customCards ?? [];
  w.customCards.push({
    type: 'wall-calendar',
    name: 'Wall Calendar',
    description: 'Week-row calendar for wall displays, anchored to the bottom and growing upward.',
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'wall-calendar': WallCalendar;
  }
}
