#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Rotate the feed URL token (old URL 404s immediately). Rebuild the app with the new URL.
set -e; . "$(dirname "$0")/_config.sh"
F=${TOKEN_FILE:-$HOME/.grokbot-usage-feed/token.env}; umask 077; mkdir -p "$(dirname "$F")"; touch "$F"
T=$(openssl rand -base64 33 | tr '+/' '-_' | tr -d '=')
jq -n --arg v "$T" '{name:"FEED_TOKEN",text:$v,type:"secret_text"}' | curl -s -X PUT $S/secrets -H "$H" -H 'Content-Type: application/json' --data-binary @- | jq -e .success >/dev/null
if grep -q '^FEED_TOKEN=' "$F"; then sed -i "s/^FEED_TOKEN=.*/FEED_TOKEN=$T/" "$F"; else echo "FEED_TOKEN=$T" >> "$F"; fi
echo "New token saved to $F. Feed URL: https://$WORKER_NAME.${WORKERS_SUBDOMAIN:-<subdomain>}.workers.dev/<FEED_TOKEN>/usage.json"
