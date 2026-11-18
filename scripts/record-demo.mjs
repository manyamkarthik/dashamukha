#!/usr/bin/env node
// Records the README demo: replays a council in headless Chrome, captures the
// screen, renders the sound effects offline from the page's own sound log, and
// muxes both into an MP4 (plus a GIF preview) with ffmpeg.
//
//   node bin/dashamukha.js view --no-open &      # the viewer must be running
//   node scripts/record-demo.mjs [sessionId] [--out docs/demo] [--chrome <path>]
//
// Needs Google Chrome and ffmpeg. Not part of the published package.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : def; };
const out = opt('--out', 'docs/demo');
const chromePath = opt('--chrome', process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const port = Number(opt('--port', 4310));
const W = Number(opt('--width', 1280)); const H = Number(opt('--height', 930));
const id = args[0] || '';
const url = `http://localhost:${port}/${id ? `#${id}` : ''}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = mkdtempSync(path.join(tmpdir(), 'dashamukha-rec-'));
const frames = path.join(work, 'frames'); mkdirSync(frames);
const debugPort = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(work, 'profile')}`,
  '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let seq = 0; const waiting = {}; const shots = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++seq; waiting[i] = (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting[m.id]) { waiting[m.id](m); delete waiting[m.id]; }
    if (m.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = m.params;
      const file = path.join(frames, `${String(shots.length).padStart(5, '0')}.jpg`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      shots.push({ file, ts: metadata.timestamp * 1000 });
      send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    }
  });
  const run = async (expr, gesture = false) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: gesture });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__sfxLog = [];' });
  await send('Page.navigate', { url });
  await sleep(3000);
  // A clean frame: the stage edge to edge on a dark page, so the video has no
  // margins. The question goes in the README text, and with nothing above the
  // stage the frame cannot shift while the replay runs.
  await run(`
    const st = document.createElement('style');
    st.textContent = '.topbar, .footer, .hero, .hint { display: none !important; } html { scroll-behavior: auto !important; } body { background: #040508 !important; } main { max-width: none !important; padding: 0 !important; } .theatre { border-radius: 0 !important; box-shadow: none !important; } .report, .argued { max-width: 1180px; margin-left: auto !important; margin-right: auto !important; }';
    document.head.append(st);
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 600));
    if (!window.__sfx) throw new Error('page did not expose the sound engine');
    document.querySelector('#sound').getAttribute('aria-pressed') === 'true' || document.querySelector('#sound').click();
  `, true);
  await sleep(400);

  // Bottom of the stage and its status line: the GIF is cropped there.
  const stageBottom = run(`const r = document.querySelector('#seal-label').getBoundingClientRect(); return Math.ceil(r.bottom + 34);`);
  await stageBottom;
  await send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  await sleep(1200);
  await run(`window.__sfxLog.length = 0; document.querySelector('#replay').click();`, true);
  const t0 = Date.now(); let verdictAt = 0;
  for (;;) {
    await sleep(500);
    const status = await run(`return document.querySelector('#seal-label').textContent;`);
    if (/decided|no verdict|interrupted/i.test(status)) { verdictAt = Date.now(); break; }
    if (Date.now() - t0 > 240000) throw new Error(`replay did not finish (status: ${status})`);
  }
  await sleep(4500);
  // End on the payload: glide down to the report.
  await run(`
    const target = document.querySelector('#report').getBoundingClientRect().top + scrollY - 24;
    const from = scrollY; const t0 = performance.now(); const dur = 1800;
    await new Promise((done) => { const step = (now) => { const k = Math.min(1, (now - t0) / dur); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; scrollTo(0, from + (target - from) * e); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); });
  `);
  await sleep(5000);
  await send('Page.stopScreencast');
  await sleep(300);
  if (shots.length < 30) throw new Error(`only ${shots.length} frames captured`);

  const start = shots[0].ts; const end = shots[shots.length - 1].ts + 1000 / 30;
  const duration = (end - start) / 1000;
  const log = await run('return window.__sfxLog;');
  const events = log.map((e) => ({ ...e, time: (e.at - start) / 1000 }));
  console.log(`${shots.length} frames, ${duration.toFixed(1)}s, ${events.length} sounds`);
  const wavB64 = await run(`
    const bytes = await window.__sfx.renderWav(${JSON.stringify(events)}, ${duration});
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  `);
  writeFileSync(path.join(work, 'audio.wav'), Buffer.from(wavB64, 'base64'));
  ws.close();

  // Frames arrive when the screen changes, so give each one its real duration.
  const list = ['ffconcat version 1.0'];
  shots.forEach((s, i) => { list.push(`file '${s.file}'`, `duration ${(((shots[i + 1]?.ts ?? end) - s.ts) / 1000).toFixed(4)}`); });
  list.push(`file '${shots[shots.length - 1].file}'`);
  writeFileSync(path.join(work, 'frames.txt'), list.join('\n'));

  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const ff = (argv) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...argv], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(work, 'frames.txt'), '-i', path.join(work, 'audio.wav'),
    '-vf', 'fps=30,scale=1280:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
    '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', `${out}.mp4`]);
  // GIF preview for the README (no sound): the stage alone, cropped above the
  // verdict text and ending on the gong, sped up and small.
  const gifEnd = Math.max(5, (verdictAt - start) / 1000 + 1.8);
  const stageH = await stageBottom;
  ff(['-t', gifEnd.toFixed(1), '-i', `${out}.mp4`, '-vf', `crop=iw:${2 * Math.round((Math.min(H, stageH) * 1280) / W / 2)}:0:0,setpts=PTS/1.6,fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, `${out}.gif`]);
  for (const f of [`${out}.mp4`, `${out}.gif`]) console.log(`${f}  ${(statSync(f).size / 1e6).toFixed(1)} MB`);
} finally {
  chrome.kill();
  rmSync(work, { recursive: true, force: true });
}
