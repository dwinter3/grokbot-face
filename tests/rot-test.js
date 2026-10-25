// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8772/index.html?theme=pills&adv=0'); await p.waitForTimeout(3500);
  console.log('sim 5000 picks', JSON.stringify(await p.evaluate(() => grokbot.rotSim(5000))));
  console.log('rot', JSON.stringify(await p.evaluate(() => { const r = grokbot.rot; delete r.picks; return r; })));
  // force rotations: shorten dwell, watch 6 auto switches
  const seen = [];
  await p.evaluate(() => { grokbot.ROTATE.dwell = { bots: [3, 3], clock: [3, 3], news: [3, 3], harness: [3, 3] }; grokbot.ROTATE.gameCapSec = 6; });
  await p.evaluate(() => grokbot.showLook('pills'));
  let last = '';
  for (let i = 0; i < 60 && seen.length < 8; i++) { await p.waitForTimeout(1000); const k = await p.evaluate(() => grokbot.rot.lastKey); if (k !== last) { seen.push(k); last = k; } }
  console.log('auto sequence', seen.join(' -> '));
  // double-tap still deterministic
  await p.evaluate(() => { grokbot.ROTATE.dwell = { bots: [999, 999], clock: [999, 999], news: [999, 999], harness: [999, 999] }; grokbot.showLook('chess'); });
  const th = [];
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 300); await p.waitForTimeout(100); await p.mouse.click(640, 300); await p.waitForTimeout(3200); th.push(await p.evaluate(() => grokbot.theme)); }
  console.log('double-tap from chess', th.join(' -> '));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
