// Runs one council and records it as a session the viewer can show.
import { runCouncil } from './council.js';
import { resolve } from './config.js';
import { callEngine } from './engines/index.js';
import { createSession, appendEvent } from './session.js';

export function engineSummary(cfg, personas, { forceDemo } = {}) {
  const ids = [...personas.heads.map((h) => h.id), 'ravana'];
  return Object.fromEntries(ids.map((id) => {
    const r = resolve(cfg, id, { forceDemo });
    return [id, { engine: r.engineName, type: r.engine.type, model: r.model }];
  }));
}

export async function convene({ problem, cfg, personas, cwd, forceDemo = false, signal, onEvent = () => {}, session = createSession() }) {
  const { id, file } = session;
  const emit = (type, data) => { appendEvent(file, type, data); onEvent(type, data); };
  emit('session', {
    id, problem, cwd, pid: process.pid, startedAt: new Date().toISOString(),
    engines: engineSummary(cfg, personas, { forceDemo }),
    rounds: cfg.rounds,
  });
  try {
    const transcript = await runCouncil({
      problem, personas, signal, emit,
      settings: { clash: cfg.rounds.clash, regrow: cfg.rounds.regrow, regrowCount: cfg.regrowCount, words: cfg.words, concurrency: cfg.concurrency },
      call: (req) => {
        const r = resolve(cfg, req.head.id, { forceDemo });
        return callEngine(r.engine, r.model, cwd, req);
      },
    });
    emit('end', { ok: true, transcript });
    return { id, transcript };
  } catch (err) {
    emit('end', { ok: false, error: err.name === 'AbortError' ? 'The council was dismissed.' : err.message });
    throw err;
  }
}
