// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

import android.service.dreams.DreamService;
import android.view.KeyEvent;
import android.webkit.WebView;

/**
 * Screen saver: same face, interactive so taps react; Back exits.
 * A dream cannot ask for permissions, so camera/mic are used only if the app already holds them
 * (FaceWeb's permission handler checks); otherwise the page silently runs the v1.0 behaviour.
 */
public class FaceDreamService extends DreamService {
    private WebView web;
    private NativeMic mic;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(true);
        setFullscreen(true);
        setScreenBright(true);
        FaceWeb.preferHighRefresh(getWindow(), getWindow().getWindowManager().getDefaultDisplay());
        // after launching the Grok Bot app, end the dream so the app is shown
        mic = new NativeMic(this);   // listens only if RECORD_AUDIO was already granted
        web = FaceWeb.create(this, this::wakeUp, mic);
        setContentView(web);
    }

    @Override
    public void onDreamingStarted() {
        super.onDreamingStarted();
        if (web != null) { web.onResume(); FaceWeb.senseStart(web); }
        if (mic != null) mic.setActive(true);
    }

    @Override
    public void onDreamingStopped() {
        if (mic != null) mic.setActive(false);
        if (web != null) { FaceWeb.senseStop(web); web.onPause(); }
        super.onDreamingStopped();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK || event.getKeyCode() == KeyEvent.KEYCODE_ESCAPE) {
            if (event.getAction() == KeyEvent.ACTION_UP) finish();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onDetachedFromWindow() {
        if (mic != null) mic.setActive(false);
        if (web != null) { FaceWeb.senseStop(web); web.destroy(); web = null; }
        super.onDetachedFromWindow();
    }
}
