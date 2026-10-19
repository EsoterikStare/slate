# Planning

A wall-mounted, input-less family dashboard: a calendar filling most of the screen
plus clock, date, current weather and a forecast. It's built as **custom Home
Assistant dashboard cards**, replacing a dashboard assembled from community cards
(week-planner-card, clock-weather-card, layout-card, card-mod,
config-template-card) whose styling and portrait scaling couldn't be fixed well.

## Target

- **Display:** Raspberry Pi 4 Model B, Chromium in kiosk mode, portrait 1080×1920 monitor.
- **Data:** Home Assistant. Calendars come from `calendar.*` entities (currently 7
  iCloud calendars through HA's CalDAV integration). Weather comes from any
  `weather.*` entity (currently Met.no `weather.forecast_home`; Open-Meteo is worth
  trying because of its longer forecast).
- **Interaction:** none. It's display-only. Configuration lives in the card YAML,
  and HA's own dashboard editor serves as the settings menu.

## Decisions

### Architecture
- **Naming:** the `wall-` prefix (`custom:wall-layout`, `wall-clock`,
  `wall-weather`, `wall-calendar`, `wall-background`).
- **Custom HA cards, not a standalone app.** Data comes through the `hass` object
  using the logged-in session, so there are no tokens or backend of our own.
  Weather arrives as a live subscription (`weather/subscribe_forecast`).
  Calendar events have no push API in HA. They're fetched with
  `GET /api/calendars/<entity>?start=&end=` (the same call week-planner-card
  uses), refreshed every few minutes and whenever a calendar entity's state
  changes.
- **Separate content cards plus our own layout card.** The clock, weather, calendar
  and background cards each work alone anywhere in HA. A thin layout card arranges
  them full-screen in a `panel: true` view. It replaces layout-card, card-mod and
  config-template-card for this dashboard.
- **Stack:** Lit + TypeScript, built by Vite into a single JS bundle, with pnpm.
  Storybook shows each card with mocked `hass` data, including portrait 1080×1920
  stories. Vitest tests the pure logic (layout and collapse, time formatting, event
  merging, forecast mapping).
- **Distribution:** a HACS-compatible repo (`hacs.json` + GitHub releases). The
  kiosk runs the HACS-installed release.
- **Environment:** HA OS on a home server, opened over plain `http://` on
  the LAN.
- **Development, step by step:**
  1. **Storybook** shows each card on its own with fake HA data.
  2. **Live dev dashboard:** a separate HA dashboard whose resource points at the
     Vite dev server on the dev PC (`http://<pc-ip>:5173/...`). Save, refresh, and
     the change shows against real HA data. This works because HA is plain HTTP.
     It needs Vite's `--host` option and a Windows Firewall rule for the port.
  3. **Pre-release check:** `pnpm deploy:dev` builds and copies the bundle to
     `\\homeassistant\config\www` through the **Samba share** add-on, with a
     content hash in the resource URL so Chromium on the Pi doesn't keep an old
     copy.

### Sizing (the original pain point)
- All sizing comes from the card's own dimensions, using container-query units,
  so text grows with the screen and enlarging it never breaks the layout.
- **Text size can be set per element.** Each piece of text has a named role, and
  its final size is `global scale × card scale × role scale`, so you can enlarge
  everything, one card, or a single element. Roles:
  - **clock:** `time`, `date`
  - **weather:** `temperature`, `condition`, `high_low`, `details`,
    `forecast_day`, `forecast_temp`
  - **calendar:** `legend`, `weekday`, `date_number`, `event_time`,
    `event_title`, `all_day`, `more`
- Spacing and icon sizes follow their related text role, so a larger
  `event_title` also makes the event row taller.
- **Shared unit:** sizes are in `--wall-unit`, which wall-layout sets to 1% of
  the dashboard width, so a half-width card's text matches a full-width card's.
  A card used outside wall-layout falls back to 1% of its container or the
  viewport.

### Screen layout
- **One block, anchored to the bottom** (changed 2026-10-19; it was originally
  top area pinned to the top and calendar to the bottom, with the photo in
  between). The clock, date and weather sit directly on top of the calendar,
  separated by `gap` (default 24px), and the whole block is only as tall as its
  content.
- **Top rows:** clock and date on the left, current conditions on the right
  (icon, temperature, condition, high/low), and a full-width forecast strip
  underneath (N days, configurable, limited to what the entity provides).
- **Calendar:** full width at the bottom, growing upward and pushing the top
  rows up with it.
- **Above the block:** the background photo. A quiet week leaves a big window
  onto the photo, a busy week a small one.
- **`bottom_style`** (wall-layout, added 2026-10-19):
  - `docked` (default): the calendar runs edge to edge and down to the bottom
    edge on solid black, with no rounded corners or blur. The photo fills only
    the area above it, behind the clock and weather. Outer padding and column
    gaps tighten to 0.4% of the width (about 4px), since the monitor bezel is
    the margin. That makes columns about 149px wide instead of 142px. Days are
    always 7 equal columns.
  - `floating`: the earlier look. The photo fills the whole screen and the
    calendar is a translucent rounded card inset by `padding`.
- **Forecast placement** (added 2026-10-19): each `top:` row has a `placement`.
  `top` pins it to the top of the screen over the photo, `stack` sits it on the
  calendar, and `hidden` leaves it out. A row holding only the forecast strip
  defaults to `top`; every other row defaults to `stack`. When there are rows
  in both places, at least `gap` of photo stays between them.
- When everything would outgrow the screen, collapsible rows (the forecast
  strip) fold away first, wherever they're placed, then calendar overflow
  kicks in (below).

### Calendar
- **Rows:** `weeks` (default 3) rows of 7 days, starting on `firstDay` (`sunday` |
  `monday`). Row 1 is always the week containing today.
- **Past days:** `pastEvents: dim | hide` (default `dim`). This also applies to
  events earlier today that have already ended.
- **Today:** a filled circle behind today's date number (configurable colour).
- **Day headers:** the weekday name appears only on the first row; every row shows
  a large date number. Real weekday names by default. An optional
  `relative_day_names: true` shows "Today" and "Tomorrow" instead.
- **Legend:** coloured dots with calendar names across the top, wrapping as needed
  (7 calendars).
- **Timed events:** a calendar-coloured bar on the left. Line 1 is a compact
  time range in muted text (`11 – 11:50a`, `6 – 10p`, `11:30a – 1p`; a 24-hour
  option gives `18 – 22`). Below it, the title wraps to at most `title_lines`
  lines (default 2, decided 2026-10-19), then ends in an ellipsis.
  Each event sits on a dark translucent background.
- **All-day and multi-day events:** spanning bars in lanes at the top of each row,
  wrapping onto the next row when needed.
- **Duplicates across calendars:** shown once, with the bar split into each
  calendar's colour (like week-planner-card's `combineSimilarEvents`).
