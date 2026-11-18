// Scripted "demo" heads. No model, no keys: used by `--demo`, the in-browser
// preview and the tests. The lines are generic so they fit any problem.

const SPEAK = {
  kama: (p) => `Point: Chase the outcome you crave\nStrip the question down. You are not really asking about "${p}". You are asking for the feeling on the other side of it: momentum, pride, freedom. Name the outcome you would brag about six months from now, then judge this choice only by whether it moves you toward that.\nStance: Do it only if it serves the outcome you secretly want most.`,
  krodha: (p) => `Point: Define done before you start\nThe biggest flaw is that nobody has defined what "done" looks like. "${p}" is a wish, not a plan. Without a deadline, an owner and a way to know you failed, this will drift for months and quietly eat your best hours.\nStance: Refuse to start until success and failure are written down.`,
  moha: (p) => `Point: Re-decide from zero\nNotice how attached you already are to one answer. You are leaning toward it because it is familiar, or because you have already sunk time into it, not because it is right. What would you decide about "${p}" if you were walking in fresh today?\nStance: Re-decide from zero; the past investment is not an argument.`,
  lobha: (p) => `Point: Take the compounding path\nThink bigger about the payoff. If "${p}" works, what does it unlock next, and can that compound? A choice that pays once is weak; one that pays every month, or turns into an asset others pay for, is worth ten times the effort.\nStance: Pick the path with compounding upside, even if it costs more now.`,
  mada: (p) => `Point: Go all in, publicly\nTimid people will turn "${p}" into a committee exercise. The bold move is obvious if you are honest about your strengths: commit, set a sharp date, and make it public so you cannot back out. Half-measures here would be the real failure.\nStance: Go all in, visibly, with a deadline.`,
  ahamkara: (p) => `Point: Own it end to end\nAsk who you become if you say yes to "${p}". Does it fit the person or team you are trying to be in five years, or is it someone else's ambition? Whatever you choose, one name must own it end to end.\nStance: Choose what you will still be proud to own in five years.`,
  matsarya: (p) => `Point: Steal what works, differ once\nOthers have already walked this road. Somebody near you has tried something like "${p}"; study what they got right, copy it shamelessly, then pick the one thing you can do that they structurally cannot.\nStance: Steal the proven parts; differentiate on one sharp edge.`,
  ghrina: (p) => `Point: Ship the smallest clean version\nWhat disgusts me is the busywork hiding inside "${p}": extra steps, meetings, features nobody asked for. Users hate friction more than they love features. If any part of this makes someone wait, click twice or read a manual, cut it.\nStance: Ship the smallest clean version and delete the rest.`,
  bhaya: (p) => `Point: Cheap, reversible first step\nWhat frightens me is the irreversible part of "${p}". Money, reputation and trust are hard to win back. Before committing, find the cheapest test that would reveal the worst case early, and decide in advance what result makes you stop.\nStance: Proceed only behind a cheap, reversible first step.`,
  buddhi: (p) => `Point: Two-week experiment decides it\nLet us separate facts from feelings. Three assumptions decide "${p}": that the need is real, that you can deliver it, and that the cost is acceptable. Each can be tested in under two weeks with a small experiment and one number to watch.\nStance: Run the two-week experiment, then decide on evidence.`,
};

const PAIRS = {
  kama: ['bhaya'], krodha: ['mada', 'kama'], moha: ['lobha'], lobha: ['bhaya', 'ghrina'], mada: ['bhaya'],
  ahamkara: ['matsarya'], matsarya: ['mada'], ghrina: ['lobha'], bhaya: ['mada', 'lobha'], buddhi: ['krodha', 'kama'],
};

const CLASH_LINES = {
  kama: { bhaya: 'Your fear is reasonable, but if you only act when it feels safe, you will never get what you actually want. Make it reversible, then move.' },
  krodha: { mada: 'Pride without a plan is just noise. "Go all in" is how people burn a year.', kama: 'Wanting something badly is not evidence. Write the definition of done first.' },
  moha: { lobha: 'You are attached to the fantasy of compounding. Most things do not compound; prove this one does before chasing it.' },
  lobha: { bhaya: 'Every upside has risk. Price it and move on instead of freezing.', ghrina: 'Cutting everything also cuts the revenue. Keep the parts people would pay for.' },
  mada: { bhaya: 'A cheap test is fine, but do not let it become an excuse to never commit. Set the date anyway.' },
  ahamkara: { matsarya: 'Copying rivals is how you lose yourself. Learn from them, but the decision must still sound like us.' },
  matsarya: { mada: 'Bold is cheap. The people who already won here were bold AND early. Check whether you are late before going all in.' },
  ghrina: { lobha: 'Chasing ten times more is exactly how this turns into a bloated mess nobody wants to use.' },
  bhaya: { mada: 'Going public before a single test is how you get humiliated. Commit privately first.', lobha: 'Compounding works in both directions; so do compounding mistakes.' },
  buddhi: { krodha: 'Agreed that "done" must be defined, but anger does not define it. One metric and a date will.', kama: 'Desire tells us what to measure. Let us turn your "brag-worthy outcome" into a number.' },
};

