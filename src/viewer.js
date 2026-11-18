// The local viewer: serves the stage and streams sessions to it.
// Binds to 127.0.0.1 only and rejects foreign Host/Origin headers.
import http from 'node:http';
import { promises as fs, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { WEB, VERSION } from './paths.js';
import { loadPersonas } from './personas.js';
import { listSessions, sessionFile, readFrom, statusOf, STOPPED } from './session.js';

async function waitForFile(file, ms) {
  for (const end = Date.now() + ms; Date.now() < end;) {
    await new Promise((r) => setTimeout(r, 200));
    if (existsSync(file)) return true;
  }
  return false;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.ico': 'image/x-icon', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
const FRAME = /^([a-z]+)(?:-(left|right|blink|talk))?\.(png|webp|jpe?g|avif|svg)$/i;

function send(res, status, body, type = 'application/json; charset=utf-8', cache = 'no-store') {
  res.writeHead(status, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

/** Which portrait frames exist in web/heads for each head. */
export function scanFrames(dir = path.join(WEB, 'heads')) {
  const frames = {};
  if (!existsSync(dir)) return frames;
  for (const f of readdirSync(dir)) {
    const m = f.match(FRAME);
    if (!m) continue;
    const id = m[1].toLowerCase();
    const kind = (m[2] || 'base').toLowerCase();
    (frames[id] ||= {})[kind] ??= `heads/${f}`;
  }
  return frames;
}

export function startViewer({ port = 4310, idleSec = 0 } = {}) {
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  let lastActive = Date.now();
  let lastPoll = 0; // the page polls /api/sessions every 2.5s while it is open
  let streams = 0;

  const server = http.createServer(async (req, res) => {
    lastActive = Date.now();
    try {
      if (!hosts.has(req.headers.host || '')) return send(res, 403, { error: 'Forbidden host' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Read-only viewer' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      const p = url.pathname;

      if (p === '/api/ping') return send(res, 200, { app: 'dashamukha', version: VERSION, watching: Date.now() - lastPoll < 6000 });
      if (p === '/api/heads') {
        const { heads, ravana } = loadPersonas();
        const frames = scanFrames();
        const meta = (h) => ({ id: h.id, name: h.name, devanagari: h.devanagari, english: h.english, tint: h.tint, lens: h.lens, frames: frames[h.id] || {} });
        return send(res, 200, { heads: heads.map(meta), ravana: meta(ravana) });
      }
      if (p === '/api/sessions') { lastPoll = Date.now(); return send(res, 200, listSessions()); }

      const m = p.match(/^\/api\/sessions\/([A-Za-z0-9_-]+)\/events$/);
      if (m) {
        let file;
        try { file = sessionFile(m[1]); } catch { return send(res, 400, { error: 'Bad id' }); }
        // The browser often opens before the council writes its first event, and
        // EventSource never retries after a 404, so wait a while for the file.
        if (!existsSync(file) && !(await waitForFile(file, 30000))) return send(res, 404, { error: 'No such council' });
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
        streams++;
        let offset = 0;
        let ended = false;
        let first = null;
        let quietSince = Date.now();
        const pump = () => {
          try {
            const r = readFrom(file, offset);
            offset = r.offset;
            if (r.lines.length) quietSince = Date.now();
            for (const line of r.lines) {
              first ??= JSON.parse(line);
              res.write(`data: ${line}\n\n`);
              if (line.includes('"type":"end"')) ended = true;
            }
            // The council process died without writing "end": say so instead of
            // showing a live session forever.
            if (!ended && Date.now() - quietSince > 2000 && statusOf(first, false) === 'stopped') {
              res.write(`data: ${JSON.stringify({ t: Date.now(), type: 'end', data: { ok: false, error: STOPPED } })}\n\n`);
              ended = true;
            }
            if (ended) stop();
          } catch { stop(); }
        };
        const timer = setInterval(pump, 150);
        const ping = setInterval(() => res.write(': ping\n\n'), 15000);
        const stop = () => { clearInterval(timer); clearInterval(ping); if (!res.writableEnded) res.end(); };
        res.on('close', () => { streams--; lastActive = Date.now(); clearInterval(timer); clearInterval(ping); });
        pump();
        return;
      }
      if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

      const rel = decodeURIComponent(p === '/' ? '/index.html' : p);
      const file = path.normalize(path.join(WEB, rel));
      if (!file.startsWith(WEB + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
      try {
        const data = await fs.readFile(file);
        const isAsset = /\.(png|webp|jpe?g|avif)$/i.test(file);
        return send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', isAsset ? 'max-age=60' : 'no-store');
      } catch {
        return send(res, 404, 'Not found', 'text/plain');
      }
    } catch (err) {
      if (!res.headersSent) send(res, 500, { error: err.message });
      else res.end();
    }
  });

  if (idleSec > 0) {
    setInterval(() => {
      if (streams === 0 && Date.now() - lastActive > idleSec * 1000) process.exit(0);
    }, 30000).unref();
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/** The viewer's ping on this port ({app, version, watching}), or null. */
export async function viewerInfo(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(800) });
    const j = await res.json();
    return j.app === 'dashamukha' ? j : null;
  } catch {
    return null;
  }
}

/** Is a Dashamukha viewer already answering on this port? */
export const viewerAlive = async (port) => Boolean(await viewerInfo(port));
