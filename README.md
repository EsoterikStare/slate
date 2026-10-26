# Slate

Custom Home Assistant dashboard cards for a portrait, wall-mounted kiosk: a
week-row calendar running edge to edge along the bottom of the screen on
black, with the clock, date and weather sitting on top of it over a rotating
photo. (`bottom_style: floating` instead floats the calendar as a translucent
card over a full-screen photo.)

| Card | What it does |
| --- | --- |
| `custom:slate-layout` | Full-screen composition: background, top rows stacked on a bottom card, night dimming, reload watchdog |
| `custom:slate-calendar` | Week rows that grow upward with the busiest day; collapses far-future weeks to fit |
| `custom:slate-clock` | Large time and date |
| `custom:slate-weather` | Current conditions and/or a daily forecast strip, with animated Meteocons |

Design decisions and their reasons are in [PLANNING.md](PLANNING.md).

## Install

> **Status: alpha.** Versions are numbered `0.1.0-alpha.N`. Expect rough
> edges and breaking config changes between releases.

Slate isn't in the catalog yet, so it's added by its GitHub address. This
link opens the right screen in your Home Assistant (the Marketplace on
2026.11 and later, HACS before that):

[![Open in Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=EsoterikStare&repository=slate&category=plugin)

**Home Assistant 2026.11 and later (Marketplace):** Settings → Marketplace,
add `https://github.com/EsoterikStare/slate` as a *Dashboard* repository,
open **Slate**, and install.

**Earlier versions (HACS):** HACS → ⋮ → *Custom repositories* → add
`https://github.com/EsoterikStare/slate` as type *Dashboard*. Open
**Slate** and choose *Download*.

Either way, the dashboard resource is added for you, at
`/local/community/slate/slate.js` (or HACS's `/hacsfiles/slate/slate.js`), and
new releases are offered as updates. After updating, reload the browser
showing the dashboard (on the kiosk, reload the page) to load the new version.

The browser console prints the running version (`SLATE 0.1.0-alpha.1`) on
load, which is handy for checking what the kiosk is actually running.

**By hand:** copy `dist/slate.js` (from `pnpm build`, or a release) to
`/config/www/slate/` and add a dashboard resource (Settings → Dashboards →
⋮ → Resources) of type *JavaScript module* pointing at
`/local/slate/slate.js`.

## Dashboard

A dashboard with one panel view holding `slate-layout`. An example with
several calendars, an Unsplash background sensor and Met.no weather:

```yaml
kiosk_mode:
  kiosk: true            # Kiosk Mode (HACS) hides the header and sidebar
views:
  - title: Wall
    type: panel
    cards:
      - type: custom:slate-layout
        scale: 1                       # global text size
        background:
          entity: sensor.unsplash_background
        night:
          start: "22:00"
          end: "06:00"
          brightness: 0.3
        reload_after: 300              # seconds offline before reloading the page
        gap: 24                        # px between the weather and the calendar
        bottom_style: docked           # or floating: translucent card over a full-screen photo
        scrim: 0.2                     # soft gradient behind text on the photo (0 = off, up to 1)
        text_shadow: true              # layered shadow on clock and weather text
        icon_shadow: true              # drop shadow on weather icons
        top:
          - - type: custom:slate-clock
              time_format: 12
            - type: custom:slate-weather
              entity: weather.forecast_home
              show: current
              current: [feels_like, precipitation]
          - cards:
              - type: custom:slate-weather
                entity: weather.forecast_home
                show: forecast
                forecast_days: 5
            collapsible: true          # folds away first when the calendar needs room
            placement: top             # top of screen (default for the forecast), stack (on the calendar), or hidden
        bottom:
          type: custom:slate-calendar
          weeks: 3
          first_day: sunday
          min_events_per_day: 2
          past_events: dim             # or hide
          calendars:
            - { entity: calendar.alex, name: Alex, color: dodgerblue }
            - { entity: calendar.sam, name: Sam, color: tomato }
            - { entity: calendar.jamie, name: Jamie, color: chartreuse }
            - { entity: calendar.family, name: Family, color: gold }
            - { entity: calendar.kids, name: Kids, color: indigo }
            - { entity: calendar.school, name: School, color: darkorange }
            - { entity: calendar.garden, name: Garden, color: darkgreen }
```

### Text sizes

Every card takes `scale:` (the whole card) and `text:` (individual pieces);
the final size is `layout scale × card scale × text role`. For example:

```yaml
type: custom:slate-calendar
scale: 1.1
text: { event_title: 1.2, event_time: 0.9 }
```

| Card | `text:` roles |
| --- | --- |
| slate-calendar | `legend`, `weekday`, `date_number`, `event_time`, `event_title`, `all_day`, `more` |
| slate-clock | `time`, `date` |
| slate-weather | `temperature`, `condition`, `high_low`, `details`, `forecast_day`, `forecast_temp` |

### Other options

- **slate-calendar:** `title_lines` (1–3, default 2), `month_on_first` (show
  "Nov" instead of "1" on the 1st; default on), `time_format` (12/24),
  `relative_day_names` (Today/Tomorrow), `show_legend`, `today_color`,
  `refresh_interval` (minutes).
- **slate-clock:** `show_seconds`, `show_meridiem`, `show_date`, `date_format`
  (Intl options, e.g. `{ weekday: long, month: long, day: numeric }`).
- **slate-weather:** `unit` (F/C), `forecast_precipitation`, `animations`,
  `sun_entity` (night icons; default `sun.sun`).
- **background:** `entity`, or `url` (with `interval` to re-fetch a random-image
  URL), or `urls` + `interval` (minutes) to rotate; `fade_seconds`.

## Kiosk (Raspberry Pi)

Let the Pi in without a login prompt, and only the Pi. In `configuration.yaml`
(give the Pi a DHCP reservation so its IP never changes, and create a
dedicated non-admin user for it):

```yaml
homeassistant:
  auth_providers:
    - type: trusted_networks
      trusted_networks:
        - <pi-ip>/32          # the Pi
      trusted_users:
        <pi-ip>/32: <user id of the kiosk user>
      allow_bypass_login: true
    - type: homeassistant          # keep normal logins for everyone else
```

If the screen still ends up on a login page or "connection lost" after a
while, likely causes are: the Pi's IP changed; a reverse proxy makes HA see
the proxy's IP instead of the Pi's; or the frontend never recovered from an
HA restart — `reload_after` covers that last one.

## Development

```bash
pnpm install
pnpm test          # unit + component tests
pnpm storybook     # every card, plus the full 1080×1920 kiosk, with fake HA data
pnpm build         # dist/slate.js
```

**Against your real HA, live:** run `pnpm dev`, allow port 5173 through
Windows Firewall (private networks only):

```powershell
New-NetFirewallRule -DisplayName "Vite dev (slate)" -Direction Inbound -Protocol TCP -LocalPort 5173 -Profile Private -Action Allow
```

then add a JavaScript module resource `http://<this-pc-ip>:5173/src/index.ts`
and build the layout in a test dashboard. Save a file, refresh, see the change
with real calendars and weather. (Works because HA is served over plain
`http://`.) Resources are global to HA, not per dashboard, so remove the dev
resource when you're done, and never keep it alongside a HACS-installed copy
(both would register the same card names). If a VPN is running on the dev PC,
it may need LAN connections allowed.

**A real build on the kiosk:** `pnpm deploy:dev` builds and copies the bundle
to `\\homeassistant.local\config\www\slate` through the Samba share
add-on (override with `SLATE_DEPLOY_DIR`), then prints the resource URL with a
`?v=` stamp so the Pi doesn't keep a cached copy.

Weather icons: [Meteocons](https://github.com/basmilius/weather-icons) by Bas
Milius, MIT licence.
