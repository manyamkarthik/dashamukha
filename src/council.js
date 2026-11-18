// The debate protocol.
//   1. speak   all ten heads answer through their own lens, in parallel
//   2. clash   each head reads the others and answers one or two with @Name
//   3. regrow  the most-attacked heads grow back with a stronger argument
//   4. verdict Ravana weighs everything and decides
import { parseMentions, parseReplies, segmentsFor } from './personas.js';

const label = (h) => `${h.name} (${h.english})`;

export const systemFor = (head, rules) => `${head.prompt}\n\n${rules}`.trim();

function formatRound(heads, entries) {
  return heads.filter((h) => entries[h.id]?.text).map((h) => `${label(h)}:\n${entries[h.id].text}`).join('\n\n');
}

const block = (problem) => `The problem before the council:\n"""\n${problem}\n"""`;

export const speakPrompt = (problem, words) =>
  `${block(problem)}\n\nRound 1 - SPEAK. Give your view through your lens in at most ${words} words. Your FIRST line must be "Point: " followed by your headline in at most 6 words (for example "Point: Ship it before the rivals do"). End with one final line that starts with "Stance:" and states your position in one sentence.`;

export const clashPrompt = (problem, round1, head, words) =>
  `${block(problem)}\n\nHere is what every head said in round 1:\n\n${round1}\n\nRound 2 - CLASH. You are ${label(head)}. Answer one or two of the OTHER heads directly. Start each reply with @Name and (agree) or (disagree), for example "@Krodha (disagree): ...". Then one or two sharp sentences on exactly what they got right or wrong. At most ${words} words in total.`;

export const regrowPrompt = (problem, own, attacks, words) =>
  `${block(problem)}\n\nYour round 1 view was:\n${own || '(none)'}\n\nIn the clash, other heads cut you down:\n${attacks.join('\n')}\n\nRound 3 - REGROW. Like Ravana's head growing back after it is cut off, return with a STRONGER version of your position that answers these attacks head-on. Concede what is fair, then show why your lens still matters. Your FIRST line must be "Point: " followed by your sharpened headline in at most 6 words. At most ${words} words.`;

export function verdictPrompt(problem, heads, t) {
  const parts = [block(problem), `ROUND 1 - SPEAK\n\n${formatRound(heads, t.rounds.speak)}`];
  if (Object.keys(t.rounds.clash).length) parts.push(`ROUND 2 - CLASH\n\n${formatRound(heads, t.rounds.clash)}`);
  if (Object.keys(t.rounds.regrow).length) parts.push(`ROUND 3 - REGROW\n\n${formatRound(heads, t.rounds.regrow)}`);
  parts.push('Now give your verdict.');
  return parts.join('\n\n---\n\n');
}

