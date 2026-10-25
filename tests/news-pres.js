// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
const { chromium } = require('playwright-core');
const fs = require('fs');
const base = JSON.parse(fs.readFileSync('/tmp/feeds/live-news.json', 'utf8'));
const write = extra => { const d = JSON.parse(JSON.stringify(base)); d.items = extra.concat(d.items); fs.writeFileSync('/tmp/nt/news.json', JSON.stringify(d)); };
(async () => {
  write([]);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8772/index.html?theme=chars&adv=0'); await p.waitForTimeout(3500);
  const face = { x0: .4, y0: .3, x1: .6, y1: .6, cx: .5, cy: .45, w: .2, h: .3, jaw: 0, jawAct: 0 };
  await p.evaluate(() => grokbot.sim({ cam: true, faces: [] })); await p.waitForTimeout(1500);
  write([{ id: 'p-1', title: 'Grok Bot story while you were away', source: 'Test', publishedAt: new Date().toISOString(), tag: 'grokbot', top: true, summary: 'x' }]);
  await p.evaluate(() => grokbot.fetchNews(true)); await p.waitForTimeout(1500);
  let n = await p.evaluate(() => grokbot.news); console.log('away: pres', await p.evaluate(() => grokbot.pres.state), 'breaking', n.breaking, 'held', n.held);
  await p.evaluate(f => grokbot.sim({ faces: [f] }), face);
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); n = await p.evaluate(() => grokbot.news); if (n.breaking) break; }
  console.log('sat down: pres', await p.evaluate(() => grokbot.pres.state), 'breaking', JSON.stringify(n.breaking));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
