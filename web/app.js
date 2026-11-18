// Dashamukha viewer. Read-only: it follows council sessions that the CLI writes.
// The stage (stage.js) is the show and the report is the payload. What each head
// said is folded away at the bottom for the few who want it.
import { createStage } from './stage.js';
import { createSfx } from './sfx.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

const ALIASES = { moh: 'moha', maatsarya: 'matsarya', matsara: 'matsarya', ahankara: 'ahamkara', ahamkar: 'ahamkara', ghrna: 'ghrina', bhay: 'bhaya', budhi: 'buddhi', kaam: 'kama', krodh: 'krodha', lobh: 'lobha' };
const ROUNDS = {
  speak: ['I', 'Speak', 'Every head has its say'],
  clash: ['II', 'Clash', 'The heads turn on each other'],
  regrow: ['III', 'Regrow', 'Cut down, they grow back stronger'],
  verdict: ['IV', 'Verdict', 'Ravana weighs his ten heads'],
};

const S = {
  heads: [], ravana: null, byId: {},
  sessionId: null, es: null, events: [], session: null,
  phase: null, live: new Set(), texts: {}, spot: null, spotAt: 0, fired: new Set(), popped: new Set(),
  verdict: '', verdictLanded: false, transcript: null, ended: false,
  instant: false, replaying: false, connectAt: 0,
  sessions: [], board: {}, edges: [], pinned: null, cutIds: [], cutTimers: {},
};
let stage;
const sfx = createSfx();
// The demo recorder (scripts/record-demo.mjs) renders the soundtrack through this.
if (Array.isArray(window.__sfxLog)) window.__sfx = sfx;

