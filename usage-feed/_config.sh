# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Sourced by the helper scripts: loads usage-feed/.env.local and checks the required values.
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[ -f "$HERE/.env.local" ] && . "$HERE/.env.local"
: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID (see config.example.env)}" "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
WORKER_NAME=${WORKER_NAME:-grokbot-usage-feed}
S=https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/$WORKER_NAME
H="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
