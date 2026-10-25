# Third-party notices

This repository's own code is MIT licensed (see [LICENSE](LICENSE)). **No third-party code or model files are committed here.** The components below are downloaded at build time by `android/vendor/fetch-vendor.sh` and `sense/fetch-mediapipe.sh` and bundled into the APK you build. Each stays under its own license; the MIT license does not apply to them. If you redistribute a built APK, you must follow these licenses too (for Apache-2.0, include its license text and any NOTICE files).

| Component | Version | Used for | License | Source |
|---|---|---|---|---|
| Vosk Android (`com.alphacephei:vosk-android`) | 0.3.75 | Offline "hey Grok Bot" wake word (speech recognition library + `libvosk.so`) | Apache-2.0 | https://github.com/alphacep/vosk-api · https://repo1.maven.org/maven2/com/alphacephei/vosk-android/0.3.75/ |
| Vosk model `vosk-model-small-en-us-0.15` | 0.15 | English acoustic/language model for the wake word | Apache-2.0 (Copyright 2020 Alpha Cephei Inc) | https://alphacephei.com/vosk/models |
| JNA (`net.java.dev.jna:jna`, Android AAR) | 5.18.1 | Native bridge Vosk depends on (`libjnidispatch.so`) | Dual-licensed: Apache-2.0 **or** LGPL-2.1-or-later (used here under Apache-2.0) | https://github.com/java-native-access/jna · https://repo1.maven.org/maven2/net/java/dev/jna/jna/5.18.1/ |
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) | 1.1.0 (`MP_VER`) | On-device face landmarks and hand gestures (JS bundle + WebAssembly, includes TensorFlow Lite runtime) | Apache-2.0 | https://github.com/google-ai-edge/mediapipe · https://www.npmjs.com/package/@mediapipe/tasks-vision |
| MediaPipe Face Landmarker model (`face_landmarker.task`, float16 v1) | 1 | Faces, smiles, blinks, gaze | Apache-2.0 (see the model card) | https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker · https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task |
| MediaPipe Gesture Recognizer model (`gesture_recognizer.task`, float16 v1) | 1 | Waves, thumbs-up and other hand gestures | Apache-2.0 (see the model card) | https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer · https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task |

Notes:
- `sense/fetch-mediapipe.sh` makes one modification to the MediaPipe JS bundle: it disables the built-in usage-stats logger (`odml.pa.googleapis.com`) so the app makes no telemetry calls. It also copies MediaPipe's `LICENSE` file next to the bundle (`sense/mp/LICENSE`) when the package ships one.
- **Fonts:** none are bundled. The app draws text with the device's system fonts (`system-ui`, Roboto on Android).
- **AndroidX / Google Play services:** not used. The app links only the Android framework (`android.jar`, API 34) plus the libraries above.
- **Build tools** (JDK 17, Android SDK build-tools 35 and platform 34: aapt2, d8, zipalign, apksigner) are used to build but are not part of this repository or the APK's code. They are covered by their own licenses (for example the Android SDK License Agreement).
- **Dev/test only, not bundled:** the `tests/` scripts use `playwright-core` (Apache-2.0, https://github.com/microsoft/playwright) with a local Chrome.
- **Usage-feed Worker services (not bundled):** the Worker in `usage-feed/` calls the Cursor Admin API, Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`, under the Llama 3.1 Community License, fallback `@cf/zai-org/glm-4.7-flash`), and public RSS/Atom feeds and changelogs (TechCrunch, NYT, WSJ, The Verge, Google News, Bing News, GitHub releases, and others). Headlines and summaries belong to their publishers. Your use of those services is governed by their own terms.
- "Grok", "Cursor", "Claude Code", "Codex", "Microsoft", "AWS" and the other product names shown in the app are trademarks of their owners. This is an unofficial personal project, not affiliated with or endorsed by any of them.
