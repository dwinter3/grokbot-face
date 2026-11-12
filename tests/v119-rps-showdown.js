// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// Rock-paper-scissors showdown. usage: node tests/v119-rps-showdown.js <baseUrl> <outDir>
const { chromium } = require('playwright-core');
const [base, out] = process.argv.slice(2);
const res = []; const ok = (name, pass, info) => { res.push({ name, pass: !!pass, info }); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader', '--hide-scrollbars'] });
  const open = async (q) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, timezoneId: 'America/New_York' });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(`${base}/index.html?adv=0&${q || ''}`); await p.waitForTimeout(500); return p;
  };
  // query hook: straight into the showdown, clock frozen
  let p = await open('rpsReveal=rock,scissors&rpsAt=1.75');
  let st = await p.evaluate(() => grokbot.rps.state);
  ok('?rpsReveal jumps to showdown', st.on && st.phase === 'showdown' && st.player === 'rock' && st.bot === 'scissors' && st.result === 'you', st);
  ok('?rpsAt freezes the clock', st.pin === 1.75 && Math.abs(st.t - 1.75) < 0.02, st);
  ok('score is counted immediately, line waits', st.you === 1 && st.me === 0 && st.shownYou === 0 && st.shownMe === 0, st);
  await p.waitForTimeout(600);
  st = await p.evaluate(() => grokbot.rps.state);
  ok('frozen showdown does not advance', st.phase === 'showdown' && Math.abs(st.t - 1.75) < 0.02, st);
  ok('query page: no errors', !p.errs.length, p.errs);
  await p.screenshot({ path: out + '/rps-win.png' });
  await p.context().close();

  // loss: grok's scissors cut the player's paper. score still hidden at 1.7 (scoreAt is 2.05)
  p = await open('rpsReveal=paper,scissors&rpsAt=1.7');
  st = await p.evaluate(() => grokbot.rps.state);
  ok('loss: bot wins, shown score still 0', st.result === 'bot' && st.me === 1 && st.you === 0 && st.shownMe === 0 && st.phase === 'showdown', st);
  ok('loss page: no errors', !p.errs.length, p.errs);
  await p.screenshot({ path: out + '/rps-loss.png' });
  // swipe still ends the game, even while the clock is pinned
  await p.evaluate(() => grokbot.swipeTo(1)); await p.waitForTimeout(200);
  st = await p.evaluate(() => grokbot.rps.state);
  ok('swipe ends a showdown', st.on === false && st.phase === '', st);
  await p.context().close();

  // tie, and the score line after scoreAt
  p = await open('rpsReveal=paper,paper&rpsAt=1.38');
  st = await p.evaluate(() => grokbot.rps.state);
  ok('tie: neither score moves', st.result === 'tie' && st.me === 0 && st.you === 0 && st.shownMe === 0 && st.shownYou === 0, st);
  ok('tie page: no errors', !p.errs.length, p.errs);
  await p.screenshot({ path: out + '/rps-tie.png' });
  await p.evaluate(() => grokbot.rps.reveal('rock', 'scissors', 2.3)); await p.waitForTimeout(150);
  st = await p.evaluate(() => grokbot.rps.state);
  ok('after scoreAt the line shows the point', st.phase === 'showdown' && st.you === 1 && st.shownYou === 1 && st.shownMe === 0, st);
  await p.context().close();

  // programmatic hook, result table, invalid input, then the phase exits into the next round
  p = await open('');
  let bad = await p.evaluate(() => grokbot.rps.reveal('frog', 'rock'));
  st = await p.evaluate(() => grokbot.rps.state);
  ok('bad throws are ignored', bad === false && st.on === false, { bad, st });
  const table = await p.evaluate(() => {
    const pairs = [['rock', 'scissors'], ['paper', 'rock'], ['scissors', 'paper'], ['scissors', 'rock'], ['paper', 'scissors'], ['rock', 'paper'], ['rock', 'rock']];
    return pairs.map(([a, c]) => { grokbot.rps.reveal(a, c, 1); const s = grokbot.rps.state; return a + ',' + c + '=' + s.result + ':' + s.me + '-' + s.you; });
  });
  ok('beats table', table.join(' ') === 'rock,scissors=you:0-1 paper,rock=you:0-1 scissors,paper=you:0-1 scissors,rock=bot:1-0 paper,scissors=bot:1-0 rock,paper=bot:1-0 rock,rock=tie:0-0', table);
  const timing = await p.evaluate(() => grokbot.rps.timing);
  ok('showdown fills the old 2.7s reveal slot', timing.showdownSec === 2.7 && timing.scoreAt > timing.sdHold && timing.scoreAt < timing.showdownSec, timing);
  await p.evaluate(() => grokbot.rps.reveal('rock', 'scissors'));
  await p.waitForTimeout(Math.ceil(timing.showdownSec * 1000) + 700);
  st = await p.evaluate(() => grokbot.rps.state);
  ok('showdown then the next round', st.on && st.phase === 'count' && st.round === 2 && st.you === 1, st);
  ok('live page: no errors', !p.errs.length, p.errs);
  await p.context().close();

  for (const r of res) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + '  ' + JSON.stringify(r.info).slice(0, 300));
  console.log(res.filter(r => r.pass).length + '/' + res.length + ' passed');
  await b.close();
  if (res.some(r => !r.pass)) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
