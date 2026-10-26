#!/usr/bin/env bash
# Turns a fresh Raspberry Pi OS (64-bit, desktop) into a Slate kiosk. At boot
# the Pi logs straight into a minimal "Slate kiosk" session: no desktop,
# taskbar or mouse cursor, just Chromium showing the dashboard full-screen
# (restarted if it ever exits). The screen is rotated, never blanks, and the
# boot screen can be the Pi splash, scrolling text, or black. Safe to re-run;
# each step replaces what it wrote last time.
#
# Run as the desktop user (not root), on the Pi:
#   ./setup-kiosk.sh --url http://<ha-ip>:8123/<dashboard-path> [options]
#   ./setup-kiosk.sh --desktop     log into the normal desktop again (maintenance)
#
# Options:
#   --url URL        dashboard to show (required, except with --desktop)
#   --rotate DEG     rotation for a portrait monitor: 0, 90, 180 or 270, as a
#                    Wayland transform (counter-clockwise). Default: unchanged.
#   --output NAME    display to rotate, e.g. HDMI-A-1 (default: the connected one)
#   --boot MODE      what shows before the dashboard: splash (Raspberry Pi logo),
#                    text (scrolling boot messages) or silent (black screen).
#                    Default: unchanged.
#   --show-cursor    keep the mouse cursor visible
#   --no-upgrade     skip `apt full-upgrade`
#
# Targets the labwc desktop (Raspberry Pi OS Trixie; Bookworm late-2024 on).
# Needs sudo for packages and system settings, so run it from a terminal.

set -euo pipefail

KIOSK_SESSION=slate-kiosk
DESKTOP_SESSION=rpd-labwc
LIGHTDM_CONF=/etc/lightdm/lightdm.conf
KDIR="$HOME/.config/slate-kiosk"
BEGIN_MARK="# >>> slate kiosk >>>"
END_MARK="# <<< slate kiosk <<<"

step() { printf '\n==> %s\n' "$*"; }

# Replaces the block between our markers in FILE (creating it if needed), so
# re-running updates the block instead of appending duplicates.
write_block() {
  local file="$1" content="$2" tmp
  mkdir -p "$(dirname "$file")"
  touch "$file"
  tmp="$(mktemp)"
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$file" >"$tmp"
  printf '%s\n%s\n%s\n' "$BEGIN_MARK" "$content" "$END_MARK" >>"$tmp"
  mv "$tmp" "$file"
}

# Removes our marked block from FILE, if both exist.
remove_block() {
  local file="$1" tmp
  [[ -f "$file" ]] || return 0
  tmp="$(mktemp)"
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$file" >"$tmp"
  mv "$tmp" "$file"
}

# Adds (add) or removes (remove) the HideCursor key binding in a labwc rc.xml.
rc_hide_cursor() {
  python3 - "$1" "$2" <<'PY'
import re, sys
path, mode = sys.argv[1], sys.argv[2]
s = open(path, encoding="utf-8").read()
s = re.sub(r"\s*<!-- >>> slate kiosk >>> -->.*?<!-- <<< slate kiosk <<< -->", "", s, flags=re.S)
if mode == "add":
    if "</keyboard>" not in s:
        sys.exit("rc.xml has no <keyboard> section")
    block = """
    <!-- >>> slate kiosk >>> -->
    <keybind key="W-C-A-h"><action name="HideCursor" /></keybind>
    <!-- <<< slate kiosk <<< -->"""
    s = s.replace("</keyboard>", block + "\n  </keyboard>", 1)
open(path, "w", encoding="utf-8").write(s)
PY
}

# Points LightDM's automatic login at SESSION.
set_autologin_session() {
  sudo sed -i -E "s/^autologin-session=.*/autologin-session=$1/" "$LIGHTDM_CONF"
  grep -q "^autologin-session=$1\$" "$LIGHTDM_CONF" ||
    { echo "couldn't set autologin-session in $LIGHTDM_CONF" >&2; exit 1; }
}

# The connected display's name as Wayland reports it, e.g. HDMI-A-1.
connected_output() {
  local status
  for status in /sys/class/drm/card*-*/status; do
    if [[ "$(cat "$status")" == connected ]]; then
      basename "$(dirname "$status")" | sed -E 's/^card[0-9]+-//'
      return
    fi
  done
}

# Rewrites a kernel command line (stdin -> stdout) for a boot MODE. Every
# token this script may have added is removed first, so modes switch cleanly.
cmdline_for() {
  local mode="$1" out=() word words=()
  # cmdline.txt has no trailing newline, so read reports EOF; the words are
  # still read, so don't treat that as failure.
  read -r -a words || true
  for word in "${words[@]}"; do
    case "$word" in
      quiet|splash|plymouth.ignore-serial-consoles|loglevel=3|logo.nologo|vt.global_cursor_default=0) ;;
      console=tty3) out+=(console=tty1) ;;
      *) out+=("$word") ;;
    esac
  done
  case "$mode" in
    splash) out+=(quiet splash plymouth.ignore-serial-consoles) ;;
    text) ;;
    silent)
      for i in "${!out[@]}"; do [[ "${out[$i]}" == console=tty1 ]] && out[$i]=console=tty3; done
      out+=(quiet loglevel=3 logo.nologo vt.global_cursor_default=0)
      ;;
  esac
  echo "${out[*]}"
}