/* ============================================================ Text helpers */
const plain = (s) => String(s || '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').trim();
const LABEL = /^[\s*_]*(point|stance)[\s*_]*[:\-–]\s*/i;
function pointOf(text) {
  const m = String(text || '').match(/^[\s*_]*point[\s*_]*[:\-–]\s*(.+)$/im);
  return m ? plain(m[1]).replace(/[.\s]+$/, '') : '';
}
function stanceOf(text) {
  const m = String(text || '').match(/^[\s*_]*stance[\s*_]*:\s*(.+)$/im);
  return m ? plain(m[1]) : '';
}
const bodyOf = (text) => String(text || '').split('\n').filter((l) => !LABEL.test(l)).join('\n').trim();
function firstSentence(s, max = 140) {
  const t = plain(s).replace(/\s+/g, ' ').trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let f = m ? m[0] : t;
  if (f.length > max) f = `${f.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
  return f;
}
const headline = (text) => pointOf(text) || firstSentence(bodyOf(text), 64);

function idOf(name) {
  const t = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  const id = ALIASES[t] || t;
  if (S.byId[id] && id !== 'ravana') return id;
  return S.heads.find((h) => (h.english || '').toLowerCase() === t)?.id || null;
}
/** Mirror of parseReplies in src/personas.js, for text that is still streaming. */
function repliesOf(text, selfId) {
  const out = [];
  for (const seg of String(text || '').split(/(?=@[A-Za-z]+)/)) {
    const m = seg.match(/^@([A-Za-z]+)\s*(?:[([]\s*(agree|disagree|agrees|disagrees)\s*[)\]])?\s*[:,.-]?\s*([\s\S]*)$/i);
    if (!m) continue;
    const to = idOf(m[1]);
    if (!to || to === selfId) continue;
    const tag = (m[2] || '').toLowerCase();
    const body = m[3].trim();
    const kind = tag.startsWith('agree') ? 'agree' : tag.startsWith('disagree') ? 'disagree' : (/^(agreed|yes|right|exactly|you're right|you are right)\b/i.test(body) ? 'agree' : 'disagree');
    const prev = out.find((r) => r.to === to);
    if (prev) prev.text = `${prev.text} ${body}`.trim(); else out.push({ to, kind, text: body, tagged: Boolean(tag) });
  }
  return out;
}

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/@([A-Za-z]+)/g, (m, name) => {
      const h = S.byId[idOf(name)];
      return h ? `<span class="mention" style="--tint:${h.tint}">@${esc(h.name)}</span>` : m;
    });
}
function md(text) {
  const out = [];
  let list = null;
  let para = [];
  const flushP = () => { if (para.length) out.push(`<p>${inline(para.join('<br>'))}</p>`); para = []; };
  const flushL = () => { if (list) out.push(`<${list.t}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.t}>`); list = null; };
  for (const raw of esc(String(text || '').trim()).split('\n')) {
    const line = raw.trim();
    let m;
    if (!line) { flushP(); flushL(); continue; }
    if ((m = line.match(/^[\s*_]*point[\s*_]*[:\-–]\s*(.*)$/i))) { flushP(); flushL(); out.push(`<p class="point-line">${inline(m[1].replace(/\*\*/g, ''))}</p>`); continue; }
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) { flushP(); flushL(); out.push(`<p><strong>${inline(m[1])}</strong></p>`); continue; }
    if ((m = line.match(/^[\s*_]*stance[\s*_]*:\s*(.*)$/i))) { flushP(); flushL(); out.push(`<span class="stance">${inline(m[1])}</span>`); continue; }
    if ((m = line.match(/^[-*•]\s+(.*)$/))) { flushP(); if (list?.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (list?.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if (/^\*\*[^*]+:\*\*/.test(line) || /^@\w+/.test(line)) { flushP(); flushL(); para.push(line); flushP(); continue; }
    flushL();
    para.push(line);
  }
  flushP(); flushL();
  return out.join('');
}

const ICON_AGREE = '<svg viewBox="0 0 12 12" aria-label="agrees"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_DISAGREE = '<svg viewBox="0 0 12 12" aria-label="disagrees"><path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const face = (id, px = 32, cls = 'face') => {
  const h = S.byId[id];
  return h ? `<img class="${cls}" src="${h.frames?.base || stage.portrait(id, 96)}" width="${px}" height="${px}" alt="" style="--tint:${h.tint}">` : '';
};

/* ============================================================ Verdict parsing */
function parseVerdict(text) {
  const sections = {};
  let cur = null;
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*\*\*([^*]+?)\*\*:?\s*(.*)$/);
    if (m) { cur = m[1].toLowerCase().replace(/:\s*$/, '').trim(); sections[cur] = m[2] ? [m[2]] : []; continue; }
    if (cur) sections[cur].push(line);
  }
  const get = (k) => { const key = Object.keys(sections).find((x) => x.startsWith(k)); return key ? sections[key].join('\n').trim() : ''; };
  const items = (s) => s.split('\n').map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  return { verdict: plain(get('verdict')), why: get('why'), agreed: items(get('where')), dissent: plain(get('strongest')), risks: items(get('risk')), steps: items(get('next')) };
}
const nameRe = (h) => new RegExp(`\\b${h.name}\\b`, 'gi');
/** How much Ravana leaned on each head: names in his reasoning count most. */
function influenceOf(v) {
  const w = {};
  const count = (s, k) => { for (const h of S.heads) { const n = (String(s).match(nameRe(h)) || []).length; if (n) w[h.id] = (w[h.id] || 0) + n * k; } };
  count(v.verdict, 3); count(v.why, 2); count(v.agreed.join(' '), 1); count(v.steps.join(' '), 1); count(v.risks.join(' '), 0.5);
  const dissent = S.heads.find((h) => nameRe(h).test(v.dissent))?.id || null;
  const max = Math.max(1, ...Object.values(w));
  for (const k of Object.keys(w)) w[k] /= max;
  return { w, dissent };
}

/* ============================================================ Stage text: as little as possible */
function bubbleHead() {
  const now = performance.now();
  if (S.pinned && now < S.pinned.until) return S.pinned.id;
  if (S.phase === 'verdict' || S.ended) return null;
  return S.spot;
}
let bubbleRaf = 0;
function renderBubble() {
  cancelAnimationFrame(bubbleRaf);
  bubbleRaf = requestAnimationFrame(() => {
    const b = $('#bubble');
    const id = bubbleHead();
    if (!id) { b.hidden = true; b.dataset.id = ''; return; }
    const h = S.byId[id];
    const pinned = S.pinned?.id === id && performance.now() < S.pinned.until;
    const round = pinned ? (S.texts[`regrow:${id}`] ? 'regrow' : 'speak') : S.phase;
    const text = S.texts[`${round}:${id}`] || '';
    let said = '';
    let kind = 'big';
    if (round === 'clash') {
      // Just who they went after. The fireballs and tethers tell the rest.
      const rs = repliesOf(text, id).filter((r) => r.tagged || r.text.length > 12);
      said = rs.map((r) => `<span class="b-to ${r.kind}">${r.kind === 'agree' ? ICON_AGREE : ICON_DISAGREE}${esc(S.byId[r.to].name)}</span>`).join(' ');
      kind = 'chips';
    } else {
      const p = pointOf(text);
      if (p) said = esc(p);
      else if (pinned && text) said = esc(headline(text));
    }
    if (S.board[id]?.err) { said = 'silent'; kind = ''; }
    if (!said) { said = '<span class="typing"><i></i><i></i><i></i></span>'; kind = ''; }
    b.style.setProperty('--tint', h.tint);
    b.className = `bubble ${kind}`;
    b.innerHTML = `<p class="b-who">${esc(h.name)}<span class="b-en">${esc(h.english)}</span></p><p class="b-said">${said}</p>`;
    b.dataset.id = id;
    b.hidden = false;
    placeBubble();
  });
}
function placeBubble() {
  const b = $('#bubble');
  if (b.hidden || !stage) return;
  const box = stage.headBox(b.dataset.id);
  if (!box) { b.hidden = true; return; }
  const bw = b.offsetWidth; const bh = b.offsetHeight;
  const x = clamp(box.x - bw / 2, 8, box.W - bw - 8);
  let y = box.top - bh - 6;
  // Phones: dock at the bottom of the stage, over the torso, so no head is covered.
  const docked = box.W < 720;
  const below = docked || y < 4;
  if (docked) y = box.H - bh - 10; else if (below) y = box.bottom + 26;
  b.classList.toggle('docked', docked);
  b.classList.toggle('below', below);
  b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  b.style.setProperty('--tx', `${Math.round(clamp(box.x - x, 16, bw - 16))}px`);
}

let titleT;
function titleCard(num, name, sub, ms = 1900) {
  if (S.instant) return;
  const c = $('#title-card');
  $('.tc-num', c).textContent = num;
  $('.tc-name', c).textContent = name;
  $('.tc-sub', c).textContent = sub;
  c.classList.remove('show');
  void c.offsetWidth;
  c.classList.add('show');
  clearTimeout(titleT);
  titleT = setTimeout(() => c.classList.remove('show'), ms);
  sfx.play('boom');
}

/** The one line under the body: progress during the debate, the verdict at the end. */
function renderStatus() {
  const done = (r) => S.heads.filter((h) => S.texts[`${r}:${h.id}`] && !S.live.has(h.id) && S.board[h.id]?.state !== 'thinking').length;
  const label = $('#seal-label');
  if (S.ended) label.textContent = S.verdict ? 'Ravana has decided' : S.transcript ? 'Ravana gave no verdict' : 'The council was interrupted';
  else if (S.phase === 'speak') label.textContent = `Speak · ${done('speak')} of 10 heads have spoken`;
  else if (S.phase === 'clash') label.textContent = `Clash · ${done('clash')} of 10 have struck`;
  else if (S.phase === 'regrow') label.textContent = `Regrow · ${S.cutIds.map((id) => S.byId[id].name).join(', ')} ${S.cutIds.length > 1 ? 'grow' : 'grows'} back`;
  else if (S.phase === 'verdict') label.textContent = 'Ravana is deciding';
  else label.textContent = 'Ravana is listening';
}

function renderVoice() {
  const v = $('#voice');
  const line = parseVerdict(S.verdict).verdict;
  // The verdict appears only once its sentence is complete, and lands with a stamp.
  const complete = line && (/\n/.test(S.verdict.slice(S.verdict.indexOf(line))) || S.ended || S.verdictLanded);
  if ((S.phase === 'verdict' || S.ended) && complete) {
    const first = !v.dataset.line;
    v.dataset.line = line;
    v.innerHTML = `<p class="who">Ravana<span class="dev">रावण</span></p><p class="said">${esc(line)}</p>`;
    if (first && !S.instant) { v.classList.remove('landed'); void v.offsetWidth; v.classList.add('landed'); }
    return;
  }
  if (S.phase === 'verdict') { v.innerHTML = '<p class="voice-idle">Ravana is weighing his ten heads…</p>'; return; }
  if (!S.ended) v.innerHTML = '';
}

/* ============================================================ Report */
let reportRaf = 0;
function renderReport() {
  cancelAnimationFrame(reportRaf);
  reportRaf = requestAnimationFrame(() => {
    const v = parseVerdict(S.verdict);
    $('#report').hidden = false;
    if (!v.verdict) {
      // Not in the expected shape: show it as it is.
      $('#r-verdict').textContent = '';
      $('#r-raw').hidden = false;
      $('#r-raw').innerHTML = md(S.verdict);
      return;
    }
    $('#r-raw').hidden = true;
    $('#r-verdict').textContent = v.verdict;
    const { w, dissent } = influenceOf(v);
    stage.influence(w, dissent);
    const ranked = S.heads.map((h) => h.id).sort((a, b) => (w[b] || 0) - (w[a] || 0));
    const top = ranked.filter((id) => w[id] > 0).slice(0, 3);
    $('#r-sway').hidden = !top.length;
    $('#r-sway').innerHTML = `<div class="r-faces">${ranked.map((id) => {
      const k = w[id] || 0;
      return `<span class="r-face${k || dissent === id ? '' : ' quiet'}${dissent === id ? ' dissent' : ''}" style="--k:${k.toFixed(2)}" title="${esc(S.byId[id].name)}">${face(id, 64)}</span>`;
    }).join('')}</div><p class="r-sway-text">${top.length ? `<b>${top.map((id) => esc(S.byId[id].name)).join(', ')}</b> swayed Ravana most` : ''}${dissent ? ` · <span class="r-red">${esc(S.byId[dissent].name)}</span> dissented` : ''}</p>`;
    $('#r-steps').hidden = !v.steps.length;
    $('#r-steps-list').innerHTML = v.steps.slice(0, 3).map((s) => `<li>${inline(esc(s))}</li>`).join('');
    $('#r-risks').hidden = !v.risks.length;
    $('#r-risks-list').innerHTML = v.risks.slice(0, 4).map((s) => `<li>${inline(esc(s))}</li>`).join('');
    $('#r-dissent').hidden = !v.dissent;
    $('#r-dissent-text').innerHTML = `${dissent ? face(dissent, 40) : ''}<span>${inline(esc(v.dissent))}</span>`;
    $('#r-why').hidden = !v.why;
    $('#r-why-body').innerHTML = md(v.why) + (v.agreed.length ? `<p class="r-label">Where the heads agreed</p><ul>${v.agreed.map((s) => `<li>${inline(esc(s))}</li>`).join('')}</ul>` : '');
  });
}

/* ============================================================ The folded debate */
const board = (id) => (S.board[id] ||= { point: '', stance: '', oldPoint: '', regrown: false, cut: false, err: '', state: '', hitBy: new Set(), agreedBy: new Set() });
function tile(id) {
  let el = $(`#board .tile[data-id="${id}"]`);
  if (!el) {
    el = document.createElement('article');
    el.className = 'tile';
    el.dataset.id = id;
    el.style.setProperty('--tint', S.byId[id].tint);
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    $('#board').appendChild(el);
    const order = S.heads.map((x) => x.id);
    [...$('#board').children].sort((a, b) => order.indexOf(a.dataset.id) - order.indexOf(b.dataset.id)).forEach((n) => $('#board').appendChild(n));
  }
  return el;
}
const pendingTiles = new Set();
function renderTile(id) {
  if (pendingTiles.has(id)) return;
  pendingTiles.add(id);
  requestAnimationFrame(() => {
    pendingTiles.delete(id);
    const b = S.board[id];
    const h = S.byId[id];
    if (!b || !h) return;
    const el = tile(id);
    const open = el.classList.contains('open');
    const more = open ? ['speak', 'clash', 'regrow'].filter((r) => S.texts[`${r}:${id}`]).map((r) => `<div class="t-round"><p class="t-label">${ROUNDS[r][0]} · ${ROUNDS[r][1]}</p>${md(S.texts[`${r}:${id}`])}</div>`).join('') : '';
    el.className = `tile${open ? ' open' : ''}${b.err ? ' err' : ''}`;
    el.setAttribute('aria-expanded', String(open));
    el.innerHTML = `
      <div class="t-top">${face(id, 34)}<div class="t-name"><b>${esc(h.name)}</b><span>${esc(h.english)}</span></div>${b.regrown ? '<span class="t-badge">↺ grew back</span>' : ''}</div>
      ${b.oldPoint ? `<p class="t-old">${esc(b.oldPoint)}</p>` : ''}
      <p class="t-point">${b.err ? `<span class="err-text">silent: ${esc(b.err)}</span>` : esc(b.point)}</p>
      <div class="t-meta">${b.hitBy.size ? `<span class="m-dis" title="Disagreed with by ${esc([...b.hitBy].map((x) => S.byId[x].name).join(', '))}">✕ ${b.hitBy.size}</span>` : ''}${b.agreedBy.size ? `<span class="m-agr" title="Agreed with by ${esc([...b.agreedBy].map((x) => S.byId[x].name).join(', '))}">✓ ${b.agreedBy.size}</span>` : ''}<span class="t-more">${open ? 'Less' : 'More'}</span></div>
      ${open ? `${b.stance ? `<p class="t-stance">${esc(b.stance)}</p>` : ''}<div class="t-full">${more}</div>` : ''}`;
  });
}
function addEdges(from, replies) {
  for (const r of replies) {
    if (S.edges.some((e) => e.from === from && e.to === r.to)) continue;
    S.edges.push({ from, ...r });
    (r.kind === 'agree' ? board(r.to).agreedBy : board(r.to).hitBy).add(from);
    renderTile(r.to);
    const li = document.createElement('li');
    li.className = `edge ${r.kind}`;
    li.innerHTML = `<span class="e-who">${face(from, 24)}<b>${esc(S.byId[from].name)}</b><span class="e-arrow">${r.kind === 'agree' ? '✓' : '✕'}</span>${face(r.to, 24)}<b>${esc(S.byId[r.to].name)}</b></span><q>${esc(firstSentence(r.text, 160))}</q>`;
    $('#edges').appendChild(li);
    $('#clash-sec').hidden = false;
  }
}
function roundSection(round) {
  let sec = $(`#feed [data-round="${round}"]`);
  if (!sec) {
    const [num, name, desc] = ROUNDS[round];
    sec = document.createElement('section');
    sec.dataset.round = round;
    sec.innerHTML = `<div class="round-title"><h3><i>${num}</i>${name}</h3><p>${desc}.</p></div><div class="cards"></div>`;
    $('#feed').appendChild(sec);
  }
  return $('.cards', sec);
}
function card(round, id) {
  let el = $(`#feed .msg[data-key="${round}:${id}"]`);
  if (!el) {
    const h = S.byId[id];
    const e = S.session?.engines?.[id];
    const tag = e ? `${e.engine}${e.model ? ` · ${e.model}` : ''}` : '';
    el = document.createElement('article');
    el.className = 'msg';
    el.dataset.key = `${round}:${id}`;
    el.style.setProperty('--tint', h.tint);
    el.innerHTML = `<div class="msg-head">${face(id, 30)}<div><b>${esc(h.name)}</b> <span class="sub">${esc(h.english)}</span></div>${tag ? `<span class="model">${esc(tag)}</span>` : ''}</div><div class="msg-body"></div>`;
    roundSection(round).appendChild(el);
  }
  return el;
}
// The transcript is folded away: only build it once it is final or opened.
function renderCard(key) {
  const [r, id] = key.split(':');
  if (!$('#full').open && !$('#argued').open) return;
  $('.msg-body', card(r, id)).innerHTML = md(S.texts[key]);
}
function renderAllCards() {
  for (const r of ['speak', 'clash', 'regrow']) for (const h of S.heads) { const k = `${r}:${h.id}`; if (S.texts[k]) $('.msg-body', card(r, h.id)).innerHTML = md(S.texts[k]); }
}

