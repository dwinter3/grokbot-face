// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

/**
 * Pure-Java port of the page's mic analysis (clap / loud / beat), fed from the single native
 * AudioRecord stream. Works on 10 ms hops; keeps only a few running numbers, never samples.
 */
final class MicAnalyzer {
    final int sampleRate, hop;
    private int n; private double sum, lowSum, hiSum, peak, lp1, lp2, lpH;
    private final double aLow, aHi;
    private double t;                       // seconds of audio processed
    volatile double rms, floor = 0.002, envS; volatile boolean loud, beat; volatile double bpm;
    volatile int clapSeq, beatSeq;
    private double prevRms, loudFor, lowAvg, lowFloor = 0.001, lastOnset = -9, lastClap = -9;
    private final double[] onsets = new double[10]; private int onsetCount;

    MicAnalyzer(int sampleRate) {
        this.sampleRate = sampleRate; this.hop = Math.round(sampleRate / 100f);
        aLow = 1 - Math.exp(-2 * Math.PI * 150 / sampleRate);
        aHi = 1 - Math.exp(-2 * Math.PI * 2000 / sampleRate);
    }

    void process(short[] buf, int len) {
        for (int i = 0; i < len; i++) {
            double x = buf[i] / 32768.0;
            lp1 += (x - lp1) * aLow; lp2 += (lp1 - lp2) * aLow;
            lpH += (x - lpH) * aHi; double hi = x - lpH;
            sum += x * x; lowSum += lp2 * lp2; hiSum += hi * hi;
            double a = Math.abs(x); if (a > peak) peak = a;
            if (++n >= hop) analyse();
        }
    }

    private void analyse() {
        t += n / (double) sampleRate;
        double r = Math.sqrt(sum / n), low = Math.sqrt(lowSum / n), hi = Math.sqrt(hiSum / n), pk = peak;
        n = 0; sum = lowSum = hiSum = 0; peak = 0;
        floor += (r - floor) * (r < floor ? 0.05 : 0.0008); if (floor < 0.0006) floor = 0.0006;
        envS += (r - envS) * 0.03;
        if (pk > Math.max(0.08, floor * 14) && r > Math.max(prevRms * 3, envS * 2.5) && hi > r * 0.45 && t - lastClap > 0.9) {
            lastClap = t; clapSeq++;
        }
        prevRms = r;
        if (envS > Math.max(floor * 3.5, 0.01)) loudFor += 0.01; else loudFor = Math.max(0, loudFor - 0.02);
        loud = loudFor > 0.6;
        lowFloor += (low - lowFloor) * (low < lowFloor ? 0.05 : 0.0008);
        if (low > lowAvg * 1.6 && low > Math.max(lowFloor * 4, 0.02) && t - lastOnset > 0.27) {
            lastOnset = t;
            if (onsetCount < onsets.length) onsets[onsetCount++] = t;
            else { System.arraycopy(onsets, 1, onsets, 0, onsets.length - 1); onsets[onsets.length - 1] = t; }
            if (onsetCount >= 6) {
                double[] iv = new double[onsetCount - 1];
                for (int i = 1; i < onsetCount; i++) iv[i - 1] = onsets[i] - onsets[i - 1];
                double[] s = iv.clone(); java.util.Arrays.sort(s); double m = s[s.length / 2];
                int ok = 0; for (double v : iv) if (Math.abs(v - m) < m * 0.15) ok++;
                if (m > 0.3 && m < 1.0 && ok >= 0.7 * iv.length) { beat = true; bpm = 60 / m; beatSeq++; }
            }
        }
        lowAvg += (low - lowAvg) * 0.08;
        if (beat && t - lastOnset > 2.2) { beat = false; bpm = 0; }
        rms = r;
    }
}
