#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Build-time downloads for the wake word (bundled; nothing is downloaded at runtime).
set -euo pipefail
cd "$(dirname "$0")"
[ -f vosk-android-0.3.75.aar ] || curl -fsSLO https://repo1.maven.org/maven2/com/alphacephei/vosk-android/0.3.75/vosk-android-0.3.75.aar
[ -f jna-5.18.1.aar ] || curl -fsSLO https://repo1.maven.org/maven2/net/java/dev/jna/jna/5.18.1/jna-5.18.1.aar
if [ ! -d vosk-model-small-en-us-0.15 ]; then
  curl -fsSLO https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
  unzip -q vosk-model-small-en-us-0.15.zip && rm vosk-model-small-en-us-0.15.zip
fi
sha256sum vosk-android-0.3.75.aar jna-5.18.1.aar > SHA256SUMS
