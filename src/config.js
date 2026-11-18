// dashamukha.config.json: which engine and model each head uses.
// With no config file every head runs on Claude Code with its default model.
// Secrets never go in this file: HTTP engines name an environment variable
// (apiKeyEnv) that holds the key.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, HOME } from './paths.js';
import { ORDER } from './personas.js';

export const FILE_NAME = 'dashamukha.config.json';

export const BUILTIN_ENGINES = {
  claude: { type: 'claude-code', model: '' },
  demo: { type: 'demo' },
};

export const DEFAULTS = {
  engine: 'claude',
  engines: {},
  heads: {},
  ravana: {},
  rounds: { clash: true, regrow: true },
  regrowCount: 3,
  words: 90,
  concurrency: 5,
  port: 4310,
};

export function configCandidates(cwd = process.cwd()) {
  return [process.env.DASHAMUKHA_CONFIG, path.join(cwd, FILE_NAME), path.join(ROOT, FILE_NAME), path.join(HOME, 'config.json')].filter(Boolean);
}

export function findConfigFile(explicit, cwd) {
  if (explicit) return path.resolve(explicit);
  return configCandidates(cwd).find((f) => existsSync(f)) || null;
}

export function normalize(raw = {}) {
  const cfg = {
    ...DEFAULTS, ...raw,
    rounds: { ...DEFAULTS.rounds, ...(raw.rounds || {}) },
    engines: { ...BUILTIN_ENGINES, ...(raw.engines || {}) },
    heads: { ...(raw.heads || {}) },
    ravana: { ...(raw.ravana || {}) },
  };
  cfg.words = clamp(cfg.words, 30, 400, 90);
  cfg.concurrency = clamp(cfg.concurrency, 1, 10, 5);
  cfg.regrowCount = clamp(cfg.regrowCount, 1, 5, 3);
  cfg.port = clamp(cfg.port, 1024, 65535, 4310);
  return cfg;
}

const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : d));

export function loadConfig({ file, cwd } = {}) {
  const found = findConfigFile(file, cwd);
  if (!found) return { file: null, config: normalize({}) };
  let raw;
  try {
    raw = JSON.parse(readFileSync(found, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${found}: ${err.message}`);
  }
  return { file: found, config: normalize(raw) };
}

/** Engine name, engine settings and model for a head id or "ravana". */
export function resolve(cfg, id, { forceDemo = false } = {}) {
  if (forceDemo) return { engineName: 'demo', engine: { type: 'demo' }, model: '' };
  const over = (id === 'ravana' ? cfg.ravana : cfg.heads[id]) || {};
  const engineName = over.engine || cfg.engine || 'claude';
  const engine = cfg.engines[engineName];
  if (!engine) throw new Error(`Head "${id}" uses engine "${engineName}", which is not defined in "engines".`);
  return { engineName, engine, model: over.model || engine.model || '' };
}

export function validate(cfg) {
  const problems = [];
  for (const [name, e] of Object.entries(cfg.engines)) {
    if (!['claude-code', 'anthropic', 'openai', 'cli', 'demo'].includes(e.type)) problems.push(`engines.${name}.type must be claude-code, anthropic, openai, cli or demo`);
    if (e.type === 'openai' && !e.baseUrl) problems.push(`engines.${name} needs a baseUrl`);
    if (e.type === 'cli' && (!Array.isArray(e.command) || !e.command.length)) problems.push(`engines.${name} needs a command array`);
    if ('apiKey' in e) problems.push(`engines.${name} contains apiKey. Put the key in an environment variable and reference it with apiKeyEnv.`);
  }
  for (const id of [...ORDER, 'ravana']) {
    try { resolve(cfg, id); } catch (err) { problems.push(err.message); }
  }
  for (const id of Object.keys(cfg.heads)) if (!ORDER.includes(id)) problems.push(`heads.${id} is not one of the ten heads (${ORDER.join(', ')})`);
  return problems;
}

export function writeConfig(file, raw) {
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
  return file;
}
