// The council as a galaxy: Ravana's core burns at the centre, the ten heads sit
// on pedestals around it in a ring, glowing orbs on springs. Arguments fly between
// heads as comets, hit heads get knocked off their pedestals and spring back, the
// most-attacked heads are sliced off and grow back, and the verdict forms in the
// core. A small spring integrator and 2D canvas, nothing else.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

const GOLD = '#F2C25A';
const GOLD_HI = '#FFF1CC';
const RED = '#FF5A47';
const TILT = 0.36; // how flat the orbits look: the galaxy is seen from above, at an angle

// Seats around the ring, clockwise from the top.
const SEATS = ['mada', 'krodha', 'lobha', 'moha', 'bhaya', 'ghrina', 'ahamkara', 'kama', 'buddhi', 'matsarya'];

function hexRgb(hex) {
  const h = String(hex || '#888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, t) => { const x = hexRgb(a); const y = hexRgb(b); return `#${x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join('')}`; };
const rgba = (hex, a) => `rgba(${hexRgb(hex).join(',')},${clamp(a, 0, 1)})`;

// A damped spring step for one axis.
const spring = (x, v, target, k, c, dt) => { const a = k * (target - x) - c * v; v += a * dt; return [x + v * dt, v]; };

// Each head's icon, drawn in a unit circle as glowing line art.
const dot = (c, x, y, r) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); };
const ICON = {
  mada(c) { // pride: a crown
    c.beginPath(); c.moveTo(-0.7, 0.4); c.lineTo(-0.8, -0.42); c.lineTo(-0.38, -0.02); c.lineTo(0, -0.58); c.lineTo(0.38, -0.02); c.lineTo(0.8, -0.42); c.lineTo(0.7, 0.4); c.closePath();
    c.moveTo(-0.7, 0.64); c.lineTo(0.7, 0.64); c.stroke();
    c.beginPath(); dot(c, -0.8, -0.5, 0.08); dot(c, 0, -0.68, 0.08); dot(c, 0.8, -0.5, 0.08); c.fill();
  },
  krodha(c) { // anger: a warning
    c.beginPath(); c.moveTo(0, -0.72); c.lineTo(0.82, 0.64); c.lineTo(-0.82, 0.64); c.closePath(); c.moveTo(0, -0.18); c.lineTo(0, 0.18); c.stroke();
    c.beginPath(); dot(c, 0, 0.4, 0.075); c.fill();
  },
  lobha(c) { // greed: a gem
    c.beginPath(); c.moveTo(0, -0.84); c.lineTo(0.64, 0); c.lineTo(0, 0.84); c.lineTo(-0.64, 0); c.closePath();
    c.moveTo(-0.64, 0); c.lineTo(0.64, 0); c.moveTo(0, -0.84); c.lineTo(0, 0.84); c.stroke();
  },
  moha(c) { // attachment: a spiral
    c.beginPath(); for (let a = 0; a <= TAU * 2.25; a += 0.08) { const r = 0.06 + (a / (TAU * 2.25)) * 0.74; const x = Math.cos(a) * r; const y = Math.sin(a) * r; a ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  },
  bhaya(c) { // fear: a shield
    c.beginPath(); c.moveTo(0, -0.82); c.bezierCurveTo(0.3, -0.62, 0.55, -0.6, 0.7, -0.62); c.lineTo(0.7, -0.02); c.bezierCurveTo(0.7, 0.45, 0.38, 0.7, 0, 0.86);
    c.bezierCurveTo(-0.38, 0.7, -0.7, 0.45, -0.7, -0.02); c.lineTo(-0.7, -0.62); c.bezierCurveTo(-0.55, -0.6, -0.3, -0.62, 0, -0.82); c.closePath();
    c.moveTo(0, -0.3); c.quadraticCurveTo(0.04, 0.04, 0.3, 0.06); c.quadraticCurveTo(0.04, 0.08, 0, 0.42); c.quadraticCurveTo(-0.04, 0.08, -0.3, 0.06); c.quadraticCurveTo(-0.04, 0.04, 0, -0.3); c.stroke();
  },
  ghrina(c) { // aversion: refused
    c.beginPath(); c.arc(0, 0, 0.72, 0, TAU); c.moveTo(-0.5, -0.5); c.lineTo(0.5, 0.5); c.stroke();
  },
  ahamkara(c) { // ego: a star
    c.beginPath(); c.moveTo(0, -0.84); c.quadraticCurveTo(0.1, -0.1, 0.84, 0); c.quadraticCurveTo(0.1, 0.1, 0, 0.84); c.quadraticCurveTo(-0.1, 0.1, -0.84, 0); c.quadraticCurveTo(-0.1, -0.1, 0, -0.84); c.closePath(); c.stroke();
  },
  kama(c) { // desire: a heart
    c.beginPath(); c.moveTo(0, 0.72); c.bezierCurveTo(-0.95, 0.08, -0.72, -0.82, 0, -0.34); c.bezierCurveTo(0.72, -0.82, 0.95, 0.08, 0, 0.72); c.closePath(); c.stroke();
  },
  buddhi(c) { // intellect: a brain
    c.beginPath();
    for (const s of [-1, 1]) {
      c.moveTo(s * 0.06, -0.62); c.bezierCurveTo(s * 0.32, -0.84, s * 0.74, -0.66, s * 0.7, -0.28);
      c.bezierCurveTo(s * 0.92, -0.06, s * 0.84, 0.36, s * 0.56, 0.44); c.bezierCurveTo(s * 0.5, 0.72, s * 0.2, 0.78, s * 0.06, 0.6); c.lineTo(s * 0.06, -0.62);
      c.moveTo(s * 0.06, -0.22); c.bezierCurveTo(s * 0.26, -0.22, s * 0.3, -0.42, s * 0.46, -0.44);
      c.moveTo(s * 0.06, 0.16); c.bezierCurveTo(s * 0.3, 0.1, s * 0.36, 0.3, s * 0.56, 0.24);
      c.moveTo(s * 0.7, -0.28); c.bezierCurveTo(s * 0.54, -0.18, s * 0.48, -0.02, s * 0.6, 0.04);
    }
    c.stroke();
  },
  matsarya(c) { // envy: the scales of comparison
    c.beginPath(); c.moveTo(0, -0.62); c.lineTo(0, 0.66); c.moveTo(-0.36, 0.66); c.lineTo(0.36, 0.66); c.moveTo(-0.68, -0.48); c.lineTo(0.68, -0.48);
    for (const s of [-1, 1]) {
      c.moveTo(s * 0.68, -0.48); c.lineTo(s * 0.86, 0.06); c.moveTo(s * 0.68, -0.48); c.lineTo(s * 0.5, 0.06);
      c.moveTo(s * 0.9, 0.06); c.quadraticCurveTo(s * 0.68, 0.34, s * 0.46, 0.06); c.closePath();
    }
    c.stroke(); c.beginPath(); dot(c, 0, -0.7, 0.08); c.fill();
  },
};
const fallbackIcon = (c) => { c.beginPath(); c.arc(0, 0, 0.6, 0, TAU); c.stroke(); };

// One glossy orb with its icon, drawn around (0,0) with radius R on context c.
// k is the pixel scale, so the icon's glow stays the same at any resolution.
function paintOrb(c, col, R, icon, { glow = true, k = 1 } = {}) {
  if (glow) {
    const g = c.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.62);
    g.addColorStop(0, rgba(col, 0.32)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.62, 0, TAU); c.fill();
  }
  const b = c.createRadialGradient(0, R * 0.12, R * 0.05, 0, 0, R);
  b.addColorStop(0, mix(col, '#04050b', 0.62)); b.addColorStop(0.6, mix(col, '#04050b', 0.3)); b.addColorStop(0.88, col); b.addColorStop(1, mix(col, '#ffffff', 0.45));
  c.fillStyle = b; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  // Glass: a soft highlight across the top.
  const hl = c.createLinearGradient(0, -R * 0.92, 0, -R * 0.18);
  hl.addColorStop(0, 'rgba(255,255,255,.42)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hl; c.beginPath(); c.ellipse(0, -R * 0.5, R * 0.64, R * 0.36, 0, 0, TAU); c.fill();
  c.strokeStyle = rgba(mix(col, '#ffffff', 0.6), 0.9); c.lineWidth = Math.max(1, R * 0.035);
  c.beginPath(); c.arc(0, 0, R * 0.985, 0, TAU); c.stroke();
  if (!icon) return;
  const sc = R * 0.44; const ink = mix(col, '#ffffff', 0.9);
  c.save();
  c.scale(sc, sc);
  c.lineWidth = Math.max(1.2, R * 0.075) / sc; c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = ink; c.fillStyle = ink;
  c.shadowColor = mix(col, '#ffffff', 0.35); c.shadowBlur = R * 0.32 * k;
  icon(c); icon(c);
  c.restore();
}

export function createStage(canvas, heads, { onFrame, onHeadClick, onSfx, reducedMotion = false, ravanaFrames } = {}) {
  const ctx = canvas.getContext('2d');
  const seatOf = (id, i) => { const s = SEATS.indexOf(id); return s >= 0 ? s : i; };
  const H_ = heads.map((h, i) => ({
    id: h.id, i, seat: seatOf(h.id, i), name: h.name, tint: h.tint, icon: ICON[h.id] || fallbackIcon,
    rest: { x: 0, y: 0 }, ped: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, dep: 1, R0: 30,
    p: { x: 0, y: 0 }, v: { x: 0, y: 0 }, m: { x: 0, y: 0 }, mv: { x: 0, y: 0 },
    s: 1, sv: 0, tilt: 0, tv: 0, look: { x: 0, y: 0 },
    talk: 0, voice: 0, lit: 0,
    state: null, flash: 0, hits: 0, dim: 0, severed: false, regrown: false, err: false, reborn: 0,
    wander: { at: 0, x: 0, y: 0 }, img: loadFrames(h.frames), sprite: null,
  }));
  const byId = Object.fromEntries(H_.map((h) => [h.id, h]));
  let W = 0; let H = 0; let dpr = 1; let headR = 30; let cx = 0; let narrow = false;
  let ring = { y: 0, rx: 0, ry: 0 };
  let core = { x: 0, y: 0, r: 40, glow: 0, talk: 0, spin: 0, spinV: 0.25 };
  let stars = null; let arms = null; let armR = 0; let twinkles = [];
  const parts = []; const shots = []; const rings = []; const drops = []; const slashes = [];
  const links = []; const flows = []; let influence = {}; let dissent = null; let endT = 0;
  let shake = 0; let phase = null; let spot = null; let aimAt = {}; let ended = null;
  let pointer = null; let pointerAt = 0; let grab = null; let hover = null;
  let last = performance.now(); let t = 0; let visible = true;
  let greySprite = null;
  const api = { instant: false };
  const ravanaImg = loadFrames(ravanaFrames || {});

  function loadFrames(frames = {}) {
    if (!frames.base) return null;
    const out = {};
    for (const k of ['base', 'talk']) if (frames[k]) { const im = new Image(); im.src = frames[k]; out[k] = im; }
    return out;
  }

  /* ------------------------------------------------------------ sprites */
  // Orbs are drawn once per size into offscreen canvases, then stamped each frame.
  function sprite(col, icon, R) {
    const k = dpr; const S = Math.ceil(R * 3.4 * k);
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d'); x.scale(k, k); x.translate(R * 1.7, R * 1.7);
    paintOrb(x, col, R, icon, { k });
    return { c, R };
  }
  function stamp(sp, R) { ctx.drawImage(sp.c, -R * 1.7, -R * 1.7, R * 3.4, R * 3.4); }

  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  // Star colours by temperature, from hot blue to cool orange, weighted like a real sky.
  const STAR_COLS = [['155,176,255', 0.06], ['170,191,255', 0.1], ['202,215,255', 0.16], ['248,247,255', 0.3], ['255,244,234', 0.2], ['255,222,180', 0.12], ['255,204,140', 0.06]];
  const starCol = () => { let r = Math.random(); for (const [c, w] of STAR_COLS) { if ((r -= w) <= 0) return c; } return STAR_COLS[3][0]; };

  // The sky: faint dust clouds and a field of stars, drawn once at full resolution.
  function buildStars() {
    const c = canvasOf(W * dpr, H * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    // Dust: a few octaves of soft noise, upscaled from tiny canvases so it blurs for free.
    for (const [cell, a] of [[90, 0.05], [40, 0.035]]) {
      const n = canvasOf(W / cell + 2, H / cell + 2); const nx = n.getContext('2d');
      for (let i = 0; i < n.width; i++) for (let j = 0; j < n.height; j++) {
        const warm = Math.random() < 0.45;
        nx.fillStyle = warm ? `rgba(120,96,78,${Math.random() * a * 2})` : `rgba(70,86,120,${Math.random() * a * 2})`;
        nx.fillRect(i, j, 1, 1);
      }
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(n, -cell, -cell, n.width * cell, n.height * cell);
    }
    const count = Math.round((W * H) / (narrow ? 900 : 1100));
    for (let i = 0; i < count; i++) {
      const bright = Math.random() < 0.025;
      const r = bright ? rnd(0.9, 1.4) : Math.pow(Math.random(), 2.2) * 0.9 + 0.25;
      const px = rnd(0, W); const py = rnd(0, H); const col = starCol();
      if (bright) {
        const g = x.createRadialGradient(px, py, 0, px, py, r * 5);
        g.addColorStop(0, `rgba(${col},.5)`); g.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = g; x.beginPath(); x.arc(px, py, r * 5, 0, TAU); x.fill();
      }
      x.fillStyle = `rgba(${col},${bright ? 0.95 : rnd(0.2, 0.75)})`;
      x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
    }
    stars = c;
    twinkles = Array.from({ length: narrow ? 10 : 18 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.6, 1.1), f: rnd(0, 6), s: rnd(0.6, 1.6), col: starCol() }));
  }

  // A spiral galaxy, face-on: tens of thousands of stars along two arms, a warm
  // bulge, dust lanes cut out of the disc and a few red star-forming knots. The
  // frame squashes and turns it, so it reads as seen from an angle.
  function buildArms() {
    armR = Math.max(W, H) * (narrow ? 0.9 : 0.6);
    const S = Math.ceil(armR * 2);
    const c = canvasOf(S, S);
    const x = c.getContext('2d'); x.translate(armR, armR);
    const disc = (r0, stops) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, r0); for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill(); };
    disc(armR, [[0, 'rgba(210,212,225,.16)'], [0.4, 'rgba(165,175,200,.07)'], [1, 'rgba(140,150,180,0)']]);
    x.globalCompositeOperation = 'lighter';
    const pitch = 0.34; const r0 = armR * 0.09;
    const armAngle = (r) => Math.log(Math.max(r, r0) / r0) / pitch;
    // Gas and unresolved starlight: soft blobs along each arm give the arms their body.
    for (let arm = 0; arm < 2; arm++) {
      for (let r = armR * 0.08; r < armR * 0.95; r += armR * 0.004) {
        const u = r / armR;
        for (let k = 0; k < 3; k++) {
          const a = armAngle(r) + arm * Math.PI + gauss() * (0.07 + u * 0.08);
          const rr = r * (1 + gauss() * 0.03); const px = Math.cos(a) * rr; const py = Math.sin(a) * rr;
          const rad = armR * rnd(0.015, 0.045) * (0.6 + u);
          const col = u < 0.2 ? '255,226,190' : '196,210,240';
          const g = x.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, `rgba(${col},${(u < 0.2 ? 0.025 : 0.05) * Math.pow(1 - u, 0.8)})`); g.addColorStop(1, `rgba(${col},0)`);
          x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, TAU); x.fill();
        }
      }
    }
    // Resolved stars: dense in the arms, sparse between them.
    const N = narrow ? 9000 : 16000;
    for (let i = 0; i < N; i++) {
      const field = Math.random() < 0.25;
      const r = Math.min(armR * 0.98, -Math.log(1 - Math.random() * 0.97) * armR * 0.3);
      const u = r / armR;
      const a = field ? rnd(0, TAU) : armAngle(r) + (i % 2) * Math.PI + gauss() * (0.06 + u * 0.1);
      const rr = r * (1 + gauss() * 0.03);
      const col = u < 0.16 ? (Math.random() < 0.8 ? '255,228,190' : '255,244,230') : (Math.random() < 0.62 ? '210,222,255' : Math.random() < 0.7 ? '246,246,255' : '255,232,200');
      x.fillStyle = `rgba(${col},${rnd(0.1, 0.6) * Math.pow(1 - u, 0.5) * (field ? 0.4 : 1)})`;
      const sz = Math.random() < 0.015 ? 1.6 : rnd(0.5, 1.05);
      x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr, sz * 0.6, 0, TAU); x.fill();
    }
    // Star-forming knots: sparse, small, faintly red.
    for (let i = 0; i < (narrow ? 50 : 90); i++) {
      const r = rnd(armR * 0.18, armR * 0.75); const a = armAngle(r) + (i % 2) * Math.PI + gauss() * 0.12;
      const px = Math.cos(a) * r; const py = Math.sin(a) * r; const rad = rnd(1.2, 3);
      const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,150,150,.32)'); g.addColorStop(1, 'rgba(255,150,150,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, TAU); x.fill();
    }
    // Bulge.
    disc(armR * 0.3, [[0, 'rgba(255,236,205,.32)'], [0.15, 'rgba(250,215,170,.16)'], [0.45, 'rgba(230,195,150,.06)'], [1, 'rgba(220,180,140,0)']]);
    // Dust lanes: carved out along the inner edge of each arm.
    x.globalCompositeOperation = 'destination-out';
    x.lineCap = 'round';
    for (let arm = 0; arm < 2; arm++) {
      for (let r = armR * 0.1; r < armR * 0.8; r += armR * 0.006) {
        const a = armAngle(r) + arm * Math.PI - 0.16 + gauss() * 0.025; const a2 = armAngle(r + armR * 0.008) + arm * Math.PI - 0.16;
        x.strokeStyle = `rgba(0,0,0,${0.32 * (1 - r / armR)})`; x.lineWidth = armR * rnd(0.006, 0.016);
        x.beginPath(); x.moveTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a2) * (r + armR * 0.008), Math.sin(a2) * (r + armR * 0.008)); x.stroke();
      }
    }
    // A soft glow: the same picture, shrunk and blown back up.
    const sm = canvasOf(S / 10, S / 10); const sx = sm.getContext('2d');
    sx.imageSmoothingQuality = 'high'; sx.drawImage(c, 0, 0, sm.width, sm.height);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.45; x.imageSmoothingQuality = 'high';
    x.drawImage(sm, -armR, -armR, S, S);
    arms = c;
  }

  /* ------------------------------------------------------------ layout */
  function resize() {
    W = canvas.clientWidth || canvas.parentElement.clientWidth;
    narrow = W < 720;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Phones keep a strip at the bottom free for the docked headline card.
    const reserve = narrow ? 74 : 48;
    if (narrow) {
      H = Math.round(clamp(W * 1.3 + 70, 480, 660));
      headR = clamp(W * 0.062, 15, 26);
    } else {
      H = Math.round(clamp(W * 0.58, 420, 680));
      headR = clamp(Math.min(W * 0.034, H * 0.06), 18, 40);
    }
    canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cx = W / 2;
    const ry = Math.max(80, (H - reserve - 16 - 3.0 * headR) / 2);
    ring = { y: 16 + 1.64 * headR + ry, rx: narrow ? W * 0.38 : Math.min(W * 0.4, 520), ry };
    // A portrait of Ravana needs more room than the star mark.
    const coreR = (narrow ? clamp(W * 0.085, 26, 40) : clamp(Math.min(W, H) * 0.085, 34, 62)) * (ravanaFrames?.base ? 1.35 : 1);
    core = { ...core, x: cx, y: ring.y, r: coreR };
    const n = H_.length;
    for (const h of H_) {
      const th = (h.seat / n) * TAU;
      h.ped = { x: cx + Math.sin(th) * ring.rx, y: ring.y - Math.cos(th) * ring.ry };
      h.dep = 0.82 + 0.28 * ((h.ped.y - (ring.y - ring.ry)) / (2 * ring.ry));
      h.R0 = headR * h.dep;
      h.rest = { x: h.ped.x, y: h.ped.y - h.R0 * 1.05 };
      const ax = h.rest.x - cx; const ay = h.rest.y - core.y; const ad = Math.hypot(ax, ay) || 1;
      h.anchor = { x: cx + (ax / ad) * coreR * 0.98, y: core.y + (ay / ad) * coreR * 0.98 };
      if (!h.p.x) { h.p = { ...h.rest }; h.m = mid(h); }
      h.sprite = sprite(h.tint, h.icon, h.R0 * 1.35);
    }
    greySprite = null;
    buildStars();
    buildArms();
  }
  const mid = (h) => ({ x: lerp(h.anchor.x, h.p.x, 0.5), y: lerp(h.anchor.y, h.p.y, 0.5) + 5 });
  const stumpOf = (h) => ({ x: h.ped.x, y: h.ped.y - h.R0 * 0.1 });
  const radius = (h) => h.R0 * h.s;

  /* ------------------------------------------------------------ helpers */
  function burst(x, y, color, n, speed = 260, size = 2.2, life = 0.7, streak = false) {
    if (reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && parts.length < 800; i++) {
      const a = rnd(0, TAU); const sp = rnd(0.25, 1) * speed;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(life * 0.5, life), max: life, r: rnd(size * 0.5, size), color, g: streak ? 0 : 160, streak });
    }
  }
  const kick = (amount) => { if (!reducedMotion) shake = Math.min(14, shake + amount); };
  const sfx = (name, x, v = 1) => onSfx?.(name, x == null || !W ? 0 : clamp((x / W) * 2 - 1, -0.9, 0.9), v);
  const addRing = (x, y, r, max, life, color, w = 1.5) => rings.push({ x, y, r, max, life, maxLife: life, color, w });
  // Who sided with whom: gold threads for agreement, red tension for disagreement.
  function addLink(a, b, kind) {
    if (!byId[a] || !byId[b]) return;
    const ex = links.find((l) => l.a === a && l.b === b);
    if (ex) { ex.kind = kind; return; }
    links.push({ a, b, kind, born: api.instant ? -9 : t, seed: Math.random() });
  }

  /* ------------------------------------------------------------ API */
  api.setState = (id, state) => {
    const h = byId[id];
    if (!h) return;
    h.state = state;
    h.err = state === 'error';
    if (state === 'speaking' && !api.instant) { h.sv += 3; addRing(h.p.x, h.p.y, h.R0, h.R0 * 1.9, 0.6, h.tint, 1.2); }
  };
  api.setSpot = (id) => { spot = id; };
  api.aim = (id, targetId) => { if (targetId) aimAt[id] = targetId; else delete aimAt[id]; };
  api.talk = (id, chars) => {
    if (api.instant) return;
    if (id === 'ravana') { core.talk = Math.min(1, core.talk + chars * 0.03); return; }
    const h = byId[id];
    if (!h) return;
    h.talk = Math.min(1, h.talk + chars * 0.035);
    // What a head says flows down its line into the core.
    if (Math.random() < 0.5) flows.push({ id, u: 0, sp: rnd(0.7, 1.1), col: h.tint, r: rnd(1, 1.8) });
  };
  // kind "disagree": a comet and a knock-back. kind "agree": a gold thread and a nod.
  api.attack = (from, to, kind = 'disagree') => {
    const a = byId[from]; const b = byId[to];
    const agree = kind === 'agree';
    if (!a || !b) return;
    if (api.instant) { if (!agree) b.hits++; addLink(from, to, kind); return; }
    const dx = b.p.x - a.p.x; const dy = b.p.y - a.p.y; const d = Math.hypot(dx, dy) || 1;
    const lunge = agree ? 140 : reducedMotion ? 120 : 460;
    a.v.x += (dx / d) * lunge; a.v.y += (dy / d) * lunge * 0.5 - (agree ? 30 : 110);
    a.sv += agree ? 1 : 2.2;
    sfx(agree ? 'swish' : 'whoosh', a.p.x);
    addRing(a.p.x, a.p.y, a.R0 * 0.9, a.R0 * 1.6, 0.35, agree ? GOLD : a.tint, 1.2);
    shots.push({ from, to, agree, x: a.p.x, y: a.p.y, sx: a.p.x, sy: a.p.y, t: 0, dur: (agree ? 0.85 : 0.48) + d / 1700, tint: agree ? GOLD : mix(a.tint, '#ffffff', 0.25), lift: clamp(d * (agree ? 0.45 : 0.3), 40, 190), trail: [], tAcc: 0 });
  };
  api.cut = (id) => {
    const h = byId[id];
    if (!h || h.severed) return;
    h.severed = true;
    h.state = null;
    if (api.instant) return;
    // A clean slice: two halves fly apart and fall, the pedestal sparks.
    const ang = rnd(-0.6, 0.6) + (h.p.x < cx ? 0.35 : -0.35);
    const nx = -Math.sin(ang); const ny = Math.cos(ang);
    const base = { img: h.img, sprite: h.sprite, R: radius(h), cut: ang, alpha: 1, fade: false };
    for (const side of [-1, 1]) {
      drops.push({ ...base, side, x: h.p.x, y: h.p.y, vx: nx * side * rnd(140, 220) + (h.p.x - cx) * 0.35, vy: ny * side * rnd(140, 220) - rnd(280, 380), ang: 0, va: side * rnd(2, 5) });
    }
    slashes.push({ x: h.p.x, y: h.p.y, ang, len: h.R0 * 3.4, life: 0.32, max: 0.32 });
    burst(h.p.x, h.p.y, GOLD_HI, 24, 420, 1.6, 0.55, true);
    burst(h.p.x, h.p.y, h.tint, 14, 240, 1.8, 0.7);
    addRing(h.p.x, h.p.y, h.R0 * 0.5, h.R0 * 2.8, 0.45, GOLD_HI, 1.5);
    kick(8);
    sfx('slice', h.p.x);
  };
  api.regrow = (id) => {
    const h = byId[id];
    if (!h) return;
    const was = h.severed;
    h.severed = false;
    h.regrown = true;
    h.hits = 0;
    if (api.instant || !was) { h.s = 1; h.reborn = 0; return; }
    const stump = stumpOf(h);
    h.p = { ...stump }; h.v = { x: 0, y: -620 }; h.s = 0.05; h.sv = 8; h.reborn = 1;
    // Light gathers on the pedestal, then the orb blooms out of it.
    for (let i = 0; i < (reducedMotion ? 10 : 34); i++) {
      const a = rnd(0, TAU); const r = rnd(h.R0 * 2, h.R0 * 4);
      parts.push({ x: stump.x + Math.cos(a) * r, y: stump.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2, life: 0.32, max: 0.32, r: rnd(0.8, 1.6), color: GOLD_HI, g: 0, streak: true });
    }
    addRing(stump.x, stump.y, 4, h.R0 * 3.6, 0.8, GOLD, 2);
    addRing(stump.x, stump.y, 4, h.R0 * 2.2, 0.5, h.tint, 1.5);
    for (const d of drops) d.fade = true;
    kick(5);
    sfx('grow', stump.x);
  };
  api.phase = (name) => {
    phase = name;
    aimAt = {};
    if (name !== 'regrow') for (const d of drops) d.fade = true;
  };
  api.verdictStart = () => { phase = 'verdict'; };
  api.verdictLand = () => {
    if (api.instant) { core.glow = 1; return; }
    core.glow = 1.8;
    core.spinV = 4;
    addRing(core.x, core.y, core.r, Math.max(W, H) * 0.95, 1.2, GOLD, 2.5);
    addRing(core.x, core.y, core.r, Math.max(W, H) * 0.6, 0.9, GOLD_HI, 1.2);
    addRing(core.x, core.y, core.r, Math.max(W, H) * 0.35, 0.7, '#FFE7C2', 1);
    burst(core.x, core.y, GOLD_HI, 50, 560, 1.6, 1.1, true);
    for (const h of H_) {
      const dx = h.p.x - core.x; const dy = h.p.y - core.y; const d = Math.hypot(dx, dy) || 1;
      h.v.x += (dx / d) * 480; h.v.y += (dy / d) * 480; h.sv += 3.5;
    }
    kick(14);
    sfx('gong', core.x);
  };
  // Verdict: heads Ravana credits send light down their lines into the core.
  api.influence = (weights, dissenter) => { influence = weights || {}; dissent = dissenter || null; };
  api.end = (ok) => { ended = ok ? 'ok' : 'fail'; endT = t; spot = null; for (const h of H_) if (h.state !== 'error') h.state = null; };
  api.reset = () => {
    phase = null; spot = null; aimAt = {}; ended = null; core.glow = 0; core.talk = 0;
    parts.length = 0; shots.length = 0; rings.length = 0; drops.length = 0; slashes.length = 0; links.length = 0; flows.length = 0; influence = {}; dissent = null;
    for (const h of H_) Object.assign(h, { state: null, severed: false, regrown: false, err: false, hits: 0, flash: 0, talk: 0, lit: 0, reborn: 0, s: 1, sv: 0 });
  };
  api.headBox = (id) => {
    const h = byId[id];
    if (!h || h.severed) return null;
    const R = radius(h);
    return { x: h.p.x, y: h.p.y, r: R, top: h.p.y - R * 1.35, bottom: h.ped.y + h.R0 * 1.3, W, H };
  };
  api.resize = resize;

  /* ------------------------------------------------------------ pointer */
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hit = (pt) => {
    let best = null;
    for (const h of H_) {
      if (h.severed) continue;
      const d = Math.hypot(pt.x - h.p.x, pt.y - h.p.y);
      if (d < radius(h) * 1.25 && (!best || d < best.d)) best = { h, d };
    }
    return best?.h || null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    const pt = local(e); const h = hit(pt);
    if (!h) return;
    grab = { h, ox: h.p.x - pt.x, oy: h.p.y - pt.y, x: pt.x, y: pt.y, vx: 0, vy: 0, at: performance.now(), moved: false, sx: pt.x, sy: pt.y };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    const pt = local(e);
    pointer = pt; pointerAt = performance.now();
    if (grab) {
      const now = performance.now(); const dt = Math.max(1, now - grab.at) / 1000;
      grab.vx = lerp(grab.vx, (pt.x - grab.x) / dt, 0.5); grab.vy = lerp(grab.vy, (pt.y - grab.y) / dt, 0.5);
      grab.x = pt.x; grab.y = pt.y; grab.at = now;
      if (Math.hypot(pt.x - grab.sx, pt.y - grab.sy) > 6) grab.moved = true;
    } else {
      hover = hit(pt);
      canvas.style.cursor = hover ? 'grab' : '';
    }
  });
  const release = () => {
    if (!grab) return;
    const { h } = grab;
    if (!grab.moved) { onHeadClick?.(h.id); h.sv += 3; } else { h.v.x = clamp(grab.vx, -2400, 2400) * 0.7; h.v.y = clamp(grab.vy, -2400, 2400) * 0.7; }
    grab = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { hover = null; canvas.style.cursor = ''; });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  /* ------------------------------------------------------------ simulation */
  function lookTarget(h, now) {
    if (phase === 'verdict' || ended === 'ok') return core;
    if (aimAt[h.id] && byId[aimAt[h.id]] && !byId[aimAt[h.id]].severed) return byId[aimAt[h.id]].p;
    if (spot && spot !== h.id && byId[spot] && !byId[spot].severed) return byId[spot].p;
    if (spot === h.id) return { x: h.p.x, y: h.p.y + 200 };
    if (grab && grab.h !== h) return grab.h.p;
    if (pointer && now - pointerAt < 3000) return pointer;
    const w = h.wander;
    if (now > w.at) {
      const other = H_[Math.floor(Math.random() * H_.length)];
      if (Math.random() < 0.5 && other !== h) { w.x = other.rest.x; w.y = other.rest.y; } else { w.x = h.p.x + rnd(-300, 300); w.y = h.p.y + rnd(-60, 220); }
      w.at = now + rnd(1500, 4500);
    }
    return w;
  }

  function step(dt, now) {
    const anyActive = H_.some((h) => h.state === 'speaking' || h.state === 'thinking');
    // Allies drift together, rivals push apart: the ring becomes the map of the argument.
    const off = {};
    for (const l of links) {
      const a = byId[l.a]; const b = byId[l.b];
      if (!a || !b || a.severed || b.severed) continue;
      const dx = b.rest.x - a.rest.x; const dy = b.rest.y - a.rest.y; const d = Math.hypot(dx, dy) || 1;
      const f = l.kind === 'agree' ? Math.min(18, d * 0.05) : -Math.min(10, d * 0.03);
      const oa = (off[a.id] ||= { x: 0, y: 0 }); const ob = (off[b.id] ||= { x: 0, y: 0 });
      oa.x += (dx / d) * f; oa.y += (dy / d) * f * 0.5; ob.x -= (dx / d) * f; ob.y -= (dy / d) * f * 0.5;
    }
    const swaying = phase === 'verdict' || (ended === 'ok' && t - endT < 5);
    // Orbs are solid: they bump instead of overlapping.
    for (let i = 0; i < H_.length; i++) {
      const a = H_[i];
      if (a.severed) continue;
      for (let j = i + 1; j < H_.length; j++) {
        const b = H_[j];
        if (b.severed) continue;
        const dx = b.p.x - a.p.x; const dy = b.p.y - a.p.y; const d = Math.hypot(dx, dy) || 1;
        const min = (radius(a) + radius(b)) * 1.12;
        if (d < min) { const f = (min - d) * 900 * dt; a.v.x -= (dx / d) * f; a.v.y -= (dy / d) * f; b.v.x += (dx / d) * f; b.v.y += (dy / d) * f; }
      }
    }
    for (const h of H_) {
      // Where the orb wants to be: hovering over its pedestal.
      let tx = h.rest.x + Math.sin(t * 0.7 + h.i * 1.7) * 2;
      let ty = h.rest.y + Math.sin(t * 1.3 + h.i * 2.3) * h.R0 * 0.08;
      if (h.severed) ({ x: tx, y: ty } = stumpOf(h));
      if (h.state === 'speaking') ty -= h.R0 * 0.32;
      if (h.state === 'thinking') ty += Math.sin(t * 3 + h.i) * 1.5;
      if (off[h.id] && !h.severed) { tx += clamp(off[h.id].x, -30, 30); ty += clamp(off[h.id].y, -14, 14); }
      if (ended === 'fail') ty += h.R0 * 0.35;
      if (phase === 'verdict' && !ended) { tx = lerp(tx, core.x, 0.04); ty = lerp(ty, core.y, 0.04); }
      const k = grab?.h === h ? 420 : 95; const c = grab?.h === h ? 30 : 10.5;
      if (grab?.h === h) { tx = grab.x + grab.ox; ty = grab.y + grab.oy; }
      [h.p.x, h.v.x] = spring(h.p.x, h.v.x, tx, k, c, dt);
      [h.p.y, h.v.y] = spring(h.p.y, h.v.y, ty, k, c, dt);
      // The line's middle lags behind the orb: that is the whip.
      const mt = mid(h);
      [h.m.x, h.mv.x] = spring(h.m.x, h.mv.x, mt.x, 140, 12, dt);
      [h.m.y, h.mv.y] = spring(h.m.y, h.mv.y, mt.y, 140, 12, dt);
      const w = influence[h.id] || 0;
      const st = h.severed ? 0 : (h.state === 'speaking' ? 1.12 : spot === h.id ? 1.06 : 1) + ((phase === 'verdict' || ended === 'ok') ? w * 0.18 : 0);
      if (swaying && !h.severed && (w > 0 || dissent === h.id) && Math.random() < dt * (dissent === h.id ? 9 : 5 + w * 28)) {
        flows.push({ id: h.id, u: 0, sp: rnd(0.5, 0.75), col: dissent === h.id ? RED : GOLD_HI, r: rnd(1, 1.7), verdict: true });
      }
      [h.s, h.sv] = spring(h.s, h.sv, st, 170, h.regrown && h.s < 0.9 ? 9 : 14, dt);
      h.s = Math.max(0, h.s);
      const L = lookTarget(h, now);
      const lx = clamp((L.x - h.p.x) / 260, -1, 1); const ly = clamp((L.y - h.p.y) / 260, -1, 1);
      h.look.x = lerp(h.look.x, lx, 1 - Math.exp(-dt * 6)); h.look.y = lerp(h.look.y, ly, 1 - Math.exp(-dt * 6));
      [h.tilt, h.tv] = spring(h.tilt, h.tv, h.look.x * 0.1 + h.v.x * 0.0004, 120, 12, dt);
      h.talk *= Math.exp(-dt * 4);
      const want = h.state === 'speaking' ? 0.22 + h.talk * 0.78 : 0;
      h.voice = lerp(h.voice, want, 1 - Math.exp(-dt * 14));
      h.lit = lerp(h.lit, h.state === 'speaking' ? 1 : (h.state === 'done' || h.regrown) ? 0.5 : 0.15, 1 - Math.exp(-dt * 4));
      h.flash = Math.max(0, h.flash - dt * 2.4);
      h.reborn = Math.max(0, h.reborn - dt * 0.9);
      const dimTo = (anyActive && !h.state) || h.err ? 0.45 : phase === 'verdict' && !ended ? 0.2 : 0;
      h.dim = lerp(h.dim, dimTo, 1 - Math.exp(-dt * 5));
      if (h.severed && Math.random() < dt * 24) parts.push({ x: h.ped.x + rnd(-h.R0 * 0.6, h.R0 * 0.6), y: h.ped.y, vx: rnd(-30, 30), vy: rnd(-90, -30), life: 0.5, max: 0.5, r: rnd(0.6, 1.4), color: GOLD_HI, g: 0 });
    }
    // Projectiles.
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; const b = byId[s.to];
      s.t += dt / s.dur;
      const end = b && !b.severed ? { x: b.p.x, y: b.p.y } : { x: s.sx, y: s.sy - 80 };
      const u = clamp(s.t, 0, 1); const e = s.agree ? u * u * (3 - 2 * u) : u * u * (2 - u) * 0.5 + u * 0.5;
      const qx = (s.sx + end.x) / 2; const qy = Math.min(s.sy, end.y) - s.lift;
      s.x = (1 - e) * (1 - e) * s.sx + 2 * (1 - e) * e * qx + e * e * end.x;
      s.y = (1 - e) * (1 - e) * s.sy + 2 * (1 - e) * e * qy + e * e * end.y;
      s.tAcc += dt;
      if (s.tAcc > 1 / 90) { s.tAcc = 0; s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > (s.agree ? 40 : 16)) s.trail.shift(); }
      if (!s.agree && Math.random() < dt * 60 && parts.length < 800) parts.push({ x: s.x, y: s.y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.35, max: 0.35, r: rnd(0.6, 1.3), color: s.tint, g: 0 });
      if (s.t >= 1) {
        shots.splice(i, 1);
        if (b && !b.severed && s.agree) {
          b.sv += 3.5; b.v.y += 140; b.tv += 1.2;
          addLink(s.from, s.to, 'agree'); sfx('chime', end.x);
          burst(end.x, end.y, GOLD_HI, 10, 120, 1.4, 0.6);
          addRing(end.x, end.y, b.R0 * 1.0, b.R0 * 1.8, 0.55, GOLD, 1.2);
        } else if (b && !b.severed) {
          const dx = end.x - qx; const dy = end.y - qy; const d = Math.hypot(dx, dy) || 1;
          b.v.x += (dx / d) * (reducedMotion ? 150 : 700); b.v.y += (dy / d) * (reducedMotion ? 80 : 500);
          b.tv += (dx > 0 ? 1 : -1) * 5; b.flash = 1; b.hits++;
          addLink(s.from, s.to, 'disagree'); sfx('hit', end.x);
          burst(end.x, end.y, s.tint, 16, 380, 1.5, 0.5, true);
          burst(end.x, end.y, '#FFFFFF', 8, 220, 1.1, 0.35, true);
          addRing(end.x, end.y, b.R0 * 0.7, b.R0 * 2.2, 0.4, s.tint, 2);
          kick(4.5);
        }
      }
    }
    // Sliced halves fall and bounce.
    const floor = H - (narrow ? 60 : 40);
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; const r = d.R * 0.55;
      d.vy += 2000 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.va * dt;
      if (d.y + r > floor) { d.y = floor - r; if (Math.abs(d.vy) > 90) { d.vy *= -0.38; kick(Math.abs(d.vy) / 300); sfx('thud', d.x, Math.abs(d.vy) / 700); } else d.vy = 0; d.vx *= 0.8; d.va *= 0.7; }
      if (d.x < r) { d.x = r; d.vx = Math.abs(d.vx) * 0.6; }
      if (d.x > W - r) { d.x = W - r; d.vx = -Math.abs(d.vx) * 0.6; }
      if (d.fade) d.alpha -= dt * 1.5;
      if (d.alpha <= 0) drops.splice(i, 1);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; p.vy += p.g * dt; p.vx *= Math.exp(-dt * 2.8); p.vy *= Math.exp(-dt * 1.4); p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.r = lerp(r.r, r.max, 1 - Math.exp(-dt * 6)); if (r.life <= 0) rings.splice(i, 1); }
    for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].life -= dt; if (slashes[i].life <= 0) slashes.splice(i, 1); }
    for (let i = flows.length - 1; i >= 0; i--) {
      const f = flows[i];
      f.u += f.sp * dt;
      if (f.u >= 1) { flows.splice(i, 1); core.talk = Math.min(1, core.talk + (f.verdict ? 0.03 : 0.012)); }
    }
    core.talk *= Math.exp(-dt * 4);
    const glowTo = ended === 'ok' ? 1 : phase === 'verdict' ? 0.6 + core.talk * 0.6 + Math.sin(t * 3) * 0.1 : 0.35 + core.talk * 0.5;
    core.glow = lerp(core.glow, glowTo, 1 - Math.exp(-dt * 3));
    const spinTo = phase === 'verdict' && !ended ? 1.4 : 0.25;
    core.spinV = lerp(core.spinV, spinTo, 1 - Math.exp(-dt * 1.5));
    core.spin += core.spinV * dt;
    shake *= Math.exp(-dt * 9);
  }

  /* ------------------------------------------------------------ drawing */
  function drawSky() {
    if (stars) ctx.drawImage(stars, 0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of twinkles) { ctx.fillStyle = `rgba(${s.col},${0.1 + 0.5 * Math.max(0, Math.sin(t * s.s + s.f))})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    // The galaxy turns, very slowly, faster while Ravana decides.
    if (arms) {
      ctx.save(); ctx.translate(core.x, core.y); ctx.scale(1, TILT * 1.25); ctx.rotate(-0.5 - core.spin * 0.06);
      ctx.drawImage(arms, -armR, -armR, armR * 2, armR * 2);
      ctx.restore();
    }
    ctx.restore();
    // The ring the heads sit on: a thin, quiet guide, nothing more.
    const { rx, ry, y } = ring;
    ctx.save();
    ctx.strokeStyle = 'rgba(225,230,245,.09)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // Concentric orbits around the core, with sparks travelling along them.
  function drawOrbits() {
    const { x, y, r, glow } = core;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = 4;
    for (let i = 0; i < n; i++) {
      const R = r * 1.45 * Math.pow(1.35, i);
      const a = (0.22 - i * 0.04) * (0.5 + Math.min(glow, 1.4) * 0.5);
      ctx.strokeStyle = rgba('#FFE7C2', a); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * TILT, 0, 0, TAU); ctx.stroke();
      for (let k = 0; k < 2; k++) {
        const th = core.spin * (1.6 - i * 0.15) + k * Math.PI + i * 1.3;
        const px = x + Math.cos(th) * R; const py = y + Math.sin(th) * R * TILT;
        const rg = ctx.createRadialGradient(px, py, 0, px, py, 5); rg.addColorStop(0, `rgba(255,240,215,${0.6 - i * 0.12})`); rg.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function lineEnd(h) {
    if (h.severed) return stumpOf(h);
    const R = radius(h); const dx = h.m.x - h.p.x; const dy = h.m.y - h.p.y; const d = Math.hypot(dx, dy) || 1;
    return { x: h.p.x + (dx / d) * R * 0.95, y: h.p.y + (dy / d) * R * 0.95 };
  }
  const along = (h, u) => { const a = h.anchor; const c = h.m; const b = lineEnd(h); return { x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y }; };

  function drawLine(h) {
    const end = lineEnd(h);
    const live = h.state === 'speaking';
    const g = ctx.createLinearGradient(h.anchor.x, h.anchor.y, end.x, end.y);
    g.addColorStop(0, rgba(GOLD, 0.75)); g.addColorStop(1, rgba(mix(h.tint, '#ffffff', 0.3), 0.4 + h.lit * 0.55));
    ctx.save();
    ctx.globalAlpha = 1 - h.dim * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(h.anchor.x, h.anchor.y); ctx.quadraticCurveTo(h.m.x, h.m.y, end.x, end.y);
    ctx.strokeStyle = rgba(h.tint, live ? 0.25 : 0.08); ctx.lineWidth = live ? 7 : 4; ctx.stroke();
    ctx.strokeStyle = g; ctx.lineWidth = live ? 1.8 : 1.1; ctx.stroke();
    // Beads of light along the line, like stars on a constellation.
    for (const u of [0.28, 0.52, 0.76]) {
      const p = along(h, u);
      const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 3); rg.addColorStop(0, rgba(mix(u < 0.5 ? GOLD : h.tint, '#ffffff', 0.4), 0.55)); rg.addColorStop(1, rgba(h.tint, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Ravana: a dark glass sphere with a gold rim, marked with ten points joined in
  // one star, the ten heads that answer to it. It warms as the verdict forms.
  function drawCore() {
    const { x, y, r, glow } = core;
    const gl = Math.min(glow, 1.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bloom = r * (2.2 + gl * 1.4);
    const bg = ctx.createRadialGradient(x, y, r * 0.9, x, y, bloom);
    bg.addColorStop(0, `rgba(255,205,120,${0.1 + 0.18 * gl})`); bg.addColorStop(1, 'rgba(255,205,120,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, bloom, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = r * 0.5; ctx.shadowOffsetY = r * 0.12;
    const og = ctx.createRadialGradient(x, y + r * 0.25, r * 0.05, x, y, r);
    og.addColorStop(0, mix('#1a1408', '#5a3f14', clamp(gl * 0.5, 0, 1))); og.addColorStop(0.75, '#0b0a08'); og.addColorStop(1, '#2a2010');
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent';
    // Gold rim and glass highlight.
    const rim = ctx.createLinearGradient(x, y - r, x, y + r);
    rim.addColorStop(0, '#FFE9B8'); rim.addColorStop(0.5, '#C9973E'); rim.addColorStop(1, '#7A5418');
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(233,199,123,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, TAU); ctx.stroke();
    const hl = ctx.createLinearGradient(0, y - r, 0, y - r * 0.3);
    hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(x, y - r * 0.55, r * 0.6, r * 0.3, 0, 0, TAU); ctx.fill();
    if (ravanaImg?.base?.complete && ravanaImg.base.naturalWidth) {
      const im = (core.talk > 0.3 && ravanaImg.talk) || ravanaImg.base;
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, TAU); ctx.clip();
      ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (core.talk > 0.02) { ctx.strokeStyle = rgba(GOLD_HI, core.talk * 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r * (1.1 + core.talk * 0.2), 0, TAU); ctx.stroke(); }
      ctx.restore();
      return;
    }
    // The mark: a ten-pointed star {10/3}, turning slowly.
    const R = r * 0.56; const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU + core.spin * 0.15; pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(242,200,110,${0.7 + Math.min(gl, 1) * 0.3})`; ctx.lineWidth = Math.max(1, r * 0.028);
    ctx.shadowColor = 'rgba(255,200,100,.8)'; ctx.shadowBlur = r * (0.12 + gl * 0.15);
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const [px, py] = pts[(i * 3) % 10]; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.fillStyle = '#FFE7B0';
    for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, r * 0.035), 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.6, r * 0.06), 0, TAU); ctx.fill();
    if (core.talk > 0.02) { ctx.shadowBlur = 0; ctx.strokeStyle = rgba(GOLD_HI, core.talk * 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r * (1.1 + core.talk * 0.2), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  function drawPedestal(h) {
    const R = h.R0; const { x, y } = h.ped;
    const rx = R * 1.2; const ry = R * 0.34; const hg = R * 0.88;
    const on = h.severed ? 0.25 : 0.35 + h.lit * 0.65;
    ctx.save();
    ctx.globalAlpha = 1 - h.dim * 0.45;
    // Body.
    const bg = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
    bg.addColorStop(0, '#04060c'); bg.addColorStop(0.5, '#161b2b'); bg.addColorStop(1, '#04060c');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.lineTo(x - rx, y + hg); ctx.ellipse(x, y + hg, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(x + rx, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.stroke();
    // Top: lit from the orb above.
    const tg = ctx.createRadialGradient(x, y, 0, x, y, rx);
    tg.addColorStop(0, rgba(h.tint, 0.55 * on)); tg.addColorStop(0.7, rgba(mix(h.tint, '#060912', 0.7), 0.95)); tg.addColorStop(1, '#0b0f1c');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(h.tint, 0.25 * on); ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(mix(h.tint, '#ffffff', 0.35), 0.85 * on); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // The name, on the pedestal's face. Drawn last, so a bouncing orb never hides it.
  function drawName(h) {
    const R = h.R0; const { x, y } = h.ped; const hg = R * 0.88;
    ctx.save();
    ctx.globalAlpha = 1 - h.dim * 0.45;
    const fs = clamp(R * 0.36, narrow ? 9.5 : 12, 15);
    ctx.font = `500 ${fs}px 'IBM Plex Sans', system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.2px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 4;
    ctx.fillStyle = h.err ? 'rgba(235,235,245,.5)' : `rgba(245,243,255,${0.72 + h.lit * 0.28})`;
    ctx.fillText(h.err ? `${h.name} · silent` : h.name, x, y + hg * 0.62);
    ctx.restore();
  }

  function drawOrb(h) {
    if (h.severed || h.s < 0.02) return;
    const R = radius(h);
    const speaking = h.state === 'speaking';
    ctx.save();
    ctx.translate(h.p.x, h.p.y);
    const w = influence[h.id] || 0;
    if ((phase === 'verdict' || ended === 'ok') && (w > 0 || dissent === h.id)) {
      const col = dissent === h.id ? RED : GOLD;
      const g = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * (2 + w * 1.2));
      g.addColorStop(0, rgba(col, 0.15 + w * 0.3)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * (2 + w * 1.2), 0, TAU); ctx.fill();
    }
    if (speaking || spot === h.id) {
      const g = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 2.4);
      g.addColorStop(0, rgba(h.tint, speaking ? 0.35 + h.voice * 0.25 : 0.2)); g.addColorStop(1, rgba(h.tint, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1 - h.dim * 0.55;
    // Voice: a ring of bars around the orb, driven by the words as they stream in.
    if (h.voice > 0.02) {
      const n = Math.round(clamp(R * 1.5, 32, 64)); const col = mix(h.tint, '#ffffff', 0.45);
      ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = Math.max(1, R * 0.035); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU - Math.PI / 2;
        const amp = h.voice * (0.25 + 0.75 * Math.abs(Math.sin(t * 8.5 + i * 0.83 + h.i)) * Math.abs(Math.sin(t * 4.7 - i * 0.37)));
        const r0 = R * 1.18; const r1 = r0 + R * (0.04 + amp * 0.38);
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.stroke();
    } else if (spot === h.id) {
      ctx.strokeStyle = rgba(mix(h.tint, '#ffffff', 0.4), 0.6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.22, 0, TAU); ctx.stroke();
    }
    if (h.state === 'thinking') {
      const a0 = t * 3.4 + h.i; const col = mix(h.tint, '#ffffff', 0.5);
      ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (let k = 0; k < 10; k++) { ctx.strokeStyle = rgba(col, (k / 10) * 0.9); ctx.beginPath(); ctx.arc(0, 0, R * 1.22, a0 + k * 0.12, a0 + k * 0.12 + 0.13); ctx.stroke(); }
    }
    if (h.reborn > 0) { ctx.strokeStyle = rgba(GOLD_HI, h.reborn); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * (1 + (1 - h.reborn) * 0.8), 0, TAU); ctx.stroke(); }
    ctx.rotate(h.tilt);
    if (h.err) { greySprite ||= sprite('#6b7280', h.icon, h.R0 * 1.35); stamp(greySprite, R); } else stamp(h.sprite, R);
    if (h.img?.base?.complete && h.img.base.naturalWidth) {
      const im = (h.voice > 0.35 && h.img.talk) || h.img.base;
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * 0.94, 0, TAU); ctx.clip();
      // Zoom in a little, so the face (a bit above the image's centre) fills the orb.
      const z = 1.22; ctx.drawImage(im, -R * z, -R * z * 0.9, R * 2 * z, R * 2 * z);
      ctx.restore();
      // Frame the portrait in the head's colour.
      ctx.strokeStyle = rgba(mix(h.tint, '#ffffff', 0.35), 0.95); ctx.lineWidth = Math.max(1.5, R * 0.06);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, TAU); ctx.stroke();
    }
    // Each disagreement it took leaves a red mark on the rim.
    if (h.hits > 0 && !h.err) {
      ctx.strokeStyle = rgba(RED, 0.9); ctx.lineWidth = Math.max(1.5, R * 0.06); ctx.lineCap = 'round';
      for (let k = 0; k < Math.min(h.hits, 6); k++) { const a = -Math.PI / 2 + 0.55 + k * 0.32; ctx.beginPath(); ctx.arc(0, 0, R * 1.04, a, a + 0.16); ctx.stroke(); }
    }
    if (h.regrown) {
      ctx.strokeStyle = rgba(GOLD, 0.8); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.14, -Math.PI / 2 + 0.25, Math.PI * 1.5 - 0.25); ctx.stroke();
      ctx.fillStyle = GOLD_HI; ctx.beginPath(); ctx.arc(0, -R * 1.14, Math.max(1.6, R * 0.06), 0, TAU); ctx.fill();
    }
    if (h.flash > 0.02) { ctx.fillStyle = `rgba(255,250,240,${h.flash * 0.5})`; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawDrop(d) {
    const R = d.R;
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.alpha) * 0.92;
    ctx.translate(d.x, d.y); ctx.rotate(d.ang + d.cut);
    ctx.beginPath(); ctx.rect(-R * 1.8, d.side < 0 ? -R * 1.8 : 0, R * 3.6, R * 1.8); ctx.clip();
    ctx.rotate(-d.cut);
    stamp(d.sprite, R);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.alpha - 0.4);
    ctx.translate(d.x, d.y); ctx.rotate(d.ang + d.cut);
    ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.stroke();
    ctx.restore();
  }

  function drawLinks() {
    if (!links.length) return;
    const fade = phase === 'verdict' ? 0.3 : ended ? 0.22 : phase === 'regrow' ? 0.6 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of links) {
      const a = byId[l.a]; const b = byId[l.b];
      if (!a || !b || a.severed || b.severed) continue;
      const age = clamp((t - l.born) / 0.5, 0, 1) * fade;
      const x1 = a.p.x; const y1 = a.p.y; const x2 = b.p.x; const y2 = b.p.y;
      if (l.kind === 'agree') {
        const mx = (x1 + x2) / 2; const my = Math.min(y1, y2) - 24;
        ctx.strokeStyle = rgba(GOLD, 0.35 * age); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
        for (const k of [0, 0.5]) {
          const u = (t * 0.4 + l.seed + k) % 1;
          const bx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2;
          const by = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2;
          ctx.fillStyle = rgba(GOLD_HI, 0.9 * age); ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, TAU); ctx.fill();
        }
      } else {
        if (!l.jag || t - l.jagAt > 0.09) { l.jag = Array.from({ length: 11 }, () => rnd(-1, 1)); l.jagAt = t; }
        const dx = x2 - x1; const dy = y2 - y1; const d = Math.hypot(dx, dy) || 1; const nx = -dy / d; const ny = dx / d;
        const amp = Math.min(5, d * 0.018);
        ctx.strokeStyle = rgba(RED, 0.22 * age); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y1);
        for (let i = 1; i <= 11; i++) { const u = i / 12; ctx.lineTo(x1 + dx * u + nx * l.jag[i - 1] * amp, y1 + dy * u + ny * l.jag[i - 1] * amp); }
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = rgba('#FF9A8A', (0.3 + 0.3 * Math.random()) * age); ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawShot(s) {
    const tr = s.trail;
    ctx.lineCap = 'round';
    if (s.agree) {
      for (let i = 1; i < tr.length; i++) { ctx.strokeStyle = rgba(GOLD, (i / tr.length) * 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
      ctx.fillStyle = GOLD_HI; ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, TAU); ctx.fill();
      return;
    }
    for (let i = 1; i < tr.length; i++) {
      const k = i / tr.length;
      ctx.strokeStyle = rgba(s.tint, k * 0.9); ctx.lineWidth = 0.5 + k * 4.5;
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
    }
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, rgba(s.tint, 0.9)); g.addColorStop(1, rgba(s.tint, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, TAU); ctx.fill();
  }

  // A still portrait of a head, for the report and the board: the orb without its halo.
  const portraits = {};
  api.portrait = (id, px = 64) => {
    const key = `${id}:${px}`;
    if (portraits[key]) return portraits[key];
    const h = byId[id];
    if (!h) return '';
    const off = document.createElement('canvas');
    off.width = px * 2; off.height = px * 2;
    const c = off.getContext('2d');
    c.scale(2, 2); c.translate(px / 2, px / 2);
    paintOrb(c, h.tint, px * 0.48, h.icon, { glow: false, k: 2 });
    return (portraits[key] = off.toDataURL('image/png'));
  };

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = shake > 0.2 ? rnd(-shake, shake) : 0; const sy = shake > 0.2 ? rnd(-shake, shake) : 0;
    ctx.translate(sx, sy);
    drawSky();
    drawOrbits();
    const order = [...H_].sort((a, b) => a.ped.y - b.ped.y);
    for (const h of order) drawLine(h);
    drawLinks();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of flows) {
      const p = along(byId[f.id], 1 - f.u);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, f.r * 2);
      g.addColorStop(0, rgba(mix(f.col, '#ffffff', 0.4), 0.7)); g.addColorStop(1, rgba(f.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, f.r * 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    drawCore();
    // Back to front, so nearer pedestals cover the ones behind them.
    for (const h of order) { drawPedestal(h); drawOrb(h); }
    for (const d of drops) drawDrop(d);
    for (const h of order) drawName(h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) { ctx.strokeStyle = rgba(r.color, Math.max(0, r.life / r.maxLife) * 0.8); ctx.lineWidth = r.w; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    ctx.lineCap = 'round';
    for (const p of parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.streak) { ctx.strokeStyle = rgba(p.color, a); ctx.lineWidth = p.r; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke(); } else { ctx.fillStyle = rgba(p.color, a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    }
    for (const s of slashes) {
      const k = s.life / s.max; const dx = Math.cos(s.ang) * s.len / 2; const dy = Math.sin(s.ang) * s.len / 2;
      const g = ctx.createLinearGradient(s.x - dx, s.y - dy, s.x + dx, s.y + dy);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1 + k * 3; ctx.beginPath(); ctx.moveTo(s.x - dx, s.y - dy); ctx.lineTo(s.x + dx, s.y + dy); ctx.stroke();
    }
    for (const s of shots) drawShot(s);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden) {
      // Fixed substeps keep the springs stable on slow frames.
      const n = Math.ceil(dt / (1 / 120));
      for (let i = 0; i < n; i++) { t += dt / n; step(dt / n, now); }
      draw();
      onFrame?.();
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', () => resize());
  requestAnimationFrame(frame);
  return api;
}
