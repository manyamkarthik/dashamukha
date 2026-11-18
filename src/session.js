// A council session is an append-only JSONL event log in ~/.dashamukha/sessions.
// The CLI writes it while the heads talk; the viewer replays and tails it.
import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { SESSIONS } from './paths.js';

const ID = /^[A-Za-z0-9_-]{6,80}$/;

export function sessionFile(id) {
  if (!ID.test(id)) throw new Error('Bad session id');
  return path.join(SESSIONS, `${id}.jsonl`);
}

export function createSession() {
  mkdirSync(SESSIONS, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const id = `${stamp}-${randomBytes(3).toString('hex')}`;
  return { id, file: sessionFile(id) };
}

export function appendEvent(file, type, data) {
  appendFileSync(file, `${JSON.stringify({ t: Date.now(), type, data })}\n`, { mode: 0o600 });
}

/** Is the process that writes a session still running? */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true; // older sessions: assume yes
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

/** "done", "live", or "stopped" (the council process died before an end event). */
export function statusOf(firstEvent, ended) {
  if (ended) return 'done';
  return pidAlive(firstEvent?.data?.pid) ? 'live' : 'stopped';
}

export const STOPPED = 'The council process stopped before Ravana gave a verdict.';

export const logFile = (id) => sessionFile(id).replace(/\.jsonl$/, '.log');

export function readEvents(id) {
  const file = sessionFile(id);
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** Read bytes appended after `offset`; returns complete lines and the new offset. */
export function readFrom(file, offset) {
  const size = statSync(file).size;
  if (size <= offset) return { lines: [], offset };
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    const text = buf.toString('utf8');
    const end = text.lastIndexOf('\n');
    if (end === -1) return { lines: [], offset };
    return { lines: text.slice(0, end).split('\n').filter(Boolean), offset: offset + Buffer.byteLength(text.slice(0, end + 1)) };
  } finally {
    closeSync(fd);
  }
}

export function listSessions(limit = 40) {
  if (!existsSync(SESSIONS)) return [];
  return readdirSync(SESSIONS)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, m: statSync(path.join(SESSIONS, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .map(({ f, m }) => {
      const id = f.replace(/\.jsonl$/, '');
      let first = {};
      let ended = false;
      try {
        const text = readFileSync(path.join(SESSIONS, f), 'utf8');
        first = JSON.parse(text.slice(0, text.indexOf('\n')) || '{}');
        const last = text.trimEnd().slice(text.trimEnd().lastIndexOf('\n') + 1);
        ended = last.includes('"type":"end"');
      } catch { /* half-written or damaged file: list it without details */ }
      return { id, problem: first.data?.problem || '(unreadable council)', startedAt: first.data?.startedAt, updatedAt: new Date(m).toISOString(), status: statusOf(first, ended) };
    });
}
