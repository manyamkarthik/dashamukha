// Sound effects, synthesized with Web Audio: no files, nothing to download.
// Off until the viewer turns it on (browsers block audio before a click anyway).
export function createSfx() {
  let ac = null;
  let master = null;
  let on = false;
  const last = {};

  function ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) {
      ac = new AC();
      master = ac.createDynamicsCompressor();
      const g = ac.createGain();
      g.gain.value = 0.55;
      master.connect(g);
      g.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function out(pan) {
    const g = ac.createGain();
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
    return g;
  }
  function env(g, t0, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }
  function noise(dur) {
    const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource();
    s.buffer = b;
    return s;
  }
  function tone(type, f0, f1, t0, dur, peak, pan, attack = 0.005) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = out(pan);
    env(g, t0, attack, peak, dur);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + attack + dur + 0.05);
  }
  function hiss(t0, dur, peak, pan, type, f0, f1, q = 1) {
    const n = noise(dur + 0.1);
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = out(pan);
    env(g, t0, 0.01, peak, dur);
    n.connect(f).connect(g);
    n.start(t0);
    n.stop(t0 + dur + 0.1);
  }

  const S = {
    whoosh: (p, v, t = ac.currentTime) => { hiss(t, 0.42, 0.22 * v, p, 'bandpass', 280, 2600, 1.4); },
    swish: (p, v, t = ac.currentTime) => { hiss(t, 0.5, 0.06 * v, p, 'bandpass', 1800, 4200, 3); },
    hit: (p, v, t = ac.currentTime) => { tone('sine', 150, 42, t, 0.28, 0.55 * v, p); hiss(t, 0.12, 0.25 * v, p, 'lowpass', 1400, 300); },
    chime: (p, v, t = ac.currentTime) => { tone('sine', 880, 880, t, 0.7, 0.09 * v, p); tone('sine', 1318, 1318, t + 0.06, 0.6, 0.06 * v, p); },
    slice: (p, v, t = ac.currentTime) => { hiss(t, 0.16, 0.3 * v, p, 'highpass', 3000, 6000); tone('sawtooth', 900, 160, t, 0.22, 0.08 * v, p); },
    thud: (p, v, t = ac.currentTime) => { tone('sine', 95, 48, t, 0.16, 0.35 * v, p); },
    grow: (p, v, t = ac.currentTime) => { tone('triangle', 220, 700, t, 0.55, 0.12 * v, p, 0.04); tone('sine', 1320, 1320, t + 0.45, 0.8, 0.07 * v, p); },
    pop: (p, v, t = ac.currentTime) => { tone('sine', 520, 880, t, 0.09, 0.08 * v, p); },
    boom: (p, v, t = ac.currentTime) => { tone('sine', 70, 34, t, 0.9, 0.45 * v, 0); hiss(t, 0.5, 0.06 * v, 0, 'lowpass', 400, 120); },
    gong: (p, v, t = ac.currentTime) => {
      for (const [f, a, d] of [[62, 0.5, 4.2], [93.4, 0.3, 3.4], [131, 0.22, 2.8], [176.5, 0.14, 2.2], [265, 0.08, 1.6], [352, 0.05, 1.2]]) tone('sine', f, f * 0.995, t, d, a * v, 0, 0.01);
      hiss(t, 0.25, 0.18 * v, 0, 'bandpass', 900, 500, 0.8);
    },
  };

  // Render a list of sounds ({name, pan, v, time} with time in seconds) into a
  // 16-bit stereo WAV, without playing anything. Used to give the demo video sound.
  async function renderWav(events, duration, sampleRate = 48000) {
    const saved = [ac, master];
    const off = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    ac = off;
    master = off.createDynamicsCompressor();
    const g = off.createGain(); g.gain.value = 0.55; master.connect(g); g.connect(off.destination);
    try {
      for (const e of events) if (S[e.name] && e.time >= 0 && e.time < duration) S[e.name](Math.max(-1, Math.min(1, e.pan)), Math.max(0.05, Math.min(1.5, e.v)), e.time);
    } finally { [ac, master] = saved; }
    const buf = await off.startRendering();
    const n = buf.length; const L = buf.getChannelData(0); const R = buf.getChannelData(1);
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sampleRate, true); out.setUint32(28, sampleRate * 4, true);
    out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    return new Uint8Array(out.buffer);
  }

  return {
    renderWav,
    get on() { return on; },
    set(value) { on = Boolean(value); if (on) ensure(); },
    play(name, pan = 0, v = 1) {
      if (!S[name]) return;
      // Ten heads can fire at once: keep each sound from stacking into noise.
      const now = performance.now();
      if (now - (last[name] || 0) < 45) return;
      last[name] = now;
      // The demo recorder (scripts/record-demo.mjs) collects every sound with its time.
      if (Array.isArray(window.__sfxLog)) window.__sfxLog.push({ name, pan, v, at: Date.now() });
      if (!on || !ensure()) return;
      try { S[name](Math.max(-1, Math.min(1, pan)), Math.max(0.05, Math.min(1.5, v))); } catch { /* audio is a nicety */ }
    },
  };
}
