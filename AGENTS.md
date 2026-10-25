# AGENTS.md: set up Grok Bot Face end to end

This file is for AI coding agents (Cursor, Claude Code, Codex, and others) and for humans who like checklists. Your goal: **build the Grok Bot Face APK, optionally deploy its usage/news Worker, install it on an Android tablet or emulator, and set it as the screensaver.** Do everything you can yourself. Ask the human only for the items in [Ask the human for](#ask-the-human-for).

The one entry point is `scripts/setup.sh`. It is idempotent: re-running it skips work that's already done.

```bash
scripts/setup.sh doctor     # check tools and config, change nothing
scripts/setup.sh            # interactive: config -> (deploy) -> build -> (install) -> verify
scripts/setup.sh build|deploy|install|verify|config
```

Non-interactive (good for agents): `GBF_NONINTERACTIVE=1` plus env vars. The full list is in the header of `scripts/setup.sh`.

## Prerequisites (exact versions this is tested with)

| Tool | Version | Needed for | Check |
|---|---|---|---|
| JDK | 17 (Temurin 17.0.x; 17+ works) | build | `java -version` or set `JAVA_HOME` |
| Android SDK build-tools | **35.0.0** (aapt2, d8, zipalign, apksigner) | build | `$ANDROID_SDK_ROOT/build-tools/35.0.0/` |
| Android SDK platform | **android-34** (`android.jar`) | build | `$ANDROID_SDK_ROOT/platforms/android-34/` |
| Android platform-tools | adb 1.0.41 (35.x) | install | `adb version` |
| curl, unzip, zip, python3 | any recent | build | `scripts/setup.sh doctor` |
| Node.js + npm | npm for the MediaPipe download; **Node 22+** for wrangler | build / deploy | `node -v` |
| wrangler | 4.x (run via `npx wrangler@4`, nothing to install) | deploy only | `npx wrangler@4 --version` |
| jq | any | usage-feed helper scripts only | `jq --version` |

No Gradle and no Android Studio are needed to build. `android/build.sh` calls the SDK tools directly. Install the SDK pieces with `sdkmanager "build-tools;35.0.0" "platforms;android-34" "platform-tools"`. `ANDROID_SDK_ROOT` defaults to `~/opt/android-sdk`.

## Steps (in order)

1. **Doctor.** Run `scripts/setup.sh doctor`. Install anything marked `miss`. The `opt` lines are optional.
2. **Decide on the feed** (ask the human, see below): `none` (offline app, simplest), `deploy` (new Cloudflare Worker), or `url` (they already have a feed URL).
3. **Config.** `scripts/setup.sh config` writes git-ignored `android/local.env` and, for deploy, `usage-feed/.env.local`. Both are mode 600. The feed token goes in `~/.grokbot-usage-feed/token.env` (mode 600, outside the repo).
4. **Deploy the Worker** (only for `deploy`). `scripts/setup.sh deploy` creates or reuses a KV namespace, writes `usage-feed/wrangler.toml` (git-ignored), runs `wrangler deploy`, sets the secrets `FEED_TOKEN` (generated) and `CURSOR_KEY` (from the human, hidden input), then checks `usage.json` returns HTTP 200.
5. **Build.** `scripts/setup.sh build` produces `android/grokbot-face.apk`. The first build downloads Vosk, JNA and MediaPipe (about 80 MB) into git-ignored folders.
6. **Install.** `scripts/setup.sh install` runs adb connect (if `TABLET_ADDR` is set), `adb install -r`, grants camera and mic with `pm grant`, sets the screensaver with `settings put secure`, and launches the app.
7. **Verify.** `scripts/setup.sh verify` prints APK size, whether the feed is baked in, feed HTTP status, installed version and granted permissions.

Never commit `android/local.env`, `usage-feed/.env.local`, `usage-feed/wrangler.toml`, keystores, APKs or the token file. `.gitignore` already covers them. Never print secrets in logs or chat.

## Ask the human for

Ask only for these. For each one: why it's needed, where it goes, how to verify it, and what happens without it.

- [ ] **Feed or no feed.** *Why:* the usage meter and AI news need a Cloudflare Worker. *Where:* `GBF_FEED=none|deploy|url`. *Without it:* the app is fully offline (no INTERNET permission). The face, games, clock, camera/mic reactions and wake word all still work.
- [ ] **Cloudflare access** (deploy only). Either the human runs `npx wrangler@4 login` in a browser once, or gives a **Cloudflare API token** made from the *Edit Cloudflare Workers* template (Workers Scripts: Edit, Workers KV Storage: Edit, Account Settings: Read, Memberships: Read) with *Account › Workers AI: Read* added, plus their **account ID**. *Where:* `CLOUDFLARE_API_TOKEN` env var (hidden prompt, never written to disk) and `CF_ACCOUNT_ID` in `usage-feed/.env.local`. *Verify:* `npx wrangler@4 whoami`. They also need a workers.dev subdomain enabled (Dashboard › Workers & Pages). *Without it:* use `none`.
- [ ] **Cursor Admin API key** (deploy only). `worker.js` calls `POST https://api.cursor.com/teams/spend` with this key, so it must be a team **Admin API key** (Cursor dashboard › Settings › Advanced › Admin API keys, and creating one needs team admin rights). *Where:* `wrangler secret put CURSOR_KEY`. setup.sh pipes it in from a hidden prompt and never stores it. *Verify:* `usage.json` returns HTTP 200 (503 means a bad key or search term). *Without it:* `usage.json` returns 503, the meter stays hidden, and news still works.
- [ ] **Whose usage to show** (deploy only): the team member's email or name as it appears in Cursor. *Where:* `SEARCH_TERM` (Worker var in `wrangler.toml`, also kept in `.env.local`). *Plan limit:* **don't ask for it**. The Worker reads the spend limit from the Cursor API (`limitUsd`).
- [ ] **News sources** (optional). They're defined in `usage-feed/news.js` (`SOURCES`, allow/deny lists). The defaults need no keys. Ask only if the human wants different topics, then redeploy.
- [ ] **Signing key.** Ask whether they have an existing keystore. *Where:* `KEYSTORE`, `KS_ALIAS`, `KS_PASS` (hidden prompt; stored only in git-ignored `android/local.env`, mode 600). *Default:* a throwaway `android/debug.keystore` is generated on the first build. **Warn them:** whatever key signs the first install must sign every update. A different key gives `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, and the only fix is uninstalling, which wipes the app's settings. Tell them to back the keystore up.
- [ ] **Tablet prep.** The human has to do these on the device, and an agent can't. Turn on *Settings › About tablet › Build number* (tap 7 times) to unlock Developer options. Then *Developer options › Wireless debugging* on, then *Pair device with pairing code*. Run `adb pair <IP>:<PAIR_PORT>` with the 6-digit code they read to you. USB alternative: plug in, accept the RSA prompt, optionally `adb tcpip 5555`. **Root is not required for anything.** Install, permission grants and the screensaver setting all work over plain adb.
- [ ] **Tablet address.** The `IP:PORT` shown on the Wireless debugging screen (it changes after reboots). *Where:* `TABLET_ADDR` in `android/local.env`. *Verify:* `adb devices` lists it as `device`.
- [ ] **Camera and mic.** setup.sh grants these with `adb shell pm grant`. If that fails, the human taps *Allow* on first launch. *Verify:* `scripts/setup.sh verify` shows `granted=true`. *Without them:* no face following, smile/wave/clap/music reactions or wake word. Everything else works. Processing is on the device only.
- [ ] **Grok Bot app** (optional). Long-press, wordmark tap and "hey Grok Bot" open the Grok Bot Android app (`ai.x.grok.bot`) if it's installed. Without it, the bot shrugs.

## Emulator instead of a real tablet

1. Install Android Studio (or `sdkmanager "emulator" "system-images;android-34;google_apis;arm64-v8a"` on Apple Silicon or ARM Linux, or `...;x86_64` on Intel/AMD).
2. Create an AVD: Device Manager › *Pixel Tablet* profile › API 34 image, or `avdmanager create avd -n tablet -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_tablet`.
3. Start it with `emulator -avd tablet`, then `scripts/setup.sh install` (leave `TABLET_ADDR` empty, and adb sees `emulator-5554`).
4. **Caveat:** the APK ships native libraries (Vosk, JNA) for **arm64-v8a only**. Use an **arm64** system image (Apple Silicon Macs run them natively). An x86_64 image works only if it includes ARM translation (recent Google APIs images do). If install fails with `INSTALL_FAILED_NO_MATCHING_ABIS`, switch to arm64. If the native wake-word library can't load, the app catches the error and runs without the wake word. Set the AVD's front camera to *Webcam0* to test camera reactions.

## Troubleshooting

- `INSTALL_FAILED_UPDATE_INCOMPATIBLE`: different signing key (see above).
- `usage.json` returns 503: the Cursor key or `SEARCH_TERM` is wrong. 404 means the token or path is wrong (by design).
- The meter or news doesn't appear: the app was built without `USAGE_FEED_URL`. Re-run `scripts/setup.sh config` and then `build`.
- `wrangler` complains about the Node version: wrangler 4 needs Node 22+.
- MediaPipe download fails: `sense/fetch-mediapipe.sh` needs npm and network access, and it patches out MediaPipe's telemetry. If a new version breaks the patch, pin `MP_VER=1.1.0`.
