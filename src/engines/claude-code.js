// Runs a head through the Claude Code harness: `claude -p` in non-interactive mode.
// Uses the user's own Claude Code login, so no API key is needed. The head's
// persona is appended to Claude Code's system prompt, and tools default to
// read-only so heads can look at the working folder but not change it.
import { spawn } from 'node:child_process';

export const CLAUDE_INSTALL_HINT = 'Claude Code CLI not found. Install it (https://docs.claude.com/en/docs/claude-code), run `claude` once to sign in, or set "binary" for the engine in dashamukha.config.json.';

export function claudeArgs({ provider = {}, model, system }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence'];
  // --tools only limits the built-in tools. Without --strict-mcp-config every head
  // would also load the user's MCP servers (often hundreds of tools, some of them
  // destructive) and pay for their schemas on every call. dontAsk denies anything
  // that would otherwise wait on a permission prompt nobody can answer.
  if (!provider.mcp) args.push('--strict-mcp-config');
  args.push('--disable-slash-commands', '--permission-mode', provider.permissionMode || 'dontAsk');
  if (system) args.push(provider.replaceSystemPrompt ? '--system-prompt' : '--append-system-prompt', system);
  if (model) args.push('--model', model);
  // --tools is variadic, so it must stay last (the prompt goes on stdin).
  args.push('--tools', provider.tools ?? 'Read,Grep,Glob');
  return args;
}

export function runClaudeCode({ provider = {}, model, system, prompt, cwd, signal, onDelta }) {
  const bin = provider.binary || 'claude';
  const args = claudeArgs({ provider, model, system });
  const timeoutMs = (provider.timeoutSec || 600) * 1000;

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, args, { cwd: cwd || process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err.code === 'ENOENT' ? new Error(CLAUDE_INSTALL_HINT) : err);
      return;
    }

    let buf = '';
    let streamed = '';
    let final = null;
    let isError = false;
    let stderr = '';
    let sawDelta = false;
    const held = [];

    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort, { once: true });

    const handle = (line) => {
      if (!line.trim()) return;
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.type === 'stream_event') {
        const ev = msg.event || {};
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          sawDelta = true;
          streamed += ev.delta.text;
          onDelta?.(ev.delta.text);
        } else if (ev.type === 'message_start' && streamed && !/\n\s*$/.test(streamed)) {
          // A new turn after tool use: keep the live text readable.
          streamed += '\n';
          onDelta?.('\n');
        }
      } else if (msg.type === 'assistant' && !sawDelta) {
        // Whole messages without partial deltas come from older CLIs, but also carry
        // errors such as "You've hit your limit". Hold them until the result says
        // the call succeeded, so an error is never shown as something a head said.
        for (const block of msg.message?.content || []) {
          if (block.type === 'text' && block.text) held.push(block.text);
        }
      } else if (msg.type === 'result') {
        final = typeof msg.result === 'string' ? msg.result : null;
        isError = Boolean(msg.is_error) || (msg.subtype && msg.subtype !== 'success');
        if (!isError) for (const text of held.splice(0)) { streamed += text; onDelta?.(text); }
      }
    };

    child.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) !== -1) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
    });
    child.stderr.on('data', (d) => { stderr = (stderr + d.toString('utf8')).slice(-4000); });

    child.on('error', (err) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(err.code === 'ENOENT' ? new Error(CLAUDE_INSTALL_HINT) : err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (buf) handle(buf);
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      if (timedOut) return reject(new Error(`Claude Code took longer than ${timeoutMs / 1000}s (raise "timeoutSec" for the engine)`));
      if (isError) return reject(new Error(`Claude Code: ${final || stderr.trim() || 'request failed'}`));
      if (final == null && !streamed) return reject(new Error(`Claude Code exited with code ${code}${stderr ? `: ${stderr.trim().slice(-300)}` : ''}`));
      resolve(final ?? streamed);
    });

    child.stdin.end(prompt);
  });
}

/** Report whether the Claude Code CLI is installed, and its version. */
export function checkClaudeCode(bin = 'claude') {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try { child = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return resolve({ found: false }); }
    const timer = setTimeout(() => { child.kill(); resolve({ found: false }); }, 8000);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); resolve({ found: false }); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 ? { found: true, version: out.trim().split(/\s+/)[0] } : { found: false }); });
  });
}
