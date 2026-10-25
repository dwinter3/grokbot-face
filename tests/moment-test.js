// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__calls = []; window.GrokBotFace = { hasGrokBot: () => true, openGrokBot: () => { __calls.push('open'); return true; }, openGrokBotIn: ms => { __calls.push('openIn:' + ms); return true; }, nativeMic: () => false }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const N = () => p.evaluate(() => grokbot.news), M = () => p.evaluate(() => grokbot.moment);
  await p.goto('http://127.0.0.1:8772/index.html?theme=pills&adv=0'); await p.waitForTimeout(4000);
  let n = await N(); const r = await p.evaluate(() => ({ m: grokbot.markRect, g: grokbot.gaugeRect, dpr: devicePixelRatio }));
  console.log('1 ticker rect', n.tickerRect, 'mark hh', r.m.hh.toFixed(1), 'gauge hh', (r.g.hh / r.dpr).toFixed(1), 'moment', JSON.stringify(await M()));
  await p.screenshot({ path: '/tmp/nt/m1-plain.png' });
  await p.evaluate(() => window.__calls.length = 0); await p.mouse.click(r.m.x, r.m.y + r.m.hh - 3); await p.waitForTimeout(400);
  console.log('  wordmark tap at bottom edge ->', JSON.stringify(await p.evaluate(() => window.__calls)));
  await p.evaluate(() => grokbot.newsMoment()); await p.waitForTimeout(2500); n = await N();
  console.log('2 forced moment', JSON.stringify(n.breaking)); await p.screenshot({ path: '/tmp/nt/m2-moment.png' });
  await p.mouse.click(640, 400); await p.waitForTimeout(600); n = await N(); console.log('  tap -> card', n.card, 'moment over', n.breaking);
  await p.mouse.click(20, 20); await p.waitForTimeout(400);
  // cadence
  await p.evaluate(() => { grokbot.NEWS.momentEvery = [4, 4]; grokbot.NEWS.momentHoldSec = 3; }); await p.evaluate(() => grokbot.newsMoment()); await p.waitForTimeout(500);
  await p.evaluate(() => grokbot.closeCard()); let fired = 0; const titles = [];
  for (let i = 0; i < 40 && fired < 2; i++) { await p.waitForTimeout(500); n = await N(); if (n.breaking && n.breaking.why === 'cadence' && titles[titles.length - 1] !== n.breaking.title) { fired++; titles.push(n.breaking.title); } }
  console.log('3 cadence fired', fired, JSON.stringify(titles));
  await p.waitForTimeout(5000);
  // absent -> held, sit down -> replay
  const face = { x0: .4, y0: .3, x1: .6, y1: .6, cx: .5, cy: .45, w: .2, h: .3, jaw: 0, jawAct: 0 };
  await p.evaluate(() => grokbot.sim({ cam: true, faces: [] })); await p.waitForTimeout(9000);
  console.log('4 nobody: moment', JSON.stringify(await M()), 'breaking', (await N()).breaking);
  await p.evaluate(f => grokbot.sim({ faces: [f] }), face); let got = null;
  for (let i = 0; i < 24 && !got; i++) { await p.waitForTimeout(500); n = await N(); if (n.breaking) got = n.breaking; }
  console.log('  sat down ->', JSON.stringify(got), 'pres', await p.evaluate(() => grokbot.pres.state));
  await p.evaluate(() => grokbot.sim({ cam: false })); await p.waitForTimeout(5000);
  // breaking blocks moments for momentAfterBreakSec
  await p.evaluate(() => { grokbot.NEWS.momentAfterBreakSec = 12; grokbot.NEWS.holdSec = 2; grokbot.breaking(); }); await p.waitForTimeout(6000);
  const seen = []; for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); n = await N(); seen.push(n.breaking ? n.breaking.mode[0] : '.'); }
  console.log('5 after breaking (12s gap), timeline 6..16s:', seen.join(''));
  // quiet hours
  await p.waitForTimeout(4000);
  await p.evaluate(() => { grokbot.NEWS.quietFrom = 0; grokbot.NEWS.quietTo = 24; }); await p.waitForTimeout(500);
  const q = []; for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); n = await N(); q.push(n.breaking ? n.breaking.mode[0] : '.'); }
  console.log('6 quiet hours 8s:', q.join(''));
  await p.evaluate(() => { grokbot.NEWS.quietFrom = 23; grokbot.NEWS.quietTo = 7; grokbot.NEWS.momentEvery = [999, 999]; });
  // pong freeze during moment
  await p.waitForTimeout(4000); await p.evaluate(() => grokbot.showLook('pong')); await p.waitForTimeout(3000);
  await p.evaluate(() => { grokbot.NEWS.momentHoldSec = 6; grokbot.newsMoment(); }); await p.waitForTimeout(1000);
  const a = await p.evaluate(() => grokbot.pong); await p.waitForTimeout(1500); const c = await p.evaluate(() => grokbot.pong);
  console.log('7 pong frozen in moment', a.bx === c.bx && a.by === c.by, 'theme', await p.evaluate(() => grokbot.theme));
  await p.screenshot({ path: '/tmp/nt/m3-moment-pong.png' });
  await p.waitForTimeout(7000); const d = await p.evaluate(() => grokbot.pong); await p.waitForTimeout(400); const e = await p.evaluate(() => grokbot.pong);
  console.log('  resumed', d.bx !== e.bx || d.phase !== 'rally', 'theme', await p.evaluate(() => grokbot.theme));
  // debug button
  await p.evaluate(() => grokbot.toggleDebug()); await p.waitForTimeout(300);
  console.log('8 debug overlay has buttons', JSON.stringify((await N()).btn));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
