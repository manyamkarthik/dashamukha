// Any agent CLI as a head: Codex, Gemini CLI, opencode, aider, a script...
//
//   "codex": { "type": "cli", "command": ["codex", "exec", "--skip-git-repo-check", "{prompt}"],
//              "modelArgs": ["-m", "{model}"] }
//
// Placeholders in command/modelArgs: {prompt}, {system}, {model}.
// With no {prompt} placeholder the prompt is written to stdin. With no {system}
// placeholder the head's persona is put in front of the prompt. Everything the
// command prints on stdout is the head's answer.
import { spawn } from 'node:child_process';

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

export function buildCli({ provider = {}, model, system, prompt }) {
  const command = [...(provider.command || [])];
  if (!command.length) throw new Error('CLI engine needs a "command" array.');
  const usesPrompt = command.some((a) => a.includes('{prompt}'));
  const usesSystem = command.some((a) => a.includes('{system}'));
  const body = usesSystem ? prompt : `${system}\n\n---\n\n${prompt}`;
  const fill = (a) => a.replaceAll('{prompt}', body).replaceAll('{system}', system).replaceAll('{model}', model || '');
  const args = command.slice(1).map(fill);
  if (model && Array.isArray(provider.modelArgs)) args.push(...provider.modelArgs.map(fill));
  return { bin: command[0], args, stdin: usesPrompt ? null : body };
}

export function runCli({ provider = {}, model, system, prompt, cwd, signal, onDelta }) {
  const { bin, args, stdin } = buildCli({ provider, model, system, prompt });
  const timeoutMs = (provider.timeoutSec || 600) * 1000;
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: cwd || process.cwd(), env: { ...process.env, NO_COLOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (d) => {
      const text = d.toString('utf8').replace(ANSI, '');
      out += text;
      onDelta?.(text);
    });
    child.stderr.on('data', (d) => { err = (err + d.toString('utf8')).slice(-3000); });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error(`"${bin}" was not found on PATH.`) : e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      if (code !== 0 && !out.trim()) return reject(new Error(`${bin} exited with code ${code}${err ? `: ${err.replace(ANSI, '').trim().slice(-300)}` : ''}`));
      resolve(out.trim());
    });
    child.stdin.end(stdin ?? '');
  });
}
