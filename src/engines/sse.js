// Minimal Server-Sent Events reader for fetch() response bodies.
export async function* readSSE(body) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
      let event = 'message';
      const data = [];
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (data.length) yield { event, data: data.join('\n') };
    }
  }
}

export async function httpError(res, who) {
  let detail = '';
  try { detail = await res.text(); } catch { /* ignore */ }
  try { const j = JSON.parse(detail); detail = j.error?.message || j.message || detail; } catch { /* not json */ }
  return new Error(`${who} returned ${res.status}${detail ? `: ${String(detail).slice(0, 300)}` : ''}`);
}
