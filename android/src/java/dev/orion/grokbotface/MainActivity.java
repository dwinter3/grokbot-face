// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

import android.Manifest;
import android.content.Intent;
import android.app.Activity;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebView;

public class MainActivity extends Activity {
    private static final int REQ_SENSES = 7;
    private WebView web;
    private NativeMic mic;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setDecorFitsSystemWindows(false);
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        getWindow().setAttributes(lp);
        FaceWeb.preferHighRefresh(getWindow(), getDisplay());
        mic = new NativeMic(this);
        web = FaceWeb.create(this, null, mic);
        setContentView(web);
        hideBars();
        debugHook(getIntent());
        // Ask once on first launch; if denied the face simply runs without camera/mic.
        if (!FaceWeb.has(this, Manifest.permission.CAMERA) || !FaceWeb.has(this, Manifest.permission.RECORD_AUDIO)) {
            requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}, REQ_SENSES);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_SENSES) { FaceWeb.senseStart(web); mic.setActive(true); }
    }

    // adb debug hook (v1.9): am start -n dev.orion.grokbotface/.MainActivity --ez breaking true | --es look news|harness|pong|moment|rps|rpsfist|...
    // Only whitelisted, fixed JS calls; no URL or script is ever taken from the intent.
    @Override
    protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); debugHook(intent); }
    private void debugHook(Intent i) {
        if (i == null || web == null) return;
        final boolean brk = i.getBooleanExtra("breaking", false);
        final String look = i.getStringExtra("look");
        final String js;
        if (brk) js = "window.grokbot&&grokbot.breaking&&grokbot.breaking()";
        else if ("moment".equals(look)) js = "window.grokbot&&grokbot.newsMoment&&grokbot.newsMoment()";
        else if ("rps".equals(look)) js = "window.grokbot&&grokbot.rpsStart&&grokbot.rpsStart()";   // v1.12 rock-paper-scissors
        else if ("rpsfist".equals(look)) js = "window.grokbot&&grokbot.rpsSimFist&&grokbot.rpsSimFist()";   // v1.12.1 synthetic held fist (test)
        else if (look != null && look.matches("pills|blob|chars|clock|pong|chess|checkers|pacman|news|harness")) js = "window.grokbot&&grokbot.showLook&&grokbot.showLook('" + look + "')";
        else return;
        web.postDelayed(() -> { if (web != null) web.evaluateJavascript(js, null); }, brk ? 300 : 100);
    }

    private void hideBars() {
        WindowInsetsController c = getWindow().getInsetsController();
        if (c != null) {
            c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); FaceWeb.senseStart(web); }
        if (mic != null) mic.setActive(true);
        hideBars();
    }

    @Override
    protected void onPause() {
        // camera + mic released whenever we're not in front
        if (mic != null) mic.setActive(false);
        if (web != null) { FaceWeb.senseStop(web); web.onPause(); }
        super.onPause();
    }

    @Override
    protected void onStop() { if (mic != null) mic.setActive(false); FaceWeb.senseStop(web); super.onStop(); }

    @Override
    protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
}
