// Loads the ten heads (and Ravana) from heads/*.md.
// Each file is a small frontmatter block followed by the head's system prompt.
// Edit those files to change how a head thinks.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

export const ORDER = ['kama', 'krodha', 'moha', 'lobha', 'mada', 'ahamkara', 'matsarya', 'ghrina', 'bhaya', 'buddhi'];

const ALIASES = { moh: 'moha', maatsarya: 'matsarya', matsara: 'matsarya', ahankara: 'ahamkara', ahamkar: 'ahamkara', ghrna: 'ghrina', bhay: 'bhaya', budhi: 'buddhi', kaam: 'kama', krodh: 'krodha', lobh: 'lobha' };

export function parsePersona(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { prompt: text.trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { ...meta, prompt: m[2].trim() };
}

export function loadPersonas(dir = path.join(ROOT, 'heads')) {
  const read = (id) => {
    const file = path.join(dir, `${id}.md`);
    if (!existsSync(file)) throw new Error(`Missing persona file: ${file}`);
    return { id, ...parsePersona(readFileSync(file, 'utf8')) };
  };
  const rulesFile = path.join(dir, '_rules.md');
  return {
    heads: ORDER.map(read),
    ravana: read('ravana'),
    rules: existsSync(rulesFile) ? readFileSync(rulesFile, 'utf8').trim() : '',
  };
}

/** Resolve "Krodha", "anger" or "moh" to a head id. */
export function findHeadId(token, heads) {
  const t = String(token || '').toLowerCase().replace(/[^a-z]/g, '');
  const id = ALIASES[t] || t;
  return heads.find((h) => h.id === id || (h.english || '').toLowerCase() === t)?.id || null;
}

/** The other heads a reply addresses with @Name, in order. */
export function parseMentions(text, selfId, heads) {
  const ids = [];
  for (const m of String(text || '').matchAll(/@([A-Za-z]+)/g)) {
    const id = findHeadId(m[1], heads);
    if (id && id !== selfId && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The parts of a clash reply addressed to one head. */
export function segmentsFor(text, targetId, heads) {
  return String(text || '')
    .split(/(?=@[A-Za-z]+)/)
    .filter((seg) => {
      const m = seg.match(/^@([A-Za-z]+)/);
      return m && findHeadId(m[1], heads) === targetId;
    })
    .map((s) => s.trim());
}

/**
 * The replies in a clash turn: [{to, kind: 'agree' | 'disagree', text}].
 * "@Krodha (disagree): ..." is the asked-for form; an untagged reply counts as disagreement.
 */
export function parseReplies(text, selfId, heads) {
  const out = [];
  for (const seg of String(text || '').split(/(?=@[A-Za-z]+)/)) {
    const m = seg.match(/^@([A-Za-z]+)\s*(?:[([]\s*(agree|disagree|agrees|disagrees)\s*[)\]])?\s*[:,.-]?\s*([\s\S]*)$/i);
    if (!m) continue;
    const to = findHeadId(m[1], heads);
    if (!to || to === selfId) continue;
    const tag = (m[2] || '').toLowerCase();
    const body = m[3].trim();
    const kind = tag.startsWith('agree') ? 'agree' : tag.startsWith('disagree') ? 'disagree' : (/^(agreed|yes|right|exactly|you're right|you are right)\b/i.test(body) ? 'agree' : 'disagree');
    const prev = out.find((r) => r.to === to);
    if (prev) prev.text = `${prev.text} ${body}`.trim(); else out.push({ to, kind, text: body });
  }
  return out;
}