const REGROW = {
  kama: 'Point: Desire is the fuel; aim it\nYou cut me down, so I grow back sharper: desire is not a feeling to ignore, it is the only reliable fuel for finishing. Keep the reversible first step Bhaya wants, but point it straight at the outcome you crave.',
  krodha: 'Point: Still no definition of done\nCut me down and I return angrier and more precise: the plan still has no definition of done. One sentence, one metric, one date. Until those exist, every other head is just talking.',
  moha: 'Point: Argue the opposite first\nI grow back with a simpler point: notice who is defending the old way, including yourself, and ask them to argue the opposite for five minutes.',
  lobha: 'Point: Small, but make it compound\nFine, I grow back humbler but still hungry: start small, but choose the small step that can still become an asset. Small and compounding beats small and disposable.',
  mada: 'Point: Courage on a schedule\nI grow back with my pride intact but my plan tighter: run Buddhi\'s two-week test, privately, and the day it passes, commit publicly and fully. Courage on a schedule.',
  ahamkara: 'Point: Own the decision in your words\nI return clearer: whatever you take from rivals, own the decision in your own words. If you cannot explain why it is yours, it is not ready.',
  matsarya: 'Point: Learn why the others failed\nI grow back with homework: list three people who tried this. If all three failed, find out why before you become the fourth.',
  ghrina: 'Point: Scalpel, not axe\nCut me down and I return with a scalpel instead of an axe: keep what people would pay for, delete everything that only exists to look impressive.',
  bhaya: 'Point: Fear is a checklist, not a stop\nI grow back braver: the fear is not a stop sign, it is a checklist. Write the worst case, buy cheap insurance against it, then go.',
  buddhi: 'Point: One metric, one kill rule\nI return with the method: one hypothesis, one metric, a two-week window and a pre-agreed kill rule. That settles the argument better than any of us can.',
};

function short(problem) {
  const p = String(problem || 'this').replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '');
  return p.length > 64 ? `${p.slice(0, 61).trim()}...` : p;
}

export function demoText({ head, round, problem, transcript }) {
  const p = short(problem);
  if (round === 'speak') return (SPEAK[head.id] || SPEAK.buddhi)(p);
  if (round === 'clash') {
    const targets = (PAIRS[head.id] || []).filter((id) => !transcript || transcript.rounds.speak[id]);
    const agrees = { buddhi: ['krodha', 'kama'] };
    return targets.map((id) => `@${id[0].toUpperCase()}${id.slice(1)} (${agrees[head.id]?.includes(id) ? 'agree' : 'disagree'}): ${CLASH_LINES[head.id]?.[id] || 'I disagree, and here is why.'}`).join('\n\n') || 'I have nothing to add; the council is right.';
  }
  if (round === 'regrow') return REGROW[head.id] || REGROW.buddhi;
  return [
    `**Verdict:** Go ahead with "${p}", but only through a small, reversible two-week experiment with one metric and a kill rule agreed in advance.`,
    `**Why:** Buddhi's experiment answers Krodha's demand for a definition of done and calms Bhaya's fear of irreversible loss, while keeping Kama's real goal in view. Mada's boldness is kept, but on a schedule.`,
    `**Where the heads agreed:**\n- Define success and failure before starting\n- Keep the first step cheap and reversible\n- One person owns it end to end`,
    `**Strongest dissent:** Lobha argues a small test may hide the compounding upside. Fair: choose a test that can grow into the real thing.`,
    `**Risks to watch:**\n- The experiment quietly becomes the whole project\n- Sunk-cost attachment after week one (Moha)`,
    `**Next three steps:**\n1. Write one sentence for done, one metric and a date\n2. Run the two-week test, privately\n3. Review the number and either commit publicly or kill it`,
  ].join('\n');
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/** A model-call function compatible with runCouncil that streams scripted text. */
export function makeDemoCall({ delay = 26, jitter = 1 } = {}) {
  return async ({ head, round, problem, transcript, onDelta, signal }) => {
    const text = demoText({ head, round, problem, transcript });
    await sleep(250 + Math.random() * 900 * jitter, signal);
    const chunks = text.match(/\S+\s*/g) || [];
    for (const c of chunks) {
      await sleep(delay + Math.random() * delay * jitter, signal);
      onDelta?.(c);
    }
    return text;
  };
}