/* ============================================================ Events */
function setSpot(id, force = false) {
  const now = performance.now();
  if (!force && S.spot && S.spot !== id && S.live.has(S.spot) && now - S.spotAt < 1700) return;
  if (S.spot !== id) { S.spot = id; S.spotAt = now; stage.setSpot(id); }
  renderBubble();
}

function setPhase(name) {
  S.phase = name;
  const order = ['speak', 'clash', 'regrow', 'verdict'];
  const idx = order.indexOf(name);
  for (const li of $$('#rail li')) {
    const i = order.indexOf(li.dataset.phase);
    li.classList.toggle('active', i === idx);
    if (i < idx && !li.classList.contains('done')) li.classList.add(li.dataset.seen ? 'done' : 'skipped');
    if (i === idx) li.dataset.seen = '1';
  }
  $('#theatre').classList.toggle('is-verdict', name === 'verdict');
  S.live.clear();
  S.spot = null;
  stage.setSpot(null);
  stage.phase(name);
  for (const h of S.heads) { stage.setState(h.id, null); if (S.board[h.id] && !S.board[h.id].err) S.board[h.id].state = ''; }
  if (ROUNDS[name]) titleCard(...ROUNDS[name]);
  renderBubble();
  renderVoice();
  renderStatus();
}

function handle(type, d) {
  stage.instant = S.instant;
  switch (type) {
    case 'session': {
      S.session = d;
      const q = $('#question');
      q.textContent = d.problem;
      q.classList.remove('open');
      q.classList.toggle('long', d.problem.length > 120);
      if (d.problem.length > 120) { q.tabIndex = 0; q.title = 'Show the whole question'; } else { q.removeAttribute('tabindex'); q.removeAttribute('title'); }
      $('#start').hidden = true;
      const counts = {};
      for (const [id, e] of Object.entries(d.engines || {})) if (id !== 'ravana') { const k = `${e.engine}${e.model ? ` · ${e.model}` : ''}`; counts[k] = (counts[k] || 0) + 1; }
      const rv = d.engines?.ravana;
      const parts = Object.entries(counts).map(([k, n]) => `<span><b>${esc(k)}</b> × ${n}</span>`);
      if (rv) parts.push(`<span>Ravana on <b>${esc(rv.engine)}${rv.model ? ` · ${esc(rv.model)}` : ''}</b></span>`);
      if (d.cwd) parts.push(`<span>reading <code>${esc(d.cwd.replace(/^\/(Users|home)\/[^/]+/, '~'))}</code></span>`);
      $('#meta').innerHTML = parts.join('');
      $('#a-faces').innerHTML = S.heads.map((h) => face(h.id, 22)).join('');
      setEyebrow();
      break;
    }
    case 'phase':
      if (d.name === 'regrow') S.cutIds = d.ids || [];
      setPhase(d.name);
      if (d.name === 'regrow') {
        (d.ids || []).forEach((id, i) => {
          board(id).cut = true;
          // Let the title card clear before the blades fall.
          if (S.instant) stage.cut(id); else S.cutTimers[id] = setTimeout(() => { delete S.cutTimers[id]; stage.instant = false; stage.cut(id); }, 1100 + i * 260);
        });
      }
      break;
    case 'head:start': {
      S.texts[`${d.round}:${d.id}`] = '';
      const b = board(d.id);
      if (d.round === 'regrow') { b.cut = false; b.regrown = true; b.oldPoint = b.point; b.point = ''; b.stance = ''; if (S.instant) stage.regrow(d.id); }
      b.state = 'thinking';
      b.err = '';
      stage.setState(d.id, 'thinking');
      if (!S.spot || !S.live.has(S.spot)) setSpot(d.id, true);
      renderStatus();
      break;
    }
    case 'head:delta': {
      const key = `${d.round}:${d.id}`;
      S.texts[key] = (S.texts[key] || '') + d.text;
      const b = board(d.id);
      if (!S.live.has(d.id)) {
        S.live.add(d.id);
        if (d.round === 'regrow') regrowNow(d.id);
        stage.setState(d.id, 'speaking');
        b.state = 'speaking';
      }
      stage.talk(d.id, d.text.length);
      if (d.round === 'clash') {
        // Fire as soon as the reply's tag (or a few words) has arrived.
        for (const r of repliesOf(S.texts[key], d.id)) {
          const k = `clash:${d.id}>${r.to}`;
          if (S.fired.has(k) || (!r.tagged && r.text.length < 12)) continue;
          S.fired.add(k);
          stage.aim(d.id, r.to);
          stage.attack(d.id, r.to, r.kind);
        }
      } else {
        const p = pointOf(S.texts[key]);
        if (p && /\n/.test(S.texts[key]) && !S.popped.has(key)) { S.popped.add(key); b.point = p; if (!S.instant) sfx.play('pop'); }
      }
      setSpot(d.id);
      if (!S.instant && S.spot === d.id) renderBubble();
      break;
    }
    case 'head:done': {
      const key = `${d.round}:${d.id}`;
      if (d.round === 'regrow' && !S.live.has(d.id)) regrowNow(d.id);
      S.texts[key] = d.text;
      S.live.delete(d.id);
      stage.setState(d.id, 'done');
      stage.aim(d.id, null);
      const b = board(d.id);
      b.state = '';
      if (d.round === 'clash') {
        const replies = d.replies || repliesOf(d.text, d.id);
        for (const r of replies) {
          const k = `clash:${d.id}>${r.to}`;
          if (!S.fired.has(k)) { S.fired.add(k); stage.attack(d.id, r.to, r.kind); }
        }
        addEdges(d.id, replies);
      } else {
        b.point = headline(d.text);
        b.stance = stanceOf(d.text);
      }
      renderTile(d.id);
      renderCard(key);
      if (S.spot === d.id) { const next = [...S.live][0]; if (next) setSpot(next, true); else renderBubble(); }
      renderStatus();
      break;
    }
    case 'head:error': {
      // Whatever streamed before the error is not the head's answer.
      delete S.texts[`${d.round}:${d.id}`];
      S.live.delete(d.id);
      stage.setState(d.id, 'error');
      const b = board(d.id);
      b.err = d.message; b.state = 'error';
      renderTile(d.id);
      renderStatus();
      break;
    }
    case 'verdict:start':
      stage.verdictStart();
      renderVoice();
      break;
    case 'verdict:delta':
      S.verdict += d.text;
      stage.talk('ravana', d.text.length);
      if (!S.instant) { renderVoice(); renderReport(); }
      break;
    case 'verdict:done':
      S.verdict = d.text;
      S.verdictLanded = true;
      stage.verdictLand();
      renderVoice();
      renderReport();
      break;
    case 'verdict:error':
      S.verdict = '';
      $('#voice').innerHTML = '';
      $('#report').hidden = false;
      $('#r-sway').hidden = true; $('#r-steps').hidden = true; $('#r-risks').hidden = true; $('#r-dissent').hidden = true; $('#r-why').hidden = true;
      $('#r-verdict').textContent = 'Ravana could not reach a verdict.';
      $('#r-raw').hidden = false;
      $('#r-raw').innerHTML = `<p class="err-text">${esc(d.message)}</p>`;
      break;
    case 'end':
      S.ended = true;
      S.transcript = d.transcript || null;
      for (const li of $$('#rail li.active')) { li.classList.remove('active'); li.classList.add('done'); }
      $('#theatre').classList.remove('live', 'is-verdict');
      stage.end(d.ok && Boolean(S.verdict));
      S.phase = 'ended';
      S.live.clear();
      S.spot = null;
      if (!d.ok) { toast(d.error, true); $('#voice').innerHTML = `<p class="voice-idle">${esc(d.error)}</p>`; } else renderVoice();
      renderBubble();
      renderStatus();
      $('#replay').hidden = false;
      $('#argued').hidden = !Object.keys(S.board).length;
      if (S.verdict) renderReport();
      setEyebrow();
      if (!S.instant && d.ok) setTimeout(() => $('#report').scrollIntoView({ behavior: 'smooth', block: 'start' }), 3200);
      break;
  }
}

