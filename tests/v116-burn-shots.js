// SPDX-License-Identifier: MIT
// v1.16 burn-chart previews (1280x800 css @2x) with SAMPLE data. usage: node v116-burn-shots.js <baseUrl> <outDir> <usage.json> [prefix]
const { chromium } = require('playwright-core');
const fs = require('fs');
const [base, out, uj, pre = ''] = process.argv.slice(2);
const usage = JSON.parse(fs.readFileSync(uj, 'utf8'));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const report = [];
  const shot = async (name, setup) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, timezoneId: 'America/New_York' });
    await ctx.addInitScript(() => { window.GrokBotFace = { hasGrokBot: () => true, openGrokBot: () => true, nativeMic: () => false }; });
    await ctx.route(/usage\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(usage) }));
    await ctx.route(/news\.json|harness\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync('/tmp/news.json', 'utf8') }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto(`${base}/index.html?adv=0&halloween=1`); await p.waitForTimeout(3500);
    await p.evaluate(setup); await p.waitForTimeout(2500);
    const info = await p.evaluate(() => ({ look: grokbot.look, thermo: grokbot.thermo, pace: grokbot.pace }));
    const f = `${out}/${pre}${name}.png`; await p.screenshot({ path: f });
    if (name === 'default-face') {
      const r = info.thermo; await p.screenshot({ path: `${out}/${pre}gauge-zoom-2x.png`, clip: { x: r.x, y: 0, width: r.w, height: 800 }, scale: 'device' });
    }
    report.push({ f, errs, ...info }); await ctx.close();
  };
  const hold = 'grokbot.ROTATE.dwell = { bots: [999, 999], clock: [999, 999], news: [999, 999], harness: [999, 999] };';
  await shot('default-face', new Function(hold + "grokbot.showLook('pills');"));
  await shot('clock', new Function(hold + "grokbot.showLook('clock');"));
  await shot('costume-dracula', new Function(hold + "grokbot.showLook('pumpkin'); grokbot.pkCalm(); grokbot.costume('dracula', false);"));
  console.log(JSON.stringify(report, null, 1)); await b.close();
})();
