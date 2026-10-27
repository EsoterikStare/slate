# Slate setup: guide for AI agents

You are helping someone set up **Slate**, a set of custom Home Assistant (HA)
dashboard cards for a wall-mounted, display-only screen (usually a portrait
1080×1920 monitor on a Raspberry Pi). This file is the authoritative
reference for doing that. The human-facing version of the same steps is
[setup.md](setup.md); link the user to its sections when they need to click
through HA's UI themselves.

Everything here was checked against the source in this repository
(`src/cards/*.ts`, `src/calendar/config.ts`, `src/background/sources.ts`,
`scripts/pi/setup-kiosk.sh`). If a detail here and the source disagree, the
source wins; please tell the user.

## Ground rules

- **Never guess entity IDs.** Every `calendar.*`, `weather.*` and `sensor.*`
  ID must come from the user's HA. If you have a tool connected to HA (for
  example HA's *Model Context Protocol Server* integration), list entities
  with it. Otherwise ask the user to read them from **Settings → Developer
  tools → States**, filtered by `calendar.` / `weather.`.
- **Don't handle secrets.** Never ask the user to paste passwords,
  app-specific passwords, long-lived access tokens or API keys into the chat.
  Tell them where to enter these (an integration's form, `secrets.yaml`).
- **Ask before changing their system.** Editing `configuration.yaml`,
  restarting HA, and running the Pi script change things that are awkward to
  undo. Show the change and get a yes first. Replacing a new dashboard's YAML
  is low risk; an existing dashboard's YAML is worth copying somewhere first.
- **One step at a time, verified.** Each step below ends with a check. Don't
  move on until the user confirms it (or you've confirmed it with a tool).
- **Placeholders in examples.** Values like `<ha-ip>`, `<pi-ip>`,
  `calendar.alex` in this file are placeholders. Replace them with the user's
  real values in what you give the user, and never write the user's real
  values back into this repository (it's public).

## Facts to collect

Collect these before writing config. The step that needs each is in brackets.

| Fact | How to get it |
| --- | --- |
| HA version | Settings → About. 2026.11+ has the Marketplace built in; older needs HACS [1] |
| HA address | What the user types to open HA, e.g. `http://<ha-ip>:8123` [7] |
| Calendar entity IDs, and a display name + colour for each | Developer tools → States, filter `calendar.` [3] |
| Which integration provides each calendar | Settings → Devices & services. Decides refresh speed [5] |
| Weather entity ID | Developer tools → States, filter `weather.` [3] |
| Background source | Entity with a picture, image URLs, or none [2] |
| Screen orientation and resolution | Ask. Portrait 1080×1920 is the design target [7, 8] |
| Kiosk hardware | Raspberry Pi model and OS; whether they can SSH to it [7] |
| Whether a reverse proxy sits in front of HA | Ask. Breaks trusted-network login [6] |

## Procedure

### 1. Install

HACS custom repository (pre-2026.11) or Marketplace repository (2026.11+):
`https://github.com/EsoterikStare/slate`, category **Dashboard**. Install,
then reload the browser. The resource (`/hacsfiles/slate/slate.js` or
`/local/community/slate/slate.js`) is registered automatically; do not add it
by hand as well, or the cards register twice.

**Verify:** the browser console prints `SLATE <version>` on any HA page.

### 2. Data sources

- **Calendars:** any `calendar.*` entity. To add one: *Remote Calendar*
  integration for a shared/public `.ics` link (`webcal://` → `https://`), or
  *CalDAV* for an account (iCloud: server `https://caldav.icloud.com`, Apple
  app-specific password), or *Google Calendar*.
- **Weather:** any `weather.*` entity that supports daily forecasts (Slate
  subscribes with `weather/subscribe_forecast`, type `daily`). Met.no's
  `weather.forecast_home` exists on most installs.
- **Background:** see the `background` options below. For Unsplash, a REST
  sensor whose `picture` is the photo URL works; [setup.md](setup.md#background-photo-optional)
  has an example. Unsplash's free tier allows 50 requests an hour,
  so keep `scan_interval` at 1800 or more.

**Verify:** you have every ID from the facts table.

### 3. Dashboard

Create a dashboard (Settings → Dashboards → Add dashboard → from scratch) and
replace its raw configuration (✏️ → ⋮ → Raw configuration editor). Minimal
working config:

```yaml
views:
  - title: Wall
    type: panel                       # required: gives the layout the whole screen
    cards:
      - type: custom:slate-layout
        top:
          - - type: custom:slate-clock
            - type: custom:slate-weather
              entity: weather.forecast_home
              show: current
          - cards:
              - type: custom:slate-weather
                entity: weather.forecast_home
                show: forecast
            collapsible: true
        bottom:
          type: custom:slate-calendar
          calendars:
            - { entity: calendar.alex, name: Alex, color: dodgerblue }
```

Build on it with the option reference below. Only include options the user
wants changed from the defaults.

**Verify:** no red error cards (see [Error messages](#error-messages)), events
visible, forecast visible (unless it was folded away for lack of room).

### 4. Kiosk Mode (hide HA's header and sidebar)

Requires the separate **Kiosk Mode** plugin (HACS/Marketplace, Dashboard
category). Then, at the top level of the dashboard YAML, above `views:`:

```yaml
kiosk_mode:
  kiosk: true
```

Appending `?disable_km` to the dashboard URL bypasses it for editing.

### 5. Calendar refresh automation

Slate re-requests events every `refresh_interval` minutes (default 5, min 1)
and also whenever a calendar entity's state changes. It can only show what HA
has fetched:

| Integration | HA fetches |
| --- | --- |
| Remote Calendar | every 24 hours |
| CalDAV | at most every 15 minutes |
| Google Calendar | about every 15 minutes |

If any calendar comes from Remote Calendar or CalDAV, propose this
automation. The action must be `homeassistant.update_entity`; `calendar.get_events`
only reads HA's cache and does not fetch.

```yaml
alias: Refresh calendars
triggers:
  - trigger: time_pattern
    minutes: /10                      # not more often than /5
actions:
  - action: homeassistant.update_entity
    target:
      entity_id:
        - calendar.alex
mode: single
```

**Verify:** run it by hand, then check its trace (⋮ → Traces): the
`update_entity` step should succeed for every listed entity.

### 6. Trusted-network login for the kiosk

Needs: a DHCP reservation for the Pi (the user does this on their router), a
dedicated **non-administrator** HA user, and that user's ID (Settings → People
→ Users → open the user; needs *Advanced mode* in the user's profile).

Proposed `configuration.yaml` change (merge into an existing `homeassistant:`
key; YAML does not allow two):

```yaml
homeassistant:
  auth_providers:
    - type: trusted_networks
      trusted_networks:
        - <pi-ip>/32
      trusted_users:
        <pi-ip>/32: <kiosk user id>
      allow_bypass_login: true
    - type: homeassistant           # must stay, or password logins stop working
```

Then restart HA. Have the user run *Developer tools → YAML → Check
configuration* first. Behind a reverse proxy, HA sees the proxy's IP, not
the Pi's, so this won't work; the Pi should reach HA directly.

### 7. Raspberry Pi

Target: Raspberry Pi OS (64-bit, desktop; the labwc/Wayland desktop on
Trixie, or Bookworm from late 2024). Run on the Pi, as the desktop user, not
root (it uses `sudo` itself and prompts for the password, so the user must
run it in an interactive terminal):

```bash
curl -fsSLO https://raw.githubusercontent.com/EsoterikStare/slate/main/scripts/pi/setup-kiosk.sh
chmod +x setup-kiosk.sh
./setup-kiosk.sh --url "http://<ha-ip>:8123/<dashboard-path>/0" --rotate 90 --boot silent
sudo reboot
```

| Option | Meaning |
| --- | --- |
| `--url URL` | Dashboard to show. Required, except with `--desktop` |
| `--rotate 0\|90\|180\|270` | Wayland transform (counter-clockwise). Portrait is 90 or 270, depending on how the monitor is mounted. Default: unchanged |
| `--output NAME` | Display to rotate, e.g. `HDMI-A-1`. Default: the connected one |
| `--boot splash\|text\|silent` | Boot screen: Pi logo, scrolling text, or black. Default: unchanged |
| `--show-cursor` | Keep the mouse pointer visible |
| `--no-upgrade` | Skip `apt full-upgrade` |
| `--desktop` | Switch back to the normal desktop session (maintenance) |

The script is idempotent: re-running replaces what it wrote before. It sets
up autologin into a minimal "Slate kiosk" session running Chromium in kiosk
mode (restarted if it exits), disables screen blanking and Wi-Fi power
saving, and enables unattended security updates.

**Verify:** after reboot the Pi shows the dashboard with no login page,
desktop or cursor.

### 8. Tuning

Ask the user what looks wrong on the real screen, then map it to the
options below. Common mappings: everything small → layout `scale`; edges cut
off → `inset`; text hard to read on bright photos → `scrim` up; too many
weeks → calendar `weeks`.

## Option reference

Defaults are what applies when an option is left out.

### `custom:slate-layout`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `top` | list of rows | `[]` | A row is a list of cards (side by side), or `{ cards, collapsible, placement }` |
| `top[].collapsible` | boolean | `false` | Folded away first when the calendar needs room (use for the forecast row) |
| `top[].placement` | `top` \| `stack` \| `hidden` | `top` for a forecast-only row, else `stack` | `top` pins to the screen top; `stack` sits on the calendar |
| `bottom` | card | none | Normally `custom:slate-calendar`; any card type works |
| `bottom_style` | `docked` \| `floating` | `docked` | `docked`: calendar edge to edge on black. `floating`: translucent card over a full-screen photo |
| `background` | object | none | See below |
| `scale` | number | `1` | Multiplies all text in every Slate card |
| `padding` | px | `16` | Outer padding |
| `inset` | px, or `{ top, right, bottom, left }` | `0` | Moves content in from cropped monitor edges; photo stays full-bleed |
| `gap` | px | `24` | Space between the top rows and the calendar |
| `scrim` | 0–1 | `0.2` | Darkening gradient behind text on the photo; `0` = off |
| `text_shadow` | boolean | `true` | Shadow behind clock and weather text |
| `icon_shadow` | `true` \| `false` \| `{ radius, opacity }` | `true` | Glow behind weather icons. `radius`: fraction of icon width, 0.1–1, default 0.65. `opacity`: centre darkness 0–1, default 0.22; always fades to 0 at the radius |
| `night` | `{ start, end, brightness }` | none | `"HH:MM"` strings; `brightness` 0–1, default `0.3`. Animations pause while dimmed |
| `reload_after` | seconds \| `false` | `300` | Reloads the page after HA's connection has been down this long |

### `background` (under the layout, or `custom:slate-background`)

Exactly one of `entity`, `url`, `urls`.

| Option | Type | Notes |
| --- | --- | --- |
| `entity` | entity ID | Uses `entity_picture`, or the state if it's an `http(s)://` URL |
| `url` | URL | One image. With `interval`, re-requested each time (for random-image URLs) |
| `urls` | list of URLs | Shown in turn every `interval` minutes. Local files: `/config/www/x.jpg` → `/local/x.jpg` |
| `interval` | minutes | Must be > 0 |
| `fade_seconds` | seconds | Cross-fade length, default `2`. New images fade in only once loaded |

### `custom:slate-calendar`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `calendars` | list | required | Each `{ entity, name, color }`, or just the entity ID string. `name` defaults from the ID; `color` from a built-in palette (any CSS colour) |
| `weeks` | integer ≥ 1 | `3` | Row 1 is always the current week |
| `first_day` | `sunday` \| `monday` | `sunday` | |
| `time_format` | `12` \| `24` | `12` | |
| `min_events_per_day` | integer ≥ 0 | `2` | Collapse never goes below this; hidden events show as "+N more" |
| `past_events` | `dim` \| `hide` | `dim` | Also applies to today's finished events |
| `title_lines` | `1` \| `2` \| `3` | `2` | Lines before a title is cut with an ellipsis |
| `month_on_first` | boolean | `true` | Shows "Nov" instead of "1" on the 1st |
| `relative_day_names` | boolean | `false` | "Today"/"Tomorrow" instead of weekday names |
| `show_legend` | boolean | `true` | Calendar names with colour dots |
| `today_color` | CSS colour | `brown` | Circle behind today's date |
| `refresh_interval` | minutes ≥ 1 | `5` | Also refetches whenever a calendar entity changes |
| `scale`, `text` | | | See [Text](#text-scale-and-text) |

Text roles: `legend`, `weekday`, `date_number`, `event_time`, `event_title`,
`all_day`, `more`.

### `custom:slate-clock`

| Option | Type | Default |
| --- | --- | --- |
| `time_format` | `12` \| `24` | `12` |
| `show_seconds` | boolean | `false` |
| `show_meridiem` | boolean | `true` (12-hour only) |
| `show_date` | boolean | `true` |
| `date_format` | `Intl.DateTimeFormat` options | `{ weekday: long, month: long, day: numeric }` |

Text roles: `time`, `date`.

### `custom:slate-weather`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `entity` | `weather.*` | required | |
| `show` | `both` \| `current` \| `forecast` | `both` | In the layout, use one card per part |
| `forecast_days` | integer | `5` | |
| `current` | list of `feels_like`, `humidity`, `wind`, `precipitation` | `[]` | Extra details beside current conditions, in order |
| `forecast_precipitation` | boolean | `false` | Precipitation chance under each day |
| `unit` | `F` \| `C` | the entity's | |
| `animations` | boolean | `true` | Icons also stay still during night dimming and with reduced motion |
| `sun_entity` | entity ID | `sun.sun` | Switches current-conditions icons to night versions |

Text roles: `temperature`, `condition`, `high_low`, `details`,
`forecast_day`, `forecast_temp`.

### Text: `scale` and `text`

Every card takes `scale` (whole card) and `text` (per role, e.g.
`text: { event_title: 1.2 }`). Final size = layout `scale` × card `scale` ×
role. Sizes also follow the screen width, so judge them on the real display,
not a desktop browser window.

## Error messages

Cards show these in a red error card when their config is invalid.

| Message (from the source) | Cause |
| --- | --- |
| `` slate-calendar: `calendars` must list at least one calendar entity `` | `calendars` missing or empty |
| `slate-calendar: "<id>" is not a calendar entity` | An entry doesn't start with `calendar.` |
| `` slate-calendar: `weeks` must be a whole number ≥ 1 `` | |
| `` slate-calendar: `first_day` must be sunday or monday `` | |
| `` slate-calendar: `title_lines` must be 1, 2 or 3 `` | |
| `` background: set exactly one of `entity`, `url`, or `urls` `` | None or several given |
| `` background: `urls` is empty `` | |
| `` background: `interval` must be positive minutes `` | |
| `Custom element doesn't exist: slate-…` (from HA) | Slate's resource isn't loaded: not installed, or the browser hasn't reloaded since |

## Diagnosing problems

| Symptom | Likely cause → fix |
| --- | --- |
| Event missing or late | Check HA's own Calendar panel. Missing there: integration problem or not yet fetched (step 5). Present there: wait `refresh_interval`, or reload |
| Kiosk shows a login page | Pi's IP changed (no DHCP reservation), reverse proxy, or the `trusted_networks` block not loaded (no restart, or a duplicate `homeassistant:` key) |
| Kiosk stuck on "connection lost" | Slate reloads the page after `reload_after` seconds disconnected. If that doesn't help, HA itself is down or unreachable |
| Old version after an update | Browser cache; reload the page (on the kiosk, reboot the Pi). Check the console's `SLATE <version>` line |
| Forecast row missing | It's `collapsible` and the calendar needed the room. Fewer `weeks`, smaller `scale`, or `collapsible: false` |
| "+N more" on many days | Not enough height; lower `weeks` or text sizes, or `title_lines: 1` |
| Choppy icon animation in Firefox | Known Firefox limitation; Chromium (the kiosk browser) is smooth |
| Photo hard to read text over | Raise `scrim`; keep `text_shadow` on |
