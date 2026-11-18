#!/usr/bin/env node
// Dashamukha CLI. Meant to be driven by an agent harness (see AGENTS.md),
// but works by hand too.
import { spawn } from 'node:child_process';
import { existsSync, openSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig, FILE_NAME, BUILTIN_ENGINES } from '../src/config.js';
import { loadPersonas } from '../src/personas.js';
import { convene } from '../src/convene.js';
import { toMarkdown } from '../src/council.js';
import { createSession, sessionFile, readEvents, logFile, statusOf, STOPPED } from '../src/session.js';
import { startViewer, viewerAlive, viewerInfo } from '../src/viewer.js';
import { doctor } from '../src/doctor.js';
import { HOME, VERSION } from '../src/paths.js';

const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const VALUE_FLAGS = ['port', 'cwd', 'config', 'session', 'engine', 'model', 'ravana-model', 'idle'];
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes((argv[i - 1] || '').replace(/^--/, '')));
const [command, ...rest] = positional;

const tty = process.stderr.isTTY;
const paint = (hex, s) => {
  if (!tty || !hex) return s;
  const [r, g, b] = hex.replace('#', '').match(/\w\w/g).map((x) => parseInt(x, 16));
  return `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
};
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const log = (s = '') => process.stderr.write(`${s}\n`);
const die = (msg, code = 1) => { log(paint('#C23B22', msg)); process.exit(code); };

const HELP = `
  Dashamukha ${VERSION} · ten heads, one decision

  dashamukha run "question"     convene the council, open the viewer, print the verdict
      --cwd <dir>                 folder the heads may read (default: current folder)
      --detach                    return at once with the session id and viewer URL
      --json                      print the full transcript as JSON instead of markdown
      --no-open                   do not open the browser
      --demo                      scripted heads, no model calls
  dashamukha result <id> [--wait] [--json]   print a session's outcome
  dashamukha doctor [--json]    show engines, models, installed CLIs and problems
  dashamukha init [--engine claude] [--model sonnet] [--ravana-model opus] [--force]
  dashamukha view [--port 4310] start the viewer on its own

  Common: --config <file>, --port <n>
  Setup and engines: see AGENTS.md
`;

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* headless */ }
}

async function ensureViewer(port) {
  if (await viewerAlive(port)) return true;
  mkdirSync(HOME, { recursive: true });
  const out = openSync(path.join(HOME, 'viewer.log'), 'a');
  spawn(process.execPath, [SELF, 'view', '--port', String(port), '--idle', '3600', '--no-open'], { detached: true, stdio: ['ignore', out, out] }).unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 125));
    if (await viewerAlive(port)) return true;
  }
  return false;
}

async function cmdRun() {
  const problem = rest.join(' ').trim();
  if (!problem) die('Usage: dashamukha run "your question"');
  const cwd = path.resolve(opt('cwd', process.cwd()));
  if (!existsSync(cwd)) die(`--cwd folder not found: ${cwd}`);
  const { config } = loadConfig({ file: opt('config'), cwd });
  const port = Number(opt('port', config.port));
  const personas = loadPersonas();
  const forceDemo = flag('demo');

  const id = opt('session');
  const session = id ? { id, file: sessionFile(id) } : createSession();
  const url = `http://localhost:${port}/#${session.id}`;

  if (!flag('no-view') && !id) {
    const up = await ensureViewer(port);
    if (!up) log(dim(`Viewer could not start on port ${port}; see ${path.join(HOME, 'viewer.log')}. The council still runs.`));
    // A viewer tab that is already open follows new councils on its own: no second tab.
    else if (!flag('no-open') && !(await viewerInfo(port))?.watching) openBrowser(url);
  }

  if (flag('detach')) {
    const args = [SELF, 'run', problem, '--session', session.id, '--cwd', cwd, '--no-view'];
    if (opt('config')) args.push('--config', path.resolve(opt('config')));
    if (forceDemo) args.push('--demo');
    // Keep the child's stderr: if it dies, `result` can point at the reason.
    const errLog = openSync(logFile(session.id), 'a', 0o600);
    spawn(process.execPath, args, { detached: true, stdio: ['ignore', 'ignore', errLog], cwd }).unref();
    process.stdout.write(`${JSON.stringify({ id: session.id, url, result: `node ${path.relative(process.cwd(), SELF) || SELF} result ${session.id} --wait` })}\n`);
    return;
  }

  if (!id) log(`\n  ${paint('#DA7C2F', 'Dashamukha')} ${dim('· the council is in session')}\n  ${url}\n`);
  const byId = Object.fromEntries([...personas.heads, personas.ravana].map((h) => [h.id, h]));
  const titles = { speak: 'I · Speak', clash: 'II · Clash', regrow: 'III · Regrow', verdict: 'IV · Verdict' };
  const ac = new AbortController();
  process.on('SIGINT', () => ac.abort());
  process.on('SIGTERM', () => ac.abort());
  try {
    const { transcript } = await convene({
      problem, cfg: config, personas, cwd, forceDemo, signal: ac.signal, session,
      onEvent: (type, d) => {
        if (type === 'phase') log(`  ${paint('#D9A441', titles[d.name])}${d.ids ? dim(`  ${d.ids.join(', ')} ${d.ids.length > 1 ? 'grow' : 'grows'} back`) : ''}`);
        if (type === 'head:done') log(`    ${paint(byId[d.id].tint, '●')} ${byId[d.id].name}${d.targets?.length ? dim(` → ${d.targets.join(', ')}`) : ''}`);
        if (type === 'head:error') log(`    ${paint('#C23B22', '✗')} ${byId[d.id].name}: ${d.message}`);
        if (type === 'verdict:error') log(`    ${paint('#C23B22', '✗')} Ravana: ${d.message}`);
      },
    });
    log('');
    process.stdout.write(flag('json') ? `${JSON.stringify({ id: session.id, url, ...transcript }, null, 2)}\n` : `${toMarkdown(transcript, personas.heads)}\nViewer: ${url}\n`);
    if (!transcript.verdict) process.exitCode = 2;
  } catch (err) {
    die(err.name === 'AbortError' ? 'The council was dismissed.' : err.message);
  }
}

