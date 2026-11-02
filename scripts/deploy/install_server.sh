#!/bin/sh
# Run from the reviewed deployment-tools directory on OCI, as root.
set -eu
test "$(id -u)" = 0
test "$#" = 1
printf '%s' "$1" | grep -Eq '^[0-9a-f]{40}$'
test -x /usr/lib/postgresql/18/bin/pg_dump
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -o root -g root -m 700 "$script_dir/nightly_api.py" /opt/handalsallim/nightly_api.py
if test ! -e /etc/handalsallim/deployed-tree; then
  umask 077
  printf '%s\n' "$1" > /etc/handalsallim/deployed-tree
fi
install -o root -g root -m 644 "$script_dir/handalsallim-deploy.service" /etc/systemd/system/handalsallim-deploy.service
install -o root -g root -m 644 "$script_dir/handalsallim-deploy.timer" /etc/systemd/system/handalsallim-deploy.timer
systemd-analyze verify /etc/systemd/system/handalsallim-deploy.service /etc/systemd/system/handalsallim-deploy.timer
systemctl daemon-reload
# Start the timer only. Never perform a daytime API restart during setup.
systemctl enable --now handalsallim-deploy.timer
systemctl list-timers handalsallim-deploy.timer --no-pager
