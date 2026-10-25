// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// Grok Bot Face v1.4 - on-device camera + mic sensing.
// Privacy: frames and audio are only analysed in memory, frame by frame.
// Nothing is recorded, stored, or sent anywhere (the page CSP and the app's
// request interceptor also block every non-local request).

const BASE = new URL('./', import.meta.url).href;
const CAM_FPS = 12;   // v1.4: 12 Hz is plenty for gaze/presence; filtered + springs fill the gaps

export function init(S) {
  Object.assign(S, {
    ready: true, wanted: false, cam: false, mic: false, delegate: '', err: '', fps: 0,
    faces: [], smile: 0, jaw: 0, roll: 0, blinkL: 0, blinkL2: 0, blinkR: 0,
    gesture: '', gestureScore: 0, hand: null, waveAt: 0,
    micRms: 0, micFloor: 0.002, micEnvS: 0, micEnvF: 0, loud: false, clapAt: 0,
    beat: false, bpm: 0, beatAt: 0, beatSeq: 0, clapSeq: 0, waveSeq: 0,
    wakeSeq: 0, wakeEngine: '', wakePartial: '', wakeLast: '', wakeConf: 0, micNative: false,
  });

  let stream = null, video = null, faceLm = null, gestRec = null, loading = null;
  let camTimer = 0, micTimer = 0, actx = null, analyser = null, tick = 0, lastTs = 0;
  let starting = false;
  const T = () => performance.now() / 1000;

  // ---- detector: a dedicated worker (v1.4) so inference never blocks the animation's main
  // thread; falls back to running MediaPipe on the main thread if the worker can't start.
  let worker = null, workerBusy = false;
  function startWorker() {
    return new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(BASE + 'detect-worker.js', { type: 'module', name: 'grok-detect' }); } catch (e) { reject(e); return; }
      const to = setTimeout(() => { w.terminate(); reject(new Error('worker init timeout')); }, 30000);
      w.onerror = e => { clearTimeout(to); w.terminate(); reject(new Error('worker: ' + (e.message || 'error'))); };
      w.onmessage = ({ data: m }) => {
        if (m.type === 'ready') { clearTimeout(to); S.delegate = 'worker ' + m.delegate; if (m.err) S.err = m.err; w.onmessage = onWorkerMsg; resolve(w); }
        else if (m.type === 'fail') { clearTimeout(to); w.terminate(); reject(new Error(m.err)); }
      };
      // CPU (XNNPACK) by default: in Android WebView the GPU delegate shares the in-process GPU
      // thread with the page compositor, so GPU inference delays frame presentation. ?det=gpu to compare.
      w.postMessage({ type: 'init', delegate: /[?&]det=gpu/.test(location.search) ? 'GPU' : 'CPU' });
    });
  }
  async function loadModels() {
    if (loading) return loading;
    loading = (async () => {
      if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function' && !/[?&]worker=0/.test(location.search)) {
        try { worker = await startWorker(); return; } catch (e) { S.err = 'worker: ' + (e && e.message || e) + ' (main-thread fallback)'; worker = null; }
      }
      const { FilesetResolver, FaceLandmarker, GestureRecognizer } = await import('./mp/vision_bundle.mjs');
      const fileset = await FilesetResolver.forVisionTasks(BASE + 'mp/wasm');
      const mk = async (Cls, file, extra) => {
        for (const delegate of ['GPU', 'CPU']) {
          try {
            const t = await Cls.createFromOptions(fileset, Object.assign({
              baseOptions: { modelAssetPath: BASE + 'mp/models/' + file, delegate }, runningMode: 'VIDEO' }, extra));
            return { t, delegate };
          } catch (e) { if (delegate === 'CPU') throw e; }
        }
      };
      const f = await mk(FaceLandmarker, 'face_landmarker.task', { numFaces: 3, outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      faceLm = f.t; S.delegate = 'main ' + f.delegate;
      try { const g = await mk(GestureRecognizer, 'gesture_recognizer.task', { numHands: 1 }); gestRec = g.t; S.delegate += '+' + g.delegate; }
      catch (e) { S.err = 'gesture: ' + (e && e.message || e); }
    })();
    return loading;
  }

  async function getStream() {
    const v = { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } };
    const a = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return null;
    // In the app the native AudioRecord stream (shared with the wake word) feeds the mic analysis,
    // so the page only asks for video and never opens a second mic.
    const tries = nativeMic() ? [{ video: v }] : [{ video: v, audio: a }, { video: v }, { audio: a }];
    for (const c of tries) {
      try { return await md.getUserMedia(c); } catch (e) { S.err = 'gum: ' + (e && e.name || e); }
    }
    return null;
  }

  function nativeMic() { try { return !!(window.GrokBotFace && GrokBotFace.nativeMic && GrokBotFace.nativeMic()); } catch (e) { return false; } }
  let pollTimer = 0;
  function startNativePoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      let d; try { d = JSON.parse(GrokBotFace.pollMic()); } catch (e) { return; }
      S.mic = !!d.on; S.micNative = true;
      if (d.on) { S.micRms = d.rms; S.micFloor = d.floor; S.micEnvS = d.envS; S.loud = d.loud; S.beat = d.beat; S.bpm = d.bpm; }
      else { S.loud = false; S.beat = false; }
      if (d.clapSeq !== S.clapSeq) { S.clapSeq = d.clapSeq; S.clapAt = T(); }
      if (d.beatSeq !== S.beatSeq) { S.beatSeq = d.beatSeq; S.beatAt = T(); }
      S.wakeSeq = d.wakeSeq; S.wakeEngine = d.engine; S.wakePartial = d.partial; S.wakeLast = d.last; S.wakeConf = d.lastConf;
    }, 50);
  }

  async function start() {
    S.wanted = true;
    if (nativeMic() && !pollTimer && document.visibilityState !== 'hidden') startNativePoll();
    if (stream || starting || document.visibilityState === 'hidden') return;
    starting = true;
    try {
      const st = await getStream();
      if (!st) return;
      if (!S.wanted || document.visibilityState === 'hidden') { st.getTracks().forEach(t => t.stop()); return; }
      stream = st;
      if (st.getVideoTracks().length) {
        video = document.createElement('video');
        video.muted = true; video.playsInline = true; video.setAttribute('playsinline', '');
        video.srcObject = st;
        await video.play().catch(() => {});
        S.cam = true;
        loadModels().then(() => { if (stream) camLoop(); }).catch(e => { S.err = 'models: ' + (e && e.message || e); });
      }
      if (st.getAudioTracks().length) startMic(st);
    } finally { starting = false; }
  }

  function stop() {
    S.wanted = false;
    clearTimeout(camTimer); clearInterval(micTimer); clearInterval(pollTimer); camTimer = micTimer = pollTimer = 0;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    if (video) { video.srcObject = null; video = null; }
    if (actx) { actx.close().catch(() => {}); actx = null; analyser = null; }
    workerBusy = false; tracks = [];
    S.cam = S.mic = false; S.faces = []; S.bright = null; S.loud = false; S.beat = false; S.hand = null;
  }

  // ---------------- camera ----------------
  const waveHist = [];
  let handSeenAt = -9, lumCtx = null;
  let frames = 0, fpsT = 0, sentAt = 0;
  S.detMs = 0; S.mainBlockMs = 0;
  // One Euro filter (Casiez et al.): steady when still, responsive when moving -> no gaze jitter.
  function oneEuro(minCut, beta) {
    let x = null, dx = 0, t = 0;
    const alpha = (cut, dt) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
    return (v, now) => {
      if (x === null) { x = v; t = now; return v; }
      const dt = Math.max(1e-3, now - t); t = now;
      const d = (v - x) / dt; dx += (d - dx) * alpha(1.0, dt);
      x += (v - x) * alpha(minCut + beta * Math.abs(dx), dt);
      return x;
    };
  }
  const mkTrack = () => ({ cx: oneEuro(1.2, 2.0), cy: oneEuro(1.2, 2.0), w: oneEuro(0.8, 1.0), h: oneEuro(0.8, 1.0) });
  let tracks = [];          // [{cx,cy,w,h filters, last:{cx,cy}, jaw, jawAct}]
  const rollF = oneEuro(1.0, 0.8);

  function camLoop() {
    clearTimeout(camTimer);
    const run = () => {
      if (!stream || !video) return;
      const t0 = performance.now();
      if (video.readyState < 2 || !video.videoWidth) { camTimer = setTimeout(run, 100); return; }
      if (worker) {
        if (workerBusy) { camTimer = setTimeout(run, 10); return; }
        workerBusy = true; sentAt = t0; tick++;
        createImageBitmap(video).then(bmp => {
          if (!worker || !stream) { bmp.close(); workerBusy = false; return; }
          const now = T();
          worker.postMessage({ type: 'frame', bmp, ts: performance.now(), hands: now - handSeenAt < 1.2 || tick % 3 === 0, lum: tick % 4 === 0 }, [bmp]);
        }).catch(e => { workerBusy = false; S.err = 'bitmap: ' + (e && e.message || e); camTimer = setTimeout(run, 200); });
        S.mainBlockMs = performance.now() - t0;
        return;                             // next frame is scheduled when the result comes back
      }
      try { processFrameMain(t0); } catch (e) { S.err = 'detect: ' + (e && e.message || e); }
      const spent = performance.now() - t0; S.mainBlockMs = spent;
      // main-thread fallback: keep detection well under the frame budget
      camTimer = setTimeout(run, Math.max(1000 / CAM_FPS - spent, spent * 2, 5));
    };
    run();
  }
  function onWorkerMsg({ data: m }) {
    if (m.type !== 'result') return;
    workerBusy = false;
    if (!stream) return;
    if (m.err) S.err = 'detect: ' + m.err; else applyRaw(m);
    S.detMs = m.ms || 0;
    const spent = performance.now() - sentAt;
    camTimer = setTimeout(camLoopTick, Math.max(1000 / CAM_FPS - spent, 5));
  }
  function camLoopTick() { if (stream && video) camLoop(); }

  function processFrameMain(ms) {
    let ts = Math.max(ms, lastTs + 1); lastTs = ts;
    tick++;
    const r = faceLm.detectForVideo(video, ts);
    const faces = [];
    (r.faceLandmarks || []).forEach((lm, i) => {
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const p of lm) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
      const cats = r.faceBlendshapes && r.faceBlendshapes[i] && r.faceBlendshapes[i].categories || [];
      const bs = {}; for (const c of cats) bs[c.categoryName] = c.score;
      const a = lm[33], b = lm[263];
      faces.push({ x0, y0, x1, y1, jaw: bs.jawOpen || 0, smile: ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2,
        blinkL: bs.eyeBlinkLeft || 0, blinkR: bs.eyeBlinkRight || 0, squint: ((bs.eyeSquintLeft || 0) + (bs.eyeSquintRight || 0)) / 2,
        roll: Math.atan2(b.y - a.y, b.x - a.x) });
    });
    let hand;
    if (gestRec && (T() - handSeenAt < 1.2 || tick % 3 === 0)) {
      const g = gestRec.recognizeForVideo(video, ts + 0.5);
      if (g.landmarks && g.landmarks.length) {
        const lm = g.landmarks[0], top = g.gestures && g.gestures[0] && g.gestures[0][0];
        const gesture = top ? top.categoryName : '';
        hand = { x: lm[9].x, y: lm[9].y, gesture, score: top ? top.score : 0, open: gesture === 'Open_Palm' || fingersOpen(lm) >= 3 };
      } else hand = null;
    }
    let bright;
    if (tick % 4 === 0) {
      try {
        if (!lumCtx) { const c = document.createElement('canvas'); c.width = 16; c.height = 12; lumCtx = c.getContext('2d', { willReadFrequently: true }); }
        lumCtx.drawImage(video, 0, 0, 16, 12);
        const px = lumCtx.getImageData(0, 0, 16, 12).data; let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        bright = sum / (px.length / 4) / 255;
      } catch (e) {}
    }
    applyRaw({ faces, hand, bright });
  }

  // shared post-processing for worker and main-thread results
  function applyRaw(raw) {
    const now = T();
    const faces = raw.faces.map(f => Object.assign(f, { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2, w: f.x1 - f.x0, h: f.y1 - f.y0 }));
    faces.sort((a, b) => b.w * b.h - a.w * a.h);
    // match to previous tracks by position; smooth boxes (One Euro) and mouth activity (EMA of |d jawOpen|)
    const used = new Set(), next = [];
    S.faces = faces.map(f => {
      let tr = null, bd = 0.15;
      for (const q of tracks) { if (used.has(q)) continue; const d = Math.hypot(q.last.cx - f.cx, q.last.cy - f.cy); if (d < bd) { bd = d; tr = q; } }
      if (tr) used.add(tr); else tr = { f: mkTrack(), jaw: f.jaw, jawAct: 0 };
      tr.last = { cx: f.cx, cy: f.cy };
      const jawAct = tr.jawAct + (Math.abs(f.jaw - tr.jaw) - tr.jawAct) * 0.3;
      tr.jaw = f.jaw; tr.jawAct = jawAct; next.push(tr);
      const cx = tr.f.cx(f.cx, now), cy = tr.f.cy(f.cy, now), w = tr.f.w(f.w, now), h = tr.f.h(f.h, now);
      return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, cx, cy, w, h, jaw: f.jaw, jawAct };
    });
    tracks = next;
    if (faces.length) {
      const f = faces[0];
      S.smile = f.smile; S.jaw = f.jaw; S.blinkL = f.blinkL; S.blinkR = f.blinkR; S.squint = f.squint;
      S.roll = rollF(f.roll, now);                   // image coords (unmirrored)
    } else { S.smile = S.jaw = S.blinkL = S.blinkR = 0; S.roll = 0; }

    if (raw.hand !== undefined) {
      const h = raw.hand;
      if (h) {
        S.gesture = h.gesture; S.gestureScore = h.score; S.hand = { x: h.x, y: h.y }; handSeenAt = now;
        waveHist.push({ t: now, x: h.x, open: h.open });
      } else { S.gesture = ''; S.gestureScore = 0; S.hand = null; }
      while (waveHist.length && now - waveHist[0].t > 2.0) waveHist.shift();
      if (detectWave()) { S.waveAt = now; S.waveSeq++; waveHist.length = 0; }
    }
    if (raw.bright !== undefined) S.bright = raw.bright;
    frames++;
    if (now - fpsT >= 1) { S.fps = frames / (now - fpsT); frames = 0; fpsT = now; }
  }

  // fingers extended: tip farther from the wrist than its PIP joint
  function fingersOpen(lm) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let n = 0;
    for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) if (d(lm[tip], lm[0]) > d(lm[pip], lm[0]) * 1.1) n++;
    return n;
  }
  S._detectWave = (hist) => { waveHist.length = 0; waveHist.push(...hist); return detectWave(); };   // for tests

  function detectWave() {
    if (waveHist.length < 5) return false;
    const open = waveHist.filter(h => h.open).length / waveHist.length;
    if (open < 0.5) return false;
    // count direction reversals with real amplitude (> 5% of frame width)
    let rev = 0, dir = 0, hi = waveHist[0].x, lo = hi;
    for (const h of waveHist) {
      const x = h.x;
      if (dir !== -1) { hi = Math.max(hi, x); if (hi - x > 0.05) { if (dir === 1) rev++; dir = -1; lo = x; continue; } }
      if (dir !== 1) { lo = Math.min(lo, x); if (x - lo > 0.05) { if (dir === -1) rev++; dir = 1; hi = x; } }
    }
    return rev >= 2;
  }

  // ---------------- microphone ----------------
  async function startMic(st) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = actx = new AC();
      if (!ctx.audioWorklet) throw new Error('no AudioWorklet');
      await ctx.audioWorklet.addModule(BASE + 'mic-worklet.js');
      if (actx !== ctx || !stream) return;            // stopped meanwhile
      const src = ctx.createMediaStreamSource(new MediaStream(st.getAudioTracks()));
      const node = new AudioWorkletNode(ctx, 'grok-mic', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      const mute = ctx.createGain(); mute.gain.value = 0;   // keeps the graph running; outputs silence
      src.connect(node); node.connect(mute); mute.connect(ctx.destination);
      node.port.onmessage = ({ data: d }) => {
        if (d.ev === 'lvl') { S.micRms = d.rms; S.micFloor = d.floor; S.micEnvS = d.envS; S.loud = d.loud; S.beat = d.beat; S.bpm = d.bpm; }
        else if (d.ev === 'clap') { S.clapAt = T(); S.clapSeq++; }
        else if (d.ev === 'beat') { S.beatAt = T(); S.beatSeq++; S.bpm = d.bpm; }
      };
      analyser = node;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      S.mic = true;
      micTimer = setInterval(() => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); }, 2000);
    } catch (e) { S.err = 'mic: ' + (e && e.message || e); S.mic = false; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { const w = S.wanted; stop(); S.wanted = w; }
    else if (S.wanted) start();
  });
  addEventListener('pointerdown', () => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); });

  S.start = start; S.stop = stop;
  return S;
}