// A cut head grows back the moment it starts to speak. If its cut is still
// waiting on the title card, cut it now and let it fall before it regrows.
function regrowNow(id) {
  if (S.instant) { stage.regrow(id); return; }
  if (S.cutTimers[id]) {
    clearTimeout(S.cutTimers[id]);
    delete S.cutTimers[id];
    stage.cut(id);
    setTimeout(() => { stage.instant = false; stage.regrow(id); }, 650);
    return;
  }
  stage.regrow(id);
}

function setEyebrow() {
  const e = $('#eyebrow');
  if (!S.session) { e.textContent = 'Ten heads. One decision.'; return; }
  const when = new Date(S.session.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  e.innerHTML = S.ended ? `Council of ${esc(when)}` : '<span class="live-dot"></span>The council is in session';
}

/* ============================================================ Sessions */
function resetStage() {
  S.events = [];
  for (const t of Object.values(S.cutTimers)) clearTimeout(t);
  Object.assign(S, { cutTimers: {}, phase: null, texts: {}, spot: null, fired: new Set(), popped: new Set(), verdict: '', verdictLanded: false, transcript: null, ended: false, session: null, board: {}, edges: [], pinned: null, cutIds: [] });
  S.live.clear();
  stage.reset();
  for (const id of ['#feed', '#board', '#edges', '#r-verdict', '#r-sway', '#r-steps-list', '#r-risks-list', '#r-dissent-text', '#r-why-body', '#r-raw', '#a-faces']) $(id).innerHTML = '';
  for (const id of ['#report', '#replay', '#argued', '#clash-sec', '#bubble']) $(id).hidden = true;
  $('#argued').open = false;
  $('#full').open = false;
  delete $('#voice').dataset.line;
  $('#voice').classList.remove('landed');
  $('#voice').innerHTML = '<p class="voice-idle">The heads are gathering…</p>';
  $('#theatre').classList.remove('is-verdict');
  $('#theatre').classList.add('live');
  $('#seal-label').textContent = 'Ravana is listening';
  for (const li of $$('#rail li')) { li.className = ''; delete li.dataset.seen; }
}

function open(id) {
  if (S.es) S.es.close();
  resetStage();
  S.sessionId = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
  $('#sessions').value = id;
  S.connectAt = Date.now();
  S.instant = true;
  connect(id);
}

// Every connection streams the session from its first event, so after a
// reconnect (viewer restart, laptop sleep) skip what has already been applied.
function connect(id) {
  const es = new EventSource(`api/sessions/${encodeURIComponent(id)}/events`);
  S.es = es;
  let flushT;
  let idx = 0;
  es.onopen = () => { idx = 0; };
  es.onmessage = (m) => {
    if (S.es !== es) return;
    if (idx++ < S.events.length) return;
    const ev = JSON.parse(m.data);
    S.events.push(ev);
    // Events written before we connected are history: apply them without animation.
    S.instant = ev.t < S.connectAt - 1500;
    handle(ev.type, ev.data);
    clearTimeout(flushT);
    flushT = setTimeout(() => { S.instant = false; }, 50);
    if (ev.type === 'end') es.close();
  };
  es.onerror = () => {
    if (S.ended) { es.close(); return; }
    // A closed stream (404, viewer gone) is not retried by the browser: do it ourselves.
    if (es.readyState === EventSource.CLOSED) setTimeout(() => { if (S.es === es && S.sessionId === id && !S.ended) connect(id); }, 2000);
  };
}

async function replay() {
  if (S.replaying || !S.events.length) return;
  const events = S.events.slice();
  if (S.es) S.es.close();
  S.replaying = true;
  resetStage();
  S.events = events;
  S.instant = false;
  $('#theatre').scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(700);
  for (let i = 0; i < events.length; i++) {
    if (!S.replaying) return;
    const gap = i ? events[i].t - events[i - 1].t : 0;
    const ev = events[i];
    // Keep the beats that matter (a new round, a strike), squeeze the token stream.
    const pause = ev.type === 'phase' ? 2100 : ev.type.endsWith(':delta') ? Math.min(gap, 50) * 0.6 : Math.min(gap, 700) * 0.6;
    if (pause > 0) await sleep(pause);
    handle(ev.type, ev.data);
  }
  S.replaying = false;
}

async function refreshSessions(autoSwitch) {
  try {
    const list = await (await fetch('api/sessions')).json();
    S.sessions = list;
    const sel = $('#sessions');
    const fmt = (s) => `${s.status === 'live' ? '● ' : s.status === 'stopped' ? '✕ ' : ''}${s.problem.length > 64 ? `${s.problem.slice(0, 62)}…` : s.problem}`;
    sel.innerHTML = list.length ? list.map((s) => `<option value="${esc(s.id)}">${esc(fmt(s))}</option>`).join('') : '<option value="">No councils yet</option>';
    if (S.sessionId) sel.value = S.sessionId;
    const newest = list[0];
    if (autoSwitch && newest && newest.id !== S.sessionId && newest.status === 'live' && (S.ended || !S.sessionId) && !S.replaying) open(newest.id);
    if (!list.length) { $('#start').hidden = false; $('#theatre').classList.remove('live'); }
  } catch { /* viewer restarting */ }
}

/* ============================================================ Misc */
let toastT;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 2400);
}

