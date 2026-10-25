#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Gradle-less build: aapt2 -> javac -> d8 -> zipalign -> apksigner
set -euo pipefail
# Optional local overrides (git-ignored): USAGE_FEED_URL, KEYSTORE, KS_PASS, KEY_PASS, KS_ALIAS
_H=$(cd "$(dirname "$0")" && pwd); [ -f "$_H/local.env" ] && . "$_H/local.env"
JAVA_HOME=${JAVA_HOME:-$(ls -d ~/opt/jdk-17* 2>/dev/null | head -1)}
if [ -n "$JAVA_HOME" ]; then export JAVA_HOME PATH=$JAVA_HOME/bin:$PATH; fi
SDK=${ANDROID_SDK_ROOT:-$HOME/opt/android-sdk}
BT=$SDK/build-tools/35.0.0
JAR=$SDK/platforms/android-34/android.jar
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=$HERE/src; OUT=$HERE/build
rm -rf "$OUT"; mkdir -p "$OUT"/{res,gen,classes,dex,cfg,vendor,lib/lib/arm64-v8a}
# Optional plan-usage feed (https only). Empty = gauge hidden, no INTERNET permission, no network at all.
USAGE_FEED_URL=${USAGE_FEED_URL:-}
if [ -n "$USAGE_FEED_URL" ]; then
  [[ "$USAGE_FEED_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^\"\'\ ]*)?$ ]] || { echo "USAGE_FEED_URL must be a plain https URL" >&2; exit 1; }
  USAGE_ORIGIN=$(python3 -c "import sys,urllib.parse as u;p=u.urlsplit(sys.argv[1]);print(p.scheme+'://'+p.netloc)" "$USAGE_FEED_URL")
fi
VEND=$HERE/vendor; "$VEND/fetch-vendor.sh" >/dev/null
unzip -q -o "$VEND/vosk-android-0.3.75.aar" classes.jar -d "$OUT/vendor/vosk"
unzip -q -o "$VEND/vosk-android-0.3.75.aar" jni/arm64-v8a/libvosk.so -d "$OUT/vendor/vosk"
unzip -q -o "$VEND/jna-5.18.1.aar" classes.jar -d "$OUT/vendor/jna"
unzip -q -o "$VEND/jna-5.18.1.aar" jni/arm64-v8a/libjnidispatch.so -d "$OUT/vendor/jna"
cp "$OUT/vendor/vosk/jni/arm64-v8a/libvosk.so" "$OUT/vendor/jna/jni/arm64-v8a/libjnidispatch.so" "$OUT/lib/lib/arm64-v8a/"
VJARS="$OUT/vendor/vosk/classes.jar:$OUT/vendor/jna/classes.jar"
ROOT=$HERE/..
[ -f "$ROOT/sense/mp/models/face_landmarker.task" ] || "$ROOT/sense/fetch-mediapipe.sh"
rm -rf "$SRC/assets"; mkdir -p "$SRC/assets/mp/wasm" "$SRC/assets/mp/models"
cp "$ROOT/index.html" "$ROOT/sense/sense.mjs" "$ROOT/sense/mic-worklet.js" "$ROOT/sense/detect-worker.js" "$SRC/assets/"
cp "$ROOT/sense/mp/vision_bundle.mjs" "$SRC/assets/mp/"
cp "$ROOT/sense/mp/wasm/vision_wasm_internal.js" "$ROOT/sense/mp/wasm/vision_wasm_internal.wasm" "$SRC/assets/mp/wasm/"
cp "$ROOT/sense/mp/models/"*.task "$SRC/assets/mp/models/"
mkdir -p "$SRC/assets/vosk-model-small-en-us-0.15"
(cd "$VEND/vosk-model-small-en-us-0.15" && cp -r am conf graph ivector "$SRC/assets/vosk-model-small-en-us-0.15/")
# bake the usage feed constant into page CSP + JS, manifest, and Java
python3 - "$SRC/assets/index.html" "$USAGE_FEED_URL" "${USAGE_ORIGIN:-}" <<'PY'
import sys
p, url, origin = sys.argv[1:4]; s = open(p).read()
a = "connect-src 'self' blob: data:;"; assert s.count(a) == 1
if url:
    s = s.replace(a, "connect-src 'self' blob: data: %s;" % origin)
    b = "/*USAGE_FEED_URL*/''"; assert s.count(b) == 1
    s = s.replace(b, "/*USAGE_FEED_URL*/%r" % url)
open(p, 'w').write(s)
PY
sed -e "s#<!--INTERNET-->#$([ -n "$USAGE_FEED_URL" ] && echo '<uses-permission android:name=\"android.permission.INTERNET\" />')#" "$SRC/AndroidManifest.xml" > "$OUT/cfg/AndroidManifest.xml"
mkdir -p "$OUT/cfg/java/dev/orion/grokbotface"
printf 'package dev.orion.grokbotface;\nfinal class Config {\n    static final String USAGE_FEED_URL = "%s";\n    private Config() {}\n}\n' "$USAGE_FEED_URL" > "$OUT/cfg/java/dev/orion/grokbotface/Config.java"
! grep -rl "odml.pa.googleapis.com" "$SRC/assets" || { echo "telemetry endpoint still present" >&2; exit 1; }
"$BT/aapt2" compile --dir "$SRC/res" -o "$OUT/res/compiled.zip"
"$BT/aapt2" link -I "$JAR" --manifest "$OUT/cfg/AndroidManifest.xml" -A "$SRC/assets" \
  --java "$OUT/gen" -o "$OUT/unsigned.apk" "$OUT/res/compiled.zip" --min-sdk-version 30 --target-sdk-version 34
javac --release 11 -classpath "$JAR:$VJARS" -d "$OUT/classes" $(find "$SRC/java" "$OUT/gen" "$OUT/cfg/java" -name '*.java') -Xlint:-options
"$BT/d8" --release --min-api 30 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class') "$OUT/vendor/vosk/classes.jar" "$OUT/vendor/jna/classes.jar" 2> "$OUT/d8.log" || { cat "$OUT/d8.log"; exit 1; }
cp "$OUT/unsigned.apk" "$OUT/with-dex.apk"
(cd "$OUT/dex" && zip -q -j "$OUT/with-dex.apk" classes*.dex)
(cd "$OUT/lib" && zip -q -r "$OUT/with-dex.apk" lib)
"$BT/zipalign" -f -p 4 "$OUT/with-dex.apk" "$OUT/aligned.apk"
# Signing: bring your own keystore (KEYSTORE=...), or a throwaway debug key is generated on first build.
# Keep the same keystore for every build, or updates won't install over the existing app.
KS=${KEYSTORE:-$HERE/debug.keystore}; KS_PASS=${KS_PASS:-android}; KEY_PASS=${KEY_PASS:-$KS_PASS}; KS_ALIAS=${KS_ALIAS:-androiddebugkey}
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KEY_PASS" -alias "$KS_ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KEY_PASS" --ks-key-alias "$KS_ALIAS" --v2-signing-enabled true --v3-signing-enabled true \
  --out "$HERE/grokbot-face.apk" "$OUT/aligned.apk"
echo "built $HERE/grokbot-face.apk"
