# grokbot-usage-feed (Cloudflare Worker)
Cloudflare Worker `grokbot-usage-feed` plus one KV namespace (binding `FEED`).
- URL: `https://<WORKER_NAME>.<WORKERS_SUBDOMAIN>.workers.dev/<FEED_TOKEN>/usage.json`. Keep FEED_TOKEN in a local file (for example `~/.grokbot-usage-feed/token.env`, mode 600), never in git.
- Cron `*/15 * * * *` calls Cursor POST /teams/spend (secret CURSOR_KEY) -> computes feed (compute.js) -> KV key `usage`.
  GET serves KV; if KV older than 40 min it refreshes inline. No box dependency.
- Wrong token / any other path: 404. CORS: https://appassets.androidplatform.net only. Cache-Control: no-store.
- Output has no names/emails/ids. Fields: updatedAt, cycleStart, cycleEnd(+1 month), spentUsd, limitUsd, pct, projectedUsd, daysLeft.
- Redeploy code: multipart PUT of worker.js+compute.js with metadata from deploy-metadata.template.json (fill in `<KV_NAMESPACE_ID>` and SEARCH_TERM; keep_bindings preserves secrets). Observability logs enabled; cron logs "cron refresh ok/failed".
  NOTE: you can deploy with wrangler (Node 22+, see wrangler.toml.example) or with the plain CF REST API below.
- If the Cursor admin key is rotated, update secret CURSOR_KEY (PUT .../secrets).
- rotate-token.sh / disable.sh / enable.sh. fetch-local.mjs = local debug fetcher. The helper scripts read `.env.local` (copy `config.example.env`).

## v1.9: AI newsfeed + harness changelogs (`news.js`)

Routes (same host, same token, same CORS `https://appassets.androidplatform.net`, `Cache-Control: no-store`, wrong token = 404):
- `/<FEED_TOKEN>/news.json` → `{updatedAt, items:[{id,title,source,publishedAt,tag,top,tool?,version?,summary?}], harness:[...], sources:[{id,ok}]}`
- `/<FEED_TOKEN>/harness.json` → `{updatedAt, tools:[{tool,version,publishedAt,summary,prerelease?,recent[]}]}`
- `/<FEED_TOKEN>/usage.json` unchanged.

Cron: `*/15` = usage (unchanged). `2,7,12,…,57` = news: each run refreshes the 4 most-overdue sources
(brand/Bing 30-40 min, harness 30 min, general AI 60 min), summarizes ≤4 new items with Workers AI
(`@cf/meta/llama-3.1-8b-instruct-fast`, fallback `@cf/zai-org/glm-4.7-flash`, ≤250 calls/day; prompt = facts from feed/article text only),
caches summaries by item id in KV `newsstate`, and writes KV `news` only when content changed.
Tags: `ai | grokbot | cursor | spacexai | harness`. Brand/harness items <48 h sort first; harness releases <7 d always included.
Alpha/beta/nightly releases fold into the latest stable + `prerelease.count`.

Harness sources: Claude Code `github.com/anthropics/claude-code/releases.atom`, Antigravity `antigravity.google/docs/changelog` (HTML, "hub" entries),
Codex `github.com/openai/codex/releases.atom`, OpenCode `github.com/anomalyco/opencode/releases.atom` (v* tags), Goose `github.com/block/goose/releases.atom` (v* tags),
Grok Build `x.ai/changelog/build/rss.xml`, Cursor `cursor.com/changelog/rss.xml` (no separate Cursor CLI feed exists).

Deploy (REST, secrets preserved by `keep_bindings`):
```
. ./.env.local; S=https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/$WORKER_NAME
curl -X PUT $S -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -F metadata=@deploy-metadata.template.json \
  -F "worker.js=@worker.js;type=application/javascript+module" -F "compute.js=@compute.js;type=application/javascript+module" -F "news.js=@news.js;type=application/javascript+module"
curl -X PUT $S/schedules -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' \
  -d '[{"cron":"*/15 * * * *"},{"cron":"2,7,12,17,22,27,32,37,42,47,52,57 * * * *"}]'
```
`bootstrap-news.mjs` seeds KV from the box (all sources, no AI) via the KV REST API.

## v1.10.1: source quality filter (Worker-only)
- Aggregator results (Google News `<source url>`, Bing unwrapped link; MSN syndication judged by publisher name) are classified by `sourceQuality(name, host)`:
  `trusted` (ALLOW_DOMAINS / ALLOW_NAMES) → published in `items`; `news` (NEWS_DOMAINS / NEWS_NAMES) → kept aside in `more` (≤15, the app ignores it);
  `deny` (DENY_DOMAINS, DENY_NAME_RE: blogs/UGC/shops/PR wires/personal sites) and `unknown` → dropped. Direct publisher feeds (TC, NYT, WSJ, Verge) and changelogs are trusted.
- `titleJunk(title)`: non-English (>15% non-Latin letters), <4 words, diary/poetic openers, "… - BRAND" SEO suffix → dropped.
- Records without a quality verdict (pre-v1.10.1 state) are purged by buildOutput.
- Up to 4 allowlisted brand items per tag (<7d) are reserved in the 30-item list even past the 48h boost.
