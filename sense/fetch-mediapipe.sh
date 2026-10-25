#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
# Downloads MediaPipe Tasks Vision + models at BUILD time so the app is fully offline at runtime.
# Also patches out the bundle's built-in usage-stats logger (odml.pa.googleapis.com).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); MP=$HERE/mp; VER=${MP_VER:-1.1.0}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$MP/wasm" "$MP/models"
(cd "$TMP" && npm pack "@mediapipe/tasks-vision@$VER" >/dev/null && tar xzf mediapipe-tasks-vision-*.tgz)
cp "$TMP/package/wasm/vision_wasm_internal.js" "$TMP/package/wasm/vision_wasm_internal.wasm" "$MP/wasm/"
cp "$TMP/package/LICENSE" "$MP/LICENSE" 2>/dev/null || true
python3 - "$TMP/package/vision_bundle.mjs" "$MP/vision_bundle.mjs" <<'PY'
import sys
s = open(sys.argv[1]).read()
a = 'constructor(t){this.i=[],this.o=new bh,this.l=t??"",this.h=setInterval(()=>{this.flush()},6e4)}'
assert s.count(a) == 1, 'logger ctor not found - re-check patch for this version'
s = s.replace(a, 'constructor(t){this.i=[],this.o=new bh,this.l="",this.error=Error("usage logging disabled (offline build)")}')
b = '"https://odml.pa.googleapis.com/v1/log"'
assert s.count(b) == 1
s = s.replace(b, '"about:blank"').replace('//# sourceMappingURL=vision_bundle.mjs.map', '')
open(sys.argv[2], 'w').write(s)
PY
B=https://storage.googleapis.com/mediapipe-models
curl -fsSL -o "$MP/models/face_landmarker.task" $B/face_landmarker/face_landmarker/float16/1/face_landmarker.task
curl -fsSL -o "$MP/models/gesture_recognizer.task" $B/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
(cd "$MP" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS)
echo "mediapipe $VER ready in $MP"; cat "$MP/SHA256SUMS"
