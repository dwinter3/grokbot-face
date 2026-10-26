// SPDX-License-Identifier: MIT
// v1.13 pumpkin previews at Pixel Tablet resolution (1280x800 css @2x = 2560x1600). usage: node v113-pumpkin-shots.js <baseUrl> <outDir>
const { chromium } = require('playwright-core');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const usage = { updatedAt: new Date().toISOString(), cycleStart: '2026-10-01T00:00:00.000Z', cycleEnd: '2026-11-01T00:00:00.000Z', spentUsd: 120, limitUsd: 300, pct: 40, projectedUsd: 150, daysLeft: 5.2 };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, timezoneId: 'America/New_York' });
  await ctx.addInitScript(() => { window.GrokBotFace = { hasGrokBot: () => true, openGrokBot: () => true, nativeMic: () => false }; });
  await ctx.route(/usage\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(usage) }));
  await ctx.route(/news\.json|harness\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(process.env.NEWS_JSON || '/tmp/news.json', 'utf8') }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(`${base}/index.html?adv=0&halloween=1`); await p.waitForTimeout(3000);
  const info = { defaultTheme: await p.evaluate(() => grokbot.theme) };
  await p.evaluate(() => { grokbot.setUsage({ spentUsd: 120, limitUsd: 300, projectedUsd: 150, cycleStart: '2026-10-01T00:00:00.000Z', cycleEnd: '2026-11-01T00:00:00.000Z', updatedAt: new Date().toISOString() }); grokbot.ROTATE.dwell = { bots: [999, 999], clock: [999, 999], news: [999, 999], harness: [999, 999] }; grokbot.showLook('pumpkin'); grokbot.pkCalm(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/pumpkin-idle.png` }); info.idle = await p.evaluate(() => ({ act: grokbot.pk.act, mini: grokbot.mini, thermo: grokbot.thermo }));
  await p.evaluate(() => grokbot.pkBurst(30));
  await p.waitForTimeout(1200); await p.evaluate(() => new Promise(r => { const f = () => (Math.sin(grokbot.pk.ph) > 0.9 ? r() : requestAnimationFrame(f)); f(); }));
  await p.screenshot({ path: `${out}/pumpkin-active-wobble.png` }); info.active = await p.evaluate(() => ({ act: grokbot.pk.act, ph: Math.sin(grokbot.pk.ph) }));
  await p.evaluate(() => grokbot.play('happy')); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/pumpkin-happy.png` });
  // short frame capture for a wobble clip (css-res frames)
  fs.mkdirSync('/tmp/pkframes', { recursive: true }); for (const f of fs.readdirSync('/tmp/pkframes')) fs.unlinkSync('/tmp/pkframes/' + f);
  await p.evaluate(() => { grokbot.pkCalm(); }); await p.waitForTimeout(800);
  await p.evaluate(() => { setTimeout(() => grokbot.pkBurst(4.5), 1200); });
  const t0 = Date.now(); let n = 0; while (Date.now() - t0 < 7500) { await p.screenshot({ path: `/tmp/pkframes/f${String(n++).padStart(4, '0')}.png`, scale: 'css' }); }
  info.frames = n; info.secs = (Date.now() - t0) / 1000;
  // swipe order check
  info.looks = await p.evaluate(() => { grokbot.showLook('blob'); return grokbot.look; });
  info.rotSim = await p.evaluate(() => grokbot.rotSim(4000));
  info.errs = errs; console.log(JSON.stringify(info, null, 1)); await b.close();
})();
