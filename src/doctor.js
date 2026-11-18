// `dashamukha doctor`: what is configured, what is installed, what is missing.
// A harness runs this before asking the user setup questions.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, resolve, validate } from './config.js';
import { checkClaudeCode } from './engines/claude-code.js';
import { ORDER } from './personas.js';

const KNOWN_CLIS = ['claude', 'codex', 'gemini', 'opencode', 'qwen', 'aider', 'ollama', 'llm'];
const KNOWN_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY'];

export function which(bin) {
  if (bin.includes('/')) return existsSync(bin) ? bin : null;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { if (statSync(p).isFile()) return p; } catch { /* keep looking */ }
  }
  return null;
}

async function getJSON(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function doctor({ file, cwd } = {}) {
  const { file: configFile, config } = loadConfig({ file, cwd });
  const problems = validate(config);

  const clis = {};
  for (const bin of KNOWN_CLIS) { const p = which(bin); if (p) clis[bin] = p; }
  const claude = clis.claude ? await checkClaudeCode(clis.claude) : { found: false };

  const [ollama, lmstudio] = await Promise.all([getJSON('http://localhost:11434/api/tags'), getJSON('http://localhost:1234/v1/models')]);
  const local = {
    ollama: ollama ? { running: true, models: (ollama.models || []).map((m) => m.name) } : { running: false },
    lmstudio: lmstudio ? { running: true, models: (lmstudio.data || []).map((m) => m.id) } : { running: false },
  };

  const assignments = {};
  const engineStatus = {};
  for (const id of [...ORDER, 'ravana']) {
    let r;
    try { r = resolve(config, id); } catch { continue; }
    assignments[id] = { engine: r.engineName, model: r.model || '(engine default)' };
    if (engineStatus[r.engineName]) continue;
    const e = r.engine;
    let ready = true;
    let note = '';
    if (e.type === 'claude-code') {
      const bin = e.binary || 'claude';
      const c = bin === 'claude' ? claude : await checkClaudeCode(bin);
      ready = c.found;
      note = c.found ? `Claude Code ${c.version}` : 'Claude Code CLI not found';
    } else if (e.type === 'cli') {
      ready = Boolean(which(e.command?.[0] || ''));
      note = ready ? `${e.command[0]} found` : `${e.command?.[0]} not on PATH`;
    } else if (e.type === 'anthropic' || e.type === 'openai') {
      const keyVar = e.apiKeyEnv || (e.type === 'anthropic' ? 'ANTHROPIC_API_KEY' : (String(e.baseUrl).includes('api.openai.com') ? 'OPENAI_API_KEY' : ''));
      if (keyVar && !process.env[keyVar]) { ready = false; note = `environment variable ${keyVar} is not set`; }
      if (e.type === 'openai' && /localhost|127\.0\.0\.1/.test(e.baseUrl || '')) {
        const up = await getJSON(`${e.baseUrl.replace(/\/+$/, '')}/models`);
        if (!up) { ready = false; note = `nothing answering at ${e.baseUrl}`; }
      }
      if (ready) note = keyVar ? `${keyVar} is set` : 'reachable';
    } else if (e.type === 'demo') {
      note = 'scripted heads, no model calls';
    }
    engineStatus[r.engineName] = { type: e.type, ready, note };
    if (!ready) problems.push(`Engine "${r.engineName}": ${note}`);
  }

  return {
    ok: problems.length === 0,
    configFile,
    firstRun: !configFile,
    assignments,
    engines: engineStatus,
    detected: { clis, local, envKeys: KNOWN_KEYS.filter((k) => process.env[k]) },
    problems,
  };
}
