import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DASHAMUKHA_HOME = mkdtempSync(path.join(tmpdir(), 'dm-test-'));

const { runCouncil, mostAttacked, toMarkdown } = await import('../src/council.js');
const { makeDemoCall } = await import('../src/engines/demo.js');
const { loadPersonas, parseMentions, parseReplies, segmentsFor, findHeadId, parsePersona } = await import('../src/personas.js');
const { normalize, resolve, validate } = await import('../src/config.js');
const { buildCli, runCli } = await import('../src/engines/cli.js');
const { convene } = await import('../src/convene.js');
const { readEvents, listSessions, statusOf, sessionFile } = await import('../src/session.js');
const { claudeArgs, runClaudeCode } = await import('../src/engines/claude-code.js');

const personas = loadPersonas();
const { heads } = personas;

test('ten personas load from markdown, in order', () => {
  assert.deepEqual(heads.map((h) => h.id), ['kama', 'krodha', 'moha', 'lobha', 'mada', 'ahamkara', 'matsarya', 'ghrina', 'bhaya', 'buddhi']);
  for (const h of heads) assert.ok(h.prompt.length > 80 && h.tint.startsWith('#') && h.devanagari, h.id);
  assert.match(personas.ravana.prompt, /Verdict/);
  assert.equal(parsePersona('---\nname: X\ntint: "#fff"\n---\nHello').tint, '#fff');
});

test('mentions resolve names and aliases and skip self', () => {
  assert.deepEqual(parseMentions('@Krodha: no. @moh yes. @Maatsarya hm', 'kama', heads), ['krodha', 'moha', 'matsarya']);
  assert.deepEqual(parseMentions('@Kama me', 'kama', heads), []);
  assert.equal(findHeadId('Fear', heads), 'bhaya');
  assert.deepEqual(segmentsFor('@Mada: one. @Bhaya: two.', 'bhaya', heads), ['@Bhaya: two.']);
});