async function pool(items, limit, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

export function mostAttacked(clash, count, order) {
  const tally = {};
  for (const [attacker, entry] of Object.entries(clash)) {
    // Only disagreements cut a head down; older transcripts have no attacks list.
    for (const target of entry.attacks || entry.targets || []) if (target !== attacker) (tally[target] ||= []).push(attacker);
  }
  return Object.entries(tally)
    .sort((a, b) => b[1].length - a[1].length || order.indexOf(a[0]) - order.indexOf(b[0]))
    .slice(0, count)
    .map(([id, attackers]) => ({ id, attackers }));
}

/**
 * @param {object} o
 * @param {string} o.problem
 * @param {{heads: object[], ravana: object, rules: string}} o.personas
 * @param {(req) => Promise<string>} o.call   ({head, round, system, prompt, onDelta, signal, problem, transcript}) => text
 * @param {(type, data) => void} [o.emit]
 * @param {object} [o.settings] {clash, regrow, regrowCount, words, concurrency}
 */
export async function runCouncil({ problem, personas, call, emit = () => {}, settings = {}, signal }) {
  const s = { clash: true, regrow: true, regrowCount: 3, words: 90, concurrency: 5, ...settings };
  const { heads, ravana, rules } = personas;
  const order = heads.map((h) => h.id);
  const t = { problem, startedAt: new Date().toISOString(), rounds: { speak: {}, clash: {}, regrow: {} }, verdict: '', errors: [] };
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Council dismissed', 'AbortError'); };

  const say = async (head, round, prompt) => {
    checkAbort();
    emit('head:start', { id: head.id, round });
    let streamed = '';
    try {
      const final = await call({
        head, round, signal, prompt, problem, transcript: t, system: systemFor(head, rules),
        onDelta: (text) => { streamed += text; emit('head:delta', { id: head.id, round, text }); },
      });
      const text = String(final ?? streamed).trim();
      if (!text) throw new Error('Empty answer');
      const targets = round === 'speak' ? [] : parseMentions(text, head.id, heads);
      const entry = { text, targets };
      if (round === 'clash') {
        const replies = parseReplies(text, head.id, heads);
        entry.replies = replies;
        entry.attacks = [...new Set(replies.filter((r) => r.kind !== 'agree').map((r) => r.to))];
      }
      t.rounds[round][head.id] = entry;
      emit('head:done', { id: head.id, round, ...entry });
    } catch (err) {
      if (signal?.aborted) throw err;
      t.errors.push({ id: head.id, round, message: err.message });
      emit('head:error', { id: head.id, round, message: err.message });
    }
  };

  emit('phase', { name: 'speak' });
  await pool(heads, s.concurrency, (h) => say(h, 'speak', speakPrompt(problem, s.words)));
  checkAbort();
  if (!Object.keys(t.rounds.speak).length) throw new Error(`No head could speak. First error: ${t.errors[0]?.message}`);

  if (s.clash) {
    emit('phase', { name: 'clash' });
    const r1 = formatRound(heads, t.rounds.speak);
    await pool(heads.filter((h) => t.rounds.speak[h.id]), s.concurrency, (h) => say(h, 'clash', clashPrompt(problem, r1, h, Math.round(s.words * 0.8))));
    checkAbort();

    const cut = s.regrow ? mostAttacked(t.rounds.clash, s.regrowCount, order) : [];
    if (cut.length) {
      emit('phase', { name: 'regrow', ids: cut.map((c) => c.id), attackers: Object.fromEntries(cut.map((c) => [c.id, c.attackers])) });
      await pool(cut, s.concurrency, ({ id, attackers }) => {
        const head = heads.find((h) => h.id === id);
        const attacks = attackers.flatMap((a) => segmentsFor(t.rounds.clash[a].text, id, heads).map((seg) => `${heads.find((h) => h.id === a).name}: ${seg}`));
        return say(head, 'regrow', regrowPrompt(problem, t.rounds.speak[id]?.text, attacks, Math.round(s.words * 0.8)));
      });
      checkAbort();
    }
  }

  emit('phase', { name: 'verdict' });
  emit('verdict:start', {});
  let streamed = '';
  try {
    const final = await call({
      head: ravana, round: 'verdict', signal, problem, transcript: t, system: ravana.prompt,
      prompt: verdictPrompt(problem, heads, t),
      onDelta: (text) => { streamed += text; emit('verdict:delta', { text }); },
    });
    t.verdict = String(final ?? streamed).trim();
    emit('verdict:done', { text: t.verdict });
  } catch (err) {
    if (signal?.aborted) throw err;
    t.errors.push({ id: 'ravana', round: 'verdict', message: err.message });
    emit('verdict:error', { message: err.message });
  }
  t.finishedAt = new Date().toISOString();
  return t;
}

export function toMarkdown(t, heads) {
  const out = ['# Dashamukha council', '', `> ${t.problem.replace(/\n/g, '\n> ')}`, ''];
  if (t.verdict) out.push("## Ravana's verdict", '', t.verdict, '');
  const round = (title, entries) => {
    const hs = heads.filter((h) => entries[h.id]);
    if (!hs.length) return;
    out.push(`## ${title}`, '');
    for (const h of hs) out.push(`### ${h.name} · ${h.english}`, '', entries[h.id].text, '');
  };
  round('Round 1 · Speak', t.rounds.speak);
  round('Round 2 · Clash', t.rounds.clash);
  round('Round 3 · Regrow', t.rounds.regrow);
  if (t.errors.length) out.push('## Errors', '', ...t.errors.map((e) => `- ${e.id} (${e.round}): ${e.message}`), '');
  return out.join('\n');
}
