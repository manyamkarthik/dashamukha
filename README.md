# Dashamukha · ten heads, one decision

> दशमुख: "the ten-faced one", a name of Ravana.

Ravana had ten heads, and each one thought differently. Dashamukha puts your hard question before ten AI agents, one per head. They speak, argue with each other, grow back stronger when they get cut down, and then Ravana gives the verdict. You watch it happen live in your browser.

**The question put to the council:**

> *"I'm a solo developer with a full-time job, 10 hours a week and $3,000 saved. Should I build a paid SaaS, grow an audience first, or freelance AI integration?"*

https://github.com/user-attachments/assets/2f3368a3-5636-4aa8-a1ec-71f3ba16768f

<p align="center"><sub>A real council, replayed. Turn the sound on. (No video player? <a href="docs/demo.gif">Here is a GIF</a>.)</sub></p>

**Ravana's verdict:**

> Drop the meeting-notes SaaS. Sell agencies one fixed-price AI integration package within 30 days, then turn what they buy repeatedly into code.

- **Speak.** Each head lights up and gives its point in six words. The full answer is one click away.
- **Clash.** Disagreements fly as comets and knock heads off their pedestals. Agreements pull allies together with gold threads.
- **Regrow.** The most-attacked heads are sliced off, then grow back with a stronger case.
- **Verdict.** The heads Ravana listened to pour light into the core, and the decision lands with a gong.
- **The report.** One verdict, the heads that swayed it, three next steps, the risks and the strongest dissent. Copy it as markdown.

<div align="center">

| Head | Means | Lens |
|---|---|---|
| **Kama** काम | Desire | What do we truly want? |
| **Krodha** क्रोध | Anger | The furious critic. Attacks weak reasoning. |
| **Moha** मोह | Attachment | Sunk costs, pet ideas, bias. |
| **Lobha** लोभ | Greed | Upside and leverage. Where is 10x hiding? |
| **Mada** मद | Pride | The boldest, most confident position. |
| **Ahamkara** अहंकार | Ego | Identity and ownership. |
| **Matsarya** मात्सर्य | Envy | Rivals: who does this better? |
| **Ghrina** घृणा | Disgust | What people will hate. What to cut. |
| **Bhaya** भय | Fear | Risks and irreversible moves. |
| **Buddhi** बुद्धि | Intellect | Evidence and the deciding experiment. |

</div>

## Use it from your agent

```bash
git clone https://github.com/manyamkarthik/dashamukha
cd dashamukha
claude
```

```
> /council Should we rewrite our backend in Rust this quarter?
```

The first time, your agent asks which models the heads should use. Skip that and every head runs on Claude Code with your own login, no API key. Then a page opens at `http://localhost:4310` and the council begins. When it ends, your agent reports Ravana's verdict.

It works the same way from Codex, Gemini CLI, opencode or any harness that reads `AGENTS.md`. Ask it to "ask the ten heads".

No dependencies. Node 18.17 or newer.

## How a council runs

1. **Speak**: each head answers through its own lens.
2. **Clash**: each head reads the others and goes after one or two of them by name. On stage, the heads turn to face each other and light runs between them.
3. **Regrow**: like Ravana's heads growing back, the most-attacked heads return with a stronger case.
4. **Verdict**: Ravana weighs everything: verdict, reasoning, strongest dissent, risks, next steps.

## Any model on any head

`dashamukha.config.json` decides which engine and model each head uses. Your agent writes it during setup; `AGENTS.md` has the full reference.

- **Claude Code** (default): one `claude -p` per head, persona appended to Claude Code's system prompt, read-only tools in the folder you point it at
- **Any OpenAI-compatible API**: OpenRouter, OpenAI, Groq, Together, Ollama, LM Studio, vLLM, a LiteLLM proxy
- **Anthropic API**
- **Any agent CLI**: Codex, Gemini CLI, opencode, or a script
- **Demo**: scripted heads for trying it out

Mix them. Krodha on Opus, Bhaya on a local Qwen, Buddhi through OpenRouter. Keys stay in environment variables; the config only names them.

## Without an agent

```bash
node bin/dashamukha.js run "Monolith or microservices for our MVP?"
node bin/dashamukha.js run "..." --cwd ~/code/my-app     # heads may read this folder
node bin/dashamukha.js run "..." --demo                  # no model calls
node bin/dashamukha.js doctor                            # what runs where, what is missing
```

## Make the heads yours

- **Personas**: `heads/<id>.md`. Edit the prompt to change how a head thinks.
- **Portraits**: the heads ship with portraits in `web/heads/` (`<id>.jpg`, plus `<id>-talk.jpg` for a mouth-open frame while a head speaks, and `ravana.jpg` for the core). Replace any of them with your own; delete them all and the stage falls back to icons. See `web/heads/README.md` for the prompts used.

## Security

The viewer binds to `127.0.0.1`, is read-only and rejects foreign `Host` headers. Claude Code heads get read-only tools by default, and do not load your MCP servers. Councils are saved as JSONL in `~/.dashamukha/sessions/`.

## Develop

```bash
npm test
npm run demo
```

To re-record the demo video above after changing the stage (needs Google Chrome and ffmpeg), start the viewer and run `node scripts/record-demo.mjs <session-id>`. It replays the council in headless Chrome, renders the sound effects from the page's own sound log, and writes `docs/demo.mp4` and `docs/demo.gif`.

## License

MIT