function markdown() {
  const t = S.transcript;
  if (!t) return '';
  const out = ['# Dashamukha council', '', `> ${t.problem}`, ''];
  if (t.verdict) out.push("## Ravana's verdict", '', t.verdict, '');
  for (const [round, [num, name]] of Object.entries(ROUNDS)) {
    const entries = t.rounds[round] || {};
    const hs = S.heads.filter((h) => entries[h.id]);
    if (!hs.length) continue;
    out.push(`## ${num} · ${name}`, '');
    for (const h of hs) out.push(`### ${h.name} · ${h.english}`, '', entries[h.id].text, '');
  }
  return out.join('\n');
}

function setSound(on) {
  sfx.set(on);
  store.set('dashamukha.sound', on ? '1' : '0');
  $('#sound').setAttribute('aria-pressed', String(on));
  $('#sound').classList.toggle('on', on);
}

async function boot() {
  const data = await (await fetch('api/heads')).json();
  S.heads = data.heads;
  S.ravana = data.ravana;
  S.byId = Object.fromEntries([...data.heads, data.ravana].map((h) => [h.id, h]));
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  stage = createStage($('#stage'), S.heads, {
    reducedMotion,
    ravanaFrames: data.ravana?.frames,
    onFrame: placeBubble,
    onSfx: (name, pan, v) => sfx.play(name, pan, v),
    onHeadClick: (id) => { S.pinned = { id, until: performance.now() + 4000 }; sfx.play('pop'); renderBubble(); setTimeout(renderBubble, 4100); },
  });

  // Browsers only allow audio after a click, so the saved choice waits for one.
  if (store.get('dashamukha.sound') === '1') { $('#sound').classList.add('on'); window.addEventListener('pointerdown', () => setSound(true), { once: true }); }
  $('#sound').addEventListener('click', (e) => { e.stopPropagation(); setSound(!sfx.on); if (sfx.on) sfx.play('chime'); });
  $('#sessions').addEventListener('change', (e) => { S.replaying = false; if (e.target.value) open(e.target.value); });
  $('#replay').addEventListener('click', replay);
  const expand = () => { const q = $('#question'); if (q.classList.contains('long')) { q.classList.add('open'); q.removeAttribute('title'); } };
  $('#question').addEventListener('click', expand);
  $('#question').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); } });
  const toggleTile = (el) => { el.classList.toggle('open'); renderTile(el.dataset.id); };
  $('#board').addEventListener('click', (e) => { const el = e.target.closest('.tile'); if (el) toggleTile(el); });
  $('#board').addEventListener('keydown', (e) => { const el = e.target.closest('.tile'); if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleTile(el); } });
  $('#full').addEventListener('toggle', () => { if ($('#full').open) renderAllCards(); });
  $('#copy-md').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(markdown()); toast('Copied as markdown.'); } catch { toast('The browser blocked the copy.', true); }
  });
  $('#download-md').addEventListener('click', () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' })), download: `dashamukha-${S.sessionId}.md` });
    a.click();
  });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== S.sessionId) open(id); });

  await refreshSessions(false);
  const wanted = location.hash.slice(1) || S.sessions[0]?.id;
  if (wanted) open(wanted);
  else { $('#theatre').classList.remove('live'); $('#voice').innerHTML = '<p class="voice-idle">The council is assembled.</p>'; }
  setInterval(() => refreshSessions(true), 2500);
}

boot();
