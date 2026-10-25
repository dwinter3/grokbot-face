#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Enable the public workers.dev URL and the two crons (usage every 15 min, news staggered every 5 min).
set -e; . "$(dirname "$0")/_config.sh"
curl -s -X POST $S/subdomain -H "$H" -H 'Content-Type: application/json' -d '{"enabled":true,"previews_enabled":false}' | jq -c .success
curl -s -X PUT $S/schedules -H "$H" -H 'Content-Type: application/json' -d '[{"cron":"*/15 * * * *"},{"cron":"2,7,12,17,22,27,32,37,42,47,52,57 * * * *"}]' | jq -c .success
