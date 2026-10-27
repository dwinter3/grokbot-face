// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
import { compute, dailyFrom } from './compute.js';
import { newsCron, harnessView } from './news.js';
const ORIGIN = 'https://appassets.androidplatform.net';
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
const jsonHdr = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const NEWS_CRON = '2,7,12,17,22,27,32,37,42,47,52,57 * * * *';
async function refresh(env) {
  const r = await fetch('https://api.cursor.com/teams/spend', { method: 'POST',
    headers: { 'Authorization': 'Basic ' + btoa(env.CURSOR_KEY + ':'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchTerm: env.SEARCH_TERM }) });
  if (!r.ok) throw new Error('cursor ' + r.status);
  const api = await r.json();
  let daily = null;                                                  // v1.15 burn chart; fail-soft (keeps last good series)
  try {
    const g = await fetch('https://api.cursor.com/teams/groups', { headers: { 'Authorization': 'Basic ' + btoa(env.CURSOR_KEY + ':') } });
    if (g.ok) daily = dailyFrom(await g.json(), env.SEARCH_TERM);
    else console.log('groups ' + g.status);
  } catch (e) { console.log('groups failed: ' + e.message); }
  if (!daily) { try { const prev = JSON.parse(await env.FEED.get('usage') || 'null'); if (prev && prev.cycleStart === new Date(api.subscriptionCycleStart).toISOString()) daily = prev.daily || null; } catch (e) {} }
  const out = JSON.stringify(compute(api, Date.now(), daily));
  await env.FEED.put('usage', out);
  return out;
}
function eq(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const unavailable = () => new Response('{"error":"unavailable"}', { status: 503, headers: jsonHdr });
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const m = u.pathname.match(/^\/([A-Za-z0-9_-]{20,})\/(usage|news|harness)\.json$/);
    if (!m || !eq(m[1], env.FEED_TOKEN)) return new Response('Not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: cors });
    if (m[2] === 'news' || m[2] === 'harness') {
      const body = await env.FEED.get('news');
      if (!body) return unavailable();
      if (m[2] === 'news') return new Response(body, { headers: jsonHdr });
      const o = JSON.parse(body);
      return new Response(JSON.stringify({ updatedAt: o.updatedAt, tools: o.harness }), { headers: jsonHdr });
    }
    let body = await env.FEED.get('usage');
    const stale = !body || Date.now() - Date.parse(JSON.parse(body).updatedAt) > 40 * 60000;
    if (stale) { try { body = await refresh(env); } catch (e) { if (!body) return unavailable(); } }
    return new Response(body, { headers: jsonHdr });
  },
  async scheduled(ev, env, ctx) {
    if (ev.cron === NEWS_CRON) {
      ctx.waitUntil(newsCron(env, ev.scheduledTime || Date.now()).then(r => console.log('news cron ok ' + JSON.stringify(r)), e => console.log('news cron failed: ' + e.message)));
      return;
    }
    ctx.waitUntil(refresh(env).then(() => console.log("cron refresh ok"), e => console.log("cron refresh failed: " + e.message)));
  },
};
