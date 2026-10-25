// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import android.webkit.CookieManager;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared WebView setup for the activity and the dream.
 * Serves bundled assets from https://appassets.androidplatform.net/assets/ (an androidx-free
 * WebViewAssetLoader) so the page is a secure context, and refuses every other request, so
 * nothing can leave the device.
 */
final class FaceWeb {
    static final String TAG = "GrokBotFace";
    static final String HOST = "appassets.androidplatform.net";
    static final String URL = "https://" + HOST + "/assets/index.html?app=1";
    static final String GROK_PKG = "ai.x.grok.bot";
    static final Uri GROK_CHAT = Uri.parse("grokbot://app/v1/agent?id=70cf39a8-9aeb-40e0-9972-8fcfa4915fa5");

    /** Deep link straight into the main Grok Bot chat; falls back to the app's launcher intent. */
    static Intent chatIntent(Context ctx) {
        Intent v = new Intent(Intent.ACTION_VIEW, GROK_CHAT).setPackage(GROK_PKG).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (v.resolveActivity(ctx.getPackageManager()) != null) return v;
        Intent l = ctx.getPackageManager().getLaunchIntentForPackage(GROK_PKG);
        if (l != null) l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return l;
    }

    /** JS bridge (window.GrokBotFace). */
    static final class Bridge {
        private final Context ctx;
        private final Runnable afterLaunch;
        private final NativeMic mic;
        private final Handler main = new Handler(Looper.getMainLooper());
        private long lastLaunch = 0;

        Bridge(Context ctx, Runnable afterLaunch, NativeMic mic) { this.ctx = ctx; this.afterLaunch = afterLaunch; this.mic = mic; }

        @JavascriptInterface
        public boolean hasGrokBot() { return chatIntent(ctx) != null; }

        @JavascriptInterface
        public boolean openGrokBot() { return openGrokBotIn(450); }

        @JavascriptInterface
        public boolean openGrokBotIn(int delayMs) {
            final Intent i = chatIntent(ctx);
            if (i == null) return false;
            long t = System.currentTimeMillis();
            if (t - lastLaunch < 2000) return true;   // ignore double fires
            lastLaunch = t;
            main.postDelayed(() -> {
                if (mic != null) mic.setActive(false);   // free the mic for the Grok Bot app first
                try {
                    ctx.startActivity(i);
                } catch (Exception e) {
                    Log.w(TAG, "deep link failed, trying launcher intent", e);
                    Intent l = ctx.getPackageManager().getLaunchIntentForPackage(GROK_PKG);
                    if (l != null) { l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { ctx.startActivity(l); } catch (Exception ignored) {} }
                }
                if (afterLaunch != null) afterLaunch.run();
            }, Math.max(0, Math.min(delayMs, 3000)));
            return true;
        }

        /** True when the app's own mic stream feeds the page (page must not open WebAudio mic). */
        @JavascriptInterface
        public boolean nativeMic() { return mic != null && has(ctx, Manifest.permission.RECORD_AUDIO); }

        @JavascriptInterface
        public String pollMic() { return mic == null ? "{\"on\":false}" : mic.poll(); }
    }

    /** The only network host the page may reach (plan usage feed); null when the feature is off. */
    static final String USAGE_HOST = usageHost();

    private static String usageHost() {
        try {
            if (Config.USAGE_FEED_URL.isEmpty()) return null;
            Uri u = Uri.parse(Config.USAGE_FEED_URL);
            return "https".equals(u.getScheme()) && u.getHost() != null ? u.getHost() : null;
        } catch (Exception e) { return null; }
    }

