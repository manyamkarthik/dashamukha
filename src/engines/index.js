import { runClaudeCode } from './claude-code.js';
import { runAnthropic, runOpenAICompatible } from './http.js';
import { runCli } from './cli.js';
import { makeDemoCall } from './demo.js';

const demo = makeDemoCall({ delay: 18 });

/** Call one engine. `req` carries head, round, system, prompt, onDelta, signal. */
export function callEngine(engine, model, cwd, req) {
  const args = { ...req, provider: engine, model, cwd };
  switch (engine.type) {
    case 'claude-code': return runClaudeCode(args);
    case 'anthropic': return runAnthropic(args);
    case 'openai': return runOpenAICompatible(args);
    case 'cli': return runCli(args);
    case 'demo': return demo(req);
    default: throw new Error(`Unknown engine type "${engine.type}"`);
  }
}
