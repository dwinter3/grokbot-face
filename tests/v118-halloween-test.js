// v1.18 Halloween window test. usage: node v118-halloween-test.js <baseUrl> <outDir>
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const [base, out] = process.argv.slice(2);
const res = []; const ok = (name, pass, info) => { res.push({ name, pass: !!pass, info }); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader'] });
  const open = async (q, time) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, timezoneId: 'America/New_York' });
    await ctx.addInitScript(() => { window.GrokBotFace = { hasGrokBot: () => true, openGrokBot: () => true, nativeMic: () => false }; });
    await ctx.route(/usage\.json|news\.json|harness\.json/, r => r.fulfill({ status: 404, body: '' }));
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    if (time) await p.clock.setSystemTime(new Date(time));
    await p.goto(`${base}/index.html?adv=0${q}`); await p.waitForTimeout(2500); return p;
  };
  const rotSample = p => p.evaluate(() => { const c = {}; for (let i = 0; i < 5000; i++) { const t = grokbot.rotatePick().theme; c[t] = (c[t] || 0) + 1; } return c; });
  const swipeAll = p => p.evaluate(async () => { const seen = []; const n = grokbot.looks().length; for (let i = 0; i < n + 1; i++) { grokbot.swipeTo(1); await new Promise(r => setTimeout(r, 1400)); seen.push(grokbot.theme + '@' + grokbot.look); } return seen; });
  // 1) today (real date, Nov 3 2026), no override
  let p = await open('');
  let looks = await p.evaluate(() => grokbot.looks()), th = await p.evaluate(() => grokbot.theme), hw = await p.evaluate(() => grokbot.pk.halloween);
  ok('today: opening theme not pumpkin', th !== 'pumpkin', th); ok('today: halloween flags off', !hw.week && !hw.season, hw);
  ok('today: no pumpkin in looks', !looks.includes('pumpkin'), looks.length + ' looks');
  let rc = await rotSample(p); ok('today: rotation never picks pumpkin (5000 picks)', !rc.pumpkin, rc);
  let sw = await swipeAll(p); ok('today: swipe cycles all looks, no pumpkin, index valid', sw.every(x => !x.startsWith('pumpkin') && !x.endsWith('@-1')), sw.join(' '));
  let dbl = await p.evaluate(async () => { const seen = []; for (let i = 0; i < 12; i++) { grokbot.switchTheme(); await new Promise(r => setTimeout(r, 2800)); seen.push(grokbot.theme); } return seen; });
  ok('today: double-tap cycle skips pumpkin', !dbl.includes('pumpkin'), dbl.join(' '));
  await p.evaluate(() => grokbot.showLook('pills')); await p.waitForTimeout(800); await p.screenshot({ path: out + '/today-default.png' });
  ok('today: no page errors', !p.errs.length, p.errs); await p.context().close();
  // 2) override halloween=1
  p = await open('&halloween=1');
  looks = await p.evaluate(() => grokbot.looks()); th = await p.evaluate(() => grokbot.theme); await p.evaluate(() => grokbot.showLook('pills')); rc = await rotSample(p);   // lastKey=pumpkin would re-roll pumpkin
  ok('halloween=1: opening theme pumpkin', th === 'pumpkin', th); ok('halloween=1: pumpkin in looks', looks.includes('pumpkin'), looks.slice(0, 4));
  ok('halloween=1: rotation picks pumpkin', rc.pumpkin > 0, rc);
  sw = await swipeAll(p); ok('halloween=1: swipe reaches pumpkin, index valid', sw.some(x => x.startsWith('pumpkin')) && sw.every(x => !x.endsWith('@-1')), sw.join(' '));
  await p.evaluate(() => { grokbot.showLook('pumpkin'); grokbot.pkCalm(); grokbot.costume('dracula', false); }); await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/halloween-override-pumpkin.png' }); ok('halloween=1: no page errors', !p.errs.length, p.errs); await p.context().close();
  // 3) halloween=0 override
  p = await open('&halloween=0', '2026-10-30T12:00:00-04:00');
  looks = await p.evaluate(() => grokbot.looks()); ok('halloween=0 on Oct 30: no pumpkin', !looks.includes('pumpkin'), looks.length); await p.context().close();
  // 4) Oct 31 boundary + live rollover at midnight without reload
  p = await open('', '2026-10-31T23:59:30-04:00');
  th = await p.evaluate(() => grokbot.theme); hw = await p.evaluate(() => grokbot.pk.halloween); looks = await p.evaluate(() => grokbot.looks());
  ok('Oct 31 23:59: week+season on, opens pumpkin, in looks', hw.week && hw.season && th === 'pumpkin' && looks.includes('pumpkin'), { th, hw });
  await p.evaluate(() => { grokbot.ROTATE.dwell = { bots: [999, 999], clock: [999, 999], news: [999, 999], harness: [999, 999] }; grokbot.showLook('pumpkin'); });
  await p.clock.setSystemTime(new Date('2026-11-01T00:00:05-04:00'));
  await p.waitForTimeout(25000);   // halloweenTick runs every 20 s of page time
  th = await p.evaluate(() => grokbot.theme); hw = await p.evaluate(() => grokbot.pk.halloween); looks = await p.evaluate(() => grokbot.looks()); rc = await rotSample(p);
  ok('rollover Nov 1 00:00 (no reload): pumpkin -> pills, flags off, gone from looks/rotation', th === 'pills' && !hw.season && !looks.includes('pumpkin') && !rc.pumpkin, { th, hw, rc });
  ok('rollover: no page errors', !p.errs.length, p.errs); await p.context().close();
  // 5) Oct 1 season start (not week): in looks, not opening
  p = await open('', '2026-10-01T09:00:00-04:00'); hw = await p.evaluate(() => grokbot.pk.halloween); th = await p.evaluate(() => grokbot.theme); looks = await p.evaluate(() => grokbot.looks());
  ok('Oct 1: season on, week off, opens pills, pumpkin in looks', hw.season && !hw.week && th !== 'pumpkin' && looks.includes('pumpkin'), { hw, th }); await p.context().close();
  for (const r of res) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + '  ' + JSON.stringify(r.info).slice(0, 300));
  console.log(res.filter(r => r.pass).length + '/' + res.length + ' passed'); await b.close();
})();
