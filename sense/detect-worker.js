// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// Grok Bot Face v1.4 (+v1.12 finger mask, v1.12.2 hand box + confidence) - MediaPipe detection off the main thread (dedicated module worker).
// Receives one downscaled camera frame at a time as a transferred ImageBitmap, returns only a
// few numbers (face boxes, blendshape scores, hand point, brightness). Frames are closed right
// after use; nothing is kept, stored, or sent anywhere.
const BASE = new URL('./', import.meta.url).href;
// The wasm loader is a UMD script; module workers have no importScripts, so MediaPipe falls back
// to self.import(url). Evaluate the (bundled, same-origin) loader in global scope instead.
self.import = async url => {
  const src = await (await fetch(url, { credentials: 'omit' })).text();
  (0, eval)(src + '\n;self.ModuleFactory = ModuleFactory;');
};
let faceLm = null, gestRec = null, lum = null, lastTs = 0, delegate = '';

async function init(pref) {
  const order = pref === 'GPU' ? ['GPU', 'CPU'] : ['CPU', 'GPU'];
  const { FilesetResolver, FaceLandmarker, GestureRecognizer } = await import(BASE + 'mp/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks(BASE + 'mp/wasm');
  const mk = async (Cls, file, extra) => {
    for (const d of order) {
      try {
        const t = await Cls.createFromOptions(fileset, Object.assign({
          baseOptions: { modelAssetPath: BASE + 'mp/models/' + file, delegate: d }, runningMode: 'VIDEO' }, extra));
        return { t, d };
      } catch (e) { if (d === order[1]) throw e; }
    }
  };
  const f = await mk(FaceLandmarker, 'face_landmarker.task', { numFaces: 3, outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  faceLm = f.t; delegate = f.d;
  let err = '';
  try { const g = await mk(GestureRecognizer, 'gesture_recognizer.task', { numHands: 1 }); gestRec = g.t; delegate += '+' + g.d; }
  catch (e) { err = 'gesture: ' + (e && e.message || e); }
  return { delegate, err };
}

function fingersOpen(lm) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let n = 0;
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) if (d(lm[tip], lm[0]) > d(lm[pip], lm[0]) * 1.1) n++;
  return n;
}
// v1.12: per-finger extended bits (index=1, middle=2, ring=4, pinky=8) for the rock-paper-scissors fallback
function fingerMask(lm) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let m = 0;
  [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(([tip, pip], i) => { if (d(lm[tip], lm[0]) > d(lm[pip], lm[0]) * 1.1) m |= 1 << i; });
  return m;
}

function detect(bmp, ms, wantHands, wantLum) {
  const t0 = performance.now();
  const ts = Math.max(ms, lastTs + 1); lastTs = ts;
  const r = faceLm.detectForVideo(bmp, ts);
  const faces = [];
  (r.faceLandmarks || []).forEach((lm, i) => {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const p of lm) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    const cats = r.faceBlendshapes && r.faceBlendshapes[i] && r.faceBlendshapes[i].categories || [];
    const bs = {}; for (const c of cats) bs[c.categoryName] = c.score;
    const a = lm[33], b = lm[263];
    faces.push({ x0, y0, x1, y1, jaw: bs.jawOpen || 0,
      smile: ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2, blinkL: bs.eyeBlinkLeft || 0, blinkR: bs.eyeBlinkRight || 0,
      squint: ((bs.eyeSquintLeft || 0) + (bs.eyeSquintRight || 0)) / 2, roll: Math.atan2(b.y - a.y, b.x - a.x) });
  });
  let hand;                                   // undefined = not run this frame
  if (gestRec && wantHands) {
    const g = gestRec.recognizeForVideo(bmp, ts + 0.5);
    if (g.landmarks && g.landmarks.length) {
      const lm = g.landmarks[0], top = g.gestures && g.gestures[0] && g.gestures[0][0];
      let bx0 = 1, by0 = 1, bx1 = 0, by1 = 0; for (const p of lm) { if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x; if (p.y < by0) by0 = p.y; if (p.y > by1) by1 = p.y; }
      const hd = g.handedness && g.handedness[0] && g.handedness[0][0];
      const gesture = top ? top.categoryName : '';
      hand = { x: lm[9].x, y: lm[9].y, bw: bx1 - bx0, bh: by1 - by0, bcx: (bx0 + bx1) / 2, bcy: (by0 + by1) / 2, conf: hd ? hd.score : 0, gesture, score: top ? top.score : 0, open: gesture === 'Open_Palm' || fingersOpen(lm) >= 3, mask: fingerMask(lm) };
    } else hand = null;
  }
  let bright;
  if (wantLum) {
    if (!lum) lum = new OffscreenCanvas(16, 12).getContext('2d', { willReadFrequently: true });
    lum.drawImage(bmp, 0, 0, 16, 12);
    const px = lum.getImageData(0, 0, 16, 12).data; let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    bright = sum / (px.length / 4) / 255;
  }
  return { faces, hand, bright, ms: performance.now() - t0 };
}

self.onmessage = async ({ data: m }) => {
  if (m.type === 'init') {
    try { const r = await init(m.delegate); self.postMessage({ type: 'ready', delegate: r.delegate, err: r.err }); }
    catch (e) { self.postMessage({ type: 'fail', err: String(e && e.message || e) }); }
  } else if (m.type === 'frame') {
    let out;
    try { out = detect(m.bmp, m.ts, m.hands, m.lum); out.type = 'result'; }
    catch (e) { out = { type: 'result', err: String(e && e.message || e), faces: [] }; }
    finally { try { m.bmp.close(); } catch (e) {} }
    self.postMessage(out);
  }
};
