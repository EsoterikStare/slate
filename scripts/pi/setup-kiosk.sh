#!/usr/bin/env bash
# Turns a fresh Raspberry Pi OS (64-bit, desktop) into a Slate kiosk: Chromium
# opens the dashboard full-screen at login and stays up, the screen is rotated
# and never blanks, and the mouse cursor is hidden. Safe to re-run; each step
# replaces what it wrote last time.
#
# Run as the desktop user (not root), on the Pi:
#   ./setup-kiosk.sh --url http://<ha-ip>:8123/<dashboard>/0?kiosk [options]
#
# Options:
#   --url URL        dashboard to show (required)
#   --rotate DEG     rotation for a portrait monitor: 0, 90, 180 or 270, as a
#                    Wayland transform (counter-clockwise). Default: unchanged.
#   --output NAME    display to rotate, e.g. HDMI-A-1 (default: the connected one)
#   --show-cursor    keep the mouse cursor visible
#   --no-upgrade     skip `apt full-upgrade`
#
# Targets the labwc desktop (Raspberry Pi OS Trixie; Bookworm late-2024 on).
# Needs sudo for packages and system settings, so run it from a terminal.

set -euo pipefail

URL=""
ROTATE=""
OUTPUT=""
HIDE_CURSOR=1
UPGRADE=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --rotate) ROTATE="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --show-cursor) HIDE_CURSOR=0; shift ;;
    --no-upgrade) UPGRADE=0; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$URL" ]] || { echo "--url is required" >&2; exit 2; }
[[ "$(id -u)" -ne 0 ]] || { echo "run as the desktop user, not root" >&2; exit 2; }
[[ -z "$ROTATE" || "$ROTATE" =~ ^(0|90|180|270)$ ]] || { echo "--rotate must be 0, 90, 180 or 270" >&2; exit 2; }
command -v labwc >/dev/null || { echo "labwc not found: this script targets the Raspberry Pi OS labwc desktop" >&2; exit 1; }

step() { printf '\n==> %s\n' "$*"; }

BEGIN_MARK="# >>> slate kiosk >>>"
END_MARK="# <<< slate kiosk <<<"

# Replaces the block between our markers in FILE (creating it if needed), so
# re-running updates the block instead of appending duplicates.
write_block() {
  local file="$1" content="$2"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  local tmp
  tmp="$(mktemp)"
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$file" >"$tmp"
  printf '%s\n%s\n%s\n' "$BEGIN_MARK" "$content" "$END_MARK" >>"$tmp"
  mv "$tmp" "$file"
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

if [[ -n "$ROTATE" ]]; then
  step "Rotating the display (kanshi)"
  OUTPUT="${OUTPUT:-$(connected_output)}"
  [[ -n "$OUTPUT" ]] || { echo "no connected display found; pass --output NAME" >&2; exit 1; }
  transform="$ROTATE"
  [[ "$transform" == 0 ]] && transform=normal
  # The desktop starts kanshi at login; it applies this profile to the display.
  write_block "$HOME/.config/kanshi/config" "profile slate {
  output $OUTPUT transform $transform
}"
  pkill -HUP -x kanshi || true # reload now if it's running
  echo "$OUTPUT -> transform $transform"
fi

if [[ "$HIDE_CURSOR" -eq 1 ]]; then
  step "Hiding the mouse cursor"
  # labwc's HideCursor action hides the pointer until it next moves; with no
  # mouse attached, that's for good. It's bound to an unused key combination,
  # which the launcher presses once Chromium is up. A personal rc.xml
  # replaces the system one, so start from a copy of it.
  RC="$HOME/.config/labwc/rc.xml"
  [[ -f "$RC" ]] || cp /etc/xdg/labwc/rc.xml "$RC"
  python3 - "$RC" <<'PY'
import re, sys
path = sys.argv[1]
s = open(path, encoding="utf-8").read()
s = re.sub(r"\s*<!-- >>> slate kiosk >>> -->.*?<!-- <<< slate kiosk <<< -->", "", s, flags=re.S)
block = """
    <!-- >>> slate kiosk >>> -->
    <keybind key="W-C-A-h"><action name="HideCursor" /></keybind>
    <!-- <<< slate kiosk <<< -->"""
if "</keyboard>" not in s:
    sys.exit("rc.xml has no <keyboard> section")
s = s.replace("</keyboard>", block + "\n  </keyboard>", 1)
open(path, "w", encoding="utf-8").write(s)
PY
fi

step "Installing the kiosk browser launcher"
CHROMIUM="$(command -v chromium || command -v chromium-browser)"
mkdir -p "$HOME/.local/bin"
HIDE_LINE=""
if [[ "$HIDE_CURSOR" -eq 1 ]]; then
  HIDE_LINE='(sleep 10; wtype -M logo -M ctrl -M alt -k h -m alt -m ctrl -m logo) &'
fi
cat >"$HOME/.local/bin/slate-kiosk-browser" <<EOF
#!/usr/bin/env bash
# Keeps Chromium showing the Slate dashboard; restarts it if it ever exits.
# Written by scripts/pi/setup-kiosk.sh; re-run that to change it.
$HIDE_LINE
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

step "Starting the kiosk at login (labwc autostart)"
write_block "$HOME/.config/labwc/autostart" "\"\$HOME/.local/bin/slate-kiosk-browser\" &"

step "Done. Reboot to start the kiosk: sudo reboot"
