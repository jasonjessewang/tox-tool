#!/usr/bin/env bash
# Runs the whole Jest suite under seven timezones. The day boundary was once a real bug (entries were stamped with the UTC date, so an
# evening logger in Chicago saw most of their entries land on tomorrow), and the suites that touch dates are only trustworthy if they pass
# in zones on both sides of UTC, including the far edges (UTC+14 and UTC-11).
#
#   bash scripts/tz-matrix.sh
cd "$(dirname "$0")/.."
for tz in UTC Asia/Seoul America/Chicago Pacific/Kiritimati Pacific/Pago_Pago Europe/Madrid America/Los_Angeles; do
  printf "%-22s" "$tz"
  TZ="$tz" npx jest 2>&1 | grep -E "^Tests:"
done