    /** GET-only, cookie-less fetch of the usage feed, done natively so the feed needn't send CORS headers. */
    static WebResourceResponse fetchUsage(Uri u) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(u.toString()).openConnection();
            c.setRequestMethod("GET");
            c.setInstanceFollowRedirects(false);      // never follow to another host
            c.setUseCaches(false);
            c.setConnectTimeout(10000); c.setReadTimeout(10000);
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            if (code != 200) return empty(502, "Upstream " + code);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) {
                byte[] b = new byte[8192]; int r, total = 0;
                while ((r = in.read(b)) > 0) { total += r; if (total > 256 * 1024) return empty(502, "Too large"); out.write(b, 0, r); }
            }
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "https://" + HOST);
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse("application/json", "utf-8", 200, "OK", h, new ByteArrayInputStream(out.toByteArray()));
        } catch (Exception e) {
            Log.w(TAG, "usage feed fetch failed: " + e);
            return empty(502, "Fetch failed");
        } finally { if (c != null) c.disconnect(); }
    }

    static boolean has(Context c, String perm) {
        return c.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    /** Ask for the panel's highest refresh rate at the current resolution (60 Hz on the Pixel Tablet). */
    static void preferHighRefresh(android.view.Window w, android.view.Display d) {
        if (w == null || d == null) return;
        android.view.Display.Mode cur = d.getMode(), best = cur;
        for (android.view.Display.Mode m : d.getSupportedModes())
            if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight()
                    && m.getRefreshRate() > best.getRefreshRate()) best = m;
        android.view.WindowManager.LayoutParams lp = w.getAttributes();
        lp.preferredDisplayModeId = best.getModeId();
        lp.preferredRefreshRate = best.getRefreshRate();
        w.setAttributes(lp);
        Log.i(TAG, "display mode " + best.getModeId() + " @ " + best.getRefreshRate() + " Hz");
    }

    static String mime(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".mjs") || p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    static WebResourceResponse empty(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<>(),
                new ByteArrayInputStream(new byte[0]));
    }

    @SuppressLint("SetJavaScriptEnabled")
    static WebView create(final Context ctx) { return create(ctx, null, null); }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    static WebView create(final Context ctx, Runnable afterLaunch, NativeMic mic) {
        CookieManager.getInstance().setAcceptCookie(false);
        WebView wv = new WebView(ctx);
        wv.setBackgroundColor(Color.BLACK);
        // v1.4 smoothness: draw straight into the hardware-accelerated window (no offscreen layer)
        // and keep the renderer at high priority while the face is on screen.
        wv.setLayerType(View.LAYER_TYPE_NONE, null);
        wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        wv.setVerticalScrollBarEnabled(false);
        wv.setHorizontalScrollBarEnabled(false);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setLongClickable(false);
        wv.setHapticFeedbackEnabled(false);
        wv.setOnLongClickListener(v -> true);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setMediaPlaybackRequiresUserGesture(false);   // lets the mic AudioContext run without a tap
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUserAgentString(s.getUserAgentString() + " GrokBotFace/1.10");

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) {
                    String path = u.getPath();
                    if (path != null && path.startsWith("/assets/") && !path.contains("..")) {
                        String asset = path.substring("/assets/".length());
                        try {
                            InputStream in = ctx.getAssets().open(asset);
                            Map<String, String> h = new HashMap<>();
                            h.put("Cache-Control", "no-cache");
                            h.put("Access-Control-Allow-Origin", "https://" + HOST);
                            String m = mime(asset);
                            return new WebResourceResponse(m, m.startsWith("text/") ? "utf-8" : null, 200, "OK", h, in);
                        } catch (IOException e) {
                            return empty(404, "Not Found");
                        }
                    }
                    return empty(404, "Not Found");
                }
                // Single allowlisted host: the plan-usage feed, GET only, no cookies.
                if (USAGE_HOST != null && "https".equals(u.getScheme()) && USAGE_HOST.equals(u.getHost())) {
                    if ("GET".equalsIgnoreCase(req.getMethod())) return fetchUsage(u);
                    return empty(405, "Method Not Allowed");
                }
                // Everything else (any network host) is refused: nothing else leaves the device.
                Log.w(TAG, "blocked request: " + u);
                return empty(403, "Blocked");
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return true; // never navigate away
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Uri origin = request.getOrigin();
                if (origin == null || !HOST.equals(origin.getHost())) { request.deny(); return; }
                List<String> grant = new ArrayList<>();
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && has(ctx, Manifest.permission.CAMERA)) grant.add(r);
                    else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && has(ctx, Manifest.permission.RECORD_AUDIO)) grant.add(r);
                }
                if (grant.isEmpty()) request.deny();
                else request.grant(grant.toArray(new String[0]));
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.message() != null && m.message().startsWith("perf ")) { Log.i(TAG, m.message()); return true; }
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    Log.w(TAG, "js: " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        wv.addJavascriptInterface(new Bridge(ctx, afterLaunch, mic), "GrokBotFace");
        wv.loadUrl(URL);
        return wv;
    }

    static void senseStart(WebView wv) {
        if (wv != null) wv.evaluateJavascript("window.grokbot&&grokbot.senseStart&&grokbot.senseStart()", null);
    }

    static void senseStop(WebView wv) {
        if (wv != null) wv.evaluateJavascript("window.grokbot&&grokbot.senseStop&&grokbot.senseStop()", null);
    }

    private FaceWeb() {}
}
