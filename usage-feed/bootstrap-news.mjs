// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// One-off: run the news cron locally against live sources (no AI) and seed KV via the CF REST API.
// Usage: CF_ACCOUNT_ID=... KV_NAMESPACE_ID=... CLOUDFLARE_API_TOKEN=... node bootstrap-news.mjs
import { newsCron } from './news.js';
const A = process.env.CF_ACCOUNT_ID, NS = process.env.KV_NAMESPACE_ID;
if (!A || !NS || !process.env.CLOUDFLARE_API_TOKEN) throw new Error('set CF_ACCOUNT_ID, KV_NAMESPACE_ID and CLOUDFLARE_API_TOKEN');
const base = `https://api.cloudflare.com/client/v4/accounts/${A}/storage/kv/namespaces/${NS}/values/`;
const H = { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN };
const env = { FEED: {
  get: async k => { const r = await fetch(base + k, { headers: H }); return r.ok ? r.text() : null; },
  put: async (k, v) => { const r = await fetch(base + k, { method: 'PUT', headers: H, body: v }); if (!r.ok) throw new Error('kv put ' + r.status); } } };
console.log(JSON.stringify(await newsCron(env, Date.now(), { all: true })));
