#!/usr/bin/env bash
# Turns a fresh Raspberry Pi OS (64-bit, desktop) into a Slate kiosk: Chromium
# opens the dashboard full-screen at login and stays up, and the screen never
# blanks. Safe to re-run; each step replaces what it wrote last time.
#
# Run as the desktop user (not root), on the Pi:
#   ./setup-kiosk.sh --url http://<ha-ip>:8123/<dashboard>/0?kiosk [options]
#
# Options:
#   --url URL       dashboard to show (required)
#   --rotate DEG    screen rotation for a portrait monitor: 0, 90, 180 or 270
#                   (Wayland "transform", counter-clockwise; default: leave as is)
#   --no-upgrade    skip `apt full-upgrade`
#
# Targets the labwc desktop (Raspberry Pi OS Bookworm late-2024 and newer).

set -euo pipefail

URL=""
ROTATE=""
UPGRADE=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --rotate) ROTATE="$2"; shift 2 ;;
    --no-upgrade) UPGRADE=0; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$URL" ]] || { echo "--url is required" >&2; exit 2; }
[[ "$(id -u)" -ne 0 ]] || { echo "run as the desktop user, not root" >&2; exit 2; }
[[ -z "$ROTATE" || "$ROTATE" =~ ^(0|90|180|270)$ ]] || { echo "--rotate must be 0, 90, 180 or 270" >&2; exit 2; }
command -v labwc >/dev/null || { echo "labwc not found: this script targets the Raspberry Pi OS labwc desktop" >&2; exit 1; }

step() { printf '\n==> %s\n' "$*"; }

# Replaces the block between our markers in FILE (creating it if needed), so
# re-running updates the block instead of appending duplicates.
write_block() {
  local file="$1" content="$2" begin="# >>> slate kiosk >>>" end="# <<< slate kiosk <<<"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  local tmp
  tmp="$(mktemp)"
  awk -v b="$begin" -v e="$end" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$file" >"$tmp"
  printf '%s\n%s\n%s\n' "$begin" "$content" "$end" >>"$tmp"
  mv "$tmp" "$file"
}

if [[ "$UPGRADE" -eq 1 ]]; then
  step "Updating the system (apt full-upgrade)"
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
fi

step "Installing automatic security updates"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades
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

step "Starting the kiosk at login (labwc autostart)"
write_block "$HOME/.config/labwc/autostart" "\"\$HOME/.local/bin/slate-kiosk-browser\" &"

if [[ -n "$ROTATE" ]]; then
  step "Rotation"
  echo "Not automated yet: confirmed on the device first (see PLANNING.md)."
fi

step "Done. Reboot to start the kiosk: sudo reboot"
