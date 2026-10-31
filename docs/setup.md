# Setting up Slate

This guide walks through a complete wall display, from an empty Home
Assistant dashboard to a Raspberry Pi on the wall that starts straight into
it. Each step ends with a check, so you know it worked before moving on.

Using an AI assistant to help? Point it at
[setup-for-agents.md](setup-for-agents.md), which covers the same ground in a
form written for it.

You don't need every step. Steps 1–5 give you the dashboard in any browser;
steps 6–7 make a dedicated kiosk out of a Raspberry Pi.

**What you'll need**

- Home Assistant with HACS installed (or Home Assistant 2026.11 or later, which
  has the Marketplace built in).
- At least one calendar and one weather entity in Home Assistant (step 2
  covers adding them).
- For the kiosk: a Raspberry Pi 4 (or newer) with Raspberry Pi OS (64-bit,
  with desktop), and a monitor. Slate is designed for a portrait 1080×1920
  screen but adapts to other sizes.

## 1. Install Slate

[![Open in Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=EsoterikStare&repository=slate&category=plugin)

The button opens the right screen in your Home Assistant. Or by hand:

- **Home Assistant 2026.11 and later:** Settings → Marketplace → add
  `https://github.com/EsoterikStare/slate` as a *Dashboard* repository.
- **Earlier versions:** HACS → ⋮ → *Custom repositories* → add
  `https://github.com/EsoterikStare/slate` with type *Dashboard*.

Then open **Slate** and install (*Download*). The dashboard resource is added
for you. Reload your browser afterwards.

**Check:** open your browser's developer console (F12) on any Home Assistant
page. You should see a line like `SLATE 0.1.0-alpha.4`.

## 2. Gather your entities

Slate shows Home Assistant's data; it doesn't connect to calendar or weather
services itself. Find the entity IDs you'll use in **Settings → Developer
tools → States**, by typing `calendar.` or `weather.` in the filter. Write
them down; you'll need them in step 3.

### Calendars

Any `calendar.*` entity works. If yours aren't in Home Assistant yet, the
most common ways to add them are:

- **A shared link** (e.g. an iCloud calendar shared as a *public calendar*,
  or a Google calendar's "secret address in iCal format"): add the **Remote
  Calendar** integration (Settings → Devices & services → Add integration)
  and paste the link. If it starts with `webcal://`, change that to
  `https://`. One integration entry per calendar.
- **Your account** (iCloud, Nextcloud, Fastmail and other CalDAV services):
  the **CalDAV** integration. For iCloud the server is
  `https://caldav.icloud.com` and the password is an *app-specific password*
  from your Apple account settings, not your Apple ID password.
- **Google Calendar:** the Google Calendar integration.

How quickly changes arrive depends on the integration; step 5 deals with
that.

### Weather

Any `weather.*` entity with a daily forecast works. A new Home Assistant
install usually has `weather.forecast_home` from Met.no already. Open-Meteo
is another good free choice, with a longer forecast.

### Background photo (optional)

Pick one:

- **Your own photos:** copy them to `/config/www/backgrounds/` (e.g. with the
  Samba share or File editor add-on). They're then served at
  `/local/backgrounds/<file name>`. List them under `background: urls:`.
- **A random-image URL:** any address that returns a different picture each
  time, under `background: url:` with an `interval`.
- **An entity:** any entity whose picture (or state) is an image URL. For
  example, a sensor that fetches a new portrait photo from Unsplash every 30 minutes.
  It needs a free Unsplash developer account for the access key, and goes in
  `configuration.yaml`:

  ```yaml
  rest:
    - resource: https://api.unsplash.com/photos/random
      params:
        client_id: !secret unsplash_key
        query: landscape                  # what kind of photos
        orientation: portrait
      scan_interval: 1800
      sensor:
        - name: Unsplash background
          value_template: "{{ value_json.id }}"
          picture: "{{ value_json.urls.raw }}&w=1080&h=1920&fit=crop&crop=entropy&q=85&auto=format"
  ```

  and in `secrets.yaml`, next to `configuration.yaml` (Home Assistant reads
  it automatically; no `!include` needed): `unsplash_key: <your access key>`.
  For a 4K screen, add `&dpr=2` to the end of the `picture` line. Restart
  Home Assistant, and `sensor.unsplash_background` appears.

**Check:** you have a list of calendar entity IDs, one weather entity ID, and
(optionally) a background.

## 3. Create the dashboard

1. Settings → Dashboards → **Add dashboard** → *New dashboard from scratch*.
   Give it a name (e.g. "Wall"), and note its URL path (e.g. `dashboard-wall`).
2. Open it, choose ✏️ (edit) → ⋮ → **Raw configuration editor**.
3. Replace everything with the configuration below, using your own entity
   IDs, and save.

```yaml
views:
  - title: Wall
    type: panel
    cards:
      - type: custom:slate-layout
        background:
          entity: sensor.unsplash_background     # or urls: / url: — see step 2
        night:
          start: "22:00"
          end: "06:00"
          brightness: 0.3
        top:
          - - type: custom:slate-clock
            - type: custom:slate-weather
              entity: weather.forecast_home
              show: current
              current: [feels_like, precipitation]
          - cards:
              - type: custom:slate-weather
                entity: weather.forecast_home
                show: forecast
                forecast_days: 5
            collapsible: true
        bottom:
          type: custom:slate-calendar
          calendars:
            - { entity: calendar.alex, name: Alex, color: dodgerblue }
            - { entity: calendar.family, name: Family, color: gold }
```

`type: panel` matters: it gives Slate the whole screen. Without a
`background`, delete those two lines and the area above the calendar is
black.

**Check:** the dashboard shows the clock, weather and your events. If a card
shows a red error box instead, its message says which setting is wrong (see
[Troubleshooting](#troubleshooting)).

Make it look right on your actual screen later, in step 8. Sizes follow the
window, so a laptop preview looks different from a portrait monitor.

## 4. Hide Home Assistant's header and sidebar

Install **Kiosk Mode** from HACS / the Marketplace (it's a *Dashboard*
plugin), then add this to the very top of the dashboard's raw configuration,
above `views:`:

```yaml
kiosk_mode:
  kiosk: true
```

**Check:** reload; only Slate is on screen.

To get the header back while you edit, add `?disable_km` to the address,
e.g. `http://<ha-ip>:8123/dashboard-wall/0?disable_km`.

## 5. Make calendar changes show up quickly

Slate checks for new events every 5 minutes, but it can only show what Home
Assistant has fetched, and some integrations fetch rarely:

| Integration | Fetches changes |
| --- | --- |
| Remote Calendar (shared links) | once a day |
| CalDAV | every 15 minutes |

To fetch more often, create an automation (Settings → Automations → Create
→ ⋮ → Edit in YAML) that asks Home Assistant to refresh your calendars every
10 minutes:

```yaml
alias: Refresh calendars
triggers:
  - trigger: time_pattern
    minutes: /10
actions:
  - action: homeassistant.update_entity
    target:
      entity_id:
        - calendar.alex
        - calendar.family
mode: single
```

Use `homeassistant.update_entity` (shown in the editor as *Update entity*);
`calendar.get_events` only reads what Home Assistant already has and doesn't
fetch anything. Every 10 minutes is gentle on the calendar service; don't go
below 5.

**Check:** add an event on your phone, run the automation by hand (⋮ → *Run
actions*), and within 5 minutes the event is on the dashboard. For even
quicker updates, add `refresh_interval: 1` under `type:
custom:slate-calendar`.

## 6. Let the Raspberry Pi in without a password

The kiosk has no keyboard, so Home Assistant needs to trust it.

1. **Give the Pi a fixed address.** In your router, add a DHCP reservation for
   the Pi. Everything below depends on its address never changing.
2. **Create a user for it.** Settings → People → *Add person*, allow login,
   and leave *Administrator* off. Open the new user (Settings → People →
   *Users* tab; turn on *Advanced mode* in your profile if you don't see it)
   and copy its **ID**.
3. **Trust the Pi's address.** Add to `configuration.yaml`:

   ```yaml
   homeassistant:
     auth_providers:
       - type: trusted_networks
         trusted_networks:
           - <pi-ip>/32
         trusted_users:
           <pi-ip>/32: <user id from step 2>
         allow_bypass_login: true
       - type: homeassistant
   ```

   Keep the second `- type: homeassistant` line: without it, nobody can log in
   with a password any more. If you already have a `homeassistant:` section,
   add `auth_providers:` inside it instead of making a second one.
4. Restart Home Assistant (Settings → System → ⏻ → *Restart Home Assistant*).

**Check:** done on the Pi in the next step; it should land on the dashboard
without ever showing a login page.

## 7. Set up the Raspberry Pi

1. Install **Raspberry Pi OS (64-bit)** with desktop using Raspberry Pi
   Imager. In the Imager's settings, set a user name and password, your Wi-Fi
   if needed, and turn on SSH.
2. Start the Pi and connect to it: `ssh <user>@<pi-ip>`.
3. Download and run the setup script:

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/EsoterikStare/slate/main/scripts/pi/setup-kiosk.sh
   chmod +x setup-kiosk.sh
   ./setup-kiosk.sh --url "http://<ha-ip>:8123/dashboard-wall/0" --rotate 90 --boot silent
   ```

   - `--url` is the dashboard's address as you'd open it in a browser.
   - `--rotate` turns the picture for a monitor mounted on its side: `90` or
     `270` depending on which way it's turned (try one; if the picture is
     upside down, re-run with the other).
   - `--boot silent` shows a black screen while starting instead of the
     Raspberry Pi logo (`splash`) or scrolling text (`text`).

   It asks for your password (for `sudo`) and takes a while the first time,
   because it also installs system updates.
4. Reboot: `sudo reboot`.

**Check:** the Pi starts straight into the dashboard, with no desktop, mouse
pointer or login page. If Chromium is ever closed or crashes, it comes back
by itself.

For maintenance, `./setup-kiosk.sh --desktop` makes the Pi start into the
normal desktop again; re-run with `--url` to go back. `./setup-kiosk.sh
--help` lists every option.

## 8. Fine-tune

Look at the real screen from across the room and adjust. All of these go in
the dashboard's raw configuration, under `type: custom:slate-layout` unless
noted.

- **Everything too small or large:** `scale: 1.2` (or `0.9`).
- **One thing too small or large:** each card takes `scale:` and `text:`, e.g.
  under the calendar `text: { event_title: 1.2 }`. The README lists every
  [text role](../README.md#text-sizes).
- **Monitor cuts off the edges:** `inset: { left: 8, right: 8 }` (pixels).
  Only the content moves in; the photo still fills the screen.
- **Text hard to read on bright photos:** raise `scrim` (default `0.2`, up to
  `1`). `text_shadow: false` turns the text shadow off.
- **Weather icon glow:** `icon_shadow: false` removes it, or set its size and
  darkness:
  ```yaml
  icon_shadow: { radius: 0.8, opacity: 0.3 }
  ```
- **Night dimming:** `night: { start, end, brightness }`; animations pause
  while dimmed.
- **More or fewer weeks:** `weeks: 4` under the calendar. When events don't
  fit, Slate folds the forecast away first, then trims the furthest week,
  never showing fewer than `min_events_per_day` (default 2) per day.
- **Calendar look:** `first_day: monday`, `time_format: 24`, `past_events:
  hide`, `title_lines: 1`, `today_color`.

The [README](../README.md#dashboard) has a fuller example.

## Updating

Slate shows up in HACS / the Marketplace when there's a new version. Install
it, then reload every browser showing the dashboard. On the kiosk, the
easiest way is to restart the Pi (`sudo reboot` over SSH). The console line
from step 1 shows which version is running.

## Troubleshooting

**A card shows a red error box.** The message names the setting; common ones:

| Message | Fix |
| --- | --- |
| `` `calendars` must list at least one calendar entity `` | Add `calendars:` under the calendar card |
| `"…" is not a calendar entity` | Entity IDs there must start with `calendar.` |
| `` background: set exactly one of `entity`, `url`, or `urls` `` | Use only one way of choosing photos |
| `Custom element doesn't exist: slate-…` | Slate isn't loaded: reinstall (step 1) and reload the browser |

**A calendar event is missing or late.** See step 5. Also check the
event appears in Home Assistant's own Calendar page; if not, the problem is
the integration, not Slate.

**The kiosk shows a login page.** Usually the Pi's address changed (check the
DHCP reservation), or Home Assistant sits behind a reverse proxy, so it sees
the proxy's address instead of the Pi's. Connect the Pi to Home Assistant
directly.

**The kiosk says "connection lost" and stays that way.** Slate reloads the
page after 5 minutes without a connection (`reload_after`, in seconds). If it
doesn't recover, Home Assistant itself is probably down.

**The kiosk still shows the old version after updating.** Restart the Pi.

**Animations are choppy in Firefox.** A known Firefox limitation with slowly
sliding layers; Chromium (which the kiosk uses) is smooth.
