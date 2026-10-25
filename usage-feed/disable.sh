#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Disable: turn off the public workers.dev URL and the cron (keeps code/KV for re-enable with enable.sh).
set -e; . "$(dirname "$0")/_config.sh"
curl -s -X POST $S/subdomain -H "$H" -H 'Content-Type: application/json' -d '{"enabled":false}' | jq -c .success
curl -s -X PUT $S/schedules -H "$H" -H 'Content-Type: application/json' -d '[]' | jq -c .success
# Full removal: curl -X DELETE "$S?force=true" -H "$H"  and delete the KV namespace $KV_NAMESPACE_ID.
