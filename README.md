<div align="center">

<img src="docs/media/hero-moves.gif" alt="Grok Bot Face winking, bouncing, getting dizzy and dancing" width="720">

# 👀 Grok Bot Face

**A desk buddy with pill eyes. It blinks, it dances, it watches the news so you don't have to.**

A fullscreen animated face and screensaver for the Google Pixel Tablet.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform: Android 11+](https://img.shields.io/badge/Android-11%2B-3DDC84?logo=android&logoColor=white)
![No Gradle](https://img.shields.io/badge/build-no%20Gradle-black)
![Runs offline](https://img.shields.io/badge/camera%20%26%20mic-on--device%20only-blue)
[![Agent-ready](https://img.shields.io/badge/AI%20agents-AGENTS.md-8B5CF6)](AGENTS.md)

</div>

---

## ✨ What it does

- 👀 **Pill eyes with personality.** Blinks, double-blinks, winks, gets dizzy, peeks, dances, dozes off. It drifts gently so your screen never burns in.
- 📷 **Sees you (on the device only).** Follows your face, smiles back, waves back. Frames are analysed in memory and never stored or sent.
- 👏 **Hears you (on the device only).** Reacts to claps, looks at whoever is talking, and dances when music plays.
- 🗣️ **"Hey Grok Bot."** Offline wake word (Vosk). It perks up and opens the Grok Bot app. A long-press anywhere opens it too.
- 🕐 **A clock on every look.** It's a desk clock first.
- 🏓 **Games it plays against itself:** Pong around the clock, chess, checkers, Pac-Man.
- 🎭 **A cast of characters,** plus little *adventures*: building towers, coding, writing the newsletter, dreaming, multiplying into 16 bots, tug of war.
- 📰 **AI news moments.** Calm center-screen headlines with short summaries, plus a "THIS JUST IN" takeover when a coding agent ships a release.
- 🌡️ **Plan-usage thermostat.** A slim gauge on the right edge for your Cursor spend versus your limit, with an end-of-cycle pace forecast. The face gets a little nervous when you're on pace to overspend.
- 📈 **Burn chart.** Under the gauge, a sideways line chart of this cycle's daily spend, its 10-day average, a forecast and your limit pace, with "hits limit ~day" if you're running hot.

  <img src="docs/media/burn-chart-zoom.png" height="360" alt="Burn chart (sample data)"> <img src="docs/media/burn-chart-face.png" height="360" alt="Face with burn chart (sample data)">
- ✊ **Rock-paper-scissors.** Tap the little clock (or hold up a fist) and play a best-of-three against the bot with real hand gestures, read on the device.
- 🎃 **Halloween pumpkin with costumes.** An orange Grok Bot pumpkin that wobbles, plus 10 corny costumes. See below.
- 🔌 **Offline by default.** Build without a feed URL and the app doesn't even get the INTERNET permission.

## 🖼️ Gallery

<table>
<tr>
<td width="33%"><img src="docs/media/pong.gif" alt="Two bots playing Pong around the clock"><br><sub>🏓 <b>Pong o'clock</b>: two bots rally around the time</sub></td>
<td width="33%"><img src="docs/media/characters.gif" alt="Character bots swapping in and out"><br><sub>🎭 <b>The cast</b> takes turns on stage</sub></td>
<td width="33%"><img src="docs/media/face-happy.png" alt="Happy pill eyes"><br><sub>😊 <b>Happy</b>: someone smiled at it</sub></td>
</tr>
<tr>
<td><img src="docs/media/look-blob.png" alt="Big green blob look"><br><sub>🟢 <b>Blob mode</b>, peeking up from the bottom</sub></td>
<td><img src="docs/media/look-clock.png" alt="Big clock look"><br><sub>🕐 <b>Clock look</b>: the eyes become the colon</sub></td>
<td><img src="docs/media/look-chars.png" alt="Three character bots"><br><sub>🔺🟠🔵 <b>Characters</b> hanging out</sub></td>
</tr>
<tr>
<td><img src="docs/media/look-chess.png" alt="Two bots playing chess"><br><sub>♟️ <b>Chess</b>: real legal moves, two bots face off</sub></td>
<td><img src="docs/media/look-checkers.png" alt="Two bots playing checkers"><br><sub>🔴 <b>Checkers</b> with forced jumps and kings</sub></td>
<td><img src="docs/media/look-pacman.png" alt="Pac-Man look"><br><sub>🟡 <b>Pac-Man</b>, played by the bots</sub></td>
</tr>
<tr>
<td><img src="docs/media/adv-building.png" alt="Two bots building a tower"><br><sub>🧱 <b>Adventure: building</b> a tower, block by block</sub></td>
<td><img src="docs/media/adv-dreaming.png" alt="Sleeping bot dreaming"><br><sub>💤 <b>Adventure: dreaming</b></sub></td>
<td><img src="docs/media/adv-writing.png" alt="Bot writing the newsletter"><br><sub>✍️ <b>Adventure: writing</b> the Grok Bot Weekly</sub></td>
</tr>
<tr>
<td><img src="docs/media/adv-coding.png" alt="Bot coding in a little terminal"><br><sub>💻 <b>Adventure: coding</b>, and the tests pass</sub></td>
<td><img src="docs/media/adv-multiplying.png" alt="Grok Bot multiplied into 16 bots"><br><sub>✖️ <b>Adventure: multiplying</b> 1 → 16 bots</sub></td>
<td><img src="docs/media/adv-tugofwar.png" alt="Bots playing tug of war"><br><sub>🪢 <b>Adventure: tug of war</b>, 2 v 2</sub></td>
</tr>
<tr>
<td><img src="docs/media/news-moment.png" alt="Center-screen news moment"><br><sub>📰 <b>News moment</b>: one calm headline at a time</sub></td>
<td><img src="docs/media/look-news.png" alt="News look"><br><sub>🗞️ <b>News look</b>: the Newsletter bot reads along</sub></td>
<td><img src="docs/media/look-harness.png" alt="Harness board of coding-agent changelogs"><br><sub>🛠️ <b>Harness board</b>: latest coding-agent releases</sub></td>
</tr>
</table>

<sub>Screenshots are rendered from <code>index.html</code> in headless Chrome with a mock feed. Headlines, versions and the $120/$300 meter are sample data.</sub>

## 🎃 Pumpkin & costumes

<div align="center">
<img src="docs/media/pumpkin-costumes.gif" alt="The Grok Bot pumpkin swapping costumes in a puff of smoke and wobbling" width="500">
</div>

The pumpkin is a flat orange Grok Bot with a lobed bottom and a curly stem. At rest its eyes are round dots. When it gets lively (a tap, a greeting, music, the wake word, or a little typing burst) they stretch into pills that dart around, and the whole pumpkin rocks from its base.

It also dresses up: **witch, Dracula, Groucho glasses, pirate, Frankenstein, mummy, ghost, wizard, devil and skeleton**, plus a plain pumpkin now and then. Every costume is drawn as flat canvas shapes layered over the pumpkin. Masks have eye holes, glasses sit around the eyes, the pirate's patch covers one eye, and costumes rock along with the pumpkin. It changes costume every 2–4 minutes in a puff of smoke, or when you tap it. Each change shows a pun for a few seconds, like *"Fangs for visiting!"* and *"Gourd to the bone"*.

Oct 25 – Nov 1 the pumpkin is the opening look and comes up often. In October it's part of auto-rotation. The rest of the year it's a swipe away. `?halloween=1` forces Halloween mode for testing, and `?theme=pumpkin` jumps straight to it.

<table>
<tr>
<td width="50%"><img src="docs/media/look-pumpkin-witch.png" alt="Pumpkin in a witch hat with a warty green nose"><br><sub>🧙 <b>Witch</b>: "Witch way to the candy?"</sub></td>
<td width="50%"><img src="docs/media/look-pumpkin-ghost.png" alt="Pumpkin under a bedsheet ghost costume"><br><sub>👻 <b>Ghost</b>: "Boo-tiful night, isn't it?"</sub></td>
</tr>
</table>

<img src="docs/media/costumes-sheet.png" alt="Contact sheet of all pumpkin costumes">

<sub>The meter shows sample data ($120 of $300).</sub>

## 🚀 Quick start

> 🤖 **Using an AI coding agent?** Point it at **[AGENTS.md](AGENTS.md)**. It has the full end-to-end recipe and the short list of things it has to ask you for.

```bash
scripts/setup.sh doctor   # what's installed, what's missing
scripts/setup.sh          # config -> (deploy feed) -> build -> (install) -> verify
```

**You need:** JDK 17, Android SDK `build-tools;35.0.0` and `platforms;android-34`, plus `curl unzip zip python3 npm`. Add `adb` to install, and Node 22+ (wrangler) only if you deploy the feed. No Gradle, no Android Studio.

<details>
<summary><b>🔧 Build by hand</b></summary>

```bash
export USAGE_FEED_URL=https://<worker>.<subdomain>.workers.dev/<FEED_TOKEN>/usage.json   # optional
./android/build.sh        # -> android/grokbot-face.apk
```

The first build downloads Vosk, JNA and MediaPipe (about 80 MB) into git-ignored folders. **Signing:** set `KEYSTORE`, `KS_PASS` and `KS_ALIAS` (or put them in git-ignored `android/local.env`). Otherwise a throwaway `android/debug.keystore` is generated. Keep that key: a different key won't install over the existing app.
</details>

<details>
<summary><b>📲 Install over Wi-Fi</b></summary>

On the tablet: Developer options › **Wireless debugging** › *Pair device with pairing code*.

```bash
adb pair <TABLET_IP>:<PAIR_PORT>
adb connect <TABLET_IP>:<PORT>
adb install -r android/grokbot-face.apk
adb shell pm grant dev.orion.grokbotface android.permission.CAMERA
adb shell pm grant dev.orion.grokbotface android.permission.RECORD_AUDIO
```

Then go to Settings › Display › **Screen saver** › *Grok Bot Face*. No root needed. No tablet? See the emulator notes in [AGENTS.md](AGENTS.md#emulator-instead-of-a-real-tablet).
</details>

<details>
<summary><b>☁️ Usage + news feed (optional Cloudflare Worker)</b></summary>

`usage-feed/` is a tiny Worker with KV and Workers AI. Every 15 minutes it reads your Cursor plan spend. A staggered cron gathers AI news and coding-agent changelogs and writes short summaries. Everything sits behind a secret URL token (wrong token = 404), and CORS only allows the app.

```bash
cd usage-feed && cp wrangler.toml.example wrangler.toml   # fill in KV id + SEARCH_TERM
npx wrangler@4 secret put CURSOR_KEY    # Cursor team Admin API key
npx wrangler@4 secret put FEED_TOKEN    # random, >= 20 chars [A-Za-z0-9_-]
npx wrangler@4 deploy
```

Or just run `scripts/setup.sh deploy`. Details are in [usage-feed/README.md](usage-feed/README.md).
</details>

## 🗂️ Repo layout

```
index.html        the whole face: canvas rendering, looks, games, adventures, news UI
sense/            on-device camera + mic sensing (MediaPipe face/gesture, audio worklet)
android/          Gradle-less build.sh, manifest, Java host (WebView, screensaver, mic, wake word)
usage-feed/       Cloudflare Worker: usage.json, news.json, harness.json
scripts/setup.sh  doctor / config / deploy / build / install / verify
tests/            headless Playwright checks and preview renderers
CHANGELOG.md      what changed, version by version
docs/media/       the pictures above
```

## 💛 A hobby project

Built for fun for one Pixel Tablet on one desk. It's unofficial and not affiliated with or endorsed by xAI, Cursor, Google, or anyone else whose product names appear in it. Your mileage may vary. Have fun with it.

## 📄 License

[MIT](LICENSE) © 2026 David Winter. Source files carry `SPDX-License-Identifier: MIT` headers. Third-party components (Vosk and its model, JNA, MediaPipe and its models) are downloaded at build time and keep their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
