// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// Grok Bot Face - audio analysis on the audio thread. Never stores or forwards samples;
// it only posts tiny numeric summaries (levels + clap/beat events) to the page.
class GrokMic extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hop = Math.round(sampleRate / 100);           // 10 ms analysis hops
    this.n = 0; this.sum = 0; this.peak = 0; this.lowSum = 0; this.hiSum = 0;
    this.lp1 = 0; this.lp2 = 0; this.lpH = 0;
    this.aLow = 1 - Math.exp(-2 * Math.PI * 150 / sampleRate);
    this.aHi = 1 - Math.exp(-2 * Math.PI * 2000 / sampleRate);
    this.floor = 0.002; this.envS = 0; this.prevRms = 0; this.loudFor = 0;
    this.lowAvg = 0; this.lowFloor = 0.001; this.lastOnset = -9; this.onsets = [];
    this.lastClap = -9; this.beat = false; this.bpm = 0; this.lastPost = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      this.lp1 += (x - this.lp1) * this.aLow; this.lp2 += (this.lp1 - this.lp2) * this.aLow;
      this.lpH += (x - this.lpH) * this.aHi; const hi = x - this.lpH;
      this.sum += x * x; this.lowSum += this.lp2 * this.lp2; this.hiSum += hi * hi;
      const a = x < 0 ? -x : x; if (a > this.peak) this.peak = a;
      if (++this.n >= this.hop) this.analyse();
    }
    return true;
  }
  analyse() {
    const t = currentTime, n = this.n;
    const rms = Math.sqrt(this.sum / n), low = Math.sqrt(this.lowSum / n), hi = Math.sqrt(this.hiSum / n), peak = this.peak;
    this.n = 0; this.sum = this.lowSum = this.hiSum = 0; this.peak = 0;
    // adaptive ambient floor: falls fast, rises slowly
    this.floor += (rms - this.floor) * (rms < this.floor ? 0.05 : 0.0008);
    if (this.floor < 0.0006) this.floor = 0.0006;
    this.envS += (rms - this.envS) * 0.03;
    // clap / sharp broadband transient
    if (peak > Math.max(0.08, this.floor * 14) && rms > Math.max(this.prevRms * 3, this.envS * 2.5)
        && hi > rms * 0.45 && t - this.lastClap > 0.9) {
      this.lastClap = t; this.port.postMessage({ ev: 'clap', t });
    }
    this.prevRms = rms;
    // sustained loud / voice
    if (this.envS > Math.max(this.floor * 3.5, 0.01)) this.loudFor += 0.01; else this.loudFor = Math.max(0, this.loudFor - 0.02);
    // beat tracking on the low band
    this.lowFloor += (low - this.lowFloor) * (low < this.lowFloor ? 0.05 : 0.0008);
    if (low > this.lowAvg * 1.6 && low > Math.max(this.lowFloor * 4, 0.02) && t - this.lastOnset > 0.27) {
      this.lastOnset = t; this.onsets.push(t); if (this.onsets.length > 10) this.onsets.shift();
      const iv = []; for (let i = 1; i < this.onsets.length; i++) iv.push(this.onsets[i] - this.onsets[i - 1]);
      if (iv.length >= 5) {
        const m = iv.slice().sort((a, b) => a - b)[iv.length >> 1];
        const ok = iv.filter(x => Math.abs(x - m) < m * 0.15).length / iv.length;
        if (m > 0.3 && m < 1.0 && ok >= 0.7) { this.beat = true; this.bpm = 60 / m; this.port.postMessage({ ev: 'beat', t, bpm: this.bpm }); }
      }
    }
    this.lowAvg += (low - this.lowAvg) * 0.08;
    if (this.beat && t - this.lastOnset > 2.2) { this.beat = false; this.bpm = 0; }
    if (t - this.lastPost > 0.05) {
      this.lastPost = t;
      this.port.postMessage({ ev: 'lvl', rms, floor: this.floor, envS: this.envS, loud: this.loudFor > 0.6, beat: this.beat, bpm: this.bpm });
    }
  }
}
registerProcessor('grok-mic', GrokMic);
