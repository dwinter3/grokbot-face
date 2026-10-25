// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

import android.Manifest;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import org.vosk.Model;
import org.vosk.Recognizer;

/**
 * One native AudioRecord stream (16 kHz mono) feeding both the wake-word recognizer and the
 * clap/loud/beat analysis that the page polls through the JS bridge. Audio is processed in
 * memory chunk by chunk and dropped; nothing is stored or sent. The mic is released before the
 * Grok Bot app is launched so that app can use it.
 */
final class NativeMic {
    static final int RATE = 16000;
    private final Context ctx;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean active;       // host (activity/dream) wants listening
    private volatile Thread thread;
    private volatile boolean running;
    private volatile MicAnalyzer an = new MicAnalyzer(RATE);
    private volatile double cooldownUntil;
    volatile String partial = "", lastText = "", engine = "off";
    volatile double lastConf;
    volatile int wakeSeq;

    NativeMic(Context ctx) { this.ctx = ctx.getApplicationContext(); }

    static double now() { return SystemClock.elapsedRealtime() / 1000.0; }

    void setActive(boolean on) {
        active = on;
        main.removeCallbacksAndMessages(null);
        if (on) start(); else stop();
    }

    boolean isOn() { return running; }

    private synchronized void start() {
        if (running || !FaceWeb.has(ctx, Manifest.permission.RECORD_AUDIO)) return;
        VoskHolder.ensure(ctx);
        running = true;
        thread = new Thread(this::loop, "grok-mic");
        thread.start();
    }

    private synchronized void stop() {
        running = false;
        Thread t = thread; thread = null;
        if (t != null && t != Thread.currentThread()) { try { t.join(800); } catch (InterruptedException ignored) {} }
    }

    private void loop() {
        AudioRecord rec = null; Recognizer vosk = null;
        try {
            int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT, Math.max(min, RATE));      // ~0.5 s buffer
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("AudioRecord init");
            rec.startRecording();
            short[] buf = new short[RATE / 10];                                  // 100 ms chunks
            int partialEvery = 0;
            while (running) {
                int n = rec.read(buf, 0, buf.length);
                if (n <= 0) continue;
                an.process(buf, n);
                if (vosk == null) {
                    Model m = VoskHolder.model();
                    if (m != null) { vosk = new Recognizer(m, RATE, WakeWord.GRAMMAR); vosk.setWords(true); engine = "vosk"; }
                    else engine = "vosk " + VoskHolder.status;
                }
                if (vosk == null) continue;
                if (vosk.acceptWaveForm(buf, n)) {
                    String res = vosk.getResult();
                    String text = WakeWord.text(res);
                    if (!text.isEmpty()) { lastText = text; lastConf = WakeWord.meanConf(res); }
                    partial = "";
                    if (WakeWord.isWake(res) && now() >= cooldownUntil) { onWake(); break; }
                } else if (++partialEvery % 3 == 0) {
                    partial = WakeWord.partial(vosk.getPartialResult());
                }
            }
        } catch (Throwable t) {
            engine = "error: " + t.getClass().getSimpleName();
            Log.w(FaceWeb.TAG, "mic loop", t);
        } finally {
            if (vosk != null) vosk.close();
            if (rec != null) { try { rec.stop(); } catch (Throwable ignored) {} rec.release(); }   // mic released here
            running = false;
        }
    }

    private void onWake() {
        cooldownUntil = now() + WakeWord.COOLDOWN_SEC;
        wakeSeq++;
        running = false;                 // leave the loop -> AudioRecord released in finally
        // if the app doesn't get launched (or the user comes back), resume listening later
        main.postDelayed(() -> { if (active) start(); }, (long) (WakeWord.COOLDOWN_SEC * 1000));
    }

    /** JSON snapshot polled by the page (~20 Hz). */
    String poll() {
        MicAnalyzer a = an;
        StringBuilder b = new StringBuilder(256);
        b.append("{\"on\":").append(running)
         .append(",\"rms\":").append(f(a.rms)).append(",\"floor\":").append(f(a.floor)).append(",\"envS\":").append(f(a.envS))
         .append(",\"loud\":").append(a.loud).append(",\"beat\":").append(a.beat).append(",\"bpm\":").append(f(a.bpm))
         .append(",\"clapSeq\":").append(a.clapSeq).append(",\"beatSeq\":").append(a.beatSeq)
         .append(",\"wakeSeq\":").append(wakeSeq).append(",\"engine\":\"").append(esc(engine))
         .append("\",\"partial\":\"").append(esc(partial)).append("\",\"last\":\"").append(esc(lastText))
         .append("\",\"lastConf\":").append(f(lastConf)).append('}');
        return b.toString();
    }

    private static String f(double v) { return Double.isFinite(v) ? String.format(java.util.Locale.US, "%.4f", v) : "0"; }
    private static String esc(String s) { return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\""); }
}