test('a demo council runs all four rounds', async () => {
  const phases = [];
  const t = await runCouncil({ problem: 'Ship on Friday?', personas, call: makeDemoCall({ delay: 0, jitter: 0 }), emit: (e, d) => e === 'phase' && phases.push(d.name), settings: { concurrency: 10 } });
  assert.deepEqual(phases, ['speak', 'clash', 'regrow', 'verdict']);
  assert.equal(Object.keys(t.rounds.speak).length, 10);
  assert.ok(Object.keys(t.rounds.regrow).length >= 1);
  assert.match(toMarkdown(t, heads), /^# Dashamukha council[\s\S]*## Ravana's verdict[\s\S]*## Round 1/);
});

test('one failing head does not sink the council', async () => {
  const demo = makeDemoCall({ delay: 0, jitter: 0 });
  const t = await runCouncil({ problem: 'x', personas, settings: { clash: false }, call: (r) => (r.head.id === 'krodha' ? Promise.reject(new Error('boom')) : demo(r)) });
  assert.equal(Object.keys(t.rounds.speak).length, 9);
  assert.equal(t.errors[0].id, 'krodha');
  assert.ok(t.verdict);
});

test('most attacked heads come first', () => {
  const clash = { kama: { targets: ['bhaya'] }, mada: { targets: ['bhaya', 'kama'] }, lobha: { targets: ['kama'] }, buddhi: { targets: ['bhaya'] } };
  assert.deepEqual(mostAttacked(clash, 2, heads.map((h) => h.id)).map((x) => x.id), ['bhaya', 'kama']);
});

test('no config means every head on Claude Code', () => {
  const cfg = normalize({});
  for (const h of [...heads, personas.ravana]) assert.equal(resolve(cfg, h.id).engine.type, 'claude-code');
  assert.deepEqual(validate(cfg), []);
});

test('per-head overrides and validation', () => {
  const cfg = normalize({ engines: { local: { type: 'openai', baseUrl: 'http://x/v1', model: 'q' } }, heads: { bhaya: { engine: 'local' }, krodha: { model: 'opus' } }, ravana: { model: 'opus' } });
  assert.equal(resolve(cfg, 'bhaya').model, 'q');
  assert.equal(resolve(cfg, 'krodha').engine.type, 'claude-code');
  assert.equal(resolve(cfg, 'krodha').model, 'opus');
  assert.equal(resolve(cfg, 'ravana').model, 'opus');
  const bad = normalize({ engines: { k: { type: 'openai', baseUrl: 'x', apiKey: 'sk-123' } }, heads: { nobody: {} }, engine: 'missing' });
  const problems = validate(bad).join('\n');
  assert.match(problems, /apiKeyEnv/);
  assert.match(problems, /nobody/);
  assert.match(problems, /missing/);
});

test('cli engine fills placeholders and reads stdout', async () => {
  const b = buildCli({ provider: { command: ['tool', '-s', '{system}', '{prompt}'], modelArgs: ['-m', '{model}'] }, model: 'm1', system: 'SYS', prompt: 'P' });
  assert.deepEqual(b.args, ['-s', 'SYS', 'P', '-m', 'm1']);
  const viaStdin = buildCli({ provider: { command: ['tool'] }, system: 'SYS', prompt: 'P' });
  assert.match(viaStdin.stdin, /SYS[\s\S]*P/);
  const script = path.join(process.env.DASHAMUKHA_HOME, 'echo.sh');
  writeFileSync(script, '#!/bin/sh\ncat | tr a-z A-Z\n');
  chmodSync(script, 0o755);
  const out = await runCli({ provider: { command: [script] }, system: 'be brief', prompt: 'hello' });
  assert.match(out, /BE BRIEF[\s\S]*HELLO/);
});

test('convene records a replayable session', async () => {
  const { id, transcript } = await convene({ problem: 'Should we?', cfg: normalize({ concurrency: 10 }), personas, forceDemo: true, cwd: process.cwd() });
  const events = readEvents(id);
  assert.equal(events[0].type, 'session');
  assert.equal(events[0].data.engines.kama.engine, 'demo');
  assert.equal(events.at(-1).type, 'end');
  assert.equal(events.at(-1).data.transcript.verdict, transcript.verdict);
  assert.equal(listSessions()[0].status, 'done');
});

test('claude-code heads are isolated: no MCP servers, no prompts, --tools last', () => {
  const a = claudeArgs({ provider: {}, model: 'sonnet', system: 'SYS' });
  for (const f of ['-p', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']) assert.ok(a.includes(f), f);
  assert.equal(a[a.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.equal(a[a.indexOf('--append-system-prompt') + 1], 'SYS');
  assert.deepEqual(a.slice(-2), ['--tools', 'Read,Grep,Glob']);
  const b = claudeArgs({ provider: { mcp: true, tools: '', replaceSystemPrompt: true }, system: 'S' });
  assert.ok(!b.includes('--strict-mcp-config'));
  assert.ok(b.includes('--system-prompt'));
  assert.deepEqual(b.slice(-2), ['--tools', '']);
});

test('claude-code engine parses stream-json and times out a hung head', async () => {
  const fake = path.join(process.env.DASHAMUKHA_HOME, 'fake-claude.sh');
  const lines = [
    { type: 'system', subtype: 'init' },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Let me look. ' } } },
    { type: 'stream_event', event: { type: 'message_start' } },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Final answer.' } } },
    { type: 'result', subtype: 'success', is_error: false, result: 'Final answer.' },
  ].map((l) => JSON.stringify(l)).join('\n');
  writeFileSync(fake, `#!/bin/sh\ncat > /dev/null\nprintf '%s\\n' '${lines.replace(/'/g, "'\\''")}'\n`);
  chmodSync(fake, 0o755);
  let streamed = '';
  const out = await runClaudeCode({ provider: { binary: fake }, prompt: 'q', onDelta: (t) => { streamed += t; } });
  assert.equal(out, 'Final answer.');
  assert.equal(streamed, 'Let me look. \nFinal answer.');

  const hang = path.join(process.env.DASHAMUKHA_HOME, 'hang-claude.sh');
  writeFileSync(hang, '#!/bin/sh\nexec sleep 30\n');
  chmodSync(hang, 0o755);
  await assert.rejects(runClaudeCode({ provider: { binary: hang, timeoutSec: 0.3 }, prompt: 'q' }), /longer than/);

  const failing = path.join(process.env.DASHAMUKHA_HOME, 'fail-claude.sh');
  writeFileSync(failing, `#!/bin/sh\ncat > /dev/null\necho '${JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in' })}'\n`);
  chmodSync(failing, 0o755);
  await assert.rejects(runClaudeCode({ provider: { binary: failing }, prompt: 'q' }), /Not logged in/);

  // A usage-limit error arrives as a plain assistant message: it must not stream as an answer.
  const limited = path.join(process.env.DASHAMUKHA_HOME, 'limit-claude.sh');
  const limitLines = [
    { type: 'assistant', message: { content: [{ type: 'text', text: "You've hit your limit" }] } },
    { type: 'result', subtype: 'success', is_error: true, result: "You've hit your limit" },
  ].map((l) => JSON.stringify(l)).join('\n');
  writeFileSync(limited, `#!/bin/sh\ncat > /dev/null\nprintf '%s\\n' '${limitLines.replace(/'/g, "'\\''")}'\n`);
  chmodSync(limited, 0o755);
  let leaked = '';
  await assert.rejects(runClaudeCode({ provider: { binary: limited }, prompt: 'q', onDelta: (t) => { leaked += t; } }), /hit your limit/);
  assert.equal(leaked, '');
});

test('a session whose process died reads as stopped, and bad files do not break the list', () => {
  assert.equal(statusOf({ data: { pid: process.pid } }, false), 'live');
  assert.equal(statusOf({ data: { pid: 2 ** 22 + 12345 } }, false), 'stopped');
  assert.equal(statusOf({ data: {} }, false), 'live');
  assert.equal(statusOf({ data: { pid: 2 ** 22 + 12345 } }, true), 'done');
  writeFileSync(sessionFile('20200101-000000-broken'), '{"t":1,"type":"sess');
  const list = listSessions(100);
  assert.ok(list.some((s) => s.id === '20200101-000000-broken'));
});

test('clash replies carry agree or disagree, and only disagreement cuts a head', () => {
  const r = parseReplies('@Krodha (agree): Yes, define done.\n\n@Bhaya [disagree] Fear is not a plan. @Moh: untagged means disagree.', 'buddhi', heads);
  assert.deepEqual(r.map((x) => [x.to, x.kind]), [['krodha', 'agree'], ['bhaya', 'disagree'], ['moha', 'disagree']]);
  assert.equal(r[0].text, 'Yes, define done.');
  const clash = {
    kama: { targets: ['bhaya'], attacks: ['bhaya'] },
    buddhi: { targets: ['krodha', 'bhaya'], attacks: ['bhaya'] },
    mada: { targets: ['krodha'], attacks: [] },
  };
  assert.deepEqual(mostAttacked(clash, 3, heads.map((h) => h.id)).map((c) => c.id), ['bhaya']);
});
