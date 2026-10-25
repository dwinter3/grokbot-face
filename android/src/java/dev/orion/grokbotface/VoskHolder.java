// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import org.vosk.LibVosk;
import org.vosk.LogLevel;
import org.vosk.Model;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** Loads the bundled Vosk model once per process (copied from assets to app storage on first run). */
final class VoskHolder {
    static final String MODEL_ASSET = "vosk-model-small-en-us-0.15";
    static final String MODEL_STAMP = MODEL_ASSET + "-v1";
    private static volatile Model model;
    private static volatile boolean loading;
    static volatile String status = "idle";

    static Model model() { return model; }

    static synchronized void ensure(final Context app) {
        if (model != null || loading) return;
        loading = true; status = "loading";
        new Thread(() -> {
            try {
                LibVosk.setLogLevel(LogLevel.WARNINGS);
                File dir = new File(app.getFilesDir(), MODEL_ASSET);
                File stamp = new File(dir, ".stamp-" + MODEL_STAMP);
                if (!stamp.exists()) {
                    deleteRec(dir);
                    copyAssetDir(app.getAssets(), MODEL_ASSET, dir);
                    if (!stamp.createNewFile()) Log.w(FaceWeb.TAG, "stamp not created");
                }
                model = new Model(dir.getAbsolutePath());
                status = "ready";
            } catch (Throwable t) {
                status = "error: " + t.getClass().getSimpleName();
                Log.w(FaceWeb.TAG, "vosk model load failed", t);
            } finally { loading = false; }
        }, "vosk-load").start();
    }

    private static void copyAssetDir(AssetManager am, String src, File dst) throws IOException {
        String[] kids = am.list(src);
        if (kids == null || kids.length == 0) {               // a file
            dst.getParentFile().mkdirs();
            try (InputStream in = am.open(src); OutputStream out = new FileOutputStream(dst)) {
                byte[] b = new byte[64 * 1024]; int r; while ((r = in.read(b)) > 0) out.write(b, 0, r);
            }
            return;
        }
        dst.mkdirs();
        for (String k : kids) copyAssetDir(am, src + "/" + k, new File(dst, k));
    }

    private static void deleteRec(File f) {
        File[] kids = f.listFiles(); if (kids != null) for (File k : kids) deleteRec(k);
        if (f.exists() && !f.delete()) Log.w(FaceWeb.TAG, "could not delete " + f);
    }

    private VoskHolder() {}
}
