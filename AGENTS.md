# Dashamukha: instructions for agents

This repo is a council of ten agents modelled on Ravana's ten heads. You (the
harness: Claude Code, Codex, Gemini CLI, opencode, ...) are the user's interface.
You set it up, run it, and report the verdict. The browser page is only a viewer.
There is nothing to configure in it.

No dependencies, Node 18.17+. Every command is `node bin/dashamukha.js <command>`
from the repo root.

## When the user asks the council something

Triggers: `/council <question>`, "ask the ten heads", "ask Ravana", "run the council".

1. **Check the setup.** Run `node bin/dashamukha.js doctor --json`.
   - If `firstRun` is `true`, do the first-time setup below, then continue.
   - If `problems` is not empty, fix them with the user before running. Common fixes:
     Claude Code not signed in (`claude` once), an env var not exported, Ollama not running.
2. **Sharpen the question.** Turn the request into one self-contained question.
   Include the context the heads need (constraints, numbers, deadlines, what was
   already tried). If the user is asking about code, pass the project folder with `--cwd`.
3. **Run it.** A council takes 2 to 6 minutes. Use one of:
   - Long-running command (preferred when your shell allows 10 minutes):
     `node bin/dashamukha.js run "<question>" [--cwd <project>]` with a 600000 ms timeout.
   - If your shell times out sooner: `node bin/dashamukha.js run "<question>" --detach`
     returns `{id, url}` at once, then `node bin/dashamukha.js result <id> --wait`.
     `result` exits 1 with the reason if the council process died, and 2 if the heads
     spoke but Ravana gave no verdict (the Errors section says why, e.g. a usage limit).
   Either way the viewer opens in the browser at `http://localhost:4310`. Tell the
   user the URL right away so they can watch the heads argue.
4. **Report.** stdout is markdown with Ravana's verdict first. Give the user:
   the verdict, the two or three heads whose arguments changed the outcome, the
   strongest dissent, and the next steps. Offer the full transcript; do not paste it unasked.
   If heads errored, say which and why (the markdown ends with an Errors section).

## First-time setup (no dashamukha.config.json)

Ask before writing anything. Use multiple-choice questions where your harness has them.
Base the options on what `doctor --json` detected (`detected.clis`,
`detected.local.ollama.models`, `detected.envKeys`). Keep it short: two or three questions.

1. **Engine for the ten heads.** Default and recommended: *Claude Code* (this
   harness, the user's own login, no API key). Other options only if detected:
   another agent CLI (Codex, Gemini CLI, opencode), a local model server (Ollama,
   LM Studio), or an API whose key is already in the environment (OpenRouter,
   Anthropic, OpenAI, Groq).
2. **Models.** One model for every head, or a mix (different models argue more
   differently, which is the point of a council). For Claude Code the model is an
   alias: `haiku` (fast, cheap), `sonnet` (balanced), `opus` (strongest).
3. **Ravana's model.** The verdict benefits most from the strongest model available.

If the user says "just run it" or skips setup, do not write a config: with no file,
every head and Ravana run on Claude Code with its default model.

Then write `dashamukha.config.json` in the repo root, run `doctor` again, and show
the user the head-to-model table it prints. Quick path for Claude Code only:
`node bin/dashamukha.js init --model sonnet --ravana-model opus`.

**Never write API keys into the config.** HTTP engines name an environment
variable in `apiKeyEnv`. If it is not set, tell the user which variable to export.

## Config reference

```jsonc
{
  "engine": "claude",                 // default engine for all ten heads
  "engines": {
    "claude":     { "type": "claude-code", "model": "sonnet", "tools": "Read,Grep,Glob" },
    "local":      { "type": "openai", "baseUrl": "http://localhost:11434/v1", "model": "qwen3:14b" },
    "openrouter": { "type": "openai", "baseUrl": "https://openrouter.ai/api/v1", "apiKeyEnv": "OPENROUTER_API_KEY", "model": "deepseek/deepseek-chat" },
    "anthropic":  { "type": "anthropic", "apiKeyEnv": "ANTHROPIC_API_KEY", "model": "claude-sonnet-5-5" },
    "codex":      { "type": "cli", "command": ["codex", "exec", "--skip-git-repo-check", "{prompt}"] }
  },
  "heads": {                          // optional per-head overrides
    "krodha": { "engine": "claude", "model": "opus" },
    "bhaya":  { "engine": "local" },
    "buddhi": { "engine": "openrouter", "model": "qwen/qwen3-235b-a22b" }
  },
  "ravana": { "engine": "claude", "model": "opus" },
  "rounds": { "clash": true, "regrow": true },
  "words": 90,          // length of each head's turn
  "concurrency": 5,     // heads thinking at once
  "port": 4310
}
```

Engine types:

- `claude-code`: runs `claude -p` per head with the persona appended to Claude
  Code's system prompt. `model` (alias or full name), `tools` (default
  `Read,Grep,Glob`: read-only, inside `--cwd`), `binary` (default `claude`),
  `replaceSystemPrompt` (default false), `timeoutSec` (default 600 per head),
  `permissionMode` (default `dontAsk`: anything not pre-approved is denied, never
  waits on a prompt), `mcp` (default false: heads run with `--strict-mcp-config`,
  so the user's MCP servers are not loaded into every head; set true to allow them).
- `openai`: any OpenAI-compatible `/chat/completions` endpoint. `baseUrl`, `model`,
  `apiKeyEnv` (omit for local servers).
- `anthropic`: the Messages API. `model`, `apiKeyEnv` (default `ANTHROPIC_API_KEY`).
- `cli`: any command that prints an answer to stdout. `command` is an array with
  placeholders `{prompt}`, `{system}`, `{model}`; without `{prompt}` the prompt
  goes to stdin, without `{system}` the persona is put in front of the prompt.
  `modelArgs` (for example `["-m", "{model}"]`) is added only when a model is set.
  Before writing one, check the tool's `--help` for its non-interactive mode and
  make sure it prints only the final answer.
- `demo`: scripted heads, no model calls. Also `run --demo`.

`claude` and `demo` exist without being declared.

## The heads

Personas live in `heads/<id>.md` (frontmatter + system prompt). `heads/_rules.md`
is appended to every head. `heads/ravana.md` is the verdict prompt. Edit these when
the user wants a head to think differently. Ids, in order:
`kama krodha moha lobha mada ahamkara matsarya ghrina bhaya buddhi`.

Portraits for the viewer go in `web/heads/` (see the README there).

## Rounds

1. **Speak**: all ten heads answer through their own lens. Each turn starts with a
   `Point:` headline (6 words at most) and ends with a `Stance:` line; the viewer
   shows the headline on stage and on the board.
2. **Clash**: each head reads the others and answers one or two with
   `@Name (agree)` or `@Name (disagree)`. Disagreements fly as fireballs on stage.
3. **Regrow**: the most-disagreed-with heads are cut off and grow back with a stronger case.
4. **Verdict**: Ravana decides.

## Files

- `bin/dashamukha.js`: CLI (`run`, `result`, `doctor`, `init`, `view`)
- `src/council.js`: the protocol; `src/engines/`: engine adapters
- `src/viewer.js` + `web/`: the read-only viewer (`web/stage.js` draws the stage: a galaxy, Ravana's core at the centre, the ten heads as orbs on pedestals around it). Sessions are JSONL event logs
  in `~/.dashamukha/sessions/`
- `test/`: `npm test`
