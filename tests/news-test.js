// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
const { chromium } = require('playwright-core');
const fs = require('fs');
const NJ = '/tmp/nt/news.json', base = JSON.parse(fs.readFileSync('/tmp/feeds/live-news.json', 'utf8'));
const write = extra => { const d = JSON.parse(JSON.stringify(base)); d.updatedAt = new Date().toISOString(); d.items = extra.concat(d.items); fs.writeFileSync(NJ, JSON.stringify(d)); };
const mk = (id, tag, title, extra) => Object.assign({ id, title, source: tag === 'harness' ? 'Test changelog' : 'Test Wire', publishedAt: new Date().toISOString(), tag, top: true, summary: 'This is a test summary sentence one. It has a second sentence. And a third one for good measure.' }, extra || {});
(async () => {
  write([]);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__calls = []; window.GrokBotFace = { hasGrokBot: () => true, openGrokBot: () => { __calls.push('open'); return true; }, openGrokBotIn: ms => { __calls.push('openIn:' + ms); return true; }, nativeMic: () => false }; });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const N = () => p.evaluate(() => grokbot.news);
  const T = () => p.evaluate(() => grokbot.pres.t);
  await p.goto('http://127.0.0.1:8772/index.html?theme=pills&adv=0');
  await p.waitForTimeout(4000);
  let n = await N(); console.log('1 armed', n.armed, 'n', n.n, 'ready', n.ready, 'breaking(backlog)', n.breaking, 'ticker:', n.ticker, 'err', n.err);
  const rects = await p.evaluate(() => ({ g: grokbot.gaugeRect, m: grokbot.markRect, dpr: devicePixelRatio }));
  console.log('  tickerRect', JSON.stringify(n.tickerRect), 'mark bottom', (rects.m.y + rects.m.hh).toFixed(1), 'gauge bottom', rects.g && ((rects.g.y + rects.g.hh) / rects.dpr).toFixed(1));
  await p.screenshot({ path: '/tmp/nt/t1-ticker.png' });
  // tap ticker (right side, away from centre) -> card
  // v1.10: no ticker. Moment tap -> card; double-tap during plain look = theme switch
  await p.evaluate(() => grokbot.newsMoment()); await p.waitForTimeout(1800);
  const tr = { x1: 1100, y0: 380, y1: 420 }; const ty = 400;
  await p.mouse.click(tr.x1 - 30, ty); await p.waitForTimeout(700);
  n = await N(); console.log('2 card after moment tap:', n.card, 'moment', n.breaking);
  await p.waitForTimeout(400); await p.screenshot({ path: '/tmp/nt/t2-card.png' });
  const cr = n.cardRect; await p.mouse.click((cr.x0 + cr.x1) / 2, (cr.y0 + cr.y1) / 2); await p.waitForTimeout(400);
  console.log('  tap inside card keeps it:', (await N()).card != null);
  await p.mouse.click(30, 30); await p.waitForTimeout(500); console.log('  tap outside closes:', (await N()).card);
  // wordmark tap still opens Grok Bot; gauge long-press toggles
  await p.evaluate(() => window.__calls.length = 0);
  const m = await p.evaluate(() => grokbot.markRect); await p.mouse.click(m.x, m.y - 5); await p.waitForTimeout(500);
  console.log('3 wordmark tap calls', JSON.stringify(await p.evaluate(() => window.__calls)), 'card', (await N()).card);
  // double-tap (plain) = theme switch, not card
  await p.waitForTimeout(1500);
  const th0 = await p.evaluate(() => grokbot.theme);
  await p.mouse.click(tr.x1 - 30, ty); await p.waitForTimeout(120); await p.mouse.click(tr.x1 - 30, ty); await p.waitForTimeout(2000);
  console.log('4 double-tap (plain): theme', th0, '->', await p.evaluate(() => grokbot.theme), 'card', (await N()).card);
  await p.waitForTimeout(3000);
  // long-press (plain) opens Grok Bot (not card)
  await p.evaluate(() => { window.__calls.length = 0; grokbot.showLook('pills'); }); await p.waitForTimeout(300);
  await p.mouse.move(tr.x1 - 30, ty); await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up(); await p.waitForTimeout(600);
  console.log('5 long-press (plain) calls', JSON.stringify(await p.evaluate(() => window.__calls)), 'card', (await N()).card);
  // ---- breaking: new harness item -> takeover
  write([mk('t-h1', 'harness', 'Claude Code v9.9.9 released', { tool: 'Claude Code', version: 'v9.9.9' })]);
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1200);
  n = await N(); console.log('6 new harness item -> breaking', JSON.stringify(n.breaking));
  await p.waitForTimeout(2200); await p.screenshot({ path: '/tmp/nt/t3-breaking.png' });
  await p.mouse.click(640, 400); await p.waitForTimeout(600); n = await N();
  console.log('  tap during takeover -> card', n.card, 'breaking', n.breaking);
  await p.mouse.click(20, 20); await p.waitForTimeout(500);
  // ---- cooldown: AI top item right after -> queued, no takeover
  write([mk('t-a1', 'ai', 'OpenAI test story for cooldown')]);
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1200); n = await N();
  console.log('7 ai item within cooldown: breaking', n.breaking, 'queue', n.queue);
  // brand item, last takeover 200 s ago -> breaks through (3 min), ai stays 10 min
  let t = await T(); await p.evaluate(t => grokbot.newsTest.set('last', t - 200), t);
  write([mk('t-b1', 'cursor', 'Cursor test story breaks through')]);
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1500); n = await N();
  console.log('8 brand after 200s: breaking', JSON.stringify(n.breaking));
  await p.evaluate(() => { grokbot.NEWS.holdSec = 2; }); await p.waitForTimeout(6000);
  n = await N(); console.log('  after hold: breaking', n.breaking, 'ticker', n.ticker);
  // ---- max 3 per takeover
  t = await T(); await p.evaluate(t => grokbot.newsTest.set('last', t - 700), t);
  write([1, 2, 3, 4, 5].map(i => mk('t-m' + i, i % 2 ? 'spacexai' : 'grokbot', 'Burst story number ' + i)));
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1200); n = await N();
  console.log('9 burst of 5: takeover n =', n.breaking && n.breaking.n, 'ticker front', JSON.stringify(await p.evaluate(() => grokbot.newsTest.front)));
  await p.waitForTimeout(9000);
  // ---- quiet hours
  t = await T(); await p.evaluate(t => { grokbot.newsTest.set('last', t - 900); grokbot.NEWS.quietFrom = 0; grokbot.NEWS.quietTo = 24; }, t);
  write([mk('t-q1', 'harness', 'Goose v9.0.0 released at night', { tool: 'Goose', version: 'v9.0.0' })]);
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1500); n = await N();
  console.log('10 quiet hours: breaking', n.breaking, 'front', JSON.stringify(await p.evaluate(() => grokbot.newsTest.front)));
  await p.evaluate(() => { grokbot.NEWS.quietFrom = 23; grokbot.NEWS.quietTo = 7; });
  // ---- presence hold + replay
  await p.evaluate(() => { grokbot.sim({ cam: true, faces: [] }); grokbot.newsTest.pres('empty'); });
  write([mk('t-p1', 'grokbot', 'Grok Bot test story while away')]);
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1500); n = await N();
  console.log('11 nobody here: breaking', n.breaking, 'held', n.held);
  await p.evaluate(() => grokbot.sim({ faces: [{ x0: .4, y0: .3, x1: .6, y1: .6, cx: .5, cy: .45, w: .2, h: .3, jaw: 0, jawAct: 0 }] }));
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); n = await N(); if (n.breaking) break; }
  console.log('   sat down -> replay', JSON.stringify(n.breaking));
  await p.waitForTimeout(5000);
  await p.evaluate(() => grokbot.sim({ cam: false }));
  // ---- pong frozen during takeover, resumes
  await p.evaluate(() => grokbot.showLook('pong')); await p.waitForTimeout(4000);
  const pg0 = await p.evaluate(() => grokbot.pong);
  await p.evaluate(() => grokbot.breaking()); await p.waitForTimeout(1500);
  const pg1 = await p.evaluate(() => grokbot.pong); await p.waitForTimeout(1500); const pg2 = await p.evaluate(() => grokbot.pong);
  console.log('12 pong during takeover frozen:', pg1.bx === pg2.bx && pg1.by === pg2.by, 'score', pg1.sa + '-' + pg1.sb, 'theme', await p.evaluate(() => grokbot.theme));
  await p.screenshot({ path: '/tmp/nt/t4-breaking-pong.png' });
  await p.waitForTimeout(6500); const pg3 = await p.evaluate(() => grokbot.pong); await p.waitForTimeout(500); const pg4 = await p.evaluate(() => grokbot.pong);
  console.log('   after: breaking', (await N()).breaking, 'ball moving again', pg3.bx !== pg4.bx || pg3.phase !== 'rally', 'theme', await p.evaluate(() => grokbot.theme), 'score', pg4.sa + '-' + pg4.sb);
  // ---- news look + harness look
  await p.evaluate(() => grokbot.showLook('news')); await p.waitForTimeout(1500);
  n = await N(); console.log('13 news look rects', n.newsRects.length, 'ticker hidden', n.tickerRect === null, 'look idx', await p.evaluate(() => grokbot.look));
  await p.screenshot({ path: '/tmp/nt/t5-newslook.png' });
  const r0 = n.newsRects[1]; await p.mouse.click((r0.x0 + r0.x1) / 2, (r0.y0 + r0.y1) / 2); await p.waitForTimeout(700);
  console.log('   tap headline 2 -> card', (await N()).card, '| expected', r0.title);
  await p.mouse.click(15, 15); await p.waitForTimeout(500);
  await p.evaluate(() => grokbot.showLook('harness')); await p.waitForTimeout(1500);
  n = await N(); console.log('14 harness tiles', n.tiles.map(t => t.title).join(' | '));
  await p.screenshot({ path: '/tmp/nt/t6-harness.png' });
  const t0 = n.tiles[0]; await p.mouse.click((t0.x0 + t0.x1) / 2, (t0.y0 + t0.y1) / 2); await p.waitForTimeout(700);
  console.log('   tap tile -> card', (await N()).card); await p.screenshot({ path: '/tmp/nt/t7-harness-card.png' });
  await p.mouse.click(15, 15); await p.waitForTimeout(500);
  // swipe through looks includes news + harness
  await p.evaluate(() => grokbot.showLook('pacman')); await p.waitForTimeout(500);
  const swipe = async (x0, x1, y = 400, ms = 300) => { await p.mouse.move(x0, y); await p.mouse.down(); const k = 10; for (let i = 1; i <= k; i++) { await p.mouse.move(x0 + (x1 - x0) * i / k, y + i); await p.waitForTimeout(ms / k); } await p.mouse.up(); await p.waitForTimeout(1400); };
  const seq = []; for (let i = 0; i < 3; i++) { await swipe(1000, 300); seq.push(await p.evaluate(() => grokbot.theme)); }
  console.log('15 swipe from pacman ->', seq.join(' -> '));
  // debug button
  await p.evaluate(() => grokbot.toggleDebug()); await p.waitForTimeout(300); n = await N();
  await p.mouse.click((n.btn.x0 + n.btn.x1) / 2, (n.btn.y0 + n.btn.y1) / 2); await p.waitForTimeout(800);
  console.log('16 debug button -> breaking', JSON.stringify((await N()).breaking));
  await p.evaluate(() => grokbot.toggleDebug());
  // reload: seen persisted, no backlog takeover
  write([mk('t-r1', 'harness', 'OpenCode v9 appears while app restarted', { tool: 'OpenCode', version: 'v9.0.0' })]);
  await p.reload(); await p.waitForTimeout(4500); n = await N();
  console.log('17 after reload: armed', n.armed, 'breaking', n.breaking, 'seen', n.seen);
  console.log('errors:', JSON.stringify(errs));
  await b.close();
})();