- **Empty days:** blank by default. A "No events" placeholder is optional.
- **Row height:** each week row is as tall as its busiest day needs.
- **Overflow** (when everything doesn't fit):
  1. Collapse the forecast strip.
  2. Collapse rows starting from the **furthest-future week** and working back
     toward the current week. Each day is cut down to what fits, but never below
     `minEventsPerDay` (default 2).
  3. Within a day, keep the earliest events and hide timed events before spanning
     bars. Hidden events show as "+N more".
  4. Text never shrinks below the configured size.
  5. If every row is at its minimum and it still doesn't fit, drop whole weeks
     from the far-future end (never the current week). The weeks that remain
     are then fitted again from scratch, so they can expand back if there's room.
- Bar lanes run across the whole row so bars line up. Each day's event budget
  only counts the bars that actually cover that day, so a day isn't penalised
  for another day's trip.
- The card measures a hidden copy of each building block (header, bar, "+N
  more") and of every timed event, laid out in a real week-row grid so column
  widths and title wrapping match. This gives real pixel heights for the
  current font and scale, including which titles wrap. It re-measures when its
  width or events change.
- Why measure at all: everything visible is plain responsive CSS, but CSS
  can't decide what to hide. It can't count clipped events for "+N more",
  collapse the furthest week first, or guarantee a per-day minimum. Those
  rules need heights before rendering. (Discussed 2026-10-19. The
  alternatives were reserving two lines for every event, or pure CSS
  clipping without those rules.)
- Implemented in `src/calendar/layout.ts` (pure functions, measured heights
  passed in). The Storybook story "Calendar/Layout plan (debug)" shows it as
  boxes, with a slider for the available height.

### Weather
- Works with any `weather.*` entity. Current conditions come from the entity's
  state and attributes, and daily forecasts from a live
  `weather/subscribe_forecast` subscription.
- Configurable: forecast days, °F/°C (defaults to HA's unit), and which current
  conditions to show (e.g. feels-like, humidity, wind, precipitation).
- **Icons:** Meteocons (Bas Milius, MIT, the `@bybas/weather-icons` package),
  the same animated "fill" style clock-weather-card uses. Only the ~18 icons the
  condition mapping can return are bundled. Each icon gets its own shadow root
  because every Meteocons file reuses the same short gradient ids.
  `animations: false` pauses them (SMIL `pauseAnimations()`).
- **One card, two placements:** `show: current | forecast | both`, so
  wall-layout can put current conditions beside the clock and the forecast
  strip full-width underneath.
- Night icons for current conditions follow `sun.sun` (configurable via
  `sun_entity`). Forecast days always use day icons.

### Background
- The source is either an entity's `entity_picture` (the existing
  `sensor.unsplash_background` works unchanged) or a URL or list of URLs rotated on
  an interval.
- A new image cross-fades in only after it has fully loaded.
- Default panels: `rgba(0,0,0,0.45)` with `blur(4px)` and a 16px radius, all
  configurable.

### Night mode
- Scheduled dimming between configured hours, with animations paused while dimmed.
- No content shifting.
- Implemented as a black overlay at `1 − brightness` opacity (cheaper on the
  Pi's GPU than a CSS `filter` over the whole screen), fading over 3s.

### wall-layout (as built)
- `top:` is a list of rows; a row is either a list of cards (side by side,
  spread to the edges) or `{ cards, collapsible: true }`. `bottom:` is one
  card. `background:`, `night:`, `scale:`, `padding:`, `gap:` and
  `reload_after:` sit alongside them.
- Child cards are created with HA's own `loadCardHelpers()` inside HA, so any
  card type works in a row, not only ours.
- The calendar announces its uncollapsed height (`wall-natural-height`
  event). The layout runs `planScreen()` and hands the calendar its
  `availableHeight`.

### Kiosk
- The Pi logs in automatically through HA's `trusted_networks` auth provider
  (`allow_bypass_login`, a dedicated low-permission user, and a DHCP reservation for
  the Pi). Earlier attempts reportedly stopped working after a while. If that
  happens again, suspect a changed IP, a reverse proxy hiding the Pi's IP, or the
  frontend stuck on "connection lost" after an HA restart.
- **Watchdog:** wall-layout reloads the page once HA's `hass.connected` has
  been false for `reload_after` seconds (default 300, `false` disables),
  counted from the first disconnect.
- HA's header and sidebar are hidden by the Kiosk Mode HACS add-on, which is
  already installed.

## Config sketch (illustrative, not final)

```yaml
type: custom:wall-layout
scale: 1                               # global text multiplier
night: { start: "22:00", end: "06:00", brightness: 0.25 }
background:
  entity: sensor.unsplash_background   # or: urls: [...], interval: 15m
cards:
  - type: custom:wall-clock
    time_format: 12
    text: { time: 1.4 }                # per-role multiplier
  - type: custom:wall-weather
    entity: weather.forecast_home
    forecast_days: 5
    current: [feels_like, humidity, wind]
  - type: custom:wall-calendar
    weeks: 3
    first_day: sunday
    min_events_per_day: 2
    past_events: dim
    scale: 1.1                         # whole-card multiplier
    text: { event_title: 1.2, event_time: 0.9 }
    calendars:
      - { entity: calendar.alex, name: Alex, color: dodgerblue }
      - { entity: calendar.sam, name: Sam, color: tomato }
      # ...
```

## Open questions
- How time-zone and DST edge cases look in multi-day bars. Settle during
  implementation, with tests.