# Rewrites the kernel command line FILE for a boot MODE. Computes the new line
# first (never reading and writing the file in one pipeline), refuses to write
# one that has lost the root= entry the Pi needs to boot, and replaces the
# file in one copy. SUDO is overridable for tests.
set_boot_cmdline() {
  local file="$1" mode="$2" new tmp
  new="$(cmdline_for "$mode" <"$file")"
  if [[ "$new" != *root=* ]]; then
    echo "refusing to change $file: the result has no root= entry" >&2
    return 1
  fi
  tmp="$(mktemp)"
  printf '%s
' "$new" >"$tmp"
  ${SUDO-sudo} cp "$tmp" "$file"
  rm -f "$tmp"
}

# Writes a cursor theme whose every cursor is one transparent pixel, so the
# pointer is invisible from the session's first frame.
write_blank_cursor_theme() {
  python3 - "$HOME/.icons/slate-blank" <<'PY'
import os, struct, sys
theme = sys.argv[1]
os.makedirs(os.path.join(theme, "cursors"), exist_ok=True)
size, image_type = 24, 0xFFFD0002
# Xcursor file: header, one table-of-contents entry, one 1x1 image chunk.
chunk = struct.pack("<9I", 36, image_type, size, 1, 1, 1, 0, 0, 0) + struct.pack("<I", 0)
data = b"Xcur" + struct.pack("<3I", 16, 0x10000, 1) + struct.pack("<3I", image_type, size, 28) + chunk
names = """default left_ptr arrow top_left_arrow text xterm ibeam pointer hand hand1 hand2
grab grabbing openhand closedhand crosshair cross tcross wait watch progress
left_ptr_watch help question_arrow not-allowed no-drop crossed_circle move
fleur all-scroll cell copy alias context-menu vertical-text zoom-in zoom-out
col-resize row-resize ew-resize ns-resize nesw-resize nwse-resize e-resize
w-resize n-resize s-resize ne-resize nw-resize se-resize sw-resize
sb_h_double_arrow sb_v_double_arrow h_double_arrow v_double_arrow
top_left_corner top_right_corner bottom_left_corner bottom_right_corner
top_side bottom_side left_side right_side X_cursor dnd-none dnd-move dnd-copy
dnd-link pirate""".split()
for name in names:
    with open(os.path.join(theme, "cursors", name), "wb") as f:
        f.write(data)
with open(os.path.join(theme, "index.theme"), "w") as f:
    f.write("[Icon Theme]\nName=slate-blank\nComment=Invisible cursor for the Slate kiosk\n")
PY
}

# Tests source this file for its functions; stop here when sourced.
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  return 0
fi

URL=""
ROTATE=""
OUTPUT=""
BOOT=""
HIDE_CURSOR=1
UPGRADE=1
DESKTOP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --rotate) ROTATE="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --boot) BOOT="$2"; shift 2 ;;
    --text-boot) BOOT=text; shift ;; # older name for --boot text
    --show-cursor) HIDE_CURSOR=0; shift ;;
    --no-upgrade) UPGRADE=0; shift ;;
    --desktop) DESKTOP=1; shift ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ "$(id -u)" -ne 0 ]] || { echo "run as the desktop user, not root" >&2; exit 2; }
command -v labwc >/dev/null || { echo "labwc not found: this script targets the Raspberry Pi OS labwc desktop" >&2; exit 1; }

if [[ "$DESKTOP" -eq 1 ]]; then
  step "Logging into the normal desktop at boot again"
  set_autologin_session "$DESKTOP_SESSION"
  step "Done. Reboot to get the desktop: sudo reboot (re-run with --url for the kiosk)"
  exit 0
fi

[[ -n "$URL" ]] || { echo "--url is required" >&2; exit 2; }
[[ -z "$ROTATE" || "$ROTATE" =~ ^(0|90|180|270)$ ]] || { echo "--rotate must be 0, 90, 180 or 270" >&2; exit 2; }
[[ -z "$BOOT" || "$BOOT" =~ ^(splash|text|silent)$ ]] || { echo "--boot must be splash, text or silent" >&2; exit 2; }

if [[ "$UPGRADE" -eq 1 ]]; then
  step "Updating the system (apt full-upgrade)"
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
fi

step "Installing packages (automatic security updates, wtype)"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades wtype
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' |
  sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null

step "Disabling screen blanking"
sudo raspi-config nonint do_blanking 1

step "Turning off Wi-Fi power saving"
# Power-save naps between packets add latency and drop the dashboard's
# websocket to Home Assistant. 2 = disabled (NetworkManager).
printf '[connection]\nwifi.powersave = 2\n' |
  sudo tee /etc/NetworkManager/conf.d/99-slate-wifi-powersave.conf >/dev/null
sudo systemctl reload NetworkManager || true