async function cmdResult() {
  const id = rest[0];
  if (!id) die('Usage: dashamukha result <session-id> [--wait]');
  const { heads } = loadPersonas();
  const since = Date.now();
  const why = () => {
    let tail = '';
    try { tail = readFileSync(logFile(id), 'utf8').trim().split('\n').slice(-5).join('\n'); } catch { /* no log */ }
    return tail ? `\n${tail}` : '';
  };
  for (;;) {
    let events;
    try { events = readEvents(id); } catch { die(`Bad session id: ${id}`); }
    // Right after `run --detach` the child may not have written its first event yet.
    if (!events?.length) {
      if (!flag('wait') || Date.now() - since > 30000) die(`No session ${id}${why()}`);
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    const end = events.find((e) => e.type === 'end');
    if (!end && statusOf(events[0], false) === 'stopped') die(`${STOPPED}${why()}`);
    if (end) {
      if (!end.data.ok) die(end.data.error);
      const t = end.data.transcript;
      process.stdout.write(flag('json') ? `${JSON.stringify(t, null, 2)}\n` : `${toMarkdown(t, heads)}\n`);
      // Same contract as `run`: exit 2 when the heads spoke but Ravana gave no verdict.
      if (!t?.verdict) process.exitCode = 2;
      return;
    }
    if (!flag('wait')) {
      const phase = [...events].reverse().find((e) => e.type === 'phase');
      process.stdout.write(`${JSON.stringify({ id, status: 'running', phase: phase?.data.name || 'starting' })}\n`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function cmdDoctor() {
  const report = await doctor({ file: opt('config'), cwd: process.cwd() });
  if (flag('json')) { process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); return; }
  log(`\n  ${paint('#DA7C2F', 'Dashamukha doctor')}\n`);
  log(`  Config   ${report.configFile || dim(`none, so every head runs on Claude Code (create ${FILE_NAME} to change that)`)}`);
  log('\n  Heads');
  for (const [id, a] of Object.entries(report.assignments)) log(`    ${id.padEnd(9)} ${a.engine} ${dim(a.model)}`);
  log('\n  Engines');
  for (const [name, e] of Object.entries(report.engines)) log(`    ${e.ready ? paint('#3E8E5E', '✓') : paint('#C23B22', '✗')} ${name.padEnd(10)} ${dim(`${e.type} · ${e.note}`)}`);
  const d = report.detected;
  log('\n  Detected');
  log(`    CLIs      ${Object.keys(d.clis).join(', ') || 'none'}`);
  log(`    Ollama    ${d.local.ollama.running ? d.local.ollama.models.join(', ') || 'running, no models' : 'not running'}`);
  log(`    LM Studio ${d.local.lmstudio.running ? d.local.lmstudio.models.join(', ') : 'not running'}`);
  log(`    API keys  ${d.envKeys.join(', ') || 'none in environment'}`);
  if (report.problems.length) { log('\n  Problems'); for (const p of report.problems) log(`    ${paint('#C23B22', '•')} ${p}`); }
  log('');
  process.exitCode = report.ok ? 0 : 1;
}

function cmdInit() {
  const file = path.resolve(opt('config', path.join(process.cwd(), FILE_NAME)));
  if (existsSync(file) && !flag('force')) die(`${file} already exists. Edit it, or pass --force to overwrite.`);
  const engine = opt('engine', 'claude');
  if (!BUILTIN_ENGINES[engine]) die(`--engine must be one of: ${Object.keys(BUILTIN_ENGINES).join(', ')}. For other engines, write the "engines" block yourself (see AGENTS.md).`);
  const raw = { engine, engines: {}, heads: {}, ravana: {}, rounds: { clash: true, regrow: true }, words: 90, concurrency: 5 };
  if (opt('model')) raw.engines[engine] = { ...BUILTIN_ENGINES[engine], model: opt('model') };
  if (opt('ravana-model')) raw.ravana = { model: opt('ravana-model') };
  writeConfig(file, raw);
  process.stdout.write(`${file}\n`);
}

async function cmdView() {
  const { config } = loadConfig({ file: opt('config') });
  const port = Number(opt('port', config.port));
  try {
    await startViewer({ port, idleSec: Number(opt('idle', 0)) });
  } catch (err) {
    die(err.code === 'EADDRINUSE' ? `Port ${port} is busy. Try --port ${port + 1}.` : err.message);
  }
  log(`\n  ${paint('#DA7C2F', 'Dashamukha viewer')}  http://localhost:${port}\n`);
  if (!flag('no-open')) openBrowser(`http://localhost:${port}`);
}

const commands = { run: cmdRun, result: cmdResult, doctor: cmdDoctor, init: cmdInit, view: cmdView };
if (!command || flag('help') || argv.includes('-h') || !commands[command]) {
  process.stdout.write(HELP);
  process.exit(command && !commands[command] && !flag('help') ? 1 : 0);
}
await commands[command]();
