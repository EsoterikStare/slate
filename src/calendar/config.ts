import type { FirstDay } from './dates';
import type { HourFormat } from './format';

export const CALENDAR_TEXT_ROLES = [
  'legend',
  'weekday',
  'date_number',
  'event_time',
  'event_title',
  'all_day',
  'more',
] as const;
export type CalendarTextRole = (typeof CALENDAR_TEXT_ROLES)[number];

export interface CalendarSource {
  entity: string;
  name?: string;
  color?: string;
}

/** The card's YAML, as the user writes it. */
export interface SlateCalendarConfig {
  type: string;
  calendars: (CalendarSource | string)[];
  weeks?: number;
  first_day?: FirstDay;
  time_format?: HourFormat;
  min_events_per_day?: number;
  past_events?: 'dim' | 'hide';
  relative_day_names?: boolean;
  show_legend?: boolean;
  /** Lines an event title may wrap to before it's cut off with an ellipsis. */
  title_lines?: number;
  /** Show the month's short name ("Nov") instead of "1" on the first of a month. */
  month_on_first?: boolean;
  /** Minutes between refetches, on top of refetching whenever a calendar changes. */
  refresh_interval?: number;
  scale?: number;
  text?: Partial<Record<CalendarTextRole, number>>;
  today_color?: string;
}

/** The config with every default filled in. */
export interface ResolvedCalendarConfig {
  calendars: Required<CalendarSource>[];
  weeks: number;
  firstDay: FirstDay;
  timeFormat: HourFormat;
  minEventsPerDay: number;
  pastEvents: 'dim' | 'hide';
  relativeDayNames: boolean;
  showLegend: boolean;
  titleLines: number;
  monthOnFirst: boolean;
  refreshMinutes: number;
  scale: number;
  text: Partial<Record<CalendarTextRole, number>>;
  todayColor: string;
}

// Distinct on a dark background, used when a calendar has no color set.
const PALETTE = ['dodgerblue', 'tomato', 'chartreuse', 'gold', 'orchid', 'darkorange', 'turquoise', 'hotpink'];

const friendlyName = (entity: string) =>
  entity
    .replace(/^calendar\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Fills defaults and rejects configs HA should show an error card for. */
export function resolveConfig(config: SlateCalendarConfig): ResolvedCalendarConfig {
  if (!config || !Array.isArray(config.calendars) || config.calendars.length === 0) {
    throw new Error('slate-calendar: `calendars` must list at least one calendar entity');
  }
  const calendars = config.calendars.map((c, i) => {
    const src = typeof c === 'string' ? { entity: c } : c;
    if (!src.entity?.startsWith('calendar.')) {
      throw new Error(`slate-calendar: "${src.entity}" is not a calendar entity`);
    }
    return {
      entity: src.entity,
      name: src.name ?? friendlyName(src.entity),
      color: src.color ?? PALETTE[i % PALETTE.length]!,
    };
  });
  const weeks = config.weeks ?? 3;
  if (!Number.isInteger(weeks) || weeks < 1) throw new Error('slate-calendar: `weeks` must be a whole number ≥ 1');
  const firstDay = config.first_day ?? 'sunday';
  if (firstDay !== 'sunday' && firstDay !== 'monday') {
    throw new Error('slate-calendar: `first_day` must be sunday or monday');
  }
  const titleLines = config.title_lines ?? 2;
  if (![1, 2, 3].includes(titleLines)) throw new Error('slate-calendar: `title_lines` must be 1, 2 or 3');
  return {
    calendars,
    weeks,
    firstDay,
    timeFormat: config.time_format === 24 ? 24 : 12,
    minEventsPerDay: Math.max(0, config.min_events_per_day ?? 2),
    pastEvents: config.past_events === 'hide' ? 'hide' : 'dim',
    relativeDayNames: config.relative_day_names ?? false,
    showLegend: config.show_legend ?? true,
    titleLines,
    monthOnFirst: config.month_on_first ?? true,
    refreshMinutes: Math.max(1, config.refresh_interval ?? 5),
    scale: config.scale ?? 1,
    text: config.text ?? {},
    todayColor: config.today_color ?? 'brown',
  };
}