if [[ -n "$BOOT" ]]; then
  step "Boot screen: $BOOT"
  CMDLINE=/boot/firmware/cmdline.txt
  CONFIG=/boot/firmware/config.txt
  # Keep the originals once, before this script first changes them.
  [[ -f "$CMDLINE.before-slate" ]] || sudo cp "$CMDLINE" "$CMDLINE.before-slate"
  [[ -f "$CONFIG.before-slate" ]] || sudo cp "$CONFIG" "$CONFIG.before-slate"
  set_boot_cmdline "$CMDLINE" "$BOOT"
  sudo sed -i '/^disable_splash=/d' "$CONFIG"
  if [[ "$BOOT" == silent ]]; then
    # No rainbow firmware screen, no messages, logo or blinking cursor on the
    # screen, and no login prompt flashing on the console before the kiosk.
    echo "disable_splash=1" | sudo tee -a "$CONFIG" >/dev/null
    sudo systemctl disable getty@tty1.service
  else
    sudo systemctl enable getty@tty1.service
  fi
  echo "kernel command line: $(cat "$CMDLINE")"
fi

if [[ -n "$ROTATE" ]]; then
  step "Rotating the display (kanshi)"
  OUTPUT="${OUTPUT:-$(connected_output)}"
  [[ -n "$OUTPUT" ]] || { echo "no connected display found; pass --output NAME" >&2; exit 1; }
  transform="$ROTATE"
  [[ "$transform" == 0 ]] && transform=normal
  # Used by both the kiosk and the normal desktop session.
  write_block "$HOME/.config/kanshi/config" "profile slate {
  output $OUTPUT transform $transform
}"
  pkill -HUP -x kanshi || true # reload now if it's running
  echo "$OUTPUT -> transform $transform"
fi

step "Installing the kiosk browser launcher"
CHROMIUM="$(command -v chromium || command -v chromium-browser)"
mkdir -p "$HOME/.local/bin"
cat >"$HOME/.local/bin/slate-kiosk-browser" <<EOF
#!/usr/bin/env bash
# Keeps Chromium showing the Slate dashboard; restarts it if it ever exits.
# Written by scripts/pi/setup-kiosk.sh; re-run that to change it.
while true; do
  "$CHROMIUM" \\
    --kiosk "$URL" \\
    --user-data-dir="\$HOME/.config/slate-kiosk-chromium" \\
    --noerrdialogs --disable-infobars --no-first-run \\
    --disable-session-crashed-bubble --disable-features=Translate \\
    --password-store=basic --check-for-update-interval=31536000 \\
    --enable-features=OverlayScrollbar
  sleep 5
done
EOF
chmod +x "$HOME/.local/bin/slate-kiosk-browser"

step "Configuring the minimal kiosk session ($KDIR)"
# labwc with its own config folder: none of the desktop's wallpaper, taskbar,
# on-screen keyboard or helpers, only what's listed here.
mkdir -p "$KDIR"
cp /etc/xdg/labwc/rc.xml "$KDIR/rc.xml"
ENV_BASE="$HOME/.config/labwc/environment"
[[ -f "$ENV_BASE" ]] || ENV_BASE=/etc/xdg/labwc/environment
{ [[ -f "$ENV_BASE" ]] && grep -v '^XCURSOR_' "$ENV_BASE"; true; } >"$KDIR/environment"
AUTOSTART="kanshi &"
if [[ "$HIDE_CURSOR" -eq 1 ]]; then
  write_blank_cursor_theme
  printf 'XCURSOR_THEME=slate-blank\nXCURSOR_SIZE=24\n' >>"$KDIR/environment"
  rc_hide_cursor "$KDIR/rc.xml" add
  # Belt and braces: also hide the pointer outright once the session is up.
  AUTOSTART="$AUTOSTART
(sleep 2; wtype -M logo -M ctrl -M alt -k h -m alt -m ctrl -m logo) &"
fi
printf '%s\n"$HOME/.local/bin/slate-kiosk-browser" &\n' "$AUTOSTART" >"$KDIR/autostart"

step "Registering the kiosk session and logging into it at boot"
sudo tee /usr/local/bin/slate-kiosk-session >/dev/null <<'EOF'
#!/bin/sh
# Slate kiosk session: labwc with only the kiosk's own config.
exec labwc -C "$HOME/.config/slate-kiosk"
EOF
sudo chmod 755 /usr/local/bin/slate-kiosk-session
sudo tee "/usr/share/wayland-sessions/$KIOSK_SESSION.desktop" >/dev/null <<EOF
[Desktop Entry]
Name=Slate kiosk
Comment=Full-screen Slate dashboard, no desktop
Exec=/usr/local/bin/slate-kiosk-session
Type=Application
EOF
set_autologin_session "$KIOSK_SESSION"

step "Leaving the normal desktop session clean"
# Earlier versions of this script started the kiosk inside the desktop.
remove_block "$HOME/.config/labwc/autostart"
[[ -f "$HOME/.config/labwc/rc.xml" ]] && rc_hide_cursor "$HOME/.config/labwc/rc.xml" remove

step "Done. Reboot to start the kiosk: sudo reboot"
