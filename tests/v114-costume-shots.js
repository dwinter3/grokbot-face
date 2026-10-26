// SPDX-License-Identifier: MIT
// v1.14 costume previews. usage: node v114-costume-shots.js <baseUrl> <outDir>
const { chromium } = require('playwright-core');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const usage = { updatedAt: new Date().toISOString(), cycleStart: '2026-10-01T00:00:00.000Z', cycleEnd: '2026-11-01T00:00:00.000Z', spentUsd: 120, limitUsd: 300, pct: 40, projectedUsd: 150, daysLeft: 5.2 };
const FULL = (process.env.FULL || 'witch,pirate,ghost,wizard').split(',');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, timezoneId: 'America/New_York' });
  await ctx.addInitScript(() => { window.GrokBotFace = { hasGrokBot: () => true, openGrokBot: () => true, nativeMic: () => false }; });
  await ctx.route(/usage\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(usage) }));
  await ctx.route(/news\.json|harness\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(process.env.NEWS_JSON || '/tmp/news.json', 'utf8') }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(`${base}/index.html?adv=0&halloween=1`); await p.waitForTimeout(3000);
  await p.evaluate(() => { grokbot.ROTATE.dwell = { bots: [999, 999], clock: [999, 999], news: [999, 999], harness: [999, 999] }; grokbot.showLook('pumpkin'); grokbot.pkCalm(); });
  await p.waitForTimeout(1500);
  const ids = await p.evaluate(() => grokbot.costumes); const info = { ids, caps: {} };
  fs.mkdirSync('/tmp/pkc', { recursive: true });
  for (const id of ids) {
    await p.evaluate(id => grokbot.costume(id, false), id); await p.waitForTimeout(1300);
    info.caps[id] = await p.evaluate(() => grokbot.pkc.cap);
    await p.screenshot({ path: `/tmp/pkc/${id}.png` });
    if (FULL.includes(id)) await p.screenshot({ path: `${out}/costume-${id}.png` });
  }
  // active pills on a masked costume (eyes must still show)
  await p.evaluate(() => { grokbot.costume('mummy', false); grokbot.pkBurst(30); }); await p.waitForTimeout(1600); await p.screenshot({ path: `${out}/costume-mummy-active.png` });
  // swap + wobble clip
  fs.mkdirSync('/tmp/pkswap', { recursive: true }); for (const f of fs.readdirSync('/tmp/pkswap')) fs.unlinkSync('/tmp/pkswap/' + f);
  await p.evaluate(() => { grokbot.pkCalm(); grokbot.costume('dracula', false); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { setTimeout(() => grokbot.pkBurst(3.5), 600); setTimeout(() => grokbot.costume('groucho', true), 2600); setTimeout(() => grokbot.costume('devil', true), 6200); setTimeout(() => grokbot.pkBurst(3), 6900); });
  const t0 = Date.now(); let n = 0; while (Date.now() - t0 < 10000) { await p.screenshot({ path: `/tmp/pkswap/f${String(n++).padStart(4, '0')}.png`, scale: 'css' }); }
  info.frames = n; info.secs = (Date.now() - t0) / 1000;
  // tap on the pumpkin swaps costume (single tap, deferred past double-tap window)
  await p.evaluate(() => { grokbot.costume('witch', false); }); await p.waitForTimeout(800);
  const before = await p.evaluate(() => grokbot.pkc.cur); const L = await p.evaluate(() => ({ x: grokbot.pkPos.x, y: grokbot.pkPos.y }));
  await p.mouse.click(L.x, L.y); await p.waitForTimeout(900);
  info.tap = { before, after: await p.evaluate(() => grokbot.pkc.cur), theme: await p.evaluate(() => grokbot.theme) };
  await p.mouse.click(L.x, L.y); await p.waitForTimeout(120); await p.mouse.click(L.x, L.y); await p.waitForTimeout(1500);
  info.doubleTap = { theme: await p.evaluate(() => grokbot.theme) };
  info.errs = errs; console.log(JSON.stringify(info, null, 1)); await b.close();
})();
